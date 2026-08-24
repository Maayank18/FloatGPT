/**
 * OS Action Handler (Electron Main Process)
 *
 * Platform-specific handlers for launching apps, focusing windows,
 * and other OS-level actions. Runs in the Electron main process.
 */

const { shell } = require('electron');
const { exec, spawn } = require('child_process');
const path = require('path');

/**
 * Main Process Security Firewall: Verifies script safety before execution.
 */
const CATASTROPHIC_PATTERNS = [
  { regex: /\b(format\s+[a-z]:|Format-Volume|diskpart|clean\s+all)\b/i, reason: 'Drive formatting and partition destruction are strictly forbidden.' },
  { regex: /\b(Remove-Item|del|rmdir|rd|erase|trash)\s+.*?(c:\\windows|c:\\program files|system32|systemroot|system\.bak|syswow64)\b/i, reason: 'Modifying or deleting core Windows OS system files is strictly forbidden.' },
  { regex: /\[System\.IO\.(File|Directory)\]::(Delete|Move|WriteAllBytes)\s*\(.*?(windows|system32|program files)/i, reason: 'Direct .NET modification of system paths is strictly forbidden.' },
  { regex: /\b(Set-MpPreference\s+-DisableRealtimeMonitoring|netsh\s+advfirewall\s+set\s+allprofiles\s+state\s+off|sc\s+stop\s+WinDefend|Set-ExecutionPolicy\s+Unrestricted)\b/i, reason: 'Disabling Windows Defender, Firewall, or OS security protections is strictly forbidden.' },
  { regex: /\b(Invoke-Expression|iex)\s*\(?\s*(New-Object\s+Net\.WebClient|Invoke-WebRequest|curl|iwr|wget)\b/i, reason: 'Downloading and executing arbitrary remote web payloads is strictly forbidden.' },
  { regex: /\b(certutil(\.exe)?\s+(-urlcache|-f\s+http)|bitsadmin(\.exe)?\s+\/transfer|mshta(\.exe)?\s+http)/i, reason: 'Using certutil, bitsadmin, or mshta to download remote payloads is strictly forbidden.' },
  { regex: /\b(mimikatz|lsass|comsvcs\.dll.*MiniDump|reg\s+save\s+hklm\\(sam|system|security)|vaultcmd)\b/i, reason: 'Harvesting Windows credentials, memory dumps, or SAM registry hives is strictly forbidden.' },
  { regex: /\b(bcdedit|vssadmin\s+delete\s+shadows|wmic\s+shadowcopy\s+delete|wbadmin\s+delete\s+catalog)\b/i, reason: 'Deleting volume shadow copies or disabling Windows boot recovery is strictly forbidden.' },
  { regex: /\b(System\.Net\.Sockets\.TCPClient|System\.Net\.Sockets\.Socket|nc\.exe|ncat(\.exe)?\s+-e|bash\s+-i\s+>&)\b/i, reason: 'Initiating unauthorized reverse shells or raw network socket streams is strictly forbidden.' },
  { regex: /\b(Clear-EventLog|wevtutil\s+cl)\b/i, reason: 'Clearing system security or audit logs is strictly forbidden.' },
  { regex: /\b(regsvr32(\.exe)?\s+\/u\s+\/n\s+\/s\s+\/i:http|rundll32(\.exe)?\s+javascript:|wmic(\.exe)?\s+process\s+call\s+create)\b/i, reason: 'Executing unverified code via regsvr32, rundll32, or WMIC is strictly forbidden.' }
];

function sanitizeForCommand(input) {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[;&|`$<>\r\n]/g, '').trim();
}

/**
 * Open an application by name.
 * Uses platform-specific search strategies.
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
 * Windows: Try to launch an app using Start-Process or by searching common paths.
 */
function openAppWindows(nameLower, originalName) {
  return new Promise((resolve) => {
    // Common app mappings for Windows
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
      'the setting': 'ms-settings:',
      'the settings': 'ms-settings:',
      'device setting': 'ms-settings:',
      'device settings': 'ms-settings:',
      'laptop setting': 'ms-settings:',
      'laptop settings': 'ms-settings:',
      'windows settings': 'ms-settings:',
      'system settings': 'ms-settings:',
      'control panel': 'control',
      'snipping tool': 'snippingtool',
      // Websites
      'linkedin': 'https://linkedin.com',
      'youtube': 'https://youtube.com',
      'github': 'https://github.com',
      'google': 'https://google.com',
      'twitter': 'https://twitter.com',
      'facebook': 'https://facebook.com',
      'chatgpt': 'https://chat.openai.com',
    };

    const mapped = WIN_APP_MAP[nameLower];
    const target = mapped || originalName;

    // Validate URLs / Protocols
    if (target.includes(':')) {
      if (/^https?:\/\//i.test(target) || target.startsWith('ms-settings:')) {
        shell.openExternal(target)
          .then(() => resolve(true))
          .catch(() => resolve(false));
      } else {
        resolve(false);
      }
      return;
    }

    // Try Start-Process with sanitized target
    const escaped = sanitizeForCommand(target).replace(/'/g, "''");
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
}

/**
 * macOS: Launch apps using the `open` command.
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
      'finder': 'Finder',
      'spotify': 'Spotify',
      'discord': 'Discord',
      'slack': 'Slack',
      'teams': 'Microsoft Teams',
      'notes': 'Notes',
      'messages': 'Messages',
      'mail': 'Mail',
      'photos': 'Photos',
      'music': 'Music',
      'settings': 'System Preferences',
      'system preferences': 'System Preferences',
      'system settings': 'System Settings',
      'activity monitor': 'Activity Monitor',
      'calculator': 'Calculator',
    };

    const mapped = MAC_APP_MAP[nameLower];
    const appName = mapped || originalName;
    const sanitized = sanitizeForCommand(appName).replace(/"/g, '\\"');

    exec(`open -a "${sanitized}"`, { timeout: 5000 }, (err) => {
      resolve(!err);
    });
  });
}

/**
 * Linux: Launch apps using common methods.
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

    // Strict protocol check: Only allow HTTP and HTTPS
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      // Disallow file:, javascript:, data:, vbscript:, etc.
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

    await shell.openExternal(normalizedUrl);
    return true;
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
 * Focus a window by title (Windows only).
 */
function focusWindow(windowTitle) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false);
      return;
    }

    const sanitized = sanitizeForCommand(windowTitle).replace(/'/g, "''");
    const psScript = `
      $wnd = Get-Process | Where-Object { $_.MainWindowTitle -like '*${sanitized}*' } | Select-Object -First 1
      if ($wnd) {
        [void] [System.Reflection.Assembly]::LoadWithPartialName('Microsoft.VisualBasic')
        [Microsoft.VisualBasic.Interaction]::AppActivate($wnd.Id)
      }
    `;
    exec(`powershell -NoProfile -Command "${psScript.replace(/\n/g, '; ')}"`, { timeout: 5000 }, (err) => {
      resolve(!err);
    });
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

/**
 * Execute an arbitrary OS script (e.g. PowerShell)
 * Defense-In-Depth: Hard-blocks any catastrophic threat at the main-process level!
 */
function executeScript(scriptContent) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, output: 'OS Agent execution is currently only supported on Windows.' });
      return;
    }

    if (!scriptContent || typeof scriptContent !== 'string') {
      resolve({ success: false, output: 'No executable script provided.' });
      return;
    }

    // Main-Process Security Kernel Check (Defense in Depth)
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

    try {
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
};
