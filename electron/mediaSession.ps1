param([string]$Action = '')

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and
  $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await-WinRt($WinRtTask, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  if (-not $netTask.Wait(5000)) { return $null }
  return $netTask.Result
}

$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$script:ManagerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]

function Invoke-MediaAction([string]$cmd) {
  try {
    $manager = Await-WinRt ($script:ManagerType::RequestAsync()) $script:ManagerType
    if ($null -eq $manager) { return 'ERR' }
    $session = $manager.GetCurrentSession()
    if ($null -eq $session) { return 'NONE' }
    if ($cmd -eq 'pause') {
      $ok = Await-WinRt ($session.TryPauseAsync()) ([bool])
    } elseif ($cmd -eq 'play') {
      $ok = Await-WinRt ($session.TryPlayAsync()) ([bool])
    } else {
      return 'BAD'
    }
    if ($ok) { return 'OK' }
    return 'NO'
  } catch {
    return 'ERR'
  }
}

if ($Action) {
  [Console]::Out.WriteLine((Invoke-MediaAction $Action.ToLower()))
  [Console]::Out.Flush()
  exit 0
}

[Console]::Out.WriteLine('READY')
[Console]::Out.Flush()
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $cmd = $line.Trim().ToLower()
  if (-not $cmd) { continue }
  if ($cmd -eq 'exit') { break }
  [Console]::Out.WriteLine((Invoke-MediaAction $cmd))
  [Console]::Out.Flush()
}
