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
    console.log('[Guardian] Initialized');
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

    // Use PowerShell to get titles of all windows that have a MainWindowHandle
    const psCommand = `powershell -NoProfile -NonInteractive -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object -ExpandProperty MainWindowTitle"`;
    
    exec(psCommand, (error, stdout) => {
      if (error) {
        // Ignore errors, could be permission issues on some system processes
        return;
      }
      
      const titles = stdout.split('\n').map(t => t.trim().toLowerCase()).filter(Boolean);
      
      // Check if any title contains a blocked keyword (e.g. 'youtube.com' or 'youtube')
      for (const title of titles) {
        for (const blockedKeyword of this.focusBlocklist) {
          // Normalize blocklist keyword (e.g. "youtube.com" -> "youtube")
          let keyword = blockedKeyword.toLowerCase().trim();
          if (keyword.includes('.com')) keyword = keyword.replace('.com', '');
          
          if (keyword && title.includes(keyword)) {
            this.triggerViolation(keyword, title);
            return; // Only trigger once per cycle
          }
        }
      }
    });
  }

  triggerViolation(keyword, windowTitle) {
    console.log(`[Guardian] VIOLATION DETECTED! Blocked keyword "${keyword}" found in window: "${windowTitle}"`);
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('guardian-violation', { keyword, windowTitle });
    }
  }
}

module.exports = new DigitalGuardian();
