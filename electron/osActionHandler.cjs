/**
 * OS Action Handler (Electron Main Process)
 *
 * Platform-agnostic and platform-specific handlers for launching apps,
 * focusing windows, executing safe OS scripts, and managing system state.
 * Runs in the Electron main process with strict security validation.
 */

const { shell } = require('electron');
const { exec, execFile, spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const systemDiagnostics = require('./systemDiagnostics.cjs');

/**
 * Main Process Security Firewall: Verifies script safety before execution.
 * Covers both Windows (PowerShell/CMD) and macOS/Linux (POSIX/AppleScript).
 */
const CATASTROPHIC_PATTERNS = [
  // Drive & Partition Destruction
  { regex: /\b(format\s+[a-z]:|Format-Volume|diskpart|clean\s+all|mkfs|fdisk|diskutil\s+eraseDisk|dd\s+if=)\b/i, reason: 'Drive formatting and partition destruction are strictly forbidden.' },
  // Core System File Destruction (Windows & macOS/Linux)
  { regex: /\b(Remove-Item|del|rmdir|rd|erase|trash)\s+.*?(c:\\windows|c:\\program files|system32|systemroot|system\.bak|syswow64)\b/i, reason: 'Modifying or deleting core Windows OS system files is strictly forbidden.' },
  { regex: /\b(rm\s+-(rf|fr|r|f)\s+(\/|\/\*|~\/|~|\/System|\/Library|\/usr|\/bin|\/sbin|\/etc|\/var))\b/i, reason: 'Recursive deletion of root or core macOS/Linux system directories is strictly forbidden.' },
  { regex: /\[System\.IO\.(File|Directory)\]::(Delete|Move|WriteAllBytes)\s*\(.*?(windows|system32|program files)/i, reason: 'Direct .NET modification of system paths is strictly forbidden.' },
  // Disabling OS Security & Defenses
  { regex: /\b(Set-MpPreference\s+-DisableRealtimeMonitoring|netsh\s+advfirewall\s+set\s+allprofiles\s+state\s+off|sc\s+stop\s+WinDefend|Set-ExecutionPolicy\s+Unrestricted|csrutil\s+disable|spctl\s+--master-disable)\b/i, reason: 'Disabling Windows Defender, Gatekeeper, SIP, or OS security protections is strictly forbidden.' },
  // Remote Web Cradles & Payload Downloaders
  { regex: /\b(Invoke-Expression|iex)\s*\(?\s*(New-Object\s+Net\.WebClient|Invoke-WebRequest|curl|iwr|wget)\b/i, reason: 'Downloading and executing arbitrary remote web payloads is strictly forbidden.' },
  { regex: /\b(certutil(\.exe)?\s+(-urlcache|-f\s+http)|bitsadmin(\.exe)?\s+\/transfer|mshta(\.exe)?\s+http)\b/i, reason: 'Using certutil, bitsadmin, or mshta to download remote payloads is strictly forbidden.' },
  // Credential Harvesting & Memory Dumps
  { regex: /\b(mimikatz|lsass|comsvcs\.dll.*MiniDump|reg\s+save\s+hklm\\(sam|system|security)|vaultcmd|security\s+find-generic-password|dscl\s+\.\s+-authonly)\b/i, reason: 'Harvesting OS credentials, keychain passwords, or memory dumps is strictly forbidden.' },
  // Ransomware / System Recovery Destruction
  { regex: /\b(bcdedit|vssadmin\s+delete\s+shadows|wmic\s+shadowcopy\s+delete|wbadmin\s+delete\s+catalog|tmutil\s+delete)\b/i, reason: 'Deleting volume shadow copies or disabling system recovery is strictly forbidden.' },
  // Reverse Shells & Socket Exploits
  { regex: /\b(System\.Net\.Sockets\.TCPClient|System\.Net\.Sockets\.Socket|nc(\.exe)?\s+-e|ncat(\.exe)?\s+-e|bash\s+-i\s+>&\s*\/dev\/tcp|zsh\s+-i\s+>&\s*\/dev\/tcp)\b/i, reason: 'Initiating unauthorized reverse shells or raw network socket streams is strictly forbidden.' },
  // Event Log & Forensics Cleansing
  { regex: /\b(Clear-EventLog|wevtutil\s+cl|log\s+erase|rm\s+.*?\/var\/log)\b/i, reason: 'Clearing system security or audit logs is strictly forbidden.' },
  // LOLBins & Code Injection
  { regex: /\b(regsvr32(\.exe)?\s+\/u\s+\/n\s+\/s\s+\/i:http|rundll32(\.exe)?\s+javascript:|wmic(\.exe)?\s+process\s+call\s+create|sudo\s+rm)\b/i, reason: 'Executing unverified code injections or unauthorized privilege escalations is strictly forbidden.' }
];

function sanitizeForCommand(input) {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[;&|`$<>\r\n]/g, '').trim();
}

/**
 * Open an application by name.
 * Uses platform-specific search and launch strategies.
 */
async function openApp(appName) {
  const platform = process.platform;
  const sanitized = sanitizeForCommand(appName);
  const name = sanitized.toLowerCase();

  try {
    if (platform === 'win32') {
      return await openAppWindows(name, sanitized);
    } else if (platform === 'darwin') {
      return await openAppMac(name, sanitized);
    } else {
      return await openAppLinux(name, sanitized);
    }
  } catch (err) {
    console.error(`[Flow:OS] Failed to open "${appName}":`, err.message);
    return false;
  }
}

/**
 * Windows: Launch apps via Start-Process, shell protocol, or executable name.
 */
function openAppWindows(nameLower, originalName) {
  return new Promise((resolve) => {
    const WIN_APP_MAP = {
      'edge': 'msedge',
      'microsoft edge': 'msedge',
      'chrome': 'chrome',
      'google chrome': 'chrome',
      'firefox': 'firefox',
      'brave': 'brave',
      'notepad': 'notepad',
      'calculator': 'calc',
      'paint': 'mspaint',
      'explorer': 'explorer',
      'file explorer': 'explorer',
      'terminal': 'wt',
      'windows terminal': 'wt',
      'cmd': 'cmd',
      'command prompt': 'cmd',
      'powershell': 'powershell',
      'vscode': 'code',
      'vs code': 'code',
      'visual studio code': 'code',
      'spotify': 'spotify',
      'discord': 'discord',
      'slack': 'slack',
      'teams': 'ms-teams',
      'microsoft teams': 'ms-teams',
      'word': 'winword',
      'excel': 'excel',
      'powerpoint': 'powerpnt',
      'outlook': 'outlook',
      'task manager': 'taskmgr',
      'settings': 'ms-settings:',
      'setting': 'ms-settings:',
      'the setting': 'ms-settings:',
      'the settings': 'ms-settings:',
      'device setting': 'ms-settings:',
      'device settings': 'ms-settings:',
      'windows settings': 'ms-settings:',
      'system settings': 'ms-settings:',
      'ms-settings': 'ms-settings:',
      'ms-settings:': 'ms-settings:',
      'control panel': 'control',
      'snipping tool': 'snippingtool',
      // Websites
      'linkedin': 'https://linkedin.com',
      'youtube': 'https://youtube.com',
      'github': 'https://github.com',
      'google': 'https://google.com',
      'twitter': 'https://twitter.com',
      'chatgpt': 'https://chat.openai.com',
    };

    const mapped = WIN_APP_MAP[nameLower];
    let target = mapped || originalName;
    target = String(target || '').replace(/^(start-process|start|open|launch|run)\s+/i, '').replace(/^["']|["']$/g, '').trim();

    // Validate URLs / Protocols
    if (target.includes(':')) {
      if (/^https?:\/\//i.test(target) || /^ms-settings:/i.test(target)) {
        const uri = /^ms-settings:/i.test(target) ? target.split(/\s/)[0] : target;
        shell.openExternal(uri)
          .then(() => resolve(true))
          .catch(() => {
            exec(`explorer.exe "${uri.replace(/"/g, '')}"`, { timeout: 5000 }, (err) => resolve(!err));
          });
      } else {
        resolve(false);
      }
      return;
    }

    const escaped = sanitizeForCommand(target).replace(/'/g, "''");
    focusRunningApp(target).then((focused) => {
      if (focused === 'focused') {
        resolve(true);
        return;
      }
      if (focused === 'failed') {
        resolve(false);
        return;
      }
      exec(`powershell -NoProfile -Command "Start-Process '${escaped}'"`, { timeout: 5000 }, (err) => {
        if (err) {
          exec(`start "" "${escaped}"`, { shell: true, timeout: 5000 }, (err2) => {
            resolve(!err2);
          });
        } else {
          resolve(true);
        }
      });
    });
  });
}

const FOCUS_HELPER = `
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class FloatFgWin {
  public static IntPtr Found;
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder s, int n);
  public static void Force(IntPtr h) {
    uint pid;
    IntPtr fg = GetForegroundWindow();
    uint fgThread = GetWindowThreadProcessId(fg, out pid);
    uint thisThread = GetCurrentThreadId();
    if (fgThread != thisThread) AttachThreadInput(thisThread, fgThread, true);
    ShowWindow(h, 9);
    SetForegroundWindow(h);
    if (fgThread != thisThread) AttachThreadInput(thisThread, fgThread, false);
  }
  public static bool SkipTitle(string t) {
    if (string.IsNullOrWhiteSpace(t)) return true;
    if (string.Equals(t, "FloatGPT Studio", StringComparison.OrdinalIgnoreCase)) return true;
    if (t == "Program Manager") return true;
    if (t.IndexOf("Windows Input Experience", StringComparison.OrdinalIgnoreCase) >= 0) return true;
    if (t.IndexOf("Microsoft Text Input Application", StringComparison.OrdinalIgnoreCase) >= 0) return true;
    return false;
  }
}
'@
`;

/** Bring an already-open window forward. A new process is started only when none is open. */
function focusRunningApp(processName) {
  const safe = String(processName || '').replace(/[^a-z0-9._-]/gi, '');
  if (!safe || safe.includes(':')) return Promise.resolve(false);
  const command = FOCUS_HELPER + `
$all = @(Get-Process -Name '${safe}' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle })
if ($all.Count -eq 0) { exit 2 }
$p = $all | Sort-Object { $_.MainWindowTitle.Length } -Descending | Select-Object -First 1
[FloatFgWin]::Force([IntPtr]$p.MainWindowHandle)
Start-Sleep -Milliseconds 200
$fg = [FloatFgWin]::GetForegroundWindow()
$fgPid = [uint32]0
[void][FloatFgWin]::GetWindowThreadProcessId($fg, [ref]$fgPid)
$fgProc = Get-Process -Id $fgPid -ErrorAction SilentlyContinue
if (-not $fgProc -or $fgProc.ProcessName -ne '${safe}') { exit 3 }
exit 0
`;
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout: 6000, windowsHide: true }, (err) => {
      if (!err) resolve('focused');
      else if (err.code === 2) resolve('missing');
      else resolve('failed');
    });
  });
}

function typeIntoForeground(text) {
  const { clipboard } = require('electron');
  const value = String(text || '').slice(0, 500);
  const previous = clipboard.readText();
  clipboard.writeText(value);
  const command = FOCUS_HELPER + `
[FloatFgWin]::Found = [IntPtr]::Zero
$cb = [FloatFgWin+EnumProc]{ param($h, $l)
  if (-not [FloatFgWin]::IsWindowVisible($h)) { return $true }
  $sb = New-Object System.Text.StringBuilder 512
  [void][FloatFgWin]::GetWindowText($h, $sb, 512)
  if ([FloatFgWin]::SkipTitle($sb.ToString())) { return $true }
  [FloatFgWin]::Found = $h
  return $false
}
[void][FloatFgWin]::EnumWindows($cb, [IntPtr]::Zero)
if ([FloatFgWin]::Found -eq [IntPtr]::Zero) { exit 2 }
[FloatFgWin]::Force([FloatFgWin]::Found)
Start-Sleep -Milliseconds 250
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('^v')
exit 0
`;
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout: 8000, windowsHide: true }, (err) => {
      setTimeout(() => {
        try { clipboard.writeText(previous || ''); } catch {}
      }, 500);
      resolve({ ok: !err, error: err ? err.message : undefined });
    });
  });
}

/**
 * macOS: Launch apps natively using `open -a` and AppleScript fallback.
 */
function openAppMac(nameLower, originalName) {
  return new Promise((resolve) => {
    const MAC_APP_MAP = {
      'chrome': 'Google Chrome',
      'google chrome': 'Google Chrome',
      'safari': 'Safari',
      'firefox': 'Firefox',
      'brave': 'Brave Browser',
      'edge': 'Microsoft Edge',
      'microsoft edge': 'Microsoft Edge',
      'vscode': 'Visual Studio Code',
      'vs code': 'Visual Studio Code',
      'visual studio code': 'Visual Studio Code',
      'terminal': 'Terminal',
      'iterm': 'iTerm',
      'iterm2': 'iTerm2',
      'finder': 'Finder',
      'spotify': 'Spotify',
      'discord': 'Discord',
      'slack': 'Slack',
      'teams': 'Microsoft Teams',
      'notes': 'Notes',
      'apple notes': 'Notes',
      'messages': 'Messages',
      'imessage': 'Messages',
      'mail': 'Mail',
      'photos': 'Photos',
      'music': 'Music',
      'apple music': 'Music',
      'podcasts': 'Podcasts',
      'settings': 'System Settings',
      'system preferences': 'System Settings',
      'system settings': 'System Settings',
      'activity monitor': 'Activity Monitor',
      'calculator': 'Calculator',
      'calendar': 'Calendar',
      'reminders': 'Reminders',
      'contacts': 'Contacts',
      'maps': 'Maps',
      'preview': 'Preview',
      'pages': 'Pages',
      'keynote': 'Keynote',
      'numbers': 'Numbers',
      'xcode': 'Xcode',
      'notion': 'Notion',
      // Websites
      'linkedin': 'https://linkedin.com',
      'youtube': 'https://youtube.com',
      'github': 'https://github.com',
      'google': 'https://google.com',
      'twitter': 'https://twitter.com',
      'chatgpt': 'https://chat.openai.com',
    };

    const mapped = MAC_APP_MAP[nameLower];
    const target = mapped || originalName;

    // Validate URLs
    if (/^https?:\/\//i.test(target)) {
      shell.openExternal(target)
        .then(() => resolve(true))
        .catch(() => resolve(false));
      return;
    }

    const sanitized = sanitizeForCommand(target).replace(/"/g, '\\"');

    // Primary strategy: open -a
    exec(`open -a "${sanitized}"`, { timeout: 5000 }, (err) => {
      if (!err) {
        resolve(true);
        return;
      }

      // Secondary fallback: AppleScript activate
      const appleScript = `osascript -e 'tell application "${sanitized}" to activate'`;
      exec(appleScript, { timeout: 5000 }, (err2) => {
        resolve(!err2);
      });
    });
  });
}

/**
 * Linux: Launch apps using standard desktop entry mechanisms.
 */
function openAppLinux(nameLower, originalName) {
  return new Promise((resolve) => {
    const target = sanitizeForCommand(nameLower).replace(/\s+/g, '-');
    exec(`${target} &`, { timeout: 5000 }, (err) => {
      if (err) {
        exec(`xdg-open ${target}`, { timeout: 5000 }, (err2) => {
          resolve(!err2);
        });
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Open a URL in the default browser safely (strictly HTTP/HTTPS).
 */
async function openUrl(url) {
  try {
    let normalizedUrl = (url || '').trim();
    if (!normalizedUrl) return false;

    // Allow safe native WhatsApp protocol
    if (/^whatsapp:\/\//i.test(normalizedUrl) || /^whatsapp:/i.test(normalizedUrl)) {
      await shell.openExternal(normalizedUrl);
      return true;
    }

    if (!/^https?:\/\//i.test(normalizedUrl)) {
      if (/^[a-zA-Z0-9_-]+:/i.test(normalizedUrl)) {
        console.warn(`[Flow:OS:Security] Blocked unsafe protocol in URL: ${normalizedUrl}`);
        return false;
      }
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const parsed = new URL(normalizedUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.warn(`[Flow:OS:Security] Blocked non-http/https URL: ${normalizedUrl}`);
      return false;
    }

    try {
      await shell.openExternal(normalizedUrl);
      return true;
    } catch (shellErr) {
      if (process.platform === 'win32') {
        const escaped = normalizedUrl.replace(/'/g, "''");
        await new Promise((res) => exec(`powershell.exe -NoProfile -Command "Start-Process '${escaped}'"`, res));
        return true;
      }
      throw shellErr;
    }
  } catch (err) {
    console.error(`[Flow:OS] Failed to open URL "${url}":`, err.message);
    return false;
  }
}

/**
 * Search the web using the default browser.
 */
async function searchWeb(query) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query || '')}`;
  return openUrl(searchUrl);
}

/**
 * Focus a window or application by title.
 * Supports Windows and macOS natively.
 */
function focusWindow(windowTitleOrApp) {
  return new Promise((resolve) => {
    const platform = process.platform;
    const sanitized = sanitizeForCommand(windowTitleOrApp);

    if (platform === 'win32') {
      const escaped = sanitized.replace(/'/g, "''");
      const psScript = `
        $wnd = Get-Process | Where-Object { $_.MainWindowTitle -like '*${escaped}*' } | Select-Object -First 1
        if ($wnd) {
          [void] [System.Reflection.Assembly]::LoadWithPartialName('Microsoft.VisualBasic')
          [Microsoft.VisualBasic.Interaction]::AppActivate($wnd.Id)
        }
      `;
      exec(`powershell -NoProfile -Command "${psScript.replace(/\n/g, '; ')}"`, { timeout: 5000 }, (err) => {
        resolve(!err);
      });
    } else if (platform === 'darwin') {
      const escaped = sanitized.replace(/"/g, '\\"');
      const script = `osascript -e 'tell application "${escaped}" to activate'`;
      exec(script, { timeout: 5000 }, (err) => {
        resolve(!err);
      });
    } else {
      resolve(false);
    }
  });
}

/**
 * Check if Python 3 is available.
 */
function checkPython() {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32'
      ? 'python --version 2>&1'
      : 'python3 --version 2>&1';

    exec(cmd, { timeout: 3000 }, (err, stdout) => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(stdout.toLowerCase().includes('python 3'));
    });
  });
}

function resolveUserFolder(folder) {
  const home = os.homedir();
  if (folder === 'documents') {
    const docs = [path.join(home, 'Documents'), path.join(home, 'OneDrive', 'Documents')];
    return docs.find((p) => fs.existsSync(p)) || docs[0];
  }
  const desks = [
    path.join(home, 'Desktop'),
    path.join(home, 'OneDrive', 'Desktop'),
    path.join(home, 'OneDrive - Personal', 'Desktop')
  ];
  return desks.find((p) => fs.existsSync(p)) || desks[0];
}

function writeUserFile(opts) {
  const folder = opts?.folder === 'documents' ? 'documents' : 'desktop';
  const dir = resolveUserFolder(folder);
  const allowedExt = new Set(['.txt', '.md', '.csv', '.json', '.log']);
  let base = path.basename(String(opts?.name || 'FloatGPT-note.txt'));
  let ext = path.extname(base).toLowerCase();
  if (!ext) {
    ext = '.txt';
    base += ext;
  }
  if (!allowedExt.has(ext)) {
    return { ok: false, error: 'Only .txt, .md, .csv, .json, or .log files are allowed.' };
  }
  const stem = path.basename(base, ext).replace(/[<>:"/\\|?*]/g, '').replace(/[^\w.\- ]/g, '').slice(0, 80) || 'FloatGPT-note';
  const dest = path.join(dir, stem + ext);
  const resolved = path.resolve(dest);
  if (!resolved.toLowerCase().startsWith(path.resolve(dir).toLowerCase())) {
    return { ok: false, error: 'Invalid path.' };
  }
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolved, String(opts?.content || '').slice(0, 64 * 1024), 'utf8');
    if (opts?.openAfter) {
      if (process.platform === 'win32') {
        exec(`explorer.exe /select,"${resolved}"`, { timeout: 5000 }, () => {});
      } else if (process.platform === 'darwin') {
        exec(`open -R "${resolved.replace(/"/g, '\\"')}"`, { timeout: 5000 }, () => {});
      }
    }
    return { ok: true, path: resolved };
  } catch (err) {
    return { ok: false, error: err.message || 'Write failed' };
  }
}

function looksLikeSettingsLaunchScript(scriptContent) {
  const first = String(scriptContent || '').trim().split(/\r?\n/)[0] || '';
  return /^(start-process|start(\s+-process)?|explorer(\.exe)?)\s+["']?ms-settings:/i.test(first)
    || /^ms-settings:\s*$/i.test(first);
}

/**
 * Execute an arbitrary OS script safely with Main Process Defense-In-Depth Firewall.
 * Supports PowerShell on Windows and Bash/Zsh/AppleScript on macOS.
 */
function executeScript(scriptContent) {
  return new Promise((resolve) => {
    if (!scriptContent || typeof scriptContent !== 'string') {
      resolve({ success: false, output: 'No executable script provided.' });
      return;
    }

    if (looksLikeSettingsLaunchScript(scriptContent)) {
      openApp('ms-settings:').then((ok) => {
        resolve({ success: !!ok, output: ok ? 'Opened Windows Settings.' : 'Failed to open Settings.' });
      });
      return;
    }

    const launched = String(scriptContent).match(/Start-Process\s+['"]?([a-z0-9._-]+)['"]?/i);
    if (launched && !/https?:/i.test(scriptContent)) {
      openApp(launched[1]).then((ok) => {
        resolve({
          success: !!ok,
          output: ok ? `Brought ${launched[1]} to the front.` : `Could not open ${launched[1]}.`
        });
      });
      return;
    }

    if (/SendKeys/i.test(scriptContent) && /play\s*\/?\s*pause|media key|VK_MEDIA|0xB3/i.test(scriptContent)) {
      const osMedia = require('./osMedia.cjs');
      osMedia.controlMedia('toggle').then((res) => {
        resolve({
          success: !!res?.ok,
          output: res?.ok ? 'Sent the real play/pause key.' : ((res && res.error) || 'Play/pause key failed.')
        });
      });
      return;
    }

    if (systemDiagnostics.looksTruncatedScript(scriptContent)) {
      resolve({
        success: false,
        output: 'Script was truncated before execution (unbalanced quotes or incomplete command). Refusing to run it.'
      });
      return;
    }

    if (systemDiagnostics.isHardwareQueryScript(scriptContent)) {
      systemDiagnostics.snapshot('system').then((snap) => {
        if (!snap || !snap.ok) {
          resolve({ success: false, output: (snap && snap.error) || 'Hardware snapshot failed' });
          return;
        }
        const ram = snap.ram || {};
        const cpu = snap.cpu || {};
        const lines = [
          `RAM ${ram.usedGb} GB used / ${ram.totalGb} GB total (${ram.percent}%)`,
          `CPU ${cpu.percent}% · ${cpu.cores} cores`
        ];
        if (snap.battery) lines.push(`Battery ${snap.battery.percent}%`);
        resolve({ success: true, output: lines.join('\n') });
      }).catch((err) => {
        resolve({ success: false, output: err.message || 'Hardware snapshot failed' });
      });
      return;
    }

    // Main-Process Security Firewall Check (Defense in Depth)
    const normalized = scriptContent
      .replace(/<#[\s\S]*?#>/g, ' ')
      .replace(/#[^\r\n]*/g, ' ')
      .replace(/`([a-zA-Z0-9_\-\.\:\$])/g, '$1');

    for (const pattern of CATASTROPHIC_PATTERNS) {
      if (pattern.regex.test(scriptContent) || pattern.regex.test(normalized)) {
        console.error(`[SECURITY INTERCEPTION] Blocked catastrophic script in main process: ${pattern.reason}`);
        resolve({
          success: false,
          output: `[SECURITY VIOLATION] Execution blocked by FloatGPT Main Process Security Firewall.\nReason: ${pattern.reason}`
        });
        return;
      }
    }

    const platform = process.platform;

    try {
      if (platform === 'win32') {
        const ps = spawn('powershell.exe', [
          '-NoProfile',
          '-ExecutionPolicy', 'Bypass',
          '-Command', '-'
        ], {
          timeout: 30000
        });

        let stdout = '';
        let stderr = '';

        ps.stdout.on('data', (data) => { stdout += data.toString(); });
        ps.stderr.on('data', (data) => { stderr += data.toString(); });

        ps.on('close', (code) => {
          if (code !== 0 && !stdout.trim()) {
            resolve({ success: false, output: stderr.trim() || `Process exited with code ${code}` });
          } else {
            resolve({ success: true, output: stdout.trim() || 'Executed script successfully.' });
          }
        });

        ps.on('error', (err) => {
          resolve({ success: false, output: err.message });
        });

        ps.stdin.write(scriptContent + '\r\n');
        ps.stdin.end();
      } else if (platform === 'darwin') {
        // macOS: Use spawn for robust handling of multiline scripts and quotes
        const isAppleScript = scriptContent.trim().startsWith('tell application') || scriptContent.trim().startsWith('osascript');
        let child;

        if (isAppleScript && !scriptContent.trim().startsWith('osascript')) {
          child = spawn('/usr/bin/osascript', ['-e', scriptContent], { timeout: 30000, env: process.env });
        } else {
          child = spawn('/bin/zsh', ['-s'], { timeout: 30000, env: process.env });
          child.stdin.write(scriptContent + '\n');
          child.stdin.end();
        }

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => { stdout += data.toString(); });
        child.stderr.on('data', (data) => { stderr += data.toString(); });

        child.on('close', (code) => {
          if (code !== 0 && !stdout.trim()) {
            resolve({ success: false, output: stderr.trim() || `Process exited with code ${code}` });
          } else {
            resolve({ success: true, output: (stdout.trim() || stderr.trim()) || 'Executed script successfully.' });
          }
        });

        child.on('error', (err) => {
          resolve({ success: false, output: err.message });
        });
      } else {
        // Linux
        const child = spawn('/bin/bash', ['-s'], { timeout: 30000, env: process.env });
        child.stdin.write(scriptContent + '\n');
        child.stdin.end();

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => { stdout += data.toString(); });
        child.stderr.on('data', (data) => { stderr += data.toString(); });

        child.on('close', (code) => {
          if (code !== 0 && !stdout.trim()) {
            resolve({ success: false, output: stderr.trim() || `Process exited with code ${code}` });
          } else {
            resolve({ success: true, output: stdout.trim() || 'Executed script successfully.' });
          }
        });

        child.on('error', (err) => {
          resolve({ success: false, output: err.message });
        });
      }
    } catch (err) {
      resolve({ success: false, output: err.message });
    }
  });
}

module.exports = {
  openApp,
  openUrl,
  searchWeb,
  focusWindow,
  checkPython,
  executeScript,
  writeUserFile,
  typeIntoForeground,
};
