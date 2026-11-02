/** Local rules for a new WhatsApp message. Status updates stay out. */

const KEYWORDS = ['urgent', 'asap', 'deadline', 'payment', 'otp', 'important', 'emergency'];

function localId(jid) {
  return String(jid || '').split('@')[0].split(':')[0];
}

function roomKind(jid) {
  if (String(jid).endsWith('@newsletter')) return 'channel';
  if (String(jid).endsWith('@g.us') || /^120363\d{6,}$/.test(localId(jid))) return 'group';
  return '';
}

function displayFrom(jid, pushName) {
  const local = localId(jid);
  const given = String(pushName || '').replace(/\s+/g, ' ').trim();
  const usable = given && given !== local && !/^120363\d{6,}$/.test(given);
  if (usable) return given.slice(0, 80);
  const room = roomKind(jid);
  if (room === 'channel') return 'WhatsApp channel';
  if (room === 'group') return 'WhatsApp group';
  if (/^\d{8,15}$/.test(local)) return local;
  return 'WhatsApp';
}

function assessNotice(input) {
  const jid = String(input?.jid || '');
  const text = String(input?.text || '').replace(/\s+/g, ' ').trim();
  if (!jid || input?.fromMe) return null;
  if (jid === 'status@broadcast' || jid.endsWith('@broadcast')) return null;
  if (!text) return null;
  const lower = text.toLowerCase();
  return {
    id: String(input.id || ''),
    from: displayFrom(jid, input.pushName),
    jid,
    text: text.slice(0, 500),
    at: Number(input.at) || Date.now(),
    important: KEYWORDS.some((word) => lower.includes(word))
  };
}

module.exports = { assessNotice, KEYWORDS, displayFrom, roomKind };
