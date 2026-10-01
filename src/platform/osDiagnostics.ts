/**
 * Deterministic hardware & OS diagnostics — Accio-style.
 * Intent is resolved deterministically with zero tokens.
 * Truth comes strictly from Electron main (Node os / Win32 / WMI / native fs), never LLM hallucinations.
 * Fully operable in 100% offline mode.
 */

export type DiagKind =
  | 'ram'
  | 'cpu'
  | 'battery'
  | 'system'
  | 'desktop_folders'
  | 'screen_recordings'
  | 'top_processes'
  | 'open_taskmgr_and_ram';

export interface RamSnapshot {
  totalGb: number;
  usedGb: number;
  freeGb: number;
  percent: number;
}

export interface ProcessRamItem {
  name: string;
  displayName?: string;
  instances: number;
  bytes: number;
  mb: number;
}

export interface DiagSnapshot {
  ok?: boolean;
  error?: string;
  hostname?: string;
  platform?: string;
  uptimeSec?: number;
  ram?: RamSnapshot;
  cpu?: { percent: number; cores: number; model: string };
  battery?: { percent: number; charging: boolean; status?: number; statusText?: string } | null;
  desktopFolders?: { path: string; count: number; folders: string[] };
  /** Flat fields returned by the desktop scan before they are nested. */
  path?: string;
  count?: number;
  folders?: string[];
  screenRecordings?: {
    count: number;
    totalBytes: number;
    totalMb: number;
    totalGb: number;
    locations: { dir: string; count: number }[];
    recent: { name: string; folder: string; sizeMb: number; date: string }[];
  };
  processes?: ProcessRamItem[];
  taskManagerOpened?: boolean;
  openedAppName?: string;
}

import { normalizeUtterance } from './naturalLanguage';

/**
 * Deterministic detection for OS-level diagnostic and inspection queries.
 * Covers Battery, Desktop Folders, Screen Recordings, RAM Hogs, Task Manager, CPU, and System status.
 */
export function detectSystemDiagIntent(raw: string): DiagKind | null {
  const original = String(raw || '').toLowerCase();
  const q = normalizeUtterance(raw) || original;
  if (!q) return null;
  if (/\bramadan\b/.test(original)) return null;

  const mentionsDesktop = /\b(desktop|deskop|deskto)\b/.test(q);
  const mentionsFolder = /\b(folder|folders|directory|directories)\b/.test(q);
  if (mentionsDesktop && mentionsFolder) {
    if (
      /\b(how many|count|number of|list|present|kitne|kitna|show|what|total|all)\b/.test(q) ||
      /\b(desktop pe|desktop par|on desktop|on my desktop)\b/.test(q)
    ) {
      return 'desktop_folders';
    }
  }
  if (/^(desktop folders|folders on desktop|folders on my desktop|count folders on desktop)$/i.test(q)) {
    return 'desktop_folders';
  }

  const mentionsScreenRecording = /\b(screen\s*recording|screen\s*recordings|screen\s*record|screen\s*captures?|recordings?)\b/.test(q);
  if (mentionsScreenRecording) {
    if (
      /\b(how many|total|count|find|list|kitni|kitne|number of|do i have|on my (pc|laptop|computer)|in total)\b/.test(q) ||
      /^(how many screen recordings|screen recordings in total|total screen recordings|screen recordings count|find screen recordings|screen recordings)$/i.test(q)
    ) {
      return 'screen_recordings';
    }
  }

  const mentionsTaskManager = /\b(task\s*bar|taskbar|task\s*manager|taskmgr)\b/.test(q);
  const mentionsOpen = /\b(open|launch|start|kholo|kholdo|run)\b/.test(q);
  const mentionsRam = /\b(ram|memory)\b/.test(q);

  if (mentionsTaskManager && (mentionsOpen || mentionsRam)) {
    return 'open_taskmgr_and_ram';
  }

  const mentionsRamHog =
    /\b(which app|what app|which process|what process|konsi app|apps? taking|app taking|process taking|consuming too much|taking too much|taking most|taking highest|uses? most|using most|hogging|memory hog|ram hog|top ram|top memory|heavy ram|high ram)\b/.test(q)
    || (/\b(which|what)\b/.test(q) && /\b(app|application|process)\b/.test(q) && /\b(ram|memory)\b/.test(q));

  if (mentionsRamHog && mentionsRam) {
    return 'top_processes';
  }

  const mentionsBattery = /\b(battery|charge|charging|battery\s*ki)\b/.test(q);
  const batteryAsk =
    /\b(level|status|percent|percentage|how much|what|check|left|remaining|kitni|kitna|bachi|health|find|finding)\b/.test(q)
    || /^(battery|battery status|battery percent|battery percentage|battery level|check battery)$/i.test(q);

  if (mentionsBattery && (batteryAsk || /^(battery|battery level)$/i.test(q))) {
    return 'battery';
  }

  if (
    /^(cpu|cpu usage|processor usage)$/i.test(q) ||
    (/\b(cpu|processor)\b/.test(q) && /\b(usage|percent|used|load|how much|currently|kitna|kitni|use)\b/.test(q))
  ) {
    return 'cpu';
  }

  const ramWord = /\b(ram|memory|physical memory)\b/.test(q);
  const ramAsk =
    /\b(how much|usage|used|use|using|occupied|available|free|left|check|status|currently|kitni|kitna|kitne|rahi|raha)\b/.test(q)
    || /^(ram|memory|ram usage|memory usage|check ram)$/i.test(q);

  if (ramWord && ramAsk && !/\b(usb|sd card|flash drive)\b/.test(q)) {
    return 'ram';
  }

  if (/\b(system (info|specs|status)|laptop specs|device specs|pc specs|computer specs)\b/.test(q)) {
    return 'system';
  }

  return null;
}

/** LLM sometimes dumps a WMI script instead of numbers — treat as RAM intent. */
export function looksLikeMemoryScript(text: string): boolean {
  const t = String(text || '');
  return /\b(Get-CimInstance|Get-WmiObject)\b/i.test(t) && /\b(TotalVisibleMemorySize|FreePhysicalMemory|Win32_OperatingSystem)\b/i.test(t);
}

function n(v: unknown, fallback = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

/**
 * Senior Dev & Product Manager formatted response generator.
 * Produces crisp, actionable, high-contrast Markdown with exact statistics and 0 hallucination.
 */
export function formatDiagMessage(kind: DiagKind, snap: DiagSnapshot): string {
  if (!snap?.ok || snap.error) {
    return `⚠️ Could not read this PC’s hardware diagnostics (${snap?.error || 'unknown error'}). Fully restart the FloatGPT desktop app and try again.`;
  }

  // ─── A. Desktop Folders Audit ─────────────────────────────────
  const desktop = snap.desktopFolders || (
    kind === 'desktop_folders' && snap.path && Array.isArray(snap.folders)
      ? { path: snap.path, count: snap.count, folders: snap.folders }
      : null
  );
  if (kind === 'desktop_folders' && desktop) {
    const folders = desktop.folders || [];
    const count = Number.isFinite(Number(desktop.count)) ? Number(desktop.count) : folders.length;
    const path = desktop.path;
    if (count === 0) {
      return [
        `📁 **Desktop Folders Audit (Live Local OS)**`,
        '',
        `Your Desktop (\`${path}\`) currently has **0 subfolders** (clean desktop).`,
        '',
        `*(Scanned instantly from your native filesystem — 0 tokens used, 100% offline)*`
      ].join('\n');
    }

    const folderLines = folders.map((f) => `• 📁 **${f}**`).join('\n');
    return [
      `📁 **Desktop Folders Audit (Live Local OS)**`,
      '',
      `Found **${count} folder${count === 1 ? '' : 's'}** present on your Desktop:`,
      `📍 Path: \`${path}\``,
      '',
      folderLines,
      '',
      `*(Queried instantly from your local filesystem — 0 tokens used, 100% offline)*`
    ].join('\n');
  }

  // ─── B. Screen Recordings Audit ───────────────────────────────
  if (kind === 'screen_recordings' && snap.screenRecordings) {
    const { count, totalGb, totalMb, locations, recent } = snap.screenRecordings;
    if (count === 0) {
      return [
        `🎥 **Screen Recordings Summary (Live Local OS)**`,
        '',
        `Found **0 screen recordings** in your standard Captures & Videos folders.`,
        '',
        `*(Scanned native Windows/Mac capture directories — 0 tokens used, 100% offline)*`
      ].join('\n');
    }

    const sizeDisplay = totalGb >= 1 ? `${totalGb} GB` : `${totalMb} MB`;
    const lines = [
      `🎥 **Screen Recordings Summary (Live Local OS)**`,
      '',
      `Found **${count} screen recording${count === 1 ? '' : 's'}** in total, occupying **${sizeDisplay}**:`,
      ''
    ];

    if (recent && recent.length > 0) {
      lines.push(`**Recent Recordings:**`);
      for (const r of recent.slice(0, 8)) {
        lines.push(`• 📹 \`${r.name}\` (${r.sizeMb} MB) · *${r.folder}* ${r.date ? `(${r.date})` : ''}`);
      }
      lines.push('');
    }

    if (locations && locations.length > 0) {
      lines.push(`📂 **Folder Distribution:**`);
      for (const loc of locations) {
        lines.push(`• \`${loc.dir}\`: **${loc.count}** recording${loc.count === 1 ? '' : 's'}`);
      }
      lines.push('');
    }

    lines.push(`*(Scanned directly from your local storage — 0 tokens used, 100% offline)*`);
    return lines.join('\n');
  }

  // ─── C. Top RAM Consuming Processes & Open Task Manager ────────
  if ((kind === 'top_processes' || kind === 'open_taskmgr_and_ram') && (snap.processes || snap.ram)) {
    const ram = snap.ram;
    const lines = [];

    if (snap.taskManagerOpened) {
      lines.push(`🚀 **Opened ${snap.openedAppName || 'Task Manager'} on your screen.**`);
      lines.push('');
    }

    lines.push(`📊 **RAM Usage & Process Inspection (Live OS Process Table)**`);
    lines.push('');

    if (ram) {
      lines.push(
        `System RAM: **${n(ram.usedGb).toFixed(1)} GB** / **${n(ram.totalGb).toFixed(1)} GB** used (**${n(ram.percent).toFixed(1)}%**) · Free: **${n(ram.freeGb).toFixed(1)} GB**`
      );
      lines.push('');
    }

    const processes = snap.processes || [];
    if (processes.length > 0) {
      lines.push(`🏆 **Top Apps Consuming Memory:**`);
      processes.slice(0, 8).forEach((p, idx) => {
        const memStr = p.mb >= 1024 ? `${(p.mb / 1024).toFixed(2)} GB` : `${p.mb.toFixed(1)} MB`;
        const instStr = p.instances > 1 ? ` (${p.instances} processes)` : '';
        lines.push(`${idx + 1}. **${p.displayName || p.name}**: **${memStr}**${instStr}`);
      });
      lines.push('');

      const topApp = processes[0];
      if (topApp) {
        const topMemStr = topApp.mb >= 1024 ? `${(topApp.mb / 1024).toFixed(2)} GB` : `${topApp.mb.toFixed(1)} MB`;
        lines.push(`💡 **Observation:** **${topApp.displayName || topApp.name}** is currently your highest memory consumer at **${topMemStr}**.`);
        lines.push('');
      }
    }

    lines.push(`*(Aggregated live from OS memory manager — 0 tokens used, 100% offline)*`);
    return lines.join('\n');
  }

  // ─── D. Battery Level & Status ────────────────────────────────
  if (kind === 'battery') {
    if (!snap.battery) {
      return [
        `🔋 **Battery Status (Hardware Kernel Reading)**`,
        '',
        `No battery detected (desktop workstation connected directly to AC power, or battery driver inactive).`,
        '',
        `*(Queried live from OS power management — 0 tokens used, 100% offline)*`
      ].join('\n');
    }

    const { percent, charging, statusText } = snap.battery;
    return [
      `🔋 **Battery Status (Hardware Kernel Reading)**`,
      '',
      `• Current Charge: **${n(percent)}%**`,
      `• Power State: **${statusText || (charging ? 'Charging' : 'On Battery')}**`,
      `• AC Adapter: **${charging ? '⚡ Connected (Charging)' : '🔋 Disconnected (Running on Battery)'}**`,
      '',
      `*(Queried directly via ACPI/WMI power subsystem — 0 tokens used, 100% offline)*`
    ].join('\n');
  }

  // ─── E. General RAM Status ────────────────────────────────────
  const ram = snap.ram;
  if (kind === 'ram' && ram) {
    return [
      `📊 **RAM (This PC — Kernel Reading)**`,
      '',
      `Abhi **${n(ram.usedGb).toFixed(1)} GB** RAM use ho rahi hai.`,
      `Total: **${n(ram.totalGb).toFixed(1)} GB** · Free: **${n(ram.freeGb).toFixed(1)} GB** · Load: **${n(ram.percent).toFixed(1)}%**.`,
      '',
      `*(Source: Windows Memory Manager via Node \`os.totalmem()\` / \`os.freemem()\`. 0 tokens used, 100% offline)*`
    ].join('\n');
  }

  // ─── F. CPU Usage ─────────────────────────────────────────────
  const cpu = snap.cpu;
  if (kind === 'cpu' && cpu) {
    return [
      `⚡ **CPU (This PC — Live Hardware Sample)**`,
      '',
      `Load: **${n(cpu.percent).toFixed(1)}%** · Cores: **${n(cpu.cores)}**`,
      cpu.model ? `Model: \`${cpu.model}\`` : '',
      '',
      `*(Sampled from OS idle/busy counters over 150ms. 0 tokens used, 100% offline)*`
    ].filter(Boolean).join('\n');
  }

  // ─── G. Full System Overview ──────────────────────────────────
  const lines = [`💻 **${snap.hostname || 'This PC'}** · ${snap.platform || ''}`, ''];
  if (ram) {
    lines.push(`• RAM: **${n(ram.usedGb).toFixed(1)} / ${n(ram.totalGb).toFixed(1)} GB** (${n(ram.percent).toFixed(1)}%)`);
  }
  if (cpu) {
    lines.push(`• CPU: **${n(cpu.percent).toFixed(1)}%** · ${n(cpu.cores)} cores`);
  }
  if (snap.battery) {
    lines.push(`• Battery: **${n(snap.battery.percent)}%** (${snap.battery.statusText || (snap.battery.charging ? 'Charging' : 'On Battery')})`);
  }
  if (snap.desktopFolders) {
    lines.push(`• Desktop Folders: **${snap.desktopFolders.count}**`);
  }
  if (snap.uptimeSec) {
    const h = Math.floor(snap.uptimeSec / 3600);
    const m = Math.floor((snap.uptimeSec % 3600) / 60);
    lines.push(`• Uptime: ${h}h ${m}m`);
  }
  lines.push('', `*(Live OS snapshot. 0 tokens used, 100% offline)*`);
  return lines.join('\n');
}

/**
 * Universal diagnostics runner with Electron IPC and browser fallbacks.
 */
export async function runSystemDiagnostics(kind: DiagKind): Promise<string> {
  const win = typeof window !== 'undefined' ? window : (globalThis as any).window;
  const api = win?.electronAPI?.os?.snapshot || (globalThis as any).electronAPI?.os?.snapshot;

  if (api) {
    try {
      const snap = await api(kind);
      return formatDiagMessage(kind, (snap as DiagSnapshot) || { ok: false, error: 'empty snapshot' });
    } catch (err: any) {
      return `⚠️ Hardware read failed: ${err?.message || 'unknown error'}`;
    }
  }

  // Browser Fallback (e.g. Playground Studio on Web)
  if (kind === 'battery' && typeof navigator !== 'undefined' && (navigator as any).getBattery) {
    try {
      const b = await (navigator as any).getBattery();
      return formatDiagMessage('battery', {
        ok: true,
        battery: {
          percent: Math.round(b.level * 100),
          charging: !!b.charging,
          statusText: b.charging ? 'Charging' : 'Discharging (On Battery)'
        }
      });
    } catch {}
  }

  if (kind === 'ram' && typeof navigator !== 'undefined' && (navigator as any).deviceMemory) {
    const totalGb = (navigator as any).deviceMemory;
    return `📊 **Device Memory:** ~**${totalGb} GB** physical RAM reported by browser.\n\n*(Full process breakdown requires the FloatGPT Desktop Orb)*`;
  }

  return '⚠️ This OS-level query requires the **FloatGPT Desktop App (Electron)** to access the local kernel and filesystem. In the web playground, system access is sandboxed.';
}
