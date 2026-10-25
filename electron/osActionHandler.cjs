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
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hWnd);
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
    bool zoomed = IsZoomed(h);
    if (IsIconic(h)) ShowWindow(h, 9);
    SetForegroundWindow(h);
    if (zoomed && !IsZoomed(h)) ShowWindow(h, 3);
    if (fgThread != thisThread) AttachThreadInput(thisThread, fgThread, false);
  }
  public static bool SkipTitle(string t) {
    if (string.IsNullOrWhiteSpace(t)) return true;
    if (t.IndexOf("FloatGPT", StringComparison.OrdinalIgnoreCase) >= 0) return true;
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
$procs = @(Get-Process -Name '${safe}' -ErrorAction SilentlyContinue)
if ($procs.Count -eq 0) { exit 2 }
$withHwnd = @($procs | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle })
if ($withHwnd.Count -gt 0) {
  $p = $withHwnd | Sort-Object { $_.MainWindowTitle.Length } -Descending | Select-Object -First 1
  [FloatFgWin]::Force([IntPtr]$p.MainWindowHandle)
} else {
  $wshell = New-Object -ComObject WScript.Shell
  $activated = $false
  foreach ($p in $procs) {
    if ($wshell.AppActivate($p.Id)) {
      $activated = $true
      break
    }
  }
  if (-not $activated) {
    [void]$wshell.AppActivate('${safe}')
  }
}
Start-Sleep -Milliseconds 250
$fg = [FloatFgWin]::GetForegroundWindow()
$fgPid = [uint32]0
[void][FloatFgWin]::GetWindowThreadProcessId($fg, [ref]$fgPid)
$fgProc = Get-Process -Id $fgPid -ErrorAction SilentlyContinue
if (-not $fgProc -or $fgProc.ProcessName -ne '${safe}') {
  $targetPids = @($procs | Select-Object -ExpandProperty Id)
  if ($targetPids -contains [int]$fgPid) { exit 0 }
  exit 3
}
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

function foregroundProcessName() {
  const command = FOCUS_HELPER + `
$fg = [FloatFgWin]::GetForegroundWindow()
if ($fg -eq [IntPtr]::Zero) { exit 2 }
$fgPid = [uint32]0
[void][FloatFgWin]::GetWindowThreadProcessId($fg, [ref]$fgPid)
$fgProc = Get-Process -Id $fgPid -ErrorAction SilentlyContinue
if (-not $fgProc) { exit 2 }
Write-Output $fgProc.ProcessName
exit 0
`;
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout: 6000, windowsHide: true }, (err, stdout) => {
      if (err) resolve('');
      else resolve(String(stdout || '').trim());
    });
  });
}

function editorProcessOrder() {
  return foregroundProcessName().then((name) => {
    const front = String(name || '').toLowerCase();
    if (front === 'cursor') return ['Cursor', 'Code'];
    if (front === 'code') return ['Code', 'Cursor'];
    return ['Code', 'Cursor'];
  });
}

async function focusEditor() {
  const order = await editorProcessOrder();
  for (const name of order) {
    const status = await focusRunningApp(name);
    if (status === 'focused') return name;
  }
  return '';
}

function sendChord(chordExpression) {
  const command = `
Add-Type -AssemblyName System.Windows.Forms
Start-Sleep -Milliseconds 220
[System.Windows.Forms.SendKeys]::SendWait(${chordExpression})
exit 0
`;
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout: 8000, windowsHide: true }, (err) => {
      resolve({ ok: !err, error: err ? err.message : undefined });
    });
  });
}

function pasteWithChord(text, waits) {
  const { clipboard } = require('electron');
  const previous = clipboard.readText();
  clipboard.writeText(String(text || '').slice(0, 2000));
  const command = `
Add-Type -AssemblyName System.Windows.Forms
Start-Sleep -Milliseconds 280
${waits}
exit 0
`;
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout: 8000, windowsHide: true }, (err) => {
      setTimeout(() => {
        try { clipboard.writeText(previous || ''); } catch {}
      }, 500);
      resolve({ ok: !err, error: err ? 'chat-focus-failed' : undefined });
    });
  });
}

async function typeIntoCursorChat(text) {
  const status = await focusRunningApp('Cursor');
  if (status !== 'focused') return { ok: false, error: status === 'missing' ? 'editor-closed' : 'focus-failed' };
  return pasteWithChord(text, "[System.Windows.Forms.SendKeys]::SendWait('^+v')");
}

async function typeIntoEditorChat(text) {
  const editor = await focusEditor();
  if (!editor) return { ok: false, error: 'editor-closed' };
  if (editor === 'Cursor') return pasteWithChord(text, "[System.Windows.Forms.SendKeys]::SendWait('^+v')");
  return pasteWithChord(text, "[System.Windows.Forms.SendKeys]::SendWait('^%i')\nStart-Sleep -Milliseconds 450\n[System.Windows.Forms.SendKeys]::SendWait('^v')");
}

async function openEditorTerminal() {
  const editor = await focusEditor();
  if (!editor) return { ok: false, error: 'editor-closed' };
  const pressed = await sendChord("[string]::Concat('^', [char]96)");
  return pressed.ok ? { ok: true } : { ok: false, error: 'failed' };
}

function pasteIntoCodeEditor(text) {
  const { clipboard } = require('electron');
  const value = String(text || '').slice(0, 100000);
  clipboard.writeText(value);
  const command = FOCUS_HELPER + `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class FloatEditorPaste {
  public static IntPtr Picked;
  public static IntPtr Fallback;
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  public static bool BigEnough(IntPtr h) {
    RECT r;
    if (!GetWindowRect(h, out r)) return false;
    return (r.Right - r.Left) >= 480 && (r.Bottom - r.Top) >= 320;
  }
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, INPUT[] inputs, int cb);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct INPUT { [FieldOffset(0)] public int type; [FieldOffset(8)] public MOUSEINPUT mi; }
  public static void ClickAt(int x, int y, uint button) {
    int vx = GetSystemMetrics(76);
    int vy = GetSystemMetrics(77);
    int vw = Math.Max(1, GetSystemMetrics(78) - 1);
    int vh = Math.Max(1, GetSystemMetrics(79) - 1);
    int ax = (int)Math.Round((x - vx) * 65535.0 / vw);
    int ay = (int)Math.Round((y - vy) * 65535.0 / vh);
    INPUT[] input = new INPUT[1];
    input[0].type = 0;
    input[0].mi.dx = ax;
    input[0].mi.dy = ay;
    input[0].mi.dwFlags = 0x0001 | 0x8000 | button;
    SendInput(1, input, Marshal.SizeOf(typeof(INPUT)));
  }
  public static void ClickEditor(IntPtr h) {
    RECT r;
    POINT p;
    GetCursorPos(out p);
    if (!GetWindowRect(h, out r)) return;
    int width = Math.Max(1, r.Right - r.Left);
    int height = Math.Max(1, r.Bottom - r.Top);
    // LeetCode keeps the statement on the left and Monaco on the right.
    // A click at the old cursor position was selecting that statement.
    int x = r.Left + (int)(width * 0.68);
    int y = r.Top + (int)(height * 0.46);
    ClickAt(x, y, 0x0002);
    System.Threading.Thread.Sleep(40);
    ClickAt(x, y, 0x0004);
    System.Threading.Thread.Sleep(90);
    ClickAt(x, y, 0x0002);
    System.Threading.Thread.Sleep(40);
    ClickAt(x, y, 0x0004);
    System.Threading.Thread.Sleep(80);
    SetCursorPos(p.X, p.Y);
  }
  public static void Chord(byte vk) {
    keybd_event(0x11, 0, 0, UIntPtr.Zero);
    keybd_event(vk, 0, 0, UIntPtr.Zero);
    keybd_event(vk, 0, 2, UIntPtr.Zero);
    keybd_event(0x11, 0, 2, UIntPtr.Zero);
  }
}
'@
[FloatEditorPaste]::Picked = [IntPtr]::Zero
[FloatEditorPaste]::Fallback = [IntPtr]::Zero
$cb = [FloatFgWin+EnumProc]{ param($h, $l)
  if (-not [FloatFgWin]::IsWindowVisible($h)) { return $true }
  $sb = New-Object System.Text.StringBuilder 512
  [void][FloatFgWin]::GetWindowText($h, $sb, 512)
  $title = $sb.ToString()
  if ([FloatFgWin]::SkipTitle($title)) { return $true }
  if ($title -match 'Wispr') { return $true }
  if (-not [FloatEditorPaste]::BigEnough($h)) { return $true }
  $procId = [uint32]0
  [void][FloatFgWin]::GetWindowThreadProcessId($h, [ref]$procId)
  $name = ''
  try { $name = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName } catch {}
  if (@('chrome','msedge','firefox','brave','opera','vivaldi') -notcontains ([string]$name).ToLower()) { return $true }
  if ([FloatEditorPaste]::Fallback -eq [IntPtr]::Zero) { [FloatEditorPaste]::Fallback = $h }
  if ($title -match 'LeetCode|leetcode') { [FloatEditorPaste]::Picked = $h; return $false }
  return $true
}
[void][FloatFgWin]::EnumWindows($cb, [IntPtr]::Zero)
$hwnd = [FloatEditorPaste]::Picked
if ($hwnd -eq [IntPtr]::Zero) { $hwnd = [FloatEditorPaste]::Fallback }
if ($hwnd -eq [IntPtr]::Zero) { exit 2 }
[FloatFgWin]::Force($hwnd)
Start-Sleep -Milliseconds 320
[FloatEditorPaste]::ClickEditor($hwnd)
Start-Sleep -Milliseconds 220
[FloatEditorPaste]::Chord(0x41)
Start-Sleep -Milliseconds 120
[FloatEditorPaste]::Chord(0x56)
exit 0
`;
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout: 8000, windowsHide: true }, (err) => {
      resolve({ ok: !err, error: err ? err.message : undefined });
    });
  });
}

function typeIntoForeground(text) {
  const { clipboard } = require('electron');
  const value = String(text || '').slice(0, 100000);
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
Start-Sleep -Milliseconds 300
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('^v')
exit 0
`;
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout: 8000, windowsHide: true }, (err) => {
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

const SITE_TAB_NAMES = {
  'linkedin.com': 'LinkedIn',
  'www.linkedin.com': 'LinkedIn',
  'youtube.com': 'YouTube',
  'www.youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'github.com': 'GitHub',
  'www.github.com': 'GitHub',
  'chatgpt.com': 'ChatGPT',
  'mail.google.com': 'Gmail',
  'instagram.com': 'Instagram',
  'www.instagram.com': 'Instagram',
  'web.whatsapp.com': 'WhatsApp',
  'open.spotify.com': 'Spotify',
  'netflix.com': 'Netflix',
  'www.netflix.com': 'Netflix',
  'reddit.com': 'Reddit',
  'www.reddit.com': 'Reddit',
  'leetcode.com': 'LeetCode',
};

function siteTabQuery(parsed) {
  const path = parsed.pathname || '/';
  if (path !== '/' && path !== '') return '';
  return SITE_TAB_NAMES[parsed.hostname] || '';
}

function focusExistingSiteTab(parsed) {
  const query = siteTabQuery(parsed);
  if (!query) return Promise.resolve(false);
  const safe = query.replace(/'/g, "''");
  const command = `
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public class FloatSite {
  public static List<IntPtr> Hits = new List<IntPtr>();
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder s, int n);
  public static bool Big(IntPtr h) {
    RECT r;
    if (!GetWindowRect(h, out r)) return false;
    return (r.Right - r.Left) >= 480 && (r.Bottom - r.Top) >= 320;
  }
  public static void Focus(IntPtr h) {
    bool zoomed = IsZoomed(h);
    if (IsIconic(h)) ShowWindow(h, 9);
    SetForegroundWindow(h);
    if (zoomed && !IsZoomed(h)) ShowWindow(h, 3);
  }
}
'@
$needle = '${safe}'
$browsers = @('chrome','msedge','firefox','brave','opera','vivaldi')
[FloatSite]::Hits.Clear()
$cb = [FloatSite+EnumProc]{ param($h, $l)
  if (-not [FloatSite]::IsWindowVisible($h)) { return $true }
  if (-not [FloatSite]::Big($h)) { return $true }
  $sb = New-Object System.Text.StringBuilder 512
  [void][FloatSite]::GetWindowText($h, $sb, 512)
  $title = $sb.ToString()
  if ([string]::IsNullOrWhiteSpace($title)) { return $true }
  if ($title -match 'FloatGPT|Program Manager|Windows Input Experience|Microsoft Text Input Application') { return $true }
  [FloatSite]::Hits.Add($h)
  return $true
}
[void][FloatSite]::EnumWindows($cb, [IntPtr]::Zero)
if ([FloatSite]::Hits.Count -eq 0) { exit 4 }
function Test-BrowserWindow($h) {
  $procId = [uint32]0
  [void][FloatSite]::GetWindowThreadProcessId($h, [ref]$procId)
  $name = ''
  try { $name = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName } catch {}
  return $browsers -contains ([string]$name).ToLower()
}
foreach ($h in [FloatSite]::Hits) {
  if (-not (Test-BrowserWindow $h)) { continue }
  $sb = New-Object System.Text.StringBuilder 512
  [void][FloatSite]::GetWindowText($h, $sb, 512)
  if ($sb.ToString() -like ('*' + $needle + '*')) { [FloatSite]::Focus($h); exit 0 }
}
$uiaOk = $false
try {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  $uiaOk = $true
} catch { $uiaOk = $false }
if ($uiaOk) {
  $tabType = [System.Windows.Automation.ControlType]::Tab
  $itemType = [System.Windows.Automation.ControlType]::TabItem
  $seen = 0
  foreach ($h in [FloatSite]::Hits) {
    if ($seen -ge 6) { break }
    if (-not (Test-BrowserWindow $h)) { continue }
    $seen++
    try {
      $root = [System.Windows.Automation.AutomationElement]::FromHandle($h)
      if (-not $root) { continue }
      $tabCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, $tabType)
      $bars = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $tabCond)
      foreach ($bar in $bars) {
        $itemCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, $itemType)
        $tabs = $bar.FindAll([System.Windows.Automation.TreeScope]::Descendants, $itemCond)
        foreach ($tab in $tabs) {
          $tabName = [string]$tab.Current.Name
          if (-not $tabName -or $tabName -notlike ('*' + $needle + '*')) { continue }
          $selected = $false
          try {
            $pattern = $tab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
            $pattern.Select()
            $selected = $true
          } catch {}
          if (-not $selected) {
            try {
              $invoke = $tab.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
              $invoke.Invoke()
              $selected = $true
            } catch {}
          }
          if ($selected) { [FloatSite]::Focus($h); exit 0 }
        }
      }
    } catch {}
  }
}
exit 4
`;
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout: 15000, windowsHide: true }, (err) => {
      resolve(!err);
    });
  });
}

/**
 * Open a URL in the default browser safely (strictly HTTP/HTTPS).
 */
async function openUrl(url, opts = {}) {
  const reuseOnly = !!(opts && opts.reuseOnly);
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

    if (process.platform === 'win32') {
      const reused = await focusExistingSiteTab(parsed);
      if (reused) return true;
      if (reuseOnly) return false;
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

function sendKeys(keys) {
  const safe = String(keys || '').replace(/'/g, "''");
  if (!safe) return Promise.resolve({ ok: false, error: 'No keys.' });
  const command = `
Add-Type -AssemblyName System.Windows.Forms
Start-Sleep -Milliseconds 180
[System.Windows.Forms.SendKeys]::SendWait('${safe}')
exit 0
`;
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout: 8000, windowsHide: true }, (err) => {
      resolve({ ok: !err, error: err ? err.message : undefined });
    });
  });
}

function pasteIntoFocused(text) {
  const { clipboard } = require('electron');
  const value = String(text || '').slice(0, 4000);
  const previous = clipboard.readText();
  clipboard.writeText(value);
  return sendKeys('^v').then((result) => {
    setTimeout(() => {
      try { clipboard.writeText(previous || ''); } catch {}
    }, 400);
    return result;
  });
}

function sendKeysLiteral(text) {
  return String(text || '').slice(0, 80).replace(/[+^%~(){}[\]]/g, (ch) => `{${ch}}`);
}

function fillFocusedField(label, value, restoreClipboard = true) {
  const { clipboard } = require('electron');
  const previous = clipboard.readText();
  clipboard.writeText(String(value || '').slice(0, 500));
  const literal = sendKeysLiteral(label).replace(/'/g, "''");
  const command = `
Add-Type -AssemblyName System.Windows.Forms
Start-Sleep -Milliseconds 250
[System.Windows.Forms.SendKeys]::SendWait('^f')
Start-Sleep -Milliseconds 220
[System.Windows.Forms.SendKeys]::SendWait('^a')
Start-Sleep -Milliseconds 50
[System.Windows.Forms.SendKeys]::SendWait('${literal}')
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Milliseconds 180
[System.Windows.Forms.SendKeys]::SendWait('{ESC}')
Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait('{TAB}')
Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait('^a')
Start-Sleep -Milliseconds 50
[System.Windows.Forms.SendKeys]::SendWait('^v')
Start-Sleep -Milliseconds 100
exit 0
`;
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout: 8000, windowsHide: true }, (err) => {
      if (restoreClipboard) {
        setTimeout(() => {
          try { clipboard.writeText(previous || ''); } catch {}
        }, 500);
      }
      resolve({ ok: !err, error: err ? err.message : undefined });
    });
  });
}

module.exports = {
  openApp,
  openUrl,
  searchWeb,
  focusWindow,
  focusRunningApp,
  foregroundProcessName,
  checkPython,
  executeScript,
  writeUserFile,
  typeIntoForeground,
  pasteIntoCodeEditor,
  typeIntoEditorChat,
  typeIntoCursorChat,
  openEditorTerminal,
  sendKeys,
  pasteIntoFocused,
  fillFocusedField,
};
