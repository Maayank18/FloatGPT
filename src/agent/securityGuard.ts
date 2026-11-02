/**
 * FloatGPT Security Guard
 *
 * Renderer copy of electron/scriptFirewall.cjs. The main process runs the same
 * rules again before PowerShell starts, so this copy decides what the chat says.
 * securityParity.test.ts keeps the two in step.
 */

export type RiskLevel = 'SAFE' | 'REQUIRES_CONFIRMATION' | 'BLOCKED';

export interface SecurityAnalysis {
  riskLevel: RiskLevel;
  category: string;
  reason: string;
  isDangerous: boolean;
  blocked: boolean;
  script: string;
  deletion?: boolean;
  threatDetails?: string[];
}

export const MAX_SCRIPT_CHARS = 20000;

const SYSTEM_PATH = String.raw`(?:[a-z]:\\(?:windows|program files(?: \(x86\))?|programdata\\microsoft|boot|recovery|efi)\b|\\system32\b|\\syswow64\b|\\winsxs\b|systemroot|bootmgr)`;

const CATASTROPHIC: Array<{ regex: RegExp; category: string; reason: string }> = [
  { regex: /\b(format\s+[a-z]:|Format-Volume|Clear-Disk|Initialize-Disk|diskpart|clean\s+all|mkfs|fdisk|diskutil\s+eraseDisk|dd\s+if=)/i, category: 'Disk Destruction', reason: 'Drive formatting and partition destruction are strictly forbidden.' },
  { regex: new RegExp(String.raw`\b(Remove-Item|ri|rm|del|rmdir|rd|erase|trash|Set-Content|Add-Content|Out-File|Copy-Item|cpi|copy|Move-Item|mi|move|mv|New-Item|ni|Rename-Item|ren|takeown|icacls|attrib|cacls)\b[^\n;|]*${SYSTEM_PATH}`, 'i'), category: 'OS Integrity Threat', reason: 'Changing or deleting Windows system files is strictly forbidden.' },
  { regex: new RegExp(String.raw`>{1,2}\s*['"]?${SYSTEM_PATH}`, 'i'), category: 'OS Integrity Threat', reason: 'Writing into Windows system folders is strictly forbidden.' },
  { regex: /\b(rm\s+-(rf|fr|r|f)\s+(\/|\/\*|~\/|~|\/System|\/Library|\/usr|\/bin|\/sbin|\/etc|\/var))(\s|$)/i, category: 'OS Integrity Threat', reason: 'Recursive deletion of root or core system directories is strictly forbidden.' },
  { regex: /(System\.)?IO\.(File|Directory)\]::(Delete|Move|WriteAllBytes|WriteAllText)\s*\([^\n]*?(windows|system32|program files)/i, category: 'Direct .NET OS Tampering', reason: 'Direct .NET changes to system paths are strictly forbidden.' },
  { regex: /\b(Set-MpPreference\s+[^\n;|]*-Disable|Add-MpPreference\s+[^\n;|]*-Exclusion|netsh\s+advfirewall\s+set\s+\w+\s+state\s+off|Set-NetFirewallProfile\s+[^\n;|]*-Enabled\s+(False|\$false|0)|sc(\.exe)?\s+(stop|delete|config)\s+WinDefend|Set-ExecutionPolicy\s+Unrestricted|csrutil\s+disable|spctl\s+--master-disable)/i, category: 'Security Defense Tampering', reason: 'Disabling Windows Defender, the firewall, or OS protections is strictly forbidden.' },
  { regex: /\b(Invoke-WebRequest|iwr|wget|curl|Invoke-RestMethod|irm|Net\.WebClient|DownloadString|DownloadFile|Start-BitsTransfer)\b[^\n]*\b(Invoke-Expression|iex)\b|\b(Invoke-Expression|iex)\b[^\n]*\b(Invoke-WebRequest|iwr|wget|curl|Invoke-RestMethod|irm|Net\.WebClient|DownloadString)\b/i, category: 'Remote Web Cradle Payload', reason: 'Downloading and executing a remote payload is strictly forbidden.' },
  { regex: /\b(certutil(\.exe)?\s+[^\n;|]*(-urlcache|-decode|-f\s+http)|bitsadmin(\.exe)?\s+\/transfer|mshta(\.exe)?\s+|regsvr32(\.exe)?\s+[^\n;|]*\/i:|rundll32(\.exe)?\s+[^\n;|]*(javascript|url\.dll|shell32\.dll,\s*ShellExec)|msbuild(\.exe)?\s|installutil(\.exe)?\s|wmic(\.exe)?\s+[^\n;|]*process\s+call\s+create)/i, category: 'Living-Off-The-Land Binary', reason: 'That system tool is a known payload launcher and is strictly forbidden.' },
  { regex: /\b(mimikatz|lsass|comsvcs(\.dll)?[^\n]*MiniDump|procdump|reg(\.exe)?\s+save\s+hklm\\(sam|system|security)|vaultcmd|cmdkey\s+\/list|security\s+find-generic-password|dscl\s+\.\s+-authonly|Get-StoredCredential|Login Data|Local State)\b/i, category: 'Credential Theft Threat', reason: 'Reading saved passwords or dumping credentials is strictly forbidden.' },
  { regex: /\b(bcdedit|vssadmin(\.exe)?\s+(delete|resize)|wmic(\.exe)?\s+shadowcopy\s+delete|Get-WmiObject\s+Win32_ShadowCopy[^\n]*Delete|wbadmin\s+delete|tmutil\s+delete|reagentc\s+\/disable)\b/i, category: 'Ransomware / Recovery Sabotage', reason: 'Deleting backups or disabling system recovery is strictly forbidden.' },
  { regex: /\b(System\.Net\.Sockets\.(TCPClient|Socket|UdpClient)|Net\.Sockets\.TCPClient|nc(at)?(\.exe)?\s+[^\n;|]*-e\s|bash\s+-i\s+>&\s*\/dev\/tcp|zsh\s+-i\s+>&\s*\/dev\/tcp)/i, category: 'Reverse Shell Threat', reason: 'Opening a reverse shell or raw socket is strictly forbidden.' },
  { regex: /\b(Clear-EventLog|Remove-EventLog|wevtutil(\.exe)?\s+(cl|clear-log)|log\s+erase|Limit-EventLog)\b/i, category: 'Forensic Tampering', reason: 'Clearing system logs is strictly forbidden.' },
  { regex: /\b(Stop-Process|spps|kill|taskkill|tskill)\b[^\n;|]*\b(csrss|wininit|winlogon|smss|services|svchost|lsm|dwm|MsMpEng|System)\b(\.exe)?/i, category: 'Critical Process Kill', reason: 'Stopping a core Windows process can crash the PC and is strictly forbidden.' },
  { regex: /\bsudo\s/i, category: 'Privilege Escalation', reason: 'Running commands as root is strictly forbidden.' }
];

const SYSTEM_PATH_ANYWHERE = new RegExp(SYSTEM_PATH, 'i');
const WRITE_VERB = /\b(Remove-Item|Set-Content|Add-Content|Out-File|Copy-Item|Move-Item|New-Item|Rename-Item|Set-Acl|takeown|icacls|attrib|cacls|WriteAllBytes|WriteAllText)\b/i;

const DYNAMIC_CODE: RegExp[] = [
  /\b(Invoke-Expression|iex)\b/i,
  /\[\s*(System\.Management\.Automation\.)?ScriptBlock\s*\]\s*::\s*Create/i,
  /\$ExecutionContext\b/i,
  /\b(Invoke-Command|icm|Start-Job|Invoke-Item|ii)\b[^\n;|]*-(ScriptBlock|FilePath|ComputerName)\b/i,
  /\b(Set-Alias|New-Alias|sal|nal)\b/i,
  /(^|[\s;|{(=])[&.]\s*[$(]/,
  /(^|[\s;|{(=])[&.]\s*['"][^'"\n]*\$/,
  /\.\s*(InvokeScript|InvokeCommand|Invoke)\s*\(/i,
  /\b(powershell|pwsh)(\.exe)?['"]?\s(?:[^\n;|]*\s)?[-/](e|ec|en|enc|enco\w*|encodedcommand)\b/i,
  /\b(powershell|pwsh|cmd)(\.exe)?['"]?\s[^\n;|]*\$[\w{(]/i,
  /FromBase64String/i,
  /\[\s*char\s*\]\s*\d+\s*\+/i,
  /\[\s*char\s*\[\s*\]\s*\]/i,
  /\[\s*(System\.)?Reflection\.Assembly\s*\]\s*::\s*Load\s*\(/i,
  /\bAdd-Type\b[^\n]*-(Path|AssemblyName)\b/i
];

const DELETION_ALIAS = /(^|[\s;|&{(=])(ri|rm|rmdir|rd|del|erase|clc|cli|rp|unlink|shred|trash)(\.exe)?(\s|$)/i;

const DELETION: RegExp[] = [
  /\b(Remove-Item|Remove-ItemProperty|Clear-Content|Clear-Item|Clear-ItemProperty|Clear-RecycleBin|Remove-PSDrive|Remove-Partition|Remove-AppxPackage|Remove-AppxProvisionedPackage|Uninstall-Package|Uninstall-Module|Remove-WindowsFeature|Disable-WindowsOptionalFeature)\b/i,
  /\bcmd(\.exe)?\s+\/[ck]\s+[^\n]*\b(del|erase|rd|rmdir)\b/i,
  /(System\.)?IO\.(File|Directory|FileInfo|DirectoryInfo)\]::Delete\b/i,
  /\b(File|Directory)\.Delete\s*\(/,
  /\.Delete\s*\(\s*(\$true|true)?\s*\)/i,
  /\breg(\.exe)?\s+delete\b/i,
  /\bcipher(\.exe)?\s+\/w/i,
  /\bsdelete(64)?(\.exe)?\b/i,
  /\bmsiexec(\.exe)?\s+[^\n;|]*\/x\b/i,
  /\bwmic(\.exe)?\s+[^\n;|]*\buninstall\b/i,
  /\bwinget\s+uninstall\b/i
];

const SENSITIVE: Array<{ regex: RegExp; category: string; reason: string }> = [
  { regex: /\b(Move-Item|move\s|ren\s|Rename-Item|mv\s|mi\s)/i, category: 'File Relocation / Renaming', reason: 'This command moves or renames files.' },
  { regex: /\b(Set-Content|Add-Content|Out-File|Copy-Item|cpi\s|New-Item\s[^\n;|]*-ItemType\s+(File|Directory)|Expand-Archive|Compress-Archive)\b/i, category: 'File Write', reason: 'This command writes or overwrites files.' },
  { regex: /\b(Stop-Process|spps|taskkill|kill\s|tskill|killall\s|pkill\s)/i, category: 'Process Termination', reason: 'This command stops a running process.' },
  { regex: /\b(Set-ItemProperty|New-ItemProperty|sp\s+HK|reg(\.exe)?\s+(add|import|load|copy))\b/i, category: 'Windows Registry Modification', reason: 'This command changes the Windows Registry.' },
  { regex: /\b(Stop-Computer|Restart-Computer|shutdown(\.exe)?|logoff(\.exe)?|Suspend-Computer)\b/i, category: 'System Power State', reason: 'This command shuts down, restarts, or signs out of the computer.' },
  { regex: /\b(netsh\s|Set-NetIPAddress|New-NetIPAddress|Set-DnsClientServerAddress|Disable-NetAdapter|Enable-NetAdapter|New-NetFirewallRule|Set-NetFirewallRule|route\s+(add|delete|change))/i, category: 'Network Configuration', reason: 'This command changes network or firewall settings.' },
  { regex: /\b(winget\s+install|npm\s+(install|i)\s+-g|pip\s+install|choco\s+install|scoop\s+install|Install-Package|Install-Module|msiexec(\.exe)?\s+[^\n;|]*\/i\b|Add-AppxPackage)\b/i, category: 'Software Installation', reason: 'This command installs software.' },
  { regex: /\b(Set-Service|New-Service|Stop-Service|Start-Service|Restart-Service|sc(\.exe)?\s+(config|create|stop|start)|net\s+(start|stop|user|localgroup))\b/i, category: 'System Service or Account Change', reason: 'This command changes a Windows service or user account.' },
  { regex: /\b(Register-ScheduledTask|New-ScheduledTask|schtasks(\.exe)?\s+\/create|Set-ScheduledTask)\b/i, category: 'Scheduled Task', reason: 'This command makes something run on a schedule.' },
  { regex: /-Verb\s+['"]?RunAs\b|\brunas(\.exe)?\s/i, category: 'Administrator Elevation', reason: 'This command asks for administrator rights.' },
  { regex: /\b(Set-ExecutionPolicy|Set-MpPreference|Add-MpPreference|Enable-PSRemoting|Set-Item\s+WSMan)\b/i, category: 'Security Setting Change', reason: 'This command changes a security setting.' }
];

const BENIGN_CLOSE_BLOCKERS = /\*|Get-Process\s*\|\s*(Stop-Process|spps)|\b(explorer|electron|cursor|code|node|floatgpt|powershell|pwsh|cmd|conhost|taskmgr|MsMpEng)\b(\.exe)?|\/PID\s+\d|-Id\s+\d/i;

function decodeBase64(value: string): string[] {
  try {
    const binary = typeof atob === 'function'
      ? atob(value)
      : (globalThis as any).Buffer?.from(value, 'base64').toString('binary') ?? '';
    if (!binary) return [];
    const bytes = Uint8Array.from(binary, (char: string) => char.charCodeAt(0));
    return [new TextDecoder('utf-16le').decode(bytes), new TextDecoder('utf-8').decode(bytes)];
  } catch {
    return [];
  }
}

function expandPaths(text: string): string {
  return text
    .replace(/\$\{?env:(windir|systemroot)\}?/gi, 'C:\\Windows')
    .replace(/%(windir|systemroot)%/gi, 'C:\\Windows')
    .replace(/\$\{env:programfiles\(x86\)\}|%programfiles\(x86\)%/gi, 'C:\\Program Files (x86)')
    .replace(/\$\{?env:(programfiles|programw6432)\}?|%(programfiles|programw6432)%/gi, 'C:\\Program Files')
    .replace(/\$\{?env:(programdata|allusersprofile)\}?|%(programdata|allusersprofile)%/gi, 'C:\\ProgramData')
    .replace(/\$\{?env:systemdrive\}?|%systemdrive%/gi, 'C:')
    .replace(/\\\\\?\\/g, '')
    .replace(/\//g, '\\')
    .replace(/\\{2,}/g, '\\');
}

/** Every rewritten form of the script that a rule is tested against. */
export function normalizeScriptForAnalysis(rawScript: string): string[] {
  const raw = typeof rawScript === 'string' ? rawScript : '';
  const found = new Set<string>([raw]);
  const bases = [raw, raw.replace(/<#[\s\S]*?#>/g, ' ').replace(/#[^\r\n]*/g, ' ')];
  for (const base of bases) {
    const deTicked = base.replace(/`([^\r\n])/g, '$1').replace(/\^([^\r\n])/g, '$1');
    const joined = deTicked.replace(/['"]\s*\+\s*['"]/g, '').replace(/['"]\s*\)\s*\+\s*\(\s*['"]/g, '');
    const unquoted = joined.replace(/(^|[\s;|&{(=])['"]([A-Za-z][\w-]*)['"](?=[\s;|)}]|$)/g, '$1$2');
    for (const text of [base, deTicked, joined, unquoted]) {
      found.add(text);
      found.add(expandPaths(text));
      found.add(text.replace(/\s+/g, ' '));
    }
  }
  for (const text of [...found]) {
    const encoded = text.matchAll(/(?:\s-(?:e|ec|en|enc|enco\w*|encodedcommand)\s+|FromBase64String\s*\(\s*['"])([A-Za-z0-9+/=]{8,})/gi);
    for (const match of encoded) {
      for (const decoded of decodeBase64(match[1])) {
        found.add(decoded);
        found.add(expandPaths(decoded));
      }
    }
  }
  return [...found];
}

function withoutLiterals(text: string): string {
  return text.replace(/@'[\s\S]*?'@/g, "''").replace(/'(?:[^'\r\n]|'')*'/g, "''");
}

function result(riskLevel: RiskLevel, category: string, reason: string, script: string, deletion = false): SecurityAnalysis {
  return {
    riskLevel,
    category,
    reason,
    isDangerous: riskLevel !== 'SAFE',
    blocked: riskLevel === 'BLOCKED',
    script,
    deletion,
    threatDetails: reason ? [reason] : undefined
  };
}

export function analyzeCommandSecurity(script: string): SecurityAnalysis {
  const raw = typeof script === 'string' ? script : '';
  const trimmed = raw.trim();
  if (!trimmed) return result('SAFE', 'Empty Script', 'No executable code provided.', '');
  if (raw.length > MAX_SCRIPT_CHARS) return result('BLOCKED', 'Oversized Script', 'That script is too long to check safely.', trimmed);
  if (raw.includes('\u0000')) return result('BLOCKED', 'Malformed Script', 'That script contains hidden control characters.', trimmed);

  const versions = normalizeScriptForAnalysis(raw);
  for (const version of versions) {
    for (const rule of CATASTROPHIC) {
      if (rule.regex.test(version)) return result('BLOCKED', rule.category, rule.reason, trimmed);
    }
    if (WRITE_VERB.test(version) && SYSTEM_PATH_ANYWHERE.test(version)) {
      return result('BLOCKED', 'OS Integrity Threat', 'Changing or deleting Windows system files is strictly forbidden.', trimmed);
    }
  }

  const commands = [...new Set(versions.map(withoutLiterals))];
  const deletes = versions.some((version) => DELETION.some((regex) => regex.test(version)))
    || commands.some((version) => DELETION_ALIAS.test(version));
  if (deletes) {
    return result('BLOCKED', 'File & Folder Deletion', 'FloatGPT does not delete files, folders, apps, or registry keys. Run that yourself if you want it.', trimmed, true);
  }
  if (versions.some((version) => DYNAMIC_CODE.some((regex) => regex.test(version)))) {
    return result('BLOCKED', 'Hidden or Dynamic Code', 'That script builds or hides the command it runs, so it cannot be checked.', trimmed);
  }

  const closeIsRisky = versions.some((version) => BENIGN_CLOSE_BLOCKERS.test(version));
  for (const rule of SENSITIVE) {
    if (!commands.some((version) => rule.regex.test(version))) continue;
    if (rule.category === 'Process Termination' && !closeIsRisky) continue;
    return result('REQUIRES_CONFIRMATION', rule.category, rule.reason, trimmed);
  }

  return result('SAFE', 'Standard OS Action', 'Safe operation verified by FloatGPT Security Engine.', trimmed);
}
