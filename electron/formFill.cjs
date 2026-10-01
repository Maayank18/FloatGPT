/**
 * Inspect and fill form fields in Chrome/Edge via Windows UI Automation.
 * Targets the Chromium render widget (page), not the Orb or omnibox.
 * Never submits. Skips password-class controls.
 */

const { BrowserWindow } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let cachedHwnd = 0;
let cachedAt = 0;

function runPs(scriptBody, extraArgs, timeoutMs) {
  const file = path.join(os.tmpdir(), `floatgpt-form-${Date.now()}.ps1`);
  fs.writeFileSync(file, scriptBody, 'utf8');
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-STA', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file, ...(extraArgs || [])],
      { timeout: timeoutMs || 28000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        try { fs.unlinkSync(file); } catch {}
        if (err) reject(new Error((err.message || 'PowerShell failed') + (stderr ? ' ' + stderr : '') + (stdout ? ' ' + String(stdout).slice(0, 400) : '')));
        else resolve(String(stdout || '').trim());
      }
    );
  });
}

function parseJson(raw, fallback) {
  try {
    const fromObj = raw.indexOf('{');
    const fromArr = raw.indexOf('[');
    let startIdx = -1;
    if (fromArr < 0) startIdx = fromObj;
    else if (fromObj < 0) startIdx = fromArr;
    else startIdx = Math.min(fromObj, fromArr);
    if (startIdx < 0) return fallback;
    const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
    return JSON.parse(raw.slice(startIdx, end + 1));
  } catch {
    return fallback;
  }
}

function hideAppWindows() {
  const hidden = [];
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || !win.isVisible()) continue;
    hidden.push({ win, alwaysOnTop: win.isAlwaysOnTop() });
    try { win.setAlwaysOnTop(false); } catch {}
    win.hide();
  }
  return hidden;
}

function restoreAppWindows(hidden) {
  for (const { win, alwaysOnTop } of hidden) {
    if (!win || win.isDestroyed()) continue;
    try { if (alwaysOnTop) win.setAlwaysOnTop(true, 'screen-saver', 1); } catch {}
    win.show();
  }
}

const SHARED_PS = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName System.Windows.Forms
if (-not ('FgFormWin' -as [type])) {
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class FgFormWin {
  public const int SW_RESTORE = 9;
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder str, int nMaxCount);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder str, int nMaxCount);
  [DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr child, string cls, string win);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
}
"@
}

function Get-WinTitle([IntPtr]$hwnd) {
  $sb = New-Object System.Text.StringBuilder 1024
  [void][FgFormWin]::GetWindowText($hwnd, $sb, $sb.Capacity)
  return $sb.ToString()
}
function Get-WinClass([IntPtr]$hwnd) {
  $sb = New-Object System.Text.StringBuilder 256
  [void][FgFormWin]::GetClassName($hwnd, $sb, $sb.Capacity)
  return $sb.ToString()
}
function Test-SkipChromeUi([string]$name) {
  return $name -match '(?i)address and search|omnibox|search or type a url|search google|find in page|microsoft start|new tab|extensions|bookmarks bar|app toolbar'
}
function Test-BrowserProcess([string]$name) {
  return $name -match '^(chrome|msedge|msedgewebview2|brave|firefox|opera|vivaldi)$'
}
function Find-RenderWidget([IntPtr]$root) {
  $queue = New-Object System.Collections.Generic.Queue[IntPtr]
  $queue.Enqueue($root)
  $n = 0
  while ($queue.Count -gt 0 -and $n -lt 500) {
    $n++
    $cur = $queue.Dequeue()
    $child = [IntPtr]::Zero
    while ($true) {
      $child = [FgFormWin]::FindWindowEx($cur, $child, $null, $null)
      if ($child -eq [IntPtr]::Zero) { break }
      $cls = Get-WinClass $child
      if ($cls -eq 'Chrome_RenderWidgetHostHWND') { return $child }
      $queue.Enqueue($child)
    }
  }
  return [IntPtr]::Zero
}
function Resolve-FieldName($el) {
  try {
    $name = [string]$el.Current.Name
    if (-not [string]::IsNullOrWhiteSpace($name)) { return $name.Trim() }
  } catch {}
  try {
    $lb = $el.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::LabeledByProperty)
    if ($lb -ne $null) { return ([string]$lb.Current.Name).Trim() }
  } catch {}
  try {
    $ht = [string]$el.Current.HelpText
    if (-not [string]::IsNullOrWhiteSpace($ht)) { return $ht.Trim() }
  } catch {}
  try {
    $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
    $prev = $walker.GetPreviousSibling($el)
    if ($prev -ne $null) {
      $pn = [string]$prev.Current.Name
      $pt = [string]$prev.Current.ControlType.ProgrammaticName
      if (-not [string]::IsNullOrWhiteSpace($pn) -and $pt -match 'Text|Hyperlink|Group|Pane|Custom') { return $pn.Trim() }
    }
    $parent = $walker.GetParent($el)
    if ($parent -ne $null) {
      $pn = [string]$parent.Current.Name
      $pt = [string]$parent.Current.ControlType.ProgrammaticName
      if (-not [string]::IsNullOrWhiteSpace($pn) -and $pt -notmatch 'Window|Document|Pane') { return $pn.Trim() }
    }
  } catch {}
  return ''
}
function Collect-FromRoot($root) {
  $list = New-Object System.Collections.Generic.List[object]
  if (-not $root) { return $list }
  $edit = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
  $combo = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::ComboBox)
  $or = New-Object System.Windows.Automation.OrCondition($edit, $combo)
  $found = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $or)
  foreach ($el in $found) {
    try {
      if ([bool]$el.Current.IsPassword) { continue }
      $name = Resolve-FieldName $el
      if (Test-SkipChromeUi $name) { continue }
      $rect = $el.Current.BoundingRectangle
      if ($rect.Width -lt 8 -or $rect.Height -lt 8) { continue }
      $aid = [string]$el.Current.AutomationId
      $type = [string]$el.Current.ControlType.ProgrammaticName
      $list.Add(@{
        el = $el
        name = $name
        automationId = $aid
        type = $type
        isPassword = $false
        top = [int]$rect.Top
        left = [int]$rect.Left
      }) | Out-Null
    } catch {}
  }
  try {
    $customCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Custom)
    $customs = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $customCond)
    foreach ($el in $customs) {
      try {
        if ([bool]$el.Current.IsPassword) { continue }
        $vp = $null
        if (-not $el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp)) { continue }
        $name = Resolve-FieldName $el
        if (Test-SkipChromeUi $name) { continue }
        $rect = $el.Current.BoundingRectangle
        if ($rect.Width -lt 8 -or $rect.Height -lt 8) { continue }
        $list.Add(@{
          el = $el
          name = $name
          automationId = [string]$el.Current.AutomationId
          type = 'Custom'
          isPassword = $false
          top = [int]$rect.Top
          left = [int]$rect.Left
        }) | Out-Null
      } catch {}
    }
  } catch {}
  return $list
}
function Collect-Fields([IntPtr]$hwnd) {
  $rows = New-Object System.Collections.Generic.List[object]
  $render = Find-RenderWidget $hwnd
  $seen = New-Object 'System.Collections.Generic.HashSet[string]'
  $targets = New-Object System.Collections.Generic.List[IntPtr]
  if ($render -ne [IntPtr]::Zero) { $targets.Add($render) | Out-Null }
  $targets.Add($hwnd) | Out-Null
  foreach ($h in $targets) {
    try {
      $root = [System.Windows.Automation.AutomationElement]::FromHandle($h)
      foreach ($row in (Collect-FromRoot $root)) {
        $key = "$($row.top)|$($row.left)|$($row.name)|$($row.type)"
        if ($seen.Add($key)) { $rows.Add($row) | Out-Null }
      }
    } catch {}
  }
  return @($rows | Sort-Object top, left)
}
function Resolve-BrowserHwnd([int64]$PreferHwnd) {
  if ($PreferHwnd -ne 0) {
    $p = [IntPtr]$PreferHwnd
    if ([FgFormWin]::IsWindowVisible($p)) { return $p }
  }
  $fg = [FgFormWin]::GetForegroundWindow()
  $fgTitle = Get-WinTitle $fg
  $fgClass = Get-WinClass $fg
  if ($fgTitle -notmatch '(?i)floatgpt' -and $fgClass -match 'Chrome_WidgetWin|MozillaWindowClass|OpWindow') {
    return $fg
  }
  $best = $null
  $bestScore = 99
  Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.ProcessName -match '^(chrome|msedge|brave|firefox|opera|vivaldi)$' } | ForEach-Object {
    $h = [IntPtr]$_.MainWindowHandle
    if (-not [FgFormWin]::IsWindowVisible($h)) { return }
    $t = Get-WinTitle $h
    if ([string]::IsNullOrWhiteSpace($t) -or $t -match '(?i)floatgpt') { return }
    $score = 1
    if ($t -match '(?i)fill\\.dev|identity|unstop|google forms|application|careers|autofill') { $score = 0 }
    elseif ($t -match '(?i)^new tab|extensions') { $score = 2 }
    if ($score -lt $bestScore) { $best = $h; $bestScore = $score }
  }
  if ($best -ne $null) { return $best }
  return $fg
}
function Focus-Hwnd([IntPtr]$hwnd) {
  [void][FgFormWin]::ShowWindow($hwnd, 9)
  [void][FgFormWin]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 280
}
`;

const INSPECT_PS = SHARED_PS + `
$hwnd = Resolve-BrowserHwnd 0
Focus-Hwnd $hwnd
$title = Get-WinTitle $hwnd
$rows = Collect-Fields $hwnd
$fields = New-Object System.Collections.Generic.List[object]
$i = 0
foreach ($row in $rows) {
  $fields.Add(@{
    index = $i
    name = $row.name
    automationId = $row.automationId
    type = $row.type
    isPassword = $false
  }) | Out-Null
  $i++
  if ($i -ge 80) { break }
}
@{ hwnd = [int64]$hwnd; title = $title; fields = @($fields) } | ConvertTo-Json -Compress -Depth 6
`;

const FILL_PS = SHARED_PS + `
param([int64]$TargetHwnd, [string]$PayloadPath)
$hwnd = Resolve-BrowserHwnd $TargetHwnd
Focus-Hwnd $hwnd
$rows = @(Collect-Fields $hwnd)
$payload = Get-Content -Raw -Path $PayloadPath | ConvertFrom-Json
if ($payload -isnot [System.Array]) { $payload = @($payload) }
$filled = 0
$errors = New-Object System.Collections.Generic.List[string]
foreach ($item in $payload) {
  try {
    $idx = [int]$item.index
    if ($idx -lt 0 -or $idx -ge $rows.Count) { continue }
    $el = $rows[$idx].el
    $val = [string]$item.value
    if ([string]::IsNullOrEmpty($val)) { continue }
    if ([bool]$el.Current.IsPassword) { continue }
    $el.SetFocus()
    Start-Sleep -Milliseconds 60
    [System.Windows.Forms.SendKeys]::SendWait('^a')
    Start-Sleep -Milliseconds 25
    [System.Windows.Forms.SendKeys]::SendWait('{BACKSPACE}')
    Start-Sleep -Milliseconds 20
    $escaped = ($val -replace '([+^%~(){}])', '{$1}')
    [System.Windows.Forms.SendKeys]::SendWait($escaped)
    $vp = $null
    if ($el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp)) {
      try { if ([string]$vp.Current.Value -ne $val) { $vp.SetValue($val) } } catch {}
    }
    $filled++
  } catch {
    $errors.Add($_.Exception.Message) | Out-Null
  }
}
@{ filled = $filled; error = ($errors -join '; '); title = (Get-WinTitle $hwnd) } | ConvertTo-Json -Compress
`;

async function inspectForm() {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'Form fill currently supports Windows. Focus Chrome/Edge on the form, then try again from Windows.' };
  }
  const hidden = hideAppWindows();
  try {
    await new Promise((r) => setTimeout(r, 350));
    const raw = await runPs(INSPECT_PS, [], 28000);
    const parsed = parseJson(raw, null);
    if (!parsed) {
      return { ok: false, error: 'Could not read form fields from the browser. Fully restart FloatGPT, click the fill.dev page, then Fill again.' };
    }
    cachedHwnd = parsed.hwnd || 0;
    cachedAt = Date.now();
    return {
      ok: true,
      hwnd: parsed.hwnd,
      title: parsed.title || '',
      fields: Array.isArray(parsed.fields) ? parsed.fields : []
    };
  } catch (err) {
    return { ok: false, error: err.message || 'Form inspect failed.' };
  } finally {
    restoreAppWindows(hidden);
  }
}

async function fillForm(entries) {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'Form fill currently supports Windows.' };
  }
  const hwnd = cachedHwnd;
  if (!hwnd || Date.now() - cachedAt > 45000) {
    return { ok: false, error: 'Form window expired. Click Fill this form again with the page visible.' };
  }
  const payload = JSON.stringify(
    (entries || [])
      .filter((e) => e && e.value)
      .map((e) => ({ index: e.index, value: String(e.value).slice(0, 2000) }))
  );
  const payloadFile = path.join(os.tmpdir(), `floatgpt-form-payload-${Date.now()}.json`);
  fs.writeFileSync(payloadFile, payload, 'utf8');
  const hidden = hideAppWindows();
  try {
    await new Promise((r) => setTimeout(r, 280));
    const raw = await runPs(FILL_PS, ['-TargetHwnd', String(hwnd), '-PayloadPath', payloadFile], 35000);
    const parsed = parseJson(raw, { filled: 0 });
    cachedAt = Date.now();
    return { ok: true, filled: parsed.filled || 0, error: parsed.error || '' };
  } catch (err) {
    return { ok: false, error: err.message || 'Form fill failed.' };
  } finally {
    try { fs.unlinkSync(payloadFile); } catch {}
    restoreAppWindows(hidden);
  }
}

module.exports = { inspectForm, fillForm };
