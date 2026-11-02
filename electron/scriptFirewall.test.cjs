const assert = require('node:assert/strict');
const { assessOsScript } = require('./scriptFirewall.cjs');

assert.equal(assessOsScript("Stop-Process -Name SystemSettings -ErrorAction SilentlyContinue").ok, true);
assert.equal(assessOsScript('taskkill /IM notepad.exe').ok, true);
assert.equal(assessOsScript('Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID').ok, true);

assert.equal(assessOsScript('Remove-Item -Path C:\\Users\\me\\notes.txt').ok, false);
assert.equal(assessOsScript('Remove-Item -Path C:\\Users\\me\\notes.txt', { confirmed: true }).ok, false, 'a confirmed delete is still blocked');
assert.equal(assessOsScript('Remove-Item -Recurse -Force C:\\Windows\\System32\\drivers', { confirmed: true }).ok, false);
assert.equal(assessOsScript('Stop-Process -Name lsass -Force', { confirmed: true }).ok, false);
assert.equal(assessOsScript('Format-Volume -DriveLetter D -Force', { confirmed: true }).ok, false);

const shutdown = assessOsScript('shutdown /s /t 0');
assert.equal(shutdown.ok, false);
assert.equal(shutdown.needsConfirmation, true);
assert.equal(assessOsScript('shutdown /s /t 0', { confirmed: true }).ok, true);

assert.equal(assessOsScript('reg add HKCU\\Software\\Test /v A /t REG_SZ /d 1').ok, false);
assert.equal(assessOsScript('Stop-Process -Name notepad; winget install example').ok, false);
assert.equal(assessOsScript('Stop-Process -Name notepad; shutdown /s /t 0').ok, false);

console.log('script firewall checks passed');
