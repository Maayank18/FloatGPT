/**
 * Native OS Media & Viewport Controller (Electron Main Process).
 * 
 * Simulates universal hardware media keys (Play/Pause, Mute, Volume, Next/Prev),
 * display zoom, tab switching, hands-free viewport scrolling (PageDown/PageUp/Home/End),
 * and universal in-page search (Ctrl+F + clipboard injection) with 0ms latency.
 * 
 * Zero Python dependencies. Zero C++ compilation. Pure OS-native execution.
 */

const { exec, execFile } = require('child_process');

let electronClipboard = null;
let electronBrowserWindow = null;
try {
  const electron = require('electron');
  electronClipboard = electron.clipboard || null;
  electronBrowserWindow = electron.BrowserWindow || null;
} catch {
  // Graceful fallback for non-Electron / test runner contexts
}

/**
 * Ensures target window receives keyboard input by releasing focus from FloatGPT if focused.
 * Solves the "Focus Trap" so keystrokes land in the user's active browser, IDE, or document.
 */
function ensureTargetFocus() {
  try {
    if (electronBrowserWindow) {
      for (const win of electronBrowserWindow.getAllWindows()) {
        if (!win.isDestroyed() && win.isFocused()) {
          win.blur();
        }
      }
    }
  } catch {}
}

const fs = require('fs');
const os = require('os');
const path = require('path');

const HARDWARE_MEDIA_VK = {
  toggle: 179,      // VK_MEDIA_PLAY_PAUSE (0xB3)
  play: 179,        // VK_MEDIA_PLAY_PAUSE (0xB3)
  pause: 179,       // VK_MEDIA_PLAY_PAUSE (0xB3)
  next: 176,        // VK_MEDIA_NEXT_TRACK (0xB0)
  prev: 177,        // VK_MEDIA_PREV_TRACK (0xB1)
  mute: 173,        // VK_VOLUME_MUTE (0xAD)
  volume_down: 174, // VK_VOLUME_DOWN (0xAE)
  volume_up: 175    // VK_VOLUME_UP (0xAF)
};

function getMediaKeyScriptPath() {
  const localScript = path.join(__dirname, 'mediaKey.ps1');
  if (fs.existsSync(localScript)) {
    return localScript;
  }
  const tempScript = path.join(os.tmpdir(), 'floatgpt-mediakey.ps1');
  if (!fs.existsSync(tempScript)) {
    const code = `param([int]$vk = 179)
$c = @"
using System;
using System.Runtime.InteropServices;
public class HardwareMediaKey {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    public static void Tap(byte k) {
        keybd_event(k, 0, 1, UIntPtr.Zero);
        keybd_event(k, 0, 1 | 2, UIntPtr.Zero);
    }
}
"@
if (-not ([System.Management.Automation.PSTypeName]'HardwareMediaKey').Type) {
    Add-Type -TypeDefinition $c -Language CSharp -ErrorAction SilentlyContinue
}
[HardwareMediaKey]::Tap([byte]$vk)
Write-Output "OK"
`;
    fs.writeFileSync(tempScript, code, 'utf8');
  }
  return tempScript;
}

/**
 * Executes a hardware media action or universal OS keyboard shortcut.
 * @param {'toggle' | 'play' | 'pause' | 'mute' | 'volume_up' | 'volume_down' | 'next' | 'prev' | 'zoom_in' | 'zoom_out' | 'zoom_reset' | 'switch_tab' | 'prev_tab' | 'switch_app' | 'scroll_down' | 'scroll_up' | 'scroll_top' | 'scroll_bottom' | 'find_on_page'} action
 * @param {{ query?: string; steps?: number }} [opts]
 */
function psQuote(value) {
  return String(value || '').replace(/'/g, "''").slice(0, 40);
}

function runPowerShell(command) {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { timeout: 8000, windowsHide: true },
      (err, stdout) => {
        resolve({
          ok: !err,
          code: err && typeof err.code === 'number' ? err.code : 0,
          stdout: String(stdout || ''),
          error: err ? err.message : undefined
        });
      }
    );
  });
}

function scrollForeground(action) {
  const pageKey = action === 'scroll_up' ? '0x26' : action === 'scroll_top' ? '0x24' : action === 'scroll_bottom' ? '0x23' : '0x28';
  const withCtrl = action === 'scroll_top' || action === 'scroll_bottom' ? '1' : '0';
  const repeats = action === 'scroll_top' || action === 'scroll_bottom' ? '1' : '12';
  const wheel = action === 'scroll_up' ? 120 : -120;
  const command = `
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public class FloatScroll {
  public static List<IntPtr> Hits = new List<IntPtr>();
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct INPUT { [FieldOffset(0)] public int type; [FieldOffset(8)] public MOUSEINPUT mi; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, INPUT[] inputs, int cb);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder s, int n);
  public static bool Skip(string t) {
    if (string.IsNullOrWhiteSpace(t)) return true;
    if (t.IndexOf("FloatGPT", StringComparison.OrdinalIgnoreCase) >= 0) return true;
    if (t == "Program Manager") return true;
    if (t.IndexOf("Windows Input Experience", StringComparison.OrdinalIgnoreCase) >= 0) return true;
    if (t.IndexOf("Microsoft Text Input Application", StringComparison.OrdinalIgnoreCase) >= 0) return true;
    return false;
  }
  public static bool Big(IntPtr h) {
    RECT r;
    if (!GetWindowRect(h, out r)) return false;
    return (r.Right - r.Left) >= 480 && (r.Bottom - r.Top) >= 320;
  }
  public static uint Pid(IntPtr h) {
    uint pid;
    GetWindowThreadProcessId(h, out pid);
    return pid;
  }
  public static void Force(IntPtr h) {
    uint pid;
    IntPtr fg = GetForegroundWindow();
    uint fgThread = GetWindowThreadProcessId(fg, out pid);
    uint mine = GetCurrentThreadId();
    if (fgThread != mine) AttachThreadInput(mine, fgThread, true);
    if (IsIconic(h)) ShowWindow(h, 9);
    SetForegroundWindow(h);
    if (fgThread != mine) AttachThreadInput(mine, fgThread, false);
  }
  public static void Tap(byte vk) {
    keybd_event(vk, 0, 0, UIntPtr.Zero);
    keybd_event(vk, 0, 2, UIntPtr.Zero);
  }
  public static void Chord(byte vk) {
    keybd_event(0x11, 0, 0, UIntPtr.Zero);
    Tap(vk);
    keybd_event(0x11, 0, 2, UIntPtr.Zero);
  }
  public static void Wheel(int delta) {
    INPUT[] input = new INPUT[1];
    input[0].type = 0;
    input[0].mi.dwFlags = 0x0800;
    input[0].mi.mouseData = unchecked((uint)delta);
    SendInput(1, input, Marshal.SizeOf(typeof(INPUT)));
  }
  public static void Hover(IntPtr h) {
    RECT r;
    POINT p;
    if (!GetWindowRect(h, out r)) return;
    GetCursorPos(out p);
    int x = r.Left + (int)((r.Right - r.Left) * 0.5);
    int y = r.Top + (int)((r.Bottom - r.Top) * 0.55);
    SetCursorPos(x, y);
  }
}
'@
[FloatScroll]::Hits.Clear()
$cb = [FloatScroll+EnumProc]{ param($h, $l)
  if (-not [FloatScroll]::IsWindowVisible($h)) { return $true }
  $sb = New-Object System.Text.StringBuilder 512
  [void][FloatScroll]::GetWindowText($h, $sb, 512)
  if ([FloatScroll]::Skip($sb.ToString())) { return $true }
  if (-not [FloatScroll]::Big($h)) { return $true }
  [FloatScroll]::Hits.Add($h)
  return $true
}
[void][FloatScroll]::EnumWindows($cb, [IntPtr]::Zero)
if ([FloatScroll]::Hits.Count -eq 0) { exit 2 }
$browsers = @('chrome','msedge','firefox','brave','opera','vivaldi')
$picked = [IntPtr]::Zero
$isBrowser = $false
foreach ($h in [FloatScroll]::Hits) {
  if ($picked -eq [IntPtr]::Zero) { $picked = $h }
  $name = ''
  try { $name = (Get-Process -Id ([FloatScroll]::Pid($h)) -ErrorAction SilentlyContinue).ProcessName } catch {}
  if ($browsers -contains ([string]$name).ToLower()) { $picked = $h; $isBrowser = $true; break }
}
if ($picked -eq [IntPtr]::Zero) { exit 2 }
$old = New-Object FloatScroll+POINT
[void][FloatScroll]::GetCursorPos([ref]$old)
[FloatScroll]::Force($picked)
Start-Sleep -Milliseconds 280
if ([FloatScroll]::Pid([FloatScroll]::GetForegroundWindow()) -ne [FloatScroll]::Pid($picked)) { exit 3 }
[FloatScroll]::Hover($picked)
Start-Sleep -Milliseconds 120
if (${withCtrl} -eq 1) {
  [FloatScroll]::Chord([byte]${pageKey})
} else {
  $delta = ${wheel}
  for ($n = 0; $n -lt ${repeats}; $n++) {
    [FloatScroll]::Wheel($delta)
    Start-Sleep -Milliseconds 35
  }
}
Start-Sleep -Milliseconds 120
[FloatScroll]::SetCursorPos($old.X, $old.Y) | Out-Null
exit 0
`;
  return runPowerShell(command).then((result) => {
    if (result.code === 2 || /exit code 2/i.test(result.error || '')) return { ok: false, error: 'no-window', action };
    if (result.code === 3 || /exit code 3/i.test(result.error || '')) return { ok: false, error: 'focus-failed', action };
    return { ok: result.ok, error: result.ok ? undefined : 'scroll-failed', action };
  });
}

function openNamedChat(name) {
  const safe = psQuote(name);
  if (!safe) return Promise.resolve({ ok: false, error: 'missing-name', action: 'open_chat' });
  const previous = electronClipboard ? electronClipboard.readText() : '';
  if (electronClipboard) electronClipboard.writeText(safe);
  const command = `
Add-Type -AssemblyName System.Windows.Forms
$hit = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match 'WhatsApp' } | Select-Object -First 1
if (-not $hit) { exit 2 }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class FloatChat {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
'@
$chatHwnd = [IntPtr]$hit.MainWindowHandle
if ([FloatChat]::IsIconic($chatHwnd)) { [FloatChat]::ShowWindow($chatHwnd, 9) | Out-Null }
[FloatChat]::SetForegroundWindow($chatHwnd) | Out-Null
Start-Sleep -Milliseconds 250
[System.Windows.Forms.SendKeys]::SendWait('{ESC}')
Start-Sleep -Milliseconds 180
[System.Windows.Forms.SendKeys]::SendWait('^%n')
Start-Sleep -Milliseconds 550
[System.Windows.Forms.SendKeys]::SendWait('^a')
Start-Sleep -Milliseconds 40
[System.Windows.Forms.SendKeys]::SendWait('^v')
Start-Sleep -Milliseconds 500
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
exit 0
`;
  return runPowerShell(command).then((result) => {
    setTimeout(() => {
      try { if (electronClipboard) electronClipboard.writeText(previous || ''); } catch {}
    }, 700);
    if (result.code === 2 || /exit code 2/i.test(result.error || '')) return { ok: false, error: 'whatsapp-closed', action: 'open_chat' };
    return { ok: result.ok, error: result.ok ? undefined : 'chat-failed', action: 'open_chat' };
  });
}

function closeForegroundTab() {
  const command = `
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public class FloatCloseTab {
  public static List<IntPtr> Hits = new List<IntPtr>();
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder s, int n);
  public static bool Skip(string t) {
    if (string.IsNullOrWhiteSpace(t)) return true;
    if (t.IndexOf("FloatGPT", StringComparison.OrdinalIgnoreCase) >= 0) return true;
    if (t == "Program Manager") return true;
    if (t.IndexOf("Windows Input Experience", StringComparison.OrdinalIgnoreCase) >= 0) return true;
    if (t.IndexOf("Microsoft Text Input Application", StringComparison.OrdinalIgnoreCase) >= 0) return true;
    return false;
  }
  public static bool Big(IntPtr h) {
    RECT r;
    if (!GetWindowRect(h, out r)) return false;
    return (r.Right - r.Left) >= 480 && (r.Bottom - r.Top) >= 320;
  }
  public static uint Pid(IntPtr h) {
    uint pid;
    GetWindowThreadProcessId(h, out pid);
    return pid;
  }
  public static void Force(IntPtr h) {
    uint pid;
    IntPtr fg = GetForegroundWindow();
    uint fgThread = GetWindowThreadProcessId(fg, out pid);
    uint mine = GetCurrentThreadId();
    if (fgThread != mine) AttachThreadInput(mine, fgThread, true);
    if (IsIconic(h)) ShowWindow(h, 9);
    SetForegroundWindow(h);
    if (fgThread != mine) AttachThreadInput(mine, fgThread, false);
  }
  public static void Chord(byte vk) {
    keybd_event(0x11, 0, 0, UIntPtr.Zero);
    keybd_event(vk, 0, 0, UIntPtr.Zero);
    keybd_event(vk, 0, 2, UIntPtr.Zero);
    keybd_event(0x11, 0, 2, UIntPtr.Zero);
  }
}
'@
[FloatCloseTab]::Hits.Clear()
$cb = [FloatCloseTab+EnumProc]{ param($h, $l)
  if (-not [FloatCloseTab]::IsWindowVisible($h)) { return $true }
  $sb = New-Object System.Text.StringBuilder 512
  [void][FloatCloseTab]::GetWindowText($h, $sb, 512)
  if ([FloatCloseTab]::Skip($sb.ToString())) { return $true }
  if (-not [FloatCloseTab]::Big($h)) { return $true }
  [FloatCloseTab]::Hits.Add($h)
  return $true
}
[void][FloatCloseTab]::EnumWindows($cb, [IntPtr]::Zero)
if ([FloatCloseTab]::Hits.Count -eq 0) { exit 2 }
$browsers = @('chrome','msedge','firefox','brave','opera','vivaldi')
$picked = [IntPtr]::Zero
foreach ($h in [FloatCloseTab]::Hits) {
  $name = ''
  try { $name = (Get-Process -Id ([FloatCloseTab]::Pid($h)) -ErrorAction SilentlyContinue).ProcessName } catch {}
  if ($browsers -contains ([string]$name).ToLower()) { $picked = $h; break }
}
if ($picked -eq [IntPtr]::Zero) { exit 2 }
[FloatCloseTab]::Force($picked)
Start-Sleep -Milliseconds 220
if ([FloatCloseTab]::Pid([FloatCloseTab]::GetForegroundWindow()) -ne [FloatCloseTab]::Pid($picked)) { exit 3 }
[FloatCloseTab]::Chord(0x57)
exit 0
`;
  return runPowerShell(command).then((result) => {
    if (result.code === 2 || /exit code 2/i.test(result.error || '')) return { ok: false, error: 'no-window', action: 'close_tab' };
    if (result.code === 3 || /exit code 3/i.test(result.error || '')) return { ok: false, error: 'focus-failed', action: 'close_tab' };
    return { ok: result.ok, error: result.ok ? undefined : 'close-failed', action: 'close_tab' };
  });
}

function controlMedia(action = 'toggle', opts = {}) {
  const platform = process.platform;
  if (platform === 'win32' && /^scroll_/.test(action)) return scrollForeground(action);
  if (platform === 'win32' && action === 'close_tab') return closeForegroundTab();
  if (platform === 'win32' && action === 'open_chat') return openNamedChat(opts && opts.query);
  ensureTargetFocus();

  return new Promise((resolve) => {
    if (platform === 'win32') {
      // 1. True Windows Virtual-Key Hardware Media Controls (Play/Pause, Mute, Volume, Next/Prev)
      if (action in HARDWARE_MEDIA_VK) {
        const vk = HARDWARE_MEDIA_VK[action];
        const scriptPath = getMediaKeyScriptPath();
        const cmd = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}" ${vk}`;
        exec(cmd, { timeout: 3000, windowsHide: true }, (err) => {
          if (err) {
            console.warn('[OS:Media] Hardware media key execution failed:', err.message);
            resolve({ ok: false, error: err.message });
          } else {
            resolve({ ok: true, action, vk, platform: 'win32' });
          }
        });
        return;
      }

      // 2. Universal Navigation, Scrolling & Viewport Shortcuts (WScript.Shell SendKeys)
      let sendKeysArg = `'{PGDN}'`;
      if (action === 'zoom_in') sendKeysArg = `'^{+}'`;
      else if (action === 'zoom_out') sendKeysArg = `'^{-}'`;
      else if (action === 'zoom_reset') sendKeysArg = `'^0'`;
      else if (action === 'switch_tab') sendKeysArg = `'^{TAB}'`;
      else if (action === 'prev_tab') sendKeysArg = `'^+{TAB}'`;
      else if (action === 'switch_app') sendKeysArg = `'%{TAB}'`;
      else if (action === 'scroll_down') sendKeysArg = `'{PGDN}'`;
      else if (action === 'scroll_up') sendKeysArg = `'{PGUP}'`;
      else if (action === 'scroll_top') sendKeysArg = `'{HOME}'`;
      else if (action === 'scroll_bottom') sendKeysArg = `'{END}'`;
      else if (action === 'find_on_page') {
        const query = typeof opts === 'string' ? opts : (opts?.query || '');
        if (query && electronClipboard) {
          try {
            electronClipboard.writeText(query);
          } catch {}
          // Open Find bar, small delay to let browser/IDE animate dialog, paste query, hit Enter
          const psScript = `powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^f'); Start-Sleep -Milliseconds 120; $ws.SendKeys('^v{ENTER}')"`;
          exec(psScript, { timeout: 4000, windowsHide: true }, (err) => {
            if (err) resolve({ ok: false, error: err.message });
            else resolve({ ok: true, action, query, platform: 'win32' });
          });
          return;
        } else {
          sendKeysArg = `'^f'`;
        }
      }

      const psScript = `powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys(${sendKeysArg})"`;

      exec(psScript, { timeout: 3000, windowsHide: true }, (err) => {
        if (err) {
          console.warn('[OS:Media] Command failed:', err.message);
          resolve({ ok: false, error: err.message });
        } else {
          resolve({ ok: true, action, platform: 'win32' });
        }
      });
      return;
    }

    if (platform === 'darwin') {
      let script = `osascript -e 'tell application "System Events" to key code 16'`; // Play/pause
      if (action === 'mute') {
        script = `osascript -e "set volume output muted not (output muted of (get volume settings))"`;
      } else if (action === 'volume_up') {
        script = `osascript -e "set volume output volume ((output volume of (get volume settings)) + 10)"`;
      } else if (action === 'volume_down') {
        script = `osascript -e "set volume output volume ((output volume of (get volume settings)) - 10)"`;
      } else if (action === 'zoom_in') {
        script = `osascript -e 'tell application "System Events" to keystroke "=" using {command down}'`;
      } else if (action === 'zoom_out') {
        script = `osascript -e 'tell application "System Events" to keystroke "-" using {command down}'`;
      } else if (action === 'zoom_reset') {
        script = `osascript -e 'tell application "System Events" to keystroke "0" using {command down}'`;
      } else if (action === 'switch_tab') {
        script = `osascript -e 'tell application "System Events" to keystroke tab using {control down}'`;
      } else if (action === 'prev_tab') {
        script = `osascript -e 'tell application "System Events" to keystroke tab using {control down, shift down}'`;
      } else if (action === 'switch_app') {
        script = `osascript -e 'tell application "System Events" to keystroke tab using {command down}'`;
      } else if (action === 'scroll_down') {
        script = `osascript -e 'tell application "System Events" to key code 121'`; // Page Down
      } else if (action === 'scroll_up') {
        script = `osascript -e 'tell application "System Events" to key code 116'`; // Page Up
      } else if (action === 'scroll_top') {
        script = `osascript -e 'tell application "System Events" to key code 115'`; // Home
      } else if (action === 'scroll_bottom') {
        script = `osascript -e 'tell application "System Events" to key code 119'`; // End
      } else if (action === 'find_on_page') {
        const query = typeof opts === 'string' ? opts : (opts?.query || '');
        if (query && electronClipboard) {
          try {
            electronClipboard.writeText(query);
          } catch {}
          script = `osascript -e 'tell application "System Events" to keystroke "f" using {command down}' -e 'delay 0.12' -e 'tell application "System Events" to keystroke "v" using {command down}' -e 'delay 0.05' -e 'tell application "System Events" to key code 36'`; // 36 = Return
        } else {
          script = `osascript -e 'tell application "System Events" to keystroke "f" using {command down}'`;
        }
      }

      exec(script, { timeout: 4000 }, (err) => {
        if (err) {
          resolve({ ok: false, error: err.message });
        } else {
          resolve({ ok: true, action, platform: 'darwin' });
        }
      });
      return;
    }

    // Linux: xdotool / playerctl
    if (action === 'scroll_down') {
      exec(`xdotool key Page_Down`, { timeout: 3000 }, (err) => resolve({ ok: !err, action, platform: 'linux' }));
    } else if (action === 'scroll_up') {
      exec(`xdotool key Page_Up`, { timeout: 3000 }, (err) => resolve({ ok: !err, action, platform: 'linux' }));
    } else if (action === 'scroll_top') {
      exec(`xdotool key Home`, { timeout: 3000 }, (err) => resolve({ ok: !err, action, platform: 'linux' }));
    } else if (action === 'scroll_bottom') {
      exec(`xdotool key End`, { timeout: 3000 }, (err) => resolve({ ok: !err, action, platform: 'linux' }));
    } else if (action === 'find_on_page') {
      const query = typeof opts === 'string' ? opts : (opts?.query || '');
      if (query && electronClipboard) {
        try { electronClipboard.writeText(query); } catch {}
        exec(`xdotool key ctrl+f && sleep 0.12 && xdotool key ctrl+v Return`, { timeout: 4000 }, (err) => resolve({ ok: !err, action, platform: 'linux' }));
      } else {
        exec(`xdotool key ctrl+f`, { timeout: 3000 }, (err) => resolve({ ok: !err, action, platform: 'linux' }));
      }
    } else {
      exec(`playerctl play-pause 2>/dev/null || xdotool key XF86AudioPlay`, { timeout: 3000 }, (err) => {
        resolve({ ok: !err, action, platform: 'linux' });
      });
    }
  });
}

module.exports = {
  controlMedia,
  ensureTargetFocus
};

