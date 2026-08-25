const { exec } = require('child_process');
const { ipcMain } = require('electron');

class DigitalGuardian {
  constructor() {
    this.intervalId = null;
    this.focusBlocklist = [];
    this.isFocusModeActive = false;
    this.mainWindow = null;
  }

  init(mainWindow) {
    this.mainWindow = mainWindow;
    console.log('[Guardian] Initialized on platform:', process.platform);
  }

  // Called from main.cjs when global state updates
  updateState(state) {
    const productivity = state?.settings?.productivity;
    if (!productivity) return;

    this.focusBlocklist = productivity.focusBlocklist || [];
    
    // Check if focus mode state changed
    const newFocusMode = productivity.focusMode === true;
    
    if (newFocusMode && !this.isFocusModeActive) {
      this.startMonitoring();
    } else if (!newFocusMode && this.isFocusModeActive) {
      this.stopMonitoring();
    }
    
    this.isFocusModeActive = newFocusMode;
  }

  startMonitoring() {
    console.log('[Guardian] Starting Focus Mode monitoring...');
    if (this.intervalId) clearInterval(this.intervalId);
    
    // Poll every 3 seconds
    this.intervalId = setInterval(() => this.checkActiveWindows(), 3000);
  }

  stopMonitoring() {
    console.log('[Guardian] Stopping Focus Mode monitoring.');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  checkActiveWindows() {
    if (this.focusBlocklist.length === 0) return;

    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: Use PowerShell to get titles of all windows with a MainWindowHandle
      const psCommand = `powershell -NoProfile -NonInteractive -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object -ExpandProperty MainWindowTitle"`;
      
      exec(psCommand, { timeout: 2500 }, (error, stdout) => {
        if (error) return;
        const titles = stdout.split('\n').map(t => t.trim().toLowerCase()).filter(Boolean);
        this.evaluateTitles(titles);
      });
    } else if (platform === 'darwin') {
      // macOS: Use AppleScript to query running foreground process names and active window titles
      const macCommand = `osascript -e '
        tell application "System Events"
          set appNames to name of (every process whose background only is false)
          set winTitles to {}
          repeat with proc in (every process whose background only is false)
            try
              set procWins to title of every window of proc
              set winTitles to winTitles & procWins
            end try
          end repeat
          return appNames & winTitles
        end tell
      '`;

      exec(macCommand, { timeout: 2500 }, (error, stdout) => {
        if (error) return;
        const titles = stdout.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        this.evaluateTitles(titles);
      });
    } else {
      // Linux: Use wmctrl or xdotool if available
      exec(`wmctrl -l || true`, { timeout: 2500 }, (error, stdout) => {
        if (error || !stdout) return;
        const titles = stdout.split('\n').map(t => t.trim().toLowerCase()).filter(Boolean);
        this.evaluateTitles(titles);
      });
    }
  }

  evaluateTitles(titles) {
    for (const title of titles) {
      for (const blockedKeyword of this.focusBlocklist) {
        let keyword = blockedKeyword.toLowerCase().trim();
        if (keyword.includes('.com')) keyword = keyword.replace('.com', '');
        
        if (keyword && title.includes(keyword)) {
          this.triggerViolation(keyword, title);
          return; // Only trigger once per cycle
        }
      }
    }
  }

  triggerViolation(keyword, windowTitle) {
    console.log(`[Guardian] VIOLATION DETECTED! Blocked keyword "${keyword}" found in window/process: "${windowTitle}"`);
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('guardian-violation', { keyword, windowTitle });
    }
  }
}

module.exports = new DigitalGuardian();
