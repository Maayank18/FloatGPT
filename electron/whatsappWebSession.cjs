/**
 * FloatGPT — WhatsApp Web session (main process)
 *
 * One persistent Chromium window for web.whatsapp.com. Messages are sent by
 * focusing the composer and clicking the DOM Send button (plus a Chromium
 * Enter event). No OS SendKeys, no extra browser tabs.
 */

const { BrowserWindow, clipboard } = require('electron');

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

const SEND_INJECT = `async (payload) => {
  const phone = String(payload.phone || '').replace(/\\D/g, '');
  const text = String(payload.text || '');
  if (!phone || !text) return { ok: false, error: 'Missing phone or text' };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const queryComposer = () =>
    document.querySelector('#main footer [contenteditable="true"]') ||
    document.querySelector('footer [contenteditable="true"][role="textbox"]') ||
    document.querySelector('#main [contenteditable="true"][data-tab]') ||
    document.querySelector('div[contenteditable="true"][data-tab="10"]');

  const querySend = () => {
    const labeled = document.querySelector(
      'button[aria-label="Send"], button[aria-label="Send message"], button[aria-label="send"]'
    );
    if (labeled && !labeled.disabled) return labeled;
    const icon =
      document.querySelector('#main footer span[data-icon="send"]') ||
      document.querySelector('#main footer span[data-icon="wds-ic-send-filled"]') ||
      document.querySelector('span[data-icon="send"]') ||
      document.querySelector('span[data-icon="wds-ic-send-filled"]') ||
      document.querySelector('span[data-icon="send-light"]');
    const btn = icon ? icon.closest('button') || icon.parentElement : null;
    return btn && !btn.disabled ? btn : labeled || btn;
  };

  const fireClick = (el) => {
    if (!el) return;
    try {
      const r = el.getBoundingClientRect();
      const x = r.left + Math.min(r.width / 2, 12);
      const y = r.top + Math.min(r.height / 2, 12);
      const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 };
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
    } catch {}
    try { if (typeof el.click === 'function') el.click(); } catch {}
  };

  const isLoggedIn = () =>
    !!(
      document.querySelector('#pane-side') ||
      document.querySelector('#side') ||
      document.querySelector('#app .two') ||
      document.querySelector('[data-icon="chat"]')
    );

  const isQr = () =>
    !!(
      document.querySelector('canvas[aria-label]') ||
      document.querySelector('div[data-ref]') ||
      document.querySelector('div[data-testid="qrcode"]')
    );

  const waitFor = async (fn, timeoutMs, label) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const value = fn();
      if (value) return value;
      await sleep(200);
    }
    throw new Error('Timeout waiting for ' + label);
  };

  if (isQr() && !isLoggedIn()) {
    return { ok: false, error: 'QR_REQUIRED', qr: true };
  }

  const invalid = Array.from(document.querySelectorAll('div, span')).some((n) =>
    /phone number shared via url is invalid|invalid phone/i.test(n.textContent || '')
  );
  if (invalid) return { ok: false, error: 'Invalid WhatsApp number: ' + phone };

  const composer = await waitFor(queryComposer, 40000, 'chat composer');
  composer.focus();
  composer.click();
  await sleep(120);

  document.execCommand('selectAll', false, null);
  const inserted = document.execCommand('insertText', false, text);
  if (!inserted) {
    composer.textContent = text;
    composer.dispatchEvent(
      new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text })
    );
  }
  composer.dispatchEvent(new Event('input', { bubbles: true }));
  composer.dispatchEvent(new Event('change', { bubbles: true }));

  const leftoverNow = () => (queryComposer()?.innerText || '').trim();

  let sendBtn = null;
  const waitSendStart = Date.now();
  while (Date.now() - waitSendStart < 8000) {
    sendBtn = querySend();
    const drafted = leftoverNow();
    if (sendBtn && drafted) break;
    await sleep(150);
  }

  let sendX = 0;
  let sendY = 0;
  if (sendBtn) {
    const box = sendBtn.getBoundingClientRect();
    sendX = box.left + box.width / 2;
    sendY = box.top + box.height / 2;
    fireClick(sendBtn);
    await sleep(250);
    fireClick(sendBtn);
  }

  const waitEmptyStart = Date.now();
  while (Date.now() - waitEmptyStart < 2500) {
    const leftover = leftoverNow();
    if (!leftover || leftover !== text) {
      return { ok: true, leftover, clickedSend: !!sendBtn, sendX, sendY };
    }
    await sleep(150);
  }

  return { ok: false, leftover: leftoverNow(), clickedSend: !!sendBtn, sendX, sendY };
}`;

let waWindow = null;
let sendChain = Promise.resolve();

function chromeSessionWindow() {
  return new BrowserWindow({
    width: 1100,
    height: 780,
    show: false,
    title: 'FloatGPT WhatsApp',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      partition: 'persist:floatgpt-whatsapp',
      backgroundThrottling: false
    }
  });
}

function attachWindow(win) {
  waWindow = win;
  win.setMenuBarVisibility(false);
  win.webContents.setUserAgent(CHROME_UA);
  try { win.webContents.setBackgroundThrottling(false); } catch {}
  win.on('closed', () => {
    if (waWindow === win) waWindow = null;
  });
}

async function ensureWindow(showForLogin) {
  if (waWindow && !waWindow.isDestroyed()) {
    if (showForLogin) {
      waWindow.show();
      waWindow.focus();
    }
    return waWindow;
  }

  const win = chromeSessionWindow();
  attachWindow(win);
  await win.loadURL('https://web.whatsapp.com/', { userAgent: CHROME_UA });
  if (showForLogin) {
    win.show();
    win.focus();
  }
  return win;
}

async function readStatus() {
  if (!waWindow || waWindow.isDestroyed()) {
    return { ready: false, loggedIn: false, qr: false, open: false };
  }
  try {
    const snap = await waWindow.webContents.executeJavaScript(
      `({
        loggedIn: !!(document.querySelector('#pane-side') || document.querySelector('#side') || document.querySelector('#main')),
        qr: !!(document.querySelector('canvas[aria-label]') || document.querySelector('div[data-ref]')),
        href: location.href
      })`,
      true
    );
    return { ready: true, open: true, ...snap };
  } catch {
    return { ready: false, loggedIn: false, qr: false, open: true };
  }
}

async function waitForComposer(win, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const snap = await win.webContents.executeJavaScript(
        `({
          composer: !!(
            document.querySelector('#main footer [contenteditable="true"]') ||
            document.querySelector('footer [contenteditable="true"][role="textbox"]') ||
            document.querySelector('#main [contenteditable="true"][data-tab]')
          ),
          qr: !!(document.querySelector('canvas[aria-label]') || document.querySelector('div[data-ref]')),
          loggedIn: !!(document.querySelector('#pane-side') || document.querySelector('#side') || document.querySelector('#main'))
        })`,
        true
      );
      if (snap?.qr && !snap?.composer && !snap?.loggedIn) return { qr: true };
      if (snap?.composer) return { ok: true };
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return { error: 'timeout' };
}

async function openChat(win, phone) {
  const url =
    'https://web.whatsapp.com/send/?phone=' +
    encodeURIComponent(phone) +
    '&type=phone_number&app_absent=0';
  const current = win.webContents.getURL() || '';
  if (current.includes('phone=' + phone) || current.includes('phone=' + encodeURIComponent(phone))) {
    return waitForComposer(win, 20000);
  }
  await win.loadURL(url, { userAgent: CHROME_UA });
  return waitForComposer(win, 45000);
}

function pressEnter(win) {
  try {
    win.webContents.focus();
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
    win.webContents.sendInputEvent({ type: 'char', keyCode: 'Return' });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
  } catch {}
}

function clickDip(win, x, y) {
  if (!x || !y) return;
  const ix = Math.max(2, Math.round(x));
  const iy = Math.max(2, Math.round(y));
  try {
    win.webContents.focus();
    win.webContents.sendInputEvent({ type: 'mouseMove', x: ix, y: iy });
    win.webContents.sendInputEvent({ type: 'mouseDown', x: ix, y: iy, button: 'left', clickCount: 1 });
    win.webContents.sendInputEvent({ type: 'mouseUp', x: ix, y: iy, button: 'left', clickCount: 1 });
  } catch {}
}

function pasteViaCtrlV(win) {
  try {
    win.webContents.focus();
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Control' });
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['control'] });
    win.webContents.sendInputEvent({ type: 'char', keyCode: 'v', modifiers: ['control'] });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'V', modifiers: ['control'] });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Control' });
  } catch {}
}

async function sendMessage(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  const body = String(text || '');
  if (!digits || !body) return { success: false, error: 'Missing phone or text' };

  const run = async () => {
    const win = await ensureWindow(true);
    await new Promise((r) => setTimeout(r, 280));

    let status = await readStatus();
    if (status.qr && !status.loggedIn) {
      win.show();
      win.focus();
      return { success: false, error: 'QR_REQUIRED', qr: true };
    }

    const opened = await openChat(win, digits);
    if (opened?.qr) {
      win.show();
      win.focus();
      return { success: false, error: 'QR_REQUIRED', qr: true };
    }
    if (opened?.error) {
      status = await readStatus();
      if (status.qr) {
        win.show();
        win.focus();
        return { success: false, error: 'QR_REQUIRED', qr: true };
      }
      return { success: false, error: 'WhatsApp chat did not open. Scan QR in Settings → Messaging if needed.' };
    }

    try {
      await win.webContents.executeJavaScript(
        `(() => {
          const el = document.querySelector('#main footer [contenteditable="true"]')
            || document.querySelector('footer [contenteditable="true"][role="textbox"]');
          if (!el) return false;
          el.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('delete', false, null);
          return true;
        })()`,
        true
      );
    } catch {}

    const previousClip = clipboard.readText();
    try {
      clipboard.writeText(body);
      pasteViaCtrlV(win);
      await new Promise((r) => setTimeout(r, 350));
    } finally {
      try { clipboard.writeText(previousClip); } catch {}
    }

    const result = await win.webContents.executeJavaScript(
      `(${SEND_INJECT})(${JSON.stringify({ phone: digits, text: body })})`,
      true
    );

    if (result?.qr || result?.error === 'QR_REQUIRED') {
      win.show();
      win.focus();
      return { success: false, error: 'QR_REQUIRED', qr: true };
    }

    if (result?.sendX && result?.sendY) {
      clickDip(win, result.sendX, result.sendY);
      await new Promise((r) => setTimeout(r, 180));
    }
    pressEnter(win);
    await new Promise((r) => setTimeout(r, 500));

    if (result?.ok) return { success: true };

    const leftover = await win.webContents.executeJavaScript(
      `(document.querySelector('#main footer [contenteditable="true"]')||document.querySelector('footer [contenteditable="true"][role="textbox"]')||{innerText:''}).innerText`,
      true
    ).catch(() => '');
    const leftoverText = String(leftover || '').trim();
    if (!leftoverText || leftoverText !== body.trim()) {
      return { success: true };
    }

    return { success: false, error: result?.error || 'WhatsApp composer still has the draft — Send was not confirmed.' };
  };

  sendChain = sendChain.then(run, run);
  return sendChain;
}

async function openSession() {
  const win = await ensureWindow(true);
  win.show();
  win.focus();
  return readStatus();
}

function closeSession() {
  if (waWindow && !waWindow.isDestroyed()) {
    waWindow.close();
  }
  waWindow = null;
  return { closed: true };
}

module.exports = {
  sendMessage,
  readStatus,
  openSession,
  closeSession,
  ensureWindow
};
