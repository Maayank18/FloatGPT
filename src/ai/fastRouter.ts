/**
 * Fast Intent Router — Zero-Token Deterministic Fast Path
 * 
 * Intercepts requests that can be computed or executed locally:
 * 1. Application & Website launching (OS / Browser APIs)
 * 2. System Queries (Current Time, Date, Timezone)
 * 3. State Queries (List tasks, pending work, active goals, focus state)
 * 4. State Actions (Clear chat, Toggle focus mode)
 * 5. High-confidence regex intent classification (eliminating router LLM calls)
 */

import { AppState, Task, Goal, Project } from '../types';
import { resolveAlias } from '../agent/aliasResolver';
import { detectPlatform } from '../platform';
import { detectSystemDiagIntent, runSystemDiagnostics } from '../platform/osDiagnostics';
import { detectLocalOsIntent, executeLocalOsIntent } from '../platform/osLaunch';
import { detectMediaIntent, executeMediaIntent } from '../platform/osMedia';
import { MessengerAgent } from '../agents/messenger/core/MessengerAgent';

export interface FastRouteResult {
  handled: boolean;
  message?: string;
  actionExecuted?: string;
  data?: any;
  inferredIntent?: 'general_chat' | 'plan_create' | 'plan_update' | 'plan_query' | 'os_agent' | 'focus_mode';
}

const KNOWN_WEBSITES: Record<string, string> = {
  'linkedin': 'https://linkedin.com',
  'youtube': 'https://youtube.com',
  'github': 'https://github.com',
  'google': 'https://google.com',
  'twitter': 'https://twitter.com',
  'x': 'https://x.com',
  'facebook': 'https://facebook.com',
  'chatgpt': 'https://chatgpt.com',
  'leetcode': 'https://leetcode.com',
  'reddit': 'https://reddit.com',
  'stackoverflow': 'https://stackoverflow.com',
  'stack overflow': 'https://stackoverflow.com',
  'gmail': 'https://mail.google.com',
  'instagram': 'https://instagram.com',
  'whatsapp': 'https://web.whatsapp.com',
  'whatsapp web': 'https://web.whatsapp.com',
  'web whatsapp': 'https://web.whatsapp.com',
  'watsapp': 'https://web.whatsapp.com',
  'watsapp web': 'https://web.whatsapp.com',
  'netflix': 'https://netflix.com',
  'amazon': 'https://amazon.com',
  'gemini': 'https://gemini.google.com',
  'google ai studio': 'https://aistudio.google.com',
  'groq': 'https://console.groq.com',
  'openai': 'https://platform.openai.com',
  'claude': 'https://claude.ai',
};

const APP_LAUNCH_MAP_WINDOWS: Record<string, string> = {
  'chrome': 'chrome',
  'google chrome': 'chrome',
  'edge': 'msedge',
  'microsoft edge': 'msedge',
  'code': 'code',
  'vscode': 'code',
  'vs code': 'code',
  'visual studio code': 'code',
  'notepad': 'notepad',
  'calculator': 'calc',
  'calc': 'calc',
  'terminal': 'wt',
  'windows terminal': 'wt',
  'cmd': 'cmd',
  'powershell': 'powershell',
  'explorer': 'explorer',
  'file explorer': 'explorer',
  'task manager': 'taskmgr',
  'control panel': 'control',
  'settings': 'ms-settings:',
  'system settings': 'ms-settings:',
  'spotify': 'spotify',
  'slack': 'slack',
  'discord': 'discord',
};

const APP_LAUNCH_MAP_MAC: Record<string, string> = {
  'safari': 'Safari',
  'chrome': 'Google Chrome',
  'google chrome': 'Google Chrome',
  'code': 'Visual Studio Code',
  'vscode': 'Visual Studio Code',
  'vs code': 'Visual Studio Code',
  'visual studio code': 'Visual Studio Code',
  'terminal': 'Terminal',
  'calculator': 'Calculator',
  'calc': 'Calculator',
  'finder': 'Finder',
  'notes': 'Notes',
  'apple notes': 'Notes',
  'settings': 'System Settings',
  'system settings': 'System Settings',
  'spotify': 'Spotify',
  'slack': 'Slack',
  'discord': 'Discord',
};

/**
 * Checks if the prompt can be satisfied instantly without calling any LLM.
 */
export async function tryFastRoute(rawPrompt: string, state: AppState): Promise<FastRouteResult> {
  // 0. Strip Whisper / speech artifacts like "END", "[END]", "End:" at beginning of prompt
  const cleanedPrompt = rawPrompt
    .replace(/^(end|\[end\])\s*[:-]?\s*/gi, '')
    .trim();

  const normalized = resolveAlias(cleanedPrompt);
  let lower = normalized.toLowerCase();

  // Strip common conversational filler prefixes and polite phrases
  lower = lower.replace(/^(can you|could you|would you|please|just|kindly|tell me|hey|hi|hello)\s+/gi, '');
  lower = lower.replace(/^(can you|could you|would you|please|just|kindly)\s+/gi, '');
  lower = lower.replace(/\s+(please|thanks|thank you)\b/gi, '').trim();
  lower = lower.replace(/[?!.]+$/, '').trim();

  const isMac = detectPlatform() === 'darwin';

  // ─── 0. Exit, Stop & Dismiss Fast-Path ──────────────────────────────────────
  if (/^(stop|exit|done|finish|cancel|dismiss|nevermind|never mind|close|band karo|chup)$/i.test(lower)) {
    return {
      handled: true,
      message: '⏹️ Stopped and returned to idle.',
      actionExecuted: 'exit_and_stop'
    };
  }

  // ─── 1. System Time & Date Fast-Path (100% Offline / Local OS Execution) ────
  const isTimeQuery = /\b(what('s| is) (the )?(current )?time|what time (is it|do you have|is it right now|now)|tell me (the )?(current )?time|current time|the time right now|what is the time|time please)\b/i.test(lower) || /^(the )?time$/i.test(lower) || /\b(current time|what time is it)\b/i.test(cleanedPrompt.toLowerCase());
  const isDateQuery = /\b(what('s| is) (the )?(current )?date|today'?s date|date today|what day is (it|today)|what('s| is) today|current date|what is the date|date please)\b/i.test(lower) || /^(the )?date$/i.test(lower) || /\b(today'?s date|current date)\b/i.test(cleanedPrompt.toLowerCase());

  if (isTimeQuery || isDateQuery) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const hasGreeting = /\b(hello|hi|hey|how are you|good (morning|afternoon|evening))\b/i.test(cleanedPrompt);
    const greetingText = hasGreeting ? "Hello! I am doing great.\n\n" : "";

    return {
      handled: true,
      message: `${greetingText}🕒 **Current Local Time:** ${timeStr}\n📅 **Date:** ${dateStr}`,
      actionExecuted: 'system_clock'
    };
  }

  // ─── 1b. OS Storage & Disk Space Query Fast-Path ──────────────
  if (/\b(disk space|storage left|free space|hard drive space|drive space|disk usage|storage space|how much (disk|storage|space))\b/i.test(lower)) {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.flow?.executeScript) {
      const script = isMac
        ? `df -h / | awk 'NR==2 {print "Drive /: " $4 " free of " $2 " total (" $5 " used)"}'`
        : `Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | ForEach-Object { "$($_.DeviceID) $([math]::Round($_.FreeSpace/1GB, 2)) GB free of $([math]::Round($_.Size/1GB, 2)) GB total" }`;

      try {
        const res = await (window as any).electronAPI.flow.executeScript(script);
        if (res?.success && res.output) {
          return {
            handled: true,
            message: `💾 **Device Storage Status:**\n\n\`\`\`text\n${res.output.trim()}\n\`\`\`\n\n*(Queried directly via local OS execution — 0 tokens used)*`,
            actionExecuted: 'query_disk_space',
            data: { output: res.output.trim() }
          };
        }
      } catch (err) {
        console.warn('[FastRouter] OS storage query failed, falling back to LLM:', err);
      }
    }
  }

  // ─── 1c. Hardware diagnostics (RAM / CPU / battery) — kernel, not LLM
  {
    const kind = detectSystemDiagIntent(rawPrompt);
    if (kind) {
      const message = await runSystemDiagnostics(kind);
      return {
        handled: true,
        message,
        actionExecuted: `diag_${kind}`
      };
    }
  }

  // ─── 1d. Launch apps / Settings / desktop files (no LLM) ───
  {
    const local = detectLocalOsIntent(rawPrompt);
    if (local) {
      const res = await executeLocalOsIntent(local);
      const actionExecuted = local.kind === 'open_url'
        ? `open_url:${local.url}`
        : local.kind === 'open_app'
          ? `launch_app:${local.appName}`
          : local.kind === 'type_text'
            ? 'type_text'
            : 'create_file';
      return {
        handled: true,
        message: res.message,
        actionExecuted,
        data: res.data
      };
    }
  }

  // ─── 1e. Media, Navigation & Viewport Controls (Play / Pause / Volume / Zoom / Tabs / Scroll / Find) ───
  {
    const media = detectMediaIntent(rawPrompt);
    if (media) {
      const ran = await executeMediaIntent(media.action, { query: media.query, steps: media.steps });
      return {
        handled: true,
        message: ran.ok
          ? media.response
          : 'That control did not reach the screen. Fully quit FloatGPT and open it again, then ask once more.',
        actionExecuted: `media_${media.action}`,
        data: media.query ? { query: media.query } : undefined
      };
    }
  }

  // ─── 1f. Instant Desktop Screenshot Fast-Path ─────────────────────
  if (/^(take (a )?screenshot|capture (the )?screen|screenshot|screen grab|desktop screenshot)$/i.test(lower)) {
    const win = typeof window !== 'undefined' ? window : (globalThis as any).window;
    const captureFn = win?.electronAPI?.captureScreenshot;
    if (captureFn) {
      try {
        const screenshotDataUrl = await captureFn();
        if (screenshotDataUrl) {
          return {
            handled: true,
            message: `📸 **Screenshot Captured Successfully**\n\n*(Full display captured via Electron desktop graphics subsystem — 0 tokens used)*\n\n![Screenshot](${screenshotDataUrl})`,
            actionExecuted: 'capture_screenshot',
            data: { screenshot: screenshotDataUrl }
          };
        }
      } catch (err: any) {
        console.warn('[FastRouter] Screenshot capture failed:', err);
      }
    }
  }

  // ─── 1g. Screen Context & Background Intelligence Fast-Path ───────
  const isScreenVision = /\b(what('s| is) (on (the |my |this )?(screen|desktop|display)|in (the |my )?background|happening (on (the |my |this )?(screen|desktop)|in (the |my )?background)|running in (the |my )?background|going on (on (the |my |this )?(screen|desktop)|in (the |my )?background))|tell (me )?(what is|what's) (on (the |my |this )?(screen|desktop)|in (the |my )?background|happening in (the |my )?background)|(understand|explain|describe|read|look at|analyze|check|see|summarize) (the |my |this |what's on |what is on |what's in |what is in )?(screen|background|desktop|display)|what do you see( on (the |my |this )?(screen|desktop)| in (the |my )?background)?)\b/i.test(lower);

  if (isScreenVision) {
    const win = typeof window !== 'undefined' ? window : (globalThis as any).window;
    const glanceFn = win?.electronAPI?.desktopContext?.glance;
    if (glanceFn) {
      try {
        const glance = await glanceFn({ includeScreenshot: true });
        if (glance?.ok && glance.screenshot) {
          const fg = glance.foreground || {};
          const fgContext = `Active Window: "${fg.title || 'Unknown'}" (${fg.app || 'Unknown'}${fg.host ? ` - ${fg.host}` : ''})`;
          
          const visionPrompt = `${fgContext}\n\nUser request: "${rawPrompt}". Describe and explain what is visible on the screen, highlight any active code, text, or errors, and answer clearly.`;

          const { generateAIResponse } = await import('./orchestrator');

          // Select vision-capable provider / model automatically to guarantee multimodal processing
          const overrideCfg: any = { skipHistory: true };
          if (state?.settings?.aiConfig?.apiKeys?.google) {
            overrideCfg.providerId = 'google';
            overrideCfg.model = 'gemini-2.5-flash';
          } else if (state?.settings?.aiConfig?.apiKeys?.openai) {
            overrideCfg.providerId = 'openai';
            overrideCfg.model = 'gpt-4o-mini';
          } else if (state?.settings?.aiConfig?.selectedProvider === 'groq') {
            overrideCfg.providerId = 'groq';
            overrideCfg.model = 'llama-3.2-11b-vision-preview';
          }

          try {
            const aiRes = await generateAIResponse(
              state,
              visionPrompt,
              [{ name: `screen-${Date.now()}.png`, mimeType: 'image/png', data: glance.screenshot }],
              false,
              overrideCfg
            );

            if (aiRes?.message) {
              return {
                handled: true,
                message: `🖥️ **Screen Context** (${fg.app || 'Desktop'}):\n\n${aiRes.message}`,
                actionExecuted: 'analyze_screen',
                data: { foreground: fg, screenshot: glance.screenshot }
              };
            }
          } catch (aiErr: any) {
            console.warn('[FastRouter] AI vision model unavailable, falling back to OS metadata:', aiErr?.message);
            return {
              handled: true,
              message: `🖥️ **Active Background Screen:**\n- **Application:** ${fg.app || 'Unknown'}\n- **Window Title:** ${fg.title || 'Untitled'}${fg.host ? `\n- **Domain:** ${fg.host}` : ''}`,
              actionExecuted: 'analyze_screen_meta',
              data: { foreground: fg, screenshot: glance.screenshot }
            };
          }
        } else if (glance?.foreground) {
          const fg = glance.foreground;
          return {
            handled: true,
            message: `🖥️ **Active Background Screen:**\n- **Application:** ${fg.app || 'Unknown'}\n- **Window Title:** ${fg.title || 'Untitled'}${fg.host ? `\n- **Domain:** ${fg.host}` : ''}`,
            actionExecuted: 'analyze_screen_meta',
            data: { foreground: fg }
          };
        }
      } catch (err: any) {
        console.warn('[FastRouter] Screen vision analysis failed:', err);
      }
    }
  }

  // ─── 1h. FloatGPT Panel / Orb Control Fast-Path ───────────────────
  if (/^(open panel|show panel|toggle panel|open floatgpt|show floatgpt|toggle orb|open orb|bring up panel)$/i.test(lower)) {
    const win = typeof window !== 'undefined' ? window : (globalThis as any).window;
    if (win?.electronAPI?.forceShow) {
      win.electronAPI.forceShow();
    }
    return {
      handled: true,
      message: '✨ FloatGPT interface is active.',
      actionExecuted: 'toggle_panel'
    };
  }

  // ─── 2. Website & Native App Fast Navigation ──────────────────────────────
  let target = '';
  const openUrlMatch = lower.match(/^(open|launch|visit|go to|navigate to|run|start)\s+(.+)$/i);
  if (openUrlMatch) {
    target = openUrlMatch[2].trim().toLowerCase();
  } else {
    // Direct bare invocation without verbs (e.g. "whatsapp web", "youtube", "calculator", "settings")
    const bareCandidate = lower.replace(/[.,!]+$/, '').trim();
    const appMap = isMac ? APP_LAUNCH_MAP_MAC : APP_LAUNCH_MAP_WINDOWS;
    if (KNOWN_WEBSITES[bareCandidate] || KNOWN_WEBSITES[bareCandidate.replace(/\s+/g, '')] || appMap[bareCandidate]) {
      target = bareCandidate;
    }
  }

  if (target) {
    // Check known website
    const webUrl = KNOWN_WEBSITES[target] || KNOWN_WEBSITES[target.replace(/\s+/g, '')];
    if (webUrl) {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.flow) {
        await (window as any).electronAPI.flow.openUrl(webUrl);
      } else if (typeof window !== 'undefined') {
        window.open(webUrl, '_blank');
      }
      return {
        handled: true,
        message: `🌐 Opening **${target.charAt(0).toUpperCase() + target.slice(1)}** in your browser...`,
        actionExecuted: `open_url:${webUrl}`,
        data: { url: webUrl }
      };
    }

    // Direct URL check
    if (/^https?:\/\/[^\s]+$/i.test(target) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|org|net|io|dev|ai|edu|gov|co|app|xyz)(\/[^\s]*)?$/i.test(target)) {
      const fullUrl = target.startsWith('http') ? target : `https://${target}`;
      if (typeof window !== 'undefined' && (window as any).electronAPI?.flow) {
        await (window as any).electronAPI.flow.openUrl(fullUrl);
      } else if (typeof window !== 'undefined') {
        window.open(fullUrl, '_blank');
      }
      return {
        handled: true,
        message: `🌐 Navigating to [${target}](${fullUrl})...`,
        actionExecuted: `open_url:${fullUrl}`,
        data: { url: fullUrl }
      };
    }

    // Native App Launching via Registered Aliases
    const appMap = isMac ? APP_LAUNCH_MAP_MAC : APP_LAUNCH_MAP_WINDOWS;
    const mappedApp = appMap[target];
    if (mappedApp) {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.flow) {
        const script = isMac ? `open -a "${mappedApp}"` : `Start-Process "${mappedApp}"`;
        await (window as any).electronAPI.flow.executeScript(script);
      }
      return {
        handled: true,
        message: `⚡ Launching **${mappedApp}**...`,
        actionExecuted: `launch_app:${mappedApp}`,
        data: { appName: mappedApp }
      };
    }
  }

  // ─── 3. State Query Fast-Path (Tasks, Goals, Focus) ───────────
  if (/^(show|list|what are|display|view|get)\s+(my\s+)?(active\s+|pending\s+|today's\s+)?(tasks|todos|work|goals|projects)$/i.test(lower) ||
      /^(what (is|are) my tasks|what do i have to do|my tasks)$/i.test(lower)) {
    const tasks = (state.tasks || []).filter((t: Task) => t.status !== 'Completed' && t.status !== 'Archived');
    if (tasks.length === 0) {
      return {
        handled: true,
        message: `🎉 **All caught up!** You have zero active tasks remaining in your plan.`,
        actionExecuted: 'query_tasks'
      };
    }

    const taskLines = tasks.slice(0, 8).map((t, idx) => {
      const priorityEmoji = t.priority === 'Critical' ? '🔴' : t.priority === 'High' ? '🟠' : t.priority === 'Medium' ? '🟡' : '🟢';
      const deadlineStr = t.deadlineAt ? ` *(Due: ${new Date(t.deadlineAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})*` : '';
      return `${idx + 1}. ${priorityEmoji} **${t.title}**${deadlineStr}`;
    }).join('\n');

    const extraCount = tasks.length > 8 ? `\n\n*...and ${tasks.length - 8} more tasks.*` : '';
    return {
      handled: true,
      message: `📋 **Active Tasks (${tasks.length} remaining):**\n\n${taskLines}${extraCount}`,
      actionExecuted: 'query_tasks'
    };
  }

  // ─── 3.5 Instant Zero-Token Conversational Greetings & Offline Chitchat ─
  const trimmedLower = lower.trim().replace(/[?!.,]+$/, '');

  if (/^(hi|hello|hey|howdy|greetings|good (morning|afternoon|evening))\b/i.test(trimmedLower)) {
    MessengerAgent.clearPendingSession();
    return {
      handled: true,
      message: `👋 **Hello!** FloatGPT is online and ready.\n\nYou can ask me to run local diagnostics (battery level, RAM usage, desktop folders, screen recordings), control media, launch apps, or manage your daily schedule. How can I help you right now?`,
      actionExecuted: 'greeting'
    };
  }

  if (/^(how are you|how are you doing|how r u|how's it going|how is it going)\b/i.test(trimmedLower)) {
    MessengerAgent.clearPendingSession();
    return {
      handled: true,
      message: `⚡ **I'm running smoothly!** All local OS monitors, media controls, and execution services are fully operational.\n\nReady to orchestrate your workflow or execute native tasks. What would you like to work on?`,
      actionExecuted: 'chitchat'
    };
  }

  if (/^(who are you|what are you|what can you do|what do you do|help|help me)$/i.test(trimmedLower)) {
    MessengerAgent.clearPendingSession();
    return {
      handled: true,
      message: `🤖 **I am FloatGPT** — your native desktop execution assistant.\n\nHere is what I can do locally & in real-time:\n• **OS Diagnostics**: Instant battery level, RAM usage, desktop files, screen recordings\n• **OS Media**: Play, pause, adjust volume, skip tracks hands-free\n• **Instant Launch**: Open any desktop app, settings, or website\n• **Smart Productivity**: Plan daily tasks, manage habits, create quick notes\n• **Connected Messaging**: Automated WhatsApp & LinkedIn messaging\n\n*Right-click and hold the Orb to speak, or type your request below!*`,
      actionExecuted: 'capabilities'
    };
  }

  if (/^(thanks|thank you|great thanks|thx|awesome thank you)\b/i.test(trimmedLower)) {
    return {
      handled: true,
      message: `✨ You're very welcome! Let me know whenever you need anything executed.`,
      actionExecuted: 'polite_acknowledgment'
    };
  }

  if (/^(cancel|stop|never\s*mind|dismiss|exit)\b/i.test(trimmedLower)) {
    if (MessengerAgent.hasPendingSession()) {
      return MessengerAgent.cancelPendingSend();
    }
    return {
      handled: true,
      message: `👌 Cancelled. Standing by for your next instruction.`,
      actionExecuted: 'cancel'
    };
  }

  // ─── 4. Messenger Agents Family Fast-Path ───────────────────
  let isMessengerActive = MessengerAgent.hasPendingSession();

  const isCasualOrEscape = /^(hi|hello|hey|how are you|who are you|what can you do|yes|no|ok|okay|why|what|how)\b/i.test(trimmedLower);

  if (isCasualOrEscape && isMessengerActive) {
    MessengerAgent.clearPendingSession();
    isMessengerActive = false;
  }

  if (
    isMessengerActive ||
    /\b(whatsapp|linkedin|telegram|discord|slack)\b/i.test(lower) ||
    (/\b(send|schedule|message|text|dm|msg)\b/i.test(lower) && /\b(saying|say|that|to\s+[a-z]|scheduled messages|scheduled)\b/i.test(lower)) ||
    /\b(send|text)\s+.+\s+to\s+[a-z]/i.test(lower) ||
    /\b(scheduled\s+messages|cancel\s+(the\s+)?scheduled)\b/i.test(lower)
  ) {
    const messengerResult = await MessengerAgent.handleUserInstruction(rawPrompt);
    if (messengerResult.handled) {
      return {
        handled: true,
        message: messengerResult.message,
        actionExecuted: messengerResult.actionExecuted,
        data: messengerResult.data
      };
    }
  }

  // ─── 5. Smart Note Fast-Path ────────────────────────────────
  if (lower.startsWith('/note') || lower.startsWith('take a note:') || lower.startsWith('save note:')) {
    const noteText = rawPrompt.replace(/^\/(note(\s+(study|meeting|quick|research))?|take a note:|save note:)\s*/i, '').trim() || 'Quick note created from FloatGPT.';
    const noteType = lower.includes('study') ? 'study' : lower.includes('meeting') ? 'meeting' : 'quick';
    
    const { NoteService } = await import('../services/notes/noteService');
    const { ArtifactManager } = await import('../services/artifacts/artifactManager');
    
    const note = NoteService.createNoteFromText('FloatGPT Note', noteText, noteType);
    const md = NoteService.formatToMarkdown(note);
    const artifact = ArtifactManager.registerArtifact(
      `Note_${new Date().toISOString().slice(0, 10)}.md`,
      'note',
      md,
      { source: 'fast_router', generator: 'note_service', deterministic: true }
    );

    return {
      handled: true,
      message: `📝 **Smart Note Created (${note.noteType.toUpperCase()})**\n\n${md}\n\n*Artifact saved locally as \`${artifact.name}\` (ID: \`${artifact.artifactId}\`)*`,
      actionExecuted: `create_note:${artifact.artifactId}`
    };
  }

  // ─── 6. Deterministic PDF Generation Fast-Path ──────────────
  if (lower.startsWith('/pdf') || lower.startsWith('make a pdf:') || lower.startsWith('create pdf:')) {
    const pdfText = rawPrompt.replace(/^\/(pdf|make a pdf:|create pdf:)\s*/i, '').trim() || 'Document created with FloatGPT.';
    const { PdfEngine } = await import('../services/document/pdfEngine');
    const { ArtifactManager } = await import('../services/artifacts/artifactManager');

    const blocks = [
      { type: 'title' as const, text: 'FloatGPT Document' },
      { type: 'heading2' as const, text: `Generated: ${new Date().toLocaleString()}` },
      { type: 'divider' as const },
      { type: 'paragraph' as const, text: pdfText }
    ];

    const pdfBlob = PdfEngine.createPdf({ title: 'FloatGPT Document' }, blocks);
    const filename = `FloatGPT_Document_${Date.now()}.pdf`;
    const artifact = ArtifactManager.registerArtifact(
      filename,
      'pdf',
      pdfBlob,
      { source: 'fast_router', generator: 'pdf_engine', deterministic: true }
    );

    ArtifactManager.triggerDownload(artifact);

    return {
      handled: true,
      message: `📄 **PDF Created & Downloaded Successfully**\n\n- **File:** \`${artifact.name}\`\n- **Size:** ${(artifact.size / 1024).toFixed(1)} KB\n- **Artifact ID:** \`${artifact.artifactId}\`\n\n*Your browser/desktop has triggered the file download.*`,
      actionExecuted: `create_pdf:${artifact.artifactId}`
    };
  }

  // ─── 7. FloatGPT Orb & Panel Control ─────────────────────────
  if (/^(hide orb|dismiss orb|close orb|hide assistant|minimize orb)$/i.test(lower)) {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.window?.hide) {
      (window as any).electronAPI.window.hide();
    }
    return {
      handled: true,
      message: `👋 Hiding FloatGPT Orb. Press \`Ctrl + Shift + Space\` anytime to summon me back!`,
      actionExecuted: 'hide_orb'
    };
  }

  // Not handled by fast path -> Requires LLM reasoning
  return { handled: false };
}
