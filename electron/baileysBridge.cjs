/**
 * Personal WhatsApp link. One QR scan is saved on this PC and reused.
 * The socket lives in the Electron main process. A failure here leaves the
 * older WhatsApp window path working.
 */

const fs = require('fs');
const path = require('path');
const { assessNotice, roomKind } = require('./waImportance.cjs');

const RECENT_LIMIT = 40;
let sessionDir = '';
let notify = () => {};
let generation = 0;
let sock = null;
let opening = null;
let reconnects = 0;
let reconnectTimer = null;
let stopping = false;
let qrDataUrl = '';
let connection = 'idle';
let lastError = '';
const recent = [];
const sentMessages = new Map();
const titles = new Map();
const people = new Map();

function init(options) {
  sessionDir = options?.sessionDir || sessionDir;
  if (typeof options?.notify === 'function') notify = options.notify;
}

function saved() {
  try {
    return !!(sessionDir && fs.existsSync(path.join(sessionDir, 'creds.json')));
  } catch {
    return false;
  }
}

function snapshot(latest) {
  const ordered = [...recent].sort((a, b) => Number(b.important) - Number(a.important) || b.at - a.at);
  return {
    ok: true,
    linked: connection === 'open',
    saved: saved(),
    connecting: connection === 'connecting',
    qrDataUrl: qrDataUrl || '',
    error: lastError,
    recent: ordered.slice(0, 30),
    latest: latest || null,
    contacts: [...people.values()].slice(0, 200)
  };
}

function emit(latest) {
  try {
    notify(snapshot(latest));
  } catch {}
}

function clearReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

async function loadLibrary() {
  const baileys = await import('@whiskeysockets/baileys');
  const pinoMod = await import('pino');
  const qrMod = await import('qrcode');
  return {
    makeWASocket: baileys.default,
    DisconnectReason: baileys.DisconnectReason,
    useMultiFileAuthState: baileys.useMultiFileAuthState,
    Browsers: baileys.Browsers,
    logger: pinoMod.default({ level: 'silent' }),
    toDataURL: (qrMod.default && qrMod.default.toDataURL) || qrMod.toDataURL
  };
}

function sameChat(row, jid) {
  if (!row || !jid) return false;
  return row.jid === jid || bareJid(row.jid) === bareJid(jid);
}

/** A reply or a read on the phone clears that chat, so the bell does not keep a finished conversation. */
function clearAnswered(jid, at) {
  if (!jid || jid === 'status@broadcast' || String(jid).endsWith('@broadcast')) return false;
  const waiting = recent.filter((row) => sameChat(row, jid));
  if (!waiting.length) return false;
  const newest = Math.max(...waiting.map((row) => Number(row.at) || 0));
  if (at && at + 5000 < newest) return false;
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    if (sameChat(recent[index], jid)) recent.splice(index, 1);
  }
  return true;
}

function remember(notice) {
  if (!notice) return;
  const row = { ...notice, id: notice.id || `${notice.jid}:${notice.at}` };
  const existing = recent.findIndex((item) => item.id === row.id);
  if (existing >= 0) recent.splice(existing, 1);
  recent.unshift(row);
  if (recent.length > RECENT_LIMIT) recent.length = RECENT_LIMIT;
  return row;
}

function textOf(message) {
  const body = message?.message || {};
  return body.conversation
    || body.extendedTextMessage?.text
    || body.imageMessage?.caption
    || body.videoMessage?.caption
    || '';
}

function bareJid(jid) {
  return String(jid || '').split('@')[0].split(':')[0];
}

function usableTitle(value) {
  const name = String(value || '').replace(/\s+/g, ' ').trim();
  if (!name || /^120363\d{6,}$/.test(name) || /^\d{12,}$/.test(name)) return '';
  return name.slice(0, 80);
}

function rememberPerson(contact) {
  const id = String(contact?.id || '');
  if (!id || id.endsWith('@g.us') || id.endsWith('@newsletter') || id.endsWith('@broadcast')) return;
  const name = usableTitle(contact?.name || contact?.notify || contact?.verifiedName);
  if (!name) return;
  let phone = '';
  if (id.endsWith('@s.whatsapp.net')) phone = bareJid(id);
  if (!phone) phone = String(contact?.phoneNumber || '').replace(/\D/g, '');
  people.set(name.toLowerCase(), { name, phone });
}

function rememberTitle(jid, name) {
  const clean = usableTitle(name);
  if (!jid || !clean) return false;
  titles.set(String(jid), clean);
  titles.set(bareJid(jid), clean);
  return true;
}

function applyTitle(jid, name) {
  const clean = usableTitle(name);
  if (!clean) return false;
  let changed = false;
  for (const row of recent) {
    if (row.jid === jid || bareJid(row.jid) === bareJid(jid)) {
      if (row.from !== clean) {
        row.from = clean;
        changed = true;
      }
    }
  }
  return changed;
}

function chatJid(message) {
  const key = message?.key || {};
  const remote = String(key.remoteJid || '');
  const alt = String(key.remoteJidAlt || '');
  if (remote.endsWith('@g.us') || remote.endsWith('@newsletter')) return remote;
  if (alt.endsWith('@g.us') || alt.endsWith('@newsletter')) return alt;
  if (/^120363\d{6,}$/.test(bareJid(remote))) return `${bareJid(remote)}@g.us`;
  return remote || alt;
}

function cachedTitle(jid) {
  return titles.get(String(jid)) || titles.get(bareJid(jid)) || '';
}

function newsletterName(meta) {
  if (!meta || typeof meta !== 'object') return '';
  const thread = meta.thread_metadata && typeof meta.thread_metadata === 'object' ? meta.thread_metadata : null;
  const named = thread?.name?.text || meta.name?.text || (typeof meta.name === 'string' ? meta.name : '');
  return usableTitle(named);
}

async function lookupRoomTitle(socket, jid) {
  const known = cachedTitle(jid);
  if (known) return known;
  const id = bareJid(jid);
  const tries = [];
  if (jid.endsWith('@newsletter')) tries.push(['channel', jid]);
  else if (jid.endsWith('@g.us')) tries.push(['group', jid], ['channel', `${id}@newsletter`]);
  else if (/^120363\d{6,}$/.test(id)) tries.push(['group', `${id}@g.us`], ['channel', `${id}@newsletter`]);
  for (const [kind, target] of tries) {
    try {
      if (kind === 'group' && typeof socket.groupMetadata === 'function') {
        const meta = await socket.groupMetadata(target);
        const subject = usableTitle(meta?.subject);
        if (subject) {
          rememberTitle(jid, subject);
          rememberTitle(target, subject);
          return subject;
        }
      }
      if (kind === 'channel' && typeof socket.newsletterMetadata === 'function') {
        const meta = await socket.newsletterMetadata('jid', target);
        const name = newsletterName(meta);
        if (name) {
          rememberTitle(jid, name);
          rememberTitle(target, name);
          return name;
        }
      }
    } catch {}
  }
  return '';
}

function noteTitles(rows, pick) {
  let changed = false;
  for (const row of rows || []) {
    const name = pick(row);
    const id = row?.id;
    if (!rememberTitle(id, name)) continue;
    if (applyTitle(id, name)) changed = true;
  }
  if (changed) emit();
}

async function ingestNotice(socket, message, gen) {
  try {
    if (gen !== generation || message?.key?.fromMe) return;
    const jid = chatJid(message);
    if (!jid || jid === 'status@broadcast' || jid.endsWith('@broadcast')) return;
    const kind = roomKind(jid);
    let name = cachedTitle(jid);
    if (!name && kind) name = await lookupRoomTitle(socket, jid);
    if (!name && !kind) {
      name = usableTitle(message?.pushName);
      if (name) rememberTitle(jid, name);
    }
    if (gen !== generation) return;
    const row = remember(assessNotice({
      jid,
      fromMe: false,
      id: message?.key?.id,
      pushName: name,
      text: textOf(message),
      at: Number(message?.messageTimestamp || 0) * 1000 || Date.now()
    }));
    if (row) emit(row);
  } catch {}
}

async function closeSocket() {
  const current = sock;
  sock = null;
  if (!current) return;
  try {
    current.end(undefined);
  } catch {}
}

function scheduleReconnect(gen) {
  if (stopping || gen !== generation) return;
  if (reconnects >= 6) {
    connection = 'idle';
    lastError = 'WhatsApp disconnected. Open Messaging and link it again.';
    emit();
    return;
  }
  const wait = Math.min(30000, 1000 * (2 ** reconnects));
  reconnects += 1;
  clearReconnect();
  reconnectTimer = setTimeout(() => {
    if (gen !== generation || stopping) return;
    openSocket().catch(() => {});
  }, wait);
}

async function openSocket() {
  if (!sessionDir) {
    lastError = 'WhatsApp link storage is not ready.';
    emit();
    return snapshot();
  }
  if (opening) return opening;
  opening = openSocketInner().finally(() => {
    opening = null;
  });
  return opening;
}

async function openSocketInner() {
  const gen = ++generation;
  clearReconnect();
  await closeSocket();
  connection = 'connecting';
  lastError = '';
  emit();

  let lib;
  try {
    lib = await loadLibrary();
    fs.mkdirSync(sessionDir, { recursive: true });
  } catch (err) {
    connection = 'idle';
    lastError = 'The WhatsApp link could not start. The WhatsApp window still works.';
    emit();
    return snapshot();
  }
  if (gen !== generation) return snapshot();

  try {
    const { state, saveCreds } = await lib.useMultiFileAuthState(sessionDir);
    const browser = process.platform === 'darwin' ? lib.Browsers.macOS('Desktop') : lib.Browsers.windows('Desktop');
    const socket = lib.makeWASocket({
      auth: state,
      logger: lib.logger,
      browser,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      getMessage: async (key) => sentMessages.get(key?.id) || undefined
    });
    if (gen !== generation) {
      try { socket.end(undefined); } catch {}
      return snapshot();
    }
    sock = socket;

    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('groups.upsert', (groups) => noteTitles(groups, (group) => group?.subject));
    socket.ev.on('groups.update', (groups) => noteTitles(groups, (group) => group?.subject));
    socket.ev.on('chats.upsert', (chats) => {
      for (const chat of chats || []) rememberPerson(chat);
      noteTitles(chats, (chat) => chat?.name || chat?.subject);
    });
    socket.ev.on('chats.update', (chats) => {
      let cleared = false;
      for (const chat of chats || []) {
        rememberPerson(chat);
        if (chat && Number(chat.unreadCount) === 0 && clearAnswered(chat.id, Date.now())) cleared = true;
      }
      noteTitles(chats, (chat) => chat?.name || chat?.subject);
      if (cleared) emit();
    });
    socket.ev.on('contacts.upsert', (contacts) => {
      for (const contact of contacts || []) rememberPerson(contact);
      noteTitles(contacts, (contact) => contact?.name || contact?.notify || contact?.verifiedName);
    });
    socket.ev.on('contacts.update', (contacts) => {
      for (const contact of contacts || []) rememberPerson(contact);
      noteTitles(contacts, (contact) => contact?.name || contact?.notify || contact?.verifiedName);
    });
    socket.ev.on('connection.update', async (update) => {
      if (gen !== generation) return;
      try {
        if (update.qr) {
          qrDataUrl = await lib.toDataURL(update.qr, { margin: 1, width: 220 });
          connection = 'qr';
          emit();
        }
        if (update.connection === 'open') {
          connection = 'open';
          qrDataUrl = '';
          lastError = '';
          reconnects = 0;
          emit();
        }
        if (update.connection === 'close') {
          const code = update.lastDisconnect?.error?.output?.statusCode;
          qrDataUrl = '';
          sock = null;
          if (code === lib.DisconnectReason.loggedOut) {
            connection = 'idle';
            lastError = 'WhatsApp removed this link. Scan the code again.';
            try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
            emit();
            return;
          }
          if (stopping) return;
          connection = 'connecting';
          emit();
          if (code === lib.DisconnectReason.restartRequired) {
            openSocket().catch(() => {});
            return;
          }
          scheduleReconnect(gen);
        }
      } catch {
        lastError = 'WhatsApp link hit a connection error.';
        emit();
      }
    });

    socket.ev.on('messages.upsert', (event) => {
      if (gen !== generation) return;
      let cleared = false;
      for (const message of event.messages || []) {
        if (message?.key?.fromMe) {
          const at = Number(message?.messageTimestamp || 0) * 1000 || Date.now();
          if (clearAnswered(chatJid(message), at)) cleared = true;
          continue;
        }
        if (event?.type !== 'notify') continue;
        void ingestNotice(socket, message, gen);
      }
      if (cleared) emit(null);
    });
  } catch {
    connection = 'idle';
    lastError = 'WhatsApp link did not open. The WhatsApp window still works.';
    emit();
  }
  return snapshot();
}

async function link() {
  stopping = false;
  reconnects = 0;
  return openSocket();
}

async function resumeIfSaved() {
  if (!saved() || stopping) return snapshot();
  return openSocket();
}

async function unlink() {
  stopping = true;
  generation += 1;
  clearReconnect();
  const current = sock;
  sock = null;
  connection = 'idle';
  qrDataUrl = '';
  lastError = '';
  recent.length = 0;
  try {
    if (current) await current.logout();
  } catch {}
  try {
    current?.end(undefined);
  } catch {}
  try {
    if (sessionDir) fs.rmSync(sessionDir, { recursive: true, force: true });
  } catch {}
  stopping = false;
  emit();
  return snapshot();
}

async function sendText(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  const body = String(text || '').trim();
  if (!digits || !body) return { success: false, linked: connection === 'open', error: 'Missing phone or message text.' };
  if (connection !== 'open' || !sock) return { success: false, linked: false };
  try {
    let dest = `${digits}@s.whatsapp.net`;
    try {
      const rows = await sock.onWhatsApp(dest);
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row && row.exists === false) {
        return { success: false, linked: true, error: 'That number is not on WhatsApp.' };
      }
      if (row?.jid) dest = row.jid;
    } catch {}
    const sent = await sock.sendMessage(dest, { text: body.slice(0, 4000) });
    if (clearAnswered(dest, Date.now())) emit(null);
    if (sent?.key?.id && sent.message) sentMessages.set(sent.key.id, sent.message);
    if (sentMessages.size > 100) {
      const first = sentMessages.keys().next().value;
      sentMessages.delete(first);
    }
    return { success: true, linked: true };
  } catch (err) {
    return { success: false, linked: true, error: err?.message || 'WhatsApp did not send that message.' };
  }
}

module.exports = { init, link, resumeIfSaved, unlink, sendText, status: () => snapshot() };
