# FloatGPT Native Hardware Media Key Simulator
# Dispatches true Windows Virtual-Key hardware events via user32.dll::keybd_event
# Zero Python dependencies, zero C++ compilation.
param([int]$vk = 179)

$code = @"
using System;
using System.Runtime.InteropServices;
public class HardwareMediaKey {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    public static void Tap(byte k) {
        const uint extended = 1;
        const uint keyup = 2;
        keybd_event(k, 0, extended, UIntPtr.Zero);
        keybd_event(k, 0, extended | keyup, UIntPtr.Zero);
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'HardwareMediaKey').Type) {
    Add-Type -TypeDefinition $code -Language CSharp -ErrorAction SilentlyContinue
}

try {
    [HardwareMediaKey]::Tap([byte]$vk)
    Write-Output "OK"
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
