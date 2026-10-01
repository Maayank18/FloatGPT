/**
 * FloatGPT — Risk Engine & Security Firewall
 * 
 * Multi-tier security engine that inspects, de-obfuscates, and classifies
 * actions into strict risk tiers before any adapter execution.
 */

import { RiskLevel, StructuredAction } from './protocol';

export interface SecurityEvaluation {
  riskLevel: RiskLevel;
  category: string;
  reason: string;
  blocked: boolean;
  requiresConfirmation: boolean;
  threatDetails?: string[];
}

// ─── Level 4: Catastrophic & Malicious Patterns (STRICTLY FORBIDDEN) ───
const CATASTROPHIC_PATTERNS: Array<{ regex: RegExp; category: string; reason: string }> = [
  // Drive & Volume Destruction
  {
    regex: /(format\s+[a-z]:|\bFormat-Volume\b|\bdiskpart\b|\bclean\s+all\b|\bmkfs\b|\bfdisk\b|\bdiskutil\s+eraseDisk\b|\bdd\s+if=)/i,
    category: 'Disk Destruction',
    reason: 'Drive formatting and partition destruction are strictly forbidden.'
  },
  // Core System File Destruction (Windows & macOS/Linux)
  {
    regex: /\b(Remove-Item|del|rmdir|rd|erase|trash)\s+.*?(c:\\windows|c:\\program files|system32|systemroot|system\.bak|syswow64)\b/i,
    category: 'OS Integrity Threat',
    reason: 'Modifying or deleting core Windows OS system files is strictly forbidden.'
  },
  {
    regex: /\b(rm\s+-(rf|fr|r|f)\s+(\/|\/\*|~\/|~|\/System|\/Library|\/usr|\/bin|\/sbin|\/etc|\/var))\b/i,
    category: 'OS Integrity Threat',
    reason: 'Recursive deletion of root or core macOS/Linux system directories is strictly forbidden.'
  },
  // .NET System File Deletion Bypass
  {
    regex: /\[System\.IO\.(File|Directory)\]::(Delete|Move|WriteAllBytes)\s*\(.*?(windows|system32|program files)/i,
    category: 'Direct .NET OS Tampering',
    reason: 'Direct .NET modification of system paths is strictly forbidden.'
  },
  // Disabling OS Security & Defenses
  {
    regex: /\b(Set-MpPreference\s+-DisableRealtimeMonitoring|netsh\s+advfirewall\s+set\s+allprofiles\s+state\s+off|sc\s+stop\s+WinDefend|Set-ExecutionPolicy\s+Unrestricted|csrutil\s+disable|spctl\s+--master-disable)\b/i,
    category: 'Security Defense Tampering',
    reason: 'Disabling Windows Defender, Gatekeeper, SIP, or OS security protections is strictly forbidden.'
  },
  // Remote Web Cradles & Payload Downloaders
  {
    regex: /\b(Invoke-Expression|iex)\s*\(?\s*(New-Object\s+Net\.WebClient|Invoke-WebRequest|curl|iwr|wget)\b/i,
    category: 'Remote Web Cradle Payload',
    reason: 'Downloading and executing arbitrary remote web payloads is strictly forbidden.'
  },
  {
    regex: /\b(certutil(\.exe)?\s+(-urlcache|-f\s+http)|bitsadmin(\.exe)?\s+\/transfer|mshta(\.exe)?\s+http)\b/i,
    category: 'Living-Off-The-Land Web Dropper',
    reason: 'Using certutil, bitsadmin, or mshta to download remote payloads is strictly forbidden.'
  },
  // Credential Harvesting & Memory Dumps
  {
    regex: /\b(mimikatz|lsass|comsvcs\.dll.*MiniDump|reg\s+save\s+hklm\\(sam|system|security)|vaultcmd|security\s+find-generic-password|dscl\s+\.\s+-authonly)\b/i,
    category: 'Credential Theft Threat',
    reason: 'Harvesting OS credentials, keychain passwords, or memory dumps is strictly forbidden.'
  },
  // Ransomware / System Recovery Destruction
  {
    regex: /\b(bcdedit|vssadmin\s+delete\s+shadows|wmic\s+shadowcopy\s+delete|wbadmin\s+delete\s+catalog|tmutil\s+delete)\b/i,
    category: 'Ransomware / Recovery Sabotage',
    reason: 'Deleting volume shadow copies or disabling system recovery is strictly forbidden.'
  },
  // Reverse Shells & Socket Exploits
  {
    regex: /\b(System\.Net\.Sockets\.TCPClient|System\.Net\.Sockets\.Socket|nc(\.exe)?\s+-e|ncat(\.exe)?\s+-e|bash\s+-i\s+>&\s*\/dev\/tcp|zsh\s+-i\s+>&\s*\/dev\/tcp)\b/i,
    category: 'Reverse Shell Threat',
    reason: 'Initiating unauthorized reverse shells or raw network socket streams is strictly forbidden.'
  }
];

export class RiskEngine {
  /**
   * Evaluates an action and assigns its authoritative risk classification.
   */
  static evaluate(action: StructuredAction): SecurityEvaluation {
    const rawTarget = JSON.stringify(action.target || {});
    const rawArgs = JSON.stringify(action.arguments || (action as any).parameters || {});
    const combinedString = `${action.capability} ${rawTarget} ${rawArgs}`;

    // 1. Check Level 4 Catastrophic Patterns
    for (const pattern of CATASTROPHIC_PATTERNS) {
      if (pattern.regex.test(combinedString)) {
        return {
          riskLevel: 'LEVEL_4_FORBIDDEN',
          category: pattern.category,
          reason: pattern.reason,
          blocked: true,
          requiresConfirmation: false,
          threatDetails: [pattern.reason]
        };
      }
    }

    // 2. Check Level 3 Destructive Actions
    if (
      action.capability === 'filesystem.delete' ||
      action.capability === 'process.kill' ||
      /\b(delete|remove|erase|kill|destroy|drop)\b/i.test(action.capability)
    ) {
      return {
        riskLevel: 'LEVEL_3_DESTRUCTIVE',
        category: 'Destructive Operation',
        reason: 'This action permanently modifies or removes data/processes.',
        blocked: false,
        requiresConfirmation: true
      };
    }

    // 3. Check Level 2 Sensitive Actions
    if (
      action.capability === 'filesystem.write' ||
      action.capability === 'application.close' ||
      action.source === 'untrusted_external'
    ) {
      return {
        riskLevel: 'LEVEL_2_SENSITIVE',
        category: 'Sensitive Operation',
        reason: action.source === 'untrusted_external'
          ? 'Action originates from untrusted external content and requires confirmation.'
          : 'This action modifies local documents or system state.',
        blocked: false,
        requiresConfirmation: true
      };
    }

    // 4. Level 0 Read/Observation
    if (
      action.capability.endsWith('.read') ||
      action.capability.endsWith('.get_time') ||
      action.capability.endsWith('.list_directory') ||
      action.capability.endsWith('.capture_screen')
    ) {
      return {
        riskLevel: 'LEVEL_0_OBSERVE',
        category: 'Observation',
        reason: 'Read-only observation of system state.',
        blocked: false,
        requiresConfirmation: false
      };
    }

    // Default to Level 1 Low Risk
    return {
      riskLevel: 'LEVEL_1_LOW_RISK',
      category: 'Standard Operation',
      reason: 'Standard application or navigation task.',
      blocked: false,
      requiresConfirmation: false
    };
  }
}
