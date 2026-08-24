/**
 * FloatGPT Security Guard & Safety Net
 *
 * Enterprise-grade multi-tiered defense engine that de-obfuscates, analyzes,
 * and intercepts PowerShell and OS-level operations before execution.
 */

export type RiskLevel = 'SAFE' | 'REQUIRES_CONFIRMATION' | 'BLOCKED';

export interface SecurityAnalysis {
  riskLevel: RiskLevel;
  category: string;
  reason: string;
  isDangerous: boolean;
  blocked: boolean;
  script: string;
  threatDetails?: string[];
}

// ─── 1. De-obfuscation & Normalization Pipeline ─────────────────────

/**
 * Strips comments, backticks, string concatenations, and decodes Base64 payloads
 * to prevent attackers or prompt injections from bypassing security filters.
 */
export function normalizeScriptForAnalysis(rawScript: string): string[] {
  const variations: string[] = [];
  if (!rawScript || typeof rawScript !== 'string') return [''];

  const trimmed = rawScript.trim();
  variations.push(trimmed);

  // 1. Remove comments: Multiline <# ... #> and inline # ...
  let clean = trimmed
    .replace(/<#[\s\S]*?#>/g, ' ')
    .replace(/#[^\r\n]*/g, ' ');

  // 2. Remove PowerShell escape backticks (e.g. R`e`m`o`v`e`-`I`t`e`m -> Remove-Item)
  const deBackticked = clean.replace(/`([a-zA-Z0-9_\-\.\:\$])/g, '$1');
  variations.push(deBackticked);

  // 3. Resolve simple string concatenation (e.g. 'R'+'emove-Item' or "del"+" file")
  const deConcatenated = deBackticked.replace(/['"]\s*\+\s*['"]/g, '');
  variations.push(deConcatenated);

  // 4. Extract and decode Base64 strings (e.g. -enc ... or FromBase64String)
  const base64Regexes = [
    /(?:-enc|-encodedcommand|-e)\s+([A-Za-z0-9+/=]{12,})/i,
    /FromBase64String\s*\(\s*['"]([A-Za-z0-9+/=]{12,})['"]\s*\)/i
  ];

  for (const b64Regex of base64Regexes) {
    const match = deConcatenated.match(b64Regex);
    if (match && match[1]) {
      try {
        if (typeof Buffer !== 'undefined') {
          // In Node / Electron environment
          const decoded = Buffer.from(match[1], 'base64').toString('utf16le') || Buffer.from(match[1], 'base64').toString('utf8');
          variations.push(decoded);
        } else if (typeof atob !== 'undefined') {
          // In Browser environment
          const decoded = atob(match[1]);
          variations.push(decoded);
        }
      } catch {
        // Silently skip malformed base64
      }
    }
  }

  // 5. Flatten extra whitespace
  const flattened = deConcatenated.replace(/\s+/g, ' ');
  variations.push(flattened);

  return Array.from(new Set(variations));
}

// ─── 2. Tier 3: Catastrophic / Malicious Threat Patterns (STRICTLY BLOCKED) ───
const CATASTROPHIC_PATTERNS: Array<{ regex: RegExp; category: string; reason: string }> = [
  // Drive & Volume Destruction
  {
    regex: /\b(format\s+[a-z]:|Format-Volume|diskpart|clean\s+all)\b/i,
    category: 'Disk Destruction',
    reason: 'Drive formatting and partition destruction are strictly forbidden.'
  },
  // Core System File Destruction
  {
    regex: /\b(Remove-Item|del|rmdir|rd|erase|trash)\s+.*?(c:\\windows|c:\\program files|system32|systemroot|system\.bak|syswow64)\b/i,
    category: 'OS Integrity Threat',
    reason: 'Modifying or deleting core Windows OS system files is strictly forbidden.'
  },
  // .NET System File Deletion Bypass
  {
    regex: /\[System\.IO\.(File|Directory)\]::(Delete|Move|WriteAllBytes)\s*\(.*?(windows|system32|program files)/i,
    category: 'Direct .NET OS Tampering',
    reason: 'Direct .NET deletion or modification of system paths is strictly forbidden.'
  },
  // Disabling OS Security & Defenses
  {
    regex: /\b(Set-MpPreference\s+-DisableRealtimeMonitoring|netsh\s+advfirewall\s+set\s+allprofiles\s+state\s+off|sc\s+stop\s+WinDefend|Set-ExecutionPolicy\s+Unrestricted)\b/i,
    category: 'Security Defense Tampering',
    reason: 'Disabling Windows Defender, Firewall, or OS security protections is strictly forbidden.'
  },
  // Remote Web Cradles & Payload Downloaders
  {
    regex: /\b(Invoke-Expression|iex)\s*\(?\s*(New-Object\s+Net\.WebClient|Invoke-WebRequest|curl|iwr|wget)\b/i,
    category: 'Remote Web Cradle Payload',
    reason: 'Downloading and executing arbitrary remote web payloads is strictly forbidden.'
  },
  {
    regex: /\b(certutil(\.exe)?\s+(-urlcache|-f\s+http)|bitsadmin(\.exe)?\s+\/transfer|mshta(\.exe)?\s+http)/i,
    category: 'Living-Off-The-Land Web Dropper',
    reason: 'Using certutil, bitsadmin, or mshta to download remote payloads is strictly forbidden.'
  },
  // Credential Harvesting & Memory Dumps
  {
    regex: /\b(mimikatz|lsass|comsvcs\.dll.*MiniDump|reg\s+save\s+hklm\\(sam|system|security)|vaultcmd)\b/i,
    category: 'Credential Theft Threat',
    reason: 'Harvesting Windows credentials, memory dumps, or SAM registry hives is strictly forbidden.'
  },
  // Ransomware / System Recovery Destruction
  {
    regex: /\b(bcdedit|vssadmin\s+delete\s+shadows|wmic\s+shadowcopy\s+delete|wbadmin\s+delete\s+catalog)\b/i,
    category: 'Ransomware / Recovery Sabotage',
    reason: 'Deleting volume shadow copies or disabling Windows boot recovery is strictly forbidden.'
  },
  // Reverse Shells & Socket Exploits
  {
    regex: /\b(System\.Net\.Sockets\.TCPClient|System\.Net\.Sockets\.Socket|nc\.exe|ncat(\.exe)?\s+-e|bash\s+-i\s+>&)\b/i,
    category: 'Reverse Shell Threat',
    reason: 'Initiating unauthorized reverse shells or raw network socket streams is strictly forbidden.'
  },
  // Event Log & Forensics Cleansing
  {
    regex: /\b(Clear-EventLog|wevtutil\s+cl)\b/i,
    category: 'Forensic Tampering',
    reason: 'Clearing system security or audit logs is strictly forbidden.'
  },
  // LOLBins Dynamic Code Execution
  {
    regex: /\b(regsvr32(\.exe)?\s+\/u\s+\/n\s+\/s\s+\/i:http|rundll32(\.exe)?\s+javascript:|wmic(\.exe)?\s+process\s+call\s+create)\b/i,
    category: 'LOLBin Code Injection',
    reason: 'Executing unverified code via regsvr32, rundll32, or WMIC is strictly forbidden.'
  }
];

// ─── 3. Tier 2: Destructive / Sensitive Patterns (REQUIRES USER CONFIRMATION) ───
const SENSITIVE_PATTERNS: Array<{ regex: RegExp; category: string; reason: string }> = [
  // File Deletion
  {
    regex: /\b(Remove-Item|del\s|rmdir\s|rd\s|erase\s|trash)\b/i,
    category: 'File & Folder Deletion',
    reason: 'This command will permanently delete files or folders from your storage.'
  },
  {
    regex: /\[System\.IO\.(File|Directory)\]::Delete\b/i,
    category: 'Direct File Deletion',
    reason: 'This command directly deletes files or directories via .NET system APIs.'
  },
  // File Moving / Renaming
  {
    regex: /\b(Move-Item|move\s|ren\s|Rename-Item)\b/i,
    category: 'File Relocation / Renaming',
    reason: 'This command will move or rename files on your system.'
  },
  // Process Termination
  {
    regex: /\b(Stop-Process|taskkill|kill\s|tskill)\b/i,
    category: 'Process Termination',
    reason: 'This command will forcefully terminate a running background or foreground application.'
  },
  // Windows Registry Modifications
  {
    regex: /\b(Set-ItemProperty|New-ItemProperty|Remove-ItemProperty|reg\s+add|reg\s+delete)\b/i,
    category: 'Windows Registry Modification',
    reason: 'This command modifies keys or values in the Windows Registry.'
  },
  // System Power State
  {
    regex: /\b(Stop-Computer|Restart-Computer|shutdown(\.exe)?)\b/i,
    category: 'System Power State',
    reason: 'This command will shut down or restart your computer.'
  },
  // Network Configuration
  {
    regex: /\b(netsh\s|Set-NetIPAddress|Set-DnsClientServerAddress|Disable-NetAdapter|Enable-NetAdapter)\b/i,
    category: 'Network Configuration',
    reason: 'This command modifies your network adapters or DNS/IP settings.'
  },
  // Global Software Installation
  {
    regex: /\b(winget\s+install|npm\s+install\s+-g|pip\s+install|choco\s+install)\b/i,
    category: 'Global Software Installation',
    reason: 'This command will install software or global packages on your machine.'
  },
  // Service Management
  {
    regex: /\b(Set-Service|sc\s+config|net\s+start|net\s+stop)\b/i,
    category: 'System Service Modification',
    reason: 'This command modifies, starts, or stops a Windows background service.'
  }
];

/**
 * Analyzes any OS / PowerShell command across all de-obfuscation layers
 * and returns a robust risk evaluation.
 */
export function analyzeCommandSecurity(script: string): SecurityAnalysis {
  const trimmed = (script || '').trim();
  if (!trimmed) {
    return {
      riskLevel: 'SAFE',
      category: 'Empty Script',
      reason: 'No executable code provided.',
      isDangerous: false,
      blocked: false,
      script: ''
    };
  }

  // De-obfuscate raw script into normalized variants
  const variations = normalizeScriptForAnalysis(trimmed);
  const matchedThreats: string[] = [];

  // 1. Check Tier 3: Catastrophic Threat Patterns across ALL variations
  for (const variant of variations) {
    for (const item of CATASTROPHIC_PATTERNS) {
      if (item.regex.test(variant)) {
        return {
          riskLevel: 'BLOCKED',
          category: item.category,
          reason: item.reason,
          isDangerous: true,
          blocked: true,
          script: trimmed,
          threatDetails: [item.reason]
        };
      }
    }
  }

  // 2. Check Tier 2: Sensitive Threat Patterns across ALL variations
  for (const variant of variations) {
    for (const item of SENSITIVE_PATTERNS) {
      if (item.regex.test(variant)) {
        matchedThreats.push(item.reason);
        return {
          riskLevel: 'REQUIRES_CONFIRMATION',
          category: item.category,
          reason: item.reason,
          isDangerous: true,
          blocked: false,
          script: trimmed,
          threatDetails: matchedThreats
        };
      }
    }
  }

  // 3. Tier 1: Safe Verified Operation
  return {
    riskLevel: 'SAFE',
    category: 'Standard OS Action',
    reason: 'Safe operation verified by FloatGPT Security Engine.',
    isDangerous: false,
    blocked: false,
    script: trimmed
  };
}

