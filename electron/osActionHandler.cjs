/**
 * OS Action Handler (Electron Main Process)
 *
 * Platform-specific handlers for launching apps, focusing windows,
 * and other OS-level actions. Runs in the Electron main process.
 */

const { shell } = require('electron');
const { exec } = require('child_process');
const path = require('path');

/**
 * Open an application by name.
 * Uses platform-specific search strategies.
 */
async function openApp(appName) {
  const platform = process.platform;
  const name = appName.trim().toLowerCase();

  try {
    if (platform === 'win32') {
      return await openAppWindows(name, appName);
    } else if (platform === 'darwin') {
      return await openAppMac(name, appName);
    } else {
      return await openAppLinux(name, appName);
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

    // Try protocol or URL launch first (e.g., ms-settings: or https://)
    if (target.includes(':')) {
      shell.openExternal(target)
        .then(() => resolve(true))
        .catch(() => resolve(false));
      return;
    }

    // Try Start-Process
    const escaped = target.replace(/"/g, '\\"');
    exec(`powershell -Command "Start-Process '${escaped}'"`, { timeout: 5000 }, (err) => {
      if (err) {
        // Fallback: try opening as a shell command
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

    exec(`open -a "${appName}"`, { timeout: 5000 }, (err) => {
      resolve(!err);
    });
  });
}

/**
 * Linux: Launch apps using common methods.
 */
function openAppLinux(nameLower, originalName) {
  return new Promise((resolve) => {
    const target = nameLower.replace(/\s+/g, '-');
    exec(`${target} &`, { timeout: 5000 }, (err) => {
      if (err) {
        // Try with xdg-open
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
 * Open a URL in the default browser.
 */
async function openUrl(url) {
  try {
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
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
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  return openUrl(searchUrl);
}

/**
 * Focus a window by title (Windows only for now).
 */
function focusWindow(windowTitle) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false);
      return;
    }

    const escaped = windowTitle.replace(/"/g, '\\"');
    const psScript = `
      $wnd = Get-Process | Where-Object { $_.MainWindowTitle -like '*${escaped}*' } | Select-Object -First 1
      if ($wnd) {
        [void] [System.Reflection.Assembly]::LoadWithPartialName('Microsoft.VisualBasic')
        [Microsoft.VisualBasic.Interaction]::AppActivate($wnd.Id)
      }
    `;
    exec(`powershell -Command "${psScript.replace(/\n/g, '; ')}"`, { timeout: 5000 }, (err) => {
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
 * WARNING: Must be used with a safety/confirmation layer in the UI
 */
function executeScript(scriptContent) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, output: 'OS Agent execution is currently only supported on Windows.' });
      return;
    }

    // Run powershell with execution policy bypass for the script block
    exec(`powershell -NoProfile -NonInteractive -Command "${scriptContent.replace(/"/g, '\\"')}"`, 
      { timeout: 15000 }, 
      (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, output: stderr || error.message });
        } else {
          resolve({ success: true, output: stdout });
        }
      }
    );
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
