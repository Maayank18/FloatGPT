/**
 * FloatGPT — Desktop Glance (main process)
 *
 * On-demand context: hide Orb windows, read the restored foreground app,
 * optionally list Explorer/Desktop items, optionally capture pixels.
 * No background screen streaming.
 */

const { BrowserWindow, desktopCapturer, screen } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SENSITIVE =
  /password|bank login|otp|incognito|inprivate|1password|bitwarden|lastpass|keeper|dashlane|paytm|phonepe|upi pin|credit card/i;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function runFile(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(String(stdout || '').trim());
      }
    );
  });
}

function writeTemp(name, body) {
  const file = path.join(os.tmpdir(), name);
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

function parseJson(raw, fallback) {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end < start) return fallback;
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return fallback;
  }
}

function isFloatProcess(fg) {
  const p = String(fg.process || '').toLowerCase();
  const t = String(fg.title || '').toLowerCase();
  const a = String(fg.app || '').toLowerCase();
  // Cursor/VS Code/Chrome titles often contain the project name "FloatGPT".
  // Those are the screen behind the orb, not the orb.
  if (/\bcursor\b|\bcode\b|chrome|msedge|firefox/.test(p)) return false;
  if (/\b(cursor|visual studio code|google chrome|youtube)\b/.test(t)) return false;
  if (t === 'floatgpt studio' || t === 'floatgpt' || a === 'floatgpt studio' || a === 'floatgpt') return true;
  if ((p === 'electron' || p === 'floatgpt') && /floatgpt studio|^floatgpt$/.test(t)) return true;
  if (/\bfloatgpt studio\b/.test(t) && !/\bcursor\b/.test(t)) return true;
  return false;
}

function inferHost(title) {
  const t = String(title || '');
  const lower = t.toLowerCase();
  const map = [
    [/(\bx\.com\b|\btwitter\b|\b\/ x\b)/, 'x.com'],
    [/\byoutube\b/, 'youtube.com'],
    [/\bgithub\b/, 'github.com'],
    [/\blinkedin\b/, 'linkedin.com'],
    [/\breddit\b/, 'reddit.com'],
    [/\bgmail\b/, 'mail.google.com'],
    [/\bwhatsapp\b/, 'web.whatsapp.com'],
    [/\bstackoverflow\b/, 'stackoverflow.com'],
    [/\bchatgpt\b|\bopenai\b/, 'chatgpt.com'],
  ];
  for (const [re, host] of map) {
    if (re.test(lower)) return host;
  }
  const url = t.match(/https?:\/\/([^/\s]+)/i);
  if (url) return url[1].replace(/^www\./, '');
  return null;
}

function listLocalDir(dir) {
  try {
    if (!dir || !fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true }).slice(0, 48);
    return {
      path: dir,
      items: entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)),
    };
  } catch {
    return null;
  }
}

async function getForegroundWindows() {
  const script = writeTemp(
    'floatgpt-fg.ps1',
    `if (-not ('FgWin' -as [type])) {
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class FgWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder str, int nMaxCount);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
}
"@
}
$hwnd = [FgWin]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 1024
[void][FgWin]::GetWindowText($hwnd, $sb, $sb.Capacity)
$pidOut = [uint32]0
[void][FgWin]::GetWindowThreadProcessId($hwnd, [ref]$pidOut)
$proc = Get-Process -Id $pidOut -ErrorAction SilentlyContinue
$app = $null
try { $app = $proc.MainModule.FileVersionInfo.FileDescription } catch {}
@{
  hwnd = [int64]$hwnd
  title = $sb.ToString()
  pid = [int64]$pidOut
  process = $proc.ProcessName
  app = $app
} | ConvertTo-Json -Compress
`
  );
  const raw = await runFile(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
    8000
  );
  return parseJson(raw, { title: '', process: '', app: '', hwnd: 0, pid: 0 });
}

async function getExplorerFolder(hwnd) {
  const script = writeTemp(
    'floatgpt-explorer.ps1',
    `param([int64]$TargetHwnd)
$shell = New-Object -ComObject Shell.Application
foreach ($w in @($shell.Windows())) {
  try {
    if ([int64]$w.HWND -eq $TargetHwnd) {
      $names = New-Object System.Collections.Generic.List[string]
      foreach ($i in @($w.Document.Folder.Items())) {
        $names.Add($i.Name) | Out-Null
        if ($names.Count -ge 48) { break }
      }
      @{ path = [string]$w.Document.Folder.Self.Path; items = $names } | ConvertTo-Json -Compress
      exit 0
    }
  } catch {}
}
'{}'
`
  );
  const raw = await runFile(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-TargetHwnd', String(hwnd || 0)],
    8000
  );
  const parsed = parseJson(raw, null);
  if (parsed && parsed.path) return parsed;
  return null;
}

async function getForegroundMac() {
  const raw = await runFile(
    'osascript',
    [
      '-e',
      'tell application "System Events" to tell (first application process whose frontmost is true)\nset n to name\nset t to ""\ntry\nset t to name of front window\nend try\nreturn n & "|||" & t\nend tell',
    ],
    5000
  );
  const [app, title] = String(raw).split('|||');
  return {
    hwnd: 0,
    pid: 0,
    process: (app || '').trim(),
    app: (app || '').trim(),
    title: (title || '').trim(),
  };
}

async function getFinderFolder() {
  try {
    const raw = await runFile(
      'osascript',
      [
        '-e',
        'tell application "Finder"\nif (count of Finder windows) > 0 then\nreturn POSIX path of (target of front Finder window as alias)\nelse\nreturn POSIX path of (path to desktop folder)\nend if\nend tell',
      ],
      5000
    );
    return listLocalDir(raw.replace(/\r?\n/g, '').trim());
  } catch {
    return listLocalDir(path.join(os.homedir(), 'Desktop'));
  }
}

function ownWindowIds() {
  const hwnds = new Set();
  const pids = new Set([process.pid]);
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try {
      const buf = win.getNativeWindowHandle();
      if (buf && buf.length >= 8) hwnds.add(Number(buf.readBigUInt64LE(0)));
      else if (buf && buf.length >= 4) hwnds.add(buf.readUInt32LE(0));
    } catch {}
    try {
      pids.add(win.webContents.getOSProcessId());
    } catch {}
  }
  return { hwnds, pids };
}

const SKIP_CLASS = /^(progman|workerw|shell_traywnd|shell_secondarytraywnd)$/i;
const SKIP_TITLE = /^(program manager|windows input experience|microsoft text input application|floatgpt|floatgpt studio)$/i;
const SKIP_PROCESS = /^(searchhost|textinputhost|startmenuexperiencehost|lockapp|shellexperiencehost|applicationframehost)$/i;

function windowArea(w) {
  return Math.max(0, Number(w.width) || 0) * Math.max(0, Number(w.height) || 0);
}

function isSmallOverlay(w) {
  const title = String(w.title || '');
  if (/picture[\s-]*in[\s-]*picture|mini\s*player|\bwidget\b/i.test(title)) return true;
  const area = windowArea(w);
  return area > 0 && area < 320 * 220;
}

function isUsableWindow(w, own) {
  const title = String(w.title || '').trim();
  const hwnd = Number(w.hwnd || 0);
  const pid = Number(w.pid || 0);
  if (!title) return false;
  if (own.hwnds.has(hwnd) || own.pids.has(pid)) return false;
  if (isFloatProcess(w)) return false;
  if (SKIP_CLASS.test(String(w.className || ''))) return false;
  if (SKIP_TITLE.test(title)) return false;
  if (SKIP_PROCESS.test(String(w.process || ''))) return false;
  return true;
}

function isEditorWindow(w) {
  const processName = String(w.process || '').toLowerCase();
  const appName = String(w.app || '').toLowerCase();
  const title = String(w.title || '').toLowerCase();
  if (processName === 'cursor' || processName === 'code') return true;
  if (appName.includes('cursor') || appName.includes('visual studio code')) return true;
  if (/\s[-–—]\s cursor\b/.test(title) || title.endsWith('cursor')) return true;
  return false;
}

/** Largest real window is the default. A visible Cursor/VS Code window is the app the user is in. */
function pickMainWindow(windows, own) {
  const rows = (windows || []).filter((w) => isUsableWindow(w, own));
  const mains = rows.filter((w) => !isSmallOverlay(w));
  const pool = (mains.length ? mains : rows).slice().sort((a, b) => windowArea(b) - windowArea(a));
  const overlays = rows.filter(isSmallOverlay);
  const largest = pool[0] || null;
  const editor = pool.filter(isEditorWindow).sort((a, b) => windowArea(b) - windowArea(a))[0] || null;
  let primary = largest;
  if (editor && largest && windowArea(editor) >= windowArea(largest) * 0.3) {
    primary = editor;
  } else if (editor && !largest) {
    primary = editor;
  }
  const rest = pool.filter((w) => w !== primary);
  const orderedTitles = [
    ...[primary, ...rest].filter(Boolean).map((w) => String(w.title || '').trim()),
    ...overlays.map((w) => `${String(w.title || '').trim()} (small overlay, not the main app)`),
  ].filter(Boolean).slice(0, 8);
  return { primary, overlays, orderedTitles };
}

/** Top-to-bottom visible windows, so we can see what sits under the always-on-top orb. */
async function listZOrderWindows() {
  const script = writeTemp(
    'floatgpt-zorder.ps1',
    `if (-not ('ZOrderWin' -as [type])) {
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public struct ZRect { public int Left; public int Top; public int Right; public int Bottom; }
public class ZOrderWin {
  [DllImport("user32.dll")] public static extern IntPtr GetTopWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder str, int nMaxCount);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder str, int nMaxCount);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out ZRect rect);
}
"@
}
$hwnd = [ZOrderWin]::GetTopWindow([IntPtr]::Zero)
$list = New-Object System.Collections.Generic.List[object]
while ($hwnd -ne [IntPtr]::Zero -and $list.Count -lt 48) {
  if ([ZOrderWin]::IsWindowVisible($hwnd)) {
    $title = New-Object System.Text.StringBuilder 512
    $cls = New-Object System.Text.StringBuilder 256
    [void][ZOrderWin]::GetWindowText($hwnd, $title, $title.Capacity)
    [void][ZOrderWin]::GetClassName($hwnd, $cls, $cls.Capacity)
    $pidOut = [uint32]0
    [void][ZOrderWin]::GetWindowThreadProcessId($hwnd, [ref]$pidOut)
    $proc = Get-Process -Id $pidOut -ErrorAction SilentlyContinue
    $app = $null
    try { $app = $proc.MainModule.FileVersionInfo.FileDescription } catch {}
    $rect = New-Object ZRect
    [void][ZOrderWin]::GetWindowRect($hwnd, [ref]$rect)
    $list.Add([pscustomobject]@{
      hwnd = [int64]$hwnd
      title = $title.ToString()
      className = $cls.ToString()
      pid = [int64]$pidOut
      process = $proc.ProcessName
      app = $app
      width = [Math]::Max(0, $rect.Right - $rect.Left)
      height = [Math]::Max(0, $rect.Bottom - $rect.Top)
    }) | Out-Null
  }
  $hwnd = [ZOrderWin]::GetWindow($hwnd, 2)
}
@{ windows = $list } | ConvertTo-Json -Compress -Depth 4
`
  );
  const raw = await runFile(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
    8000
  );
  const parsed = parseJson(raw, { windows: [] });
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.windows)) return parsed.windows;
  if (parsed.windows && typeof parsed.windows === 'object') return [parsed.windows];
  return [];
}

function sourceIsSelf(source) {
  const name = String(source?.name || '').trim();
  if (!name) return false;
  if (/\b(cursor|visual studio code|google chrome|youtube|mozilla firefox)\b/i.test(name)) return false;
  return /floatgpt studio/i.test(name) || /^floatgpt$/i.test(name);
}

async function capturePixels() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const w = Math.min(1280, Math.round(display.size.width * (display.scaleFactor || 1)));
  const h = Math.min(720, Math.round(display.size.height * (display.scaleFactor || 1)));
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: w, height: h },
  });
  const openWindows = [];
  const seen = new Set();
  for (const source of sources) {
    if (!source.id.startsWith('window:') || sourceIsSelf(source)) continue;
    const name = String(source.name || '').trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    if (SKIP_TITLE.test(name)) continue;
    seen.add(name.toLowerCase());
    openWindows.push(name);
    if (openWindows.length >= 8) break;
  }
  const screenMatch =
    sources.find((s) => s.id.startsWith('screen:') && s.display_id && String(s.display_id) === String(display.id)) ||
    sources.find((s) => s.id.startsWith('screen:'));
  const screenshot = screenMatch && !screenMatch.thumbnail.isEmpty() ? screenMatch.thumbnail.toDataURL() : null;
  return { screenshot, openWindows };
}

function hideAppWindows() {
  global.__floatGlance = true;
  const hidden = [];
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || !win.isVisible()) continue;
    hidden.push({
      win,
      focused: win.isFocused(),
      alwaysOnTop: win.isAlwaysOnTop(),
    });
    try { win.setContentProtection(true); } catch {}
    try { win.setAlwaysOnTop(false); } catch {}
    try { win.setOpacity(0); } catch {}
    try { win.hide(); } catch {}
  }
  return hidden;
}

function restoreAppWindows(hidden) {
  for (const { win, alwaysOnTop } of hidden) {
    if (!win || win.isDestroyed()) continue;
    try { win.setOpacity(1); } catch {}
    try { win.setContentProtection(false); } catch {}
    try {
      if (alwaysOnTop) win.setAlwaysOnTop(true, 'screen-saver', 1);
    } catch {}
    try { win.show(); } catch {}
  }
  global.__floatGlance = false;
}

async function gatherGlance(opts = {}) {
  const includeScreenshot = !!opts.includeScreenshot;
  const includeFolder = opts.includeFolder !== false;
  let ranked = { primary: null, orderedTitles: [] };
  if (process.platform === 'win32') {
    try {
      ranked = pickMainWindow(await listZOrderWindows(), ownWindowIds());
    } catch (err) {
      console.warn('[Glance] Could not read the window behind the orb:', err.message);
    }
  }
  const hidden = hideAppWindows();
  try {
    await sleep(320);
    let fg =
      process.platform === 'darwin' ? await getForegroundMac() : await getForegroundWindows();
    if (ranked.primary) fg = ranked.primary;
    else if (!fg || isFloatProcess(fg)) {
      fg = fg || { title: '', process: '', app: '' };
    }

    let folder = null;
    if (includeFolder && !isFloatProcess(fg)) {
      const proc = String(fg.process || '').toLowerCase();
      const title = String(fg.title || '').toLowerCase();
      if (process.platform === 'win32') {
        if (proc === 'explorer') {
          folder = await getExplorerFolder(fg.hwnd);
          if (!folder) folder = listLocalDir(path.join(os.homedir(), 'Desktop'));
        }
      } else if (process.platform === 'darwin') {
        if (proc === 'finder' || title.includes('desktop')) {
          folder = await getFinderFolder();
        }
      }
    }
    if (includeFolder && opts.forceDesktop && !folder) {
      folder = listLocalDir(path.join(os.homedir(), 'Desktop'));
    }

    const sensitive = SENSITIVE.test(String(fg.title || '')) || SENSITIVE.test(String(fg.app || ''));
    let screenshot = null;
    let openWindows = [];
    let shotNames = [];
    if (includeScreenshot && !sensitive) {
      const shot = await capturePixels();
      screenshot = shot.screenshot;
      shotNames = shot.openWindows || [];
      openWindows = shotNames.slice();
    }
    if (ranked.orderedTitles && ranked.orderedTitles.length) {
      openWindows = ranked.orderedTitles.slice();
    } else if (!openWindows.length && fg && !isFloatProcess(fg) && fg.title) {
      openWindows = [fg.title];
    }
    const seen = new Set(openWindows.map((name) => String(name).toLowerCase()));
    for (const name of shotNames) {
      if (!seen.has(String(name).toLowerCase())) {
        openWindows.push(name);
        seen.add(String(name).toLowerCase());
      }
    }
    const cursorAt = openWindows.findIndex((name) => /\bcursor\b/i.test(name) && !/floatgpt studio/i.test(name));
    if (cursorAt > 0) {
      const [cursorTitle] = openWindows.splice(cursorAt, 1);
      openWindows.unshift(cursorTitle);
      fg = { ...fg, title: cursorTitle, app: 'Cursor', process: 'Cursor' };
    } else if (cursorAt === 0) {
      fg = { ...fg, title: openWindows[0], app: fg.app || 'Cursor', process: fg.process || 'Cursor' };
    }

    return {
      ok: true,
      foreground: {
        app: fg.app || fg.process || 'Unknown',
        process: fg.process || '',
        title: fg.title || '',
        host: inferHost(fg.title),
      },
      openWindows,
      folder,
      screenshot,
      redacted: includeScreenshot && sensitive,
      lookedAtSelf: isFloatProcess(fg) && openWindows.length === 0,
    };
  } catch (err) {
    return { ok: false, error: err.message || 'Glance failed' };
  } finally {
    restoreAppWindows(hidden);
  }
}

module.exports = { gatherGlance, inferHost };
