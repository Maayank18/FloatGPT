/**
 * OS Action Handler (Electron Main Process)
 *
 * Platform-agnostic and platform-specific handlers for launching apps,
 * focusing windows, executing safe OS scripts, and managing system state.
 * Runs in the Electron main process with strict security validation.
 */

const { shell } = require('electron');
const { exec, spawn } = require('child_process');
const path = require('path');
const os = require('os');

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
      'the setting': 'ms-settings:',
      'the settings': 'ms-settings:',
      'device setting': 'ms-settings:',
      'device settings': 'ms-settings:',
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
};
