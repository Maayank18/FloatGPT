/**
 * Native OS Media & Viewport Controller (Electron Main Process).
 * 
 * Simulates universal hardware media keys (Play/Pause, Mute, Volume, Next/Prev),
 * display zoom, tab switching, hands-free viewport scrolling (PageDown/PageUp/Home/End),
 * and universal in-page search (Ctrl+F + clipboard injection) with 0ms latency.
 * 
 * Zero Python dependencies. Zero C++ compilation. Pure OS-native execution.
 */

const { exec } = require('child_process');

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
function controlMedia(action = 'toggle', opts = {}) {
  const platform = process.platform;
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

