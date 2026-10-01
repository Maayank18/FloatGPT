/**
 * FloatGPT — WhatsApp Single-Tab Reuse Engine
 *
 * Reuses one WhatsApp Web window. Never resizes the browser. Never reloads
 * the SPA via the address bar when a session is already open.
 */

import { detectPlatform } from '../../../platform';

export type WhatsAppSurface = 'web' | 'desktop';

export interface TabDispatchResult {
  success: boolean;
  reusedExisting: boolean;
  surface: WhatsAppSurface;
  error?: string;
}

export interface WebDispatchPayload {
  phone: string;
  name?: string;
  text: string;
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Windows: reuse the existing WhatsApp Web window in-place (no address-bar
 * reload, no restore/resize). Cold-start only when no session is found.
 */
export function buildWindowsWebReuseScript(
  webUrl: string,
  payload?: WebDispatchPayload,
  preferredPid?: number
): string {
  const url = escapePowerShellSingleQuoted(webUrl);
  const phone = escapePowerShellSingleQuoted((payload?.phone || '').replace(/[^\d]/g, ''));
  const contact = escapePowerShellSingleQuoted(payload?.name || '');
  const text = escapePowerShellSingleQuoted(payload?.text || '');
  const pid = Number.isFinite(preferredPid) && (preferredPid as number) > 0 ? String(preferredPid) : '0';

  return `
$ErrorActionPreference = 'SilentlyContinue';
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class FgWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@;

function Focus-Hwnd([IntPtr]$hwnd) {
  if ($hwnd -eq [IntPtr]::Zero) { return $false }
  if ([FgWin]::IsIconic($hwnd)) { [FgWin]::ShowWindow($hwnd, 9) | Out-Null }
  [FgWin]::SetForegroundWindow($hwnd) | Out-Null;
  return $true;
}

function Send-Enter([IntPtr]$hwnd) {
  if (-not (Focus-Hwnd $hwnd)) { return }
  Start-Sleep -Milliseconds 180;
  [FgWin]::keybd_event(0x0D, 0, 0, [UIntPtr]::Zero);
  Start-Sleep -Milliseconds 40;
  [FgWin]::keybd_event(0x0D, 0, 2, [UIntPtr]::Zero);
}

function Find-WaWindow([int]$preferredPid, [string]$contactName) {
  if ($preferredPid -gt 0) {
    $pref = Get-Process -Id $preferredPid -ErrorAction SilentlyContinue;
    if ($pref -and $pref.MainWindowHandle -ne 0) { return $pref }
  }
  $windows = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 };
  $hit = $windows | Where-Object { $_.MainWindowTitle -match 'WhatsApp' } | Select-Object -First 1;
  if ($hit) { return $hit }
  if ($contactName) {
    $hit = $windows | Where-Object { $_.ProcessName -match 'chrome|msedge|brave|firefox|opera' -and $_.MainWindowTitle -match [regex]::Escape($contactName) } | Select-Object -First 1;
    if ($hit) { return $hit }
  }
  return $null;
}

$wshell = New-Object -ComObject WScript.Shell;
$phone = '${phone}';
$contactName = '${contact}';
$messageText = '${text}';
$existing = Find-WaWindow ${pid} $contactName;
$reused = $false;
$targetPid = 0;
$hwnd = [IntPtr]::Zero;

if ($existing) {
  $reused = $true;
  $targetPid = $existing.Id;
  $hwnd = $existing.MainWindowHandle;
  Focus-Hwnd $hwnd | Out-Null;
  Start-Sleep -Milliseconds 250;
  $oldClip = $null;
  try { $oldClip = Get-Clipboard -Raw -ErrorAction SilentlyContinue } catch {}
  try {
    $wshell.SendKeys('{ESC}');
    Start-Sleep -Milliseconds 200;
    $titleAlready = $existing.MainWindowTitle;
    $onChat = $contactName -and ($titleAlready -match [regex]::Escape($contactName));
    if (-not $onChat) {
      $wshell.SendKeys('^%n');
      Start-Sleep -Milliseconds 700;
      Set-Clipboard -Value $phone -ErrorAction Stop;
      Start-Sleep -Milliseconds 80;
      $wshell.SendKeys('^v');
      Start-Sleep -Milliseconds 500;
      Send-Enter $hwnd;
      Start-Sleep -Milliseconds 1600;
    }
    Set-Clipboard -Value $messageText -ErrorAction Stop;
    Start-Sleep -Milliseconds 80;
    $wshell.SendKeys('^v');
    Start-Sleep -Milliseconds 350;
    Send-Enter $hwnd;
    Start-Sleep -Milliseconds 500;
    Send-Enter $hwnd;
    Start-Sleep -Milliseconds 400;
    Send-Enter $hwnd;
  } finally {
    Start-Sleep -Milliseconds 120;
    try {
      if ($null -ne $oldClip) { Set-Clipboard -Value $oldClip -ErrorAction SilentlyContinue }
      else { Set-Clipboard -Value '' -ErrorAction SilentlyContinue }
    } catch {}
  }
}

if (-not $reused) {
  Start-Process '${url}';
  Start-Sleep -Milliseconds 9000;
  $found = Find-WaWindow 0 $contactName;
  if ($found) {
    $targetPid = $found.Id;
    $hwnd = $found.MainWindowHandle;
  }
  Send-Enter $hwnd;
  Start-Sleep -Milliseconds 2000;
  Send-Enter $hwnd;
  Start-Sleep -Milliseconds 1800;
  Send-Enter $hwnd;
}

Write-Output ("WA_PID=" + $targetPid);
`.trim();
}

export function buildWindowsDesktopScript(desktopUri: string): string {
  const uri = escapePowerShellSingleQuoted(desktopUri);
  return `
$ErrorActionPreference = 'SilentlyContinue';
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class FgWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@;
$wshell = New-Object -ComObject WScript.Shell;
$existing = Get-Process | Where-Object {
  $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match 'WhatsApp' -and $_.ProcessName -notmatch 'chrome|msedge|firefox|brave|opera'
} | Select-Object -First 1;

if ($existing) {
  if ([FgWin]::IsIconic($existing.MainWindowHandle)) { [FgWin]::ShowWindow($existing.MainWindowHandle, 9) | Out-Null }
  [FgWin]::SetForegroundWindow($existing.MainWindowHandle) | Out-Null;
} else {
  Start-Process '${uri}';
}

$delays = @(1800, 1400, 1400);
foreach ($d in $delays) {
  Start-Sleep -Milliseconds $d;
  $native = Get-Process | Where-Object {
    $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match 'WhatsApp' -and $_.ProcessName -notmatch 'chrome|msedge|firefox|brave|opera'
  } | Select-Object -First 1;
  if ($native) {
    [FgWin]::SetForegroundWindow($native.MainWindowHandle) | Out-Null;
    Start-Sleep -Milliseconds 200;
    [FgWin]::keybd_event(0x0D, 0, 0, [UIntPtr]::Zero);
    Start-Sleep -Milliseconds 40;
    [FgWin]::keybd_event(0x0D, 0, 2, [UIntPtr]::Zero);
  } elseif ($wshell.AppActivate('WhatsApp')) {
    Start-Sleep -Milliseconds 200;
    $wshell.SendKeys('{ENTER}');
  }
}
`.trim();
}

/**
 * macOS: activate an existing web.whatsapp.com tab without reloading it.
 */
export function buildMacWebReuseScript(webUrl: string): string {
  const url = escapeAppleScriptString(webUrl);
  return `
set targetUrl to "${url}"
set foundTab to false

tell application "System Events"
  set chromeRunning to (exists process "Google Chrome")
  set edgeRunning to (exists process "Microsoft Edge")
  set safariRunning to (exists process "Safari")
end tell

if chromeRunning then
  tell application "Google Chrome"
    repeat with w in windows
      set tabIndex to 1
      repeat with t in tabs of w
        if URL of t contains "web.whatsapp.com" then
          set active tab index of w to tabIndex
          set index of w to 1
          set foundTab to true
          activate
          exit repeat
        end if
        set tabIndex to tabIndex + 1
      end repeat
      if foundTab then exit repeat
    end repeat
  end tell
end if

if not foundTab and edgeRunning then
  tell application "Microsoft Edge"
    repeat with w in windows
      set tabIndex to 1
      repeat with t in tabs of w
        if URL of t contains "web.whatsapp.com" then
          set active tab index of w to tabIndex
          set index of w to 1
          set foundTab to true
          activate
          exit repeat
        end if
        set tabIndex to tabIndex + 1
      end repeat
      if foundTab then exit repeat
    end repeat
  end tell
end if

if not foundTab and safariRunning then
  tell application "Safari"
    repeat with w in windows
      repeat with t in tabs of w
        if URL of t contains "web.whatsapp.com" then
          set current tab of w to t
          set foundTab to true
          activate
          exit repeat
        end if
      end repeat
      if foundTab then exit repeat
    end repeat
  end tell
end if

if not foundTab then
  open location targetUrl
  delay 8
else
  delay 0.8
end if

delay 0.4
tell application "System Events" to keystroke return
delay 1.6
tell application "System Events" to keystroke return
`.trim();
}

export function buildMacDesktopScript(desktopUri: string): string {
  const uri = escapeAppleScriptString(desktopUri);
  return `
tell application "System Events"
  if exists process "WhatsApp" then
    tell application "WhatsApp" to activate
  else
    open location "${uri}"
  end if
end tell
delay 1.6
tell application "System Events" to keystroke return
`.trim();
}

export function buildLinuxWebScript(webUrl: string): string {
  return `xdg-open '${escapePowerShellSingleQuoted(webUrl)}'`;
}

export class WhatsAppTabManager {
  private static queue: Promise<void> = Promise.resolve();
  private static lastWebUrl: string | null = null;
  private static lastBrowserPid: number | null = null;

  static enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work, work);
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  static buildDispatchScript(
    surface: WhatsAppSurface,
    targetUrl: string,
    payload?: WebDispatchPayload
  ): string {
    const platform = detectPlatform();
    if (surface === 'desktop') {
      if (platform === 'darwin') return buildMacDesktopScript(targetUrl);
      return buildWindowsDesktopScript(targetUrl);
    }
    if (platform === 'darwin') return buildMacWebReuseScript(targetUrl);
    if (platform === 'linux') return buildLinuxWebScript(targetUrl);
    return buildWindowsWebReuseScript(targetUrl, payload, this.lastBrowserPid || undefined);
  }

  static async dispatch(
    surface: WhatsAppSurface,
    targetUrl: string,
    payload?: WebDispatchPayload
  ): Promise<TabDispatchResult> {
    return this.enqueue(async () => {
      const reusedExisting = surface === 'web' && this.lastBrowserPid !== null;
      if (surface === 'web') this.lastWebUrl = targetUrl;

      if (typeof window === 'undefined') {
        return { success: true, reusedExisting: false, surface };
      }

      const electronFlow = (window as any).electronAPI?.flow;
      const electronApi = (window as any).electronAPI;
      const script = this.buildDispatchScript(surface, targetUrl, payload);

      try {
        if (electronFlow?.executeScript) {
          const result = await electronFlow.executeScript(script);
          const pidMatch = String(result?.output || '').match(/WA_PID=(\d+)/);
          if (pidMatch && Number(pidMatch[1]) > 0) {
            this.lastBrowserPid = Number(pidMatch[1]);
          }
          return { success: true, reusedExisting, surface };
        }

        if (electronFlow?.openUrl) {
          await electronFlow.openUrl(targetUrl);
          return { success: true, reusedExisting: false, surface };
        }

        if (electronApi?.openExternal) {
          await electronApi.openExternal(targetUrl);
          return { success: true, reusedExisting: false, surface };
        }
      } catch (err: any) {
        console.warn('[WhatsAppTabManager] Native dispatch failed:', err);
        return {
          success: false,
          reusedExisting: false,
          surface,
          error: err?.message || 'Native WhatsApp dispatch failed.'
        };
      }

      try {
        const named = window.open(targetUrl, 'floatgpt_whatsapp_web');
        if (!named) {
          const a = document.createElement('a');
          a.href = targetUrl;
          a.target = 'floatgpt_whatsapp_web';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        return { success: true, reusedExisting: Boolean(named), surface };
      } catch (err: any) {
        return {
          success: false,
          reusedExisting: false,
          surface,
          error: err?.message || 'Unable to open WhatsApp.'
        };
      }
    });
  }

  static resetForTesting(): void {
    this.queue = Promise.resolve();
    this.lastWebUrl = null;
    this.lastBrowserPid = null;
  }
}
