/**
 * Flow Agent — Command Schemas
 * 
 * Defines all command types that the Flow engine can process.
 * Each command has a structured shape for deterministic routing.
 */

// ─── Intent Categories ──────────────────────────────────────────
export type FlowIntent =
  | 'memory_query'
  | 'os_action'
  | 'browser_action'
  | 'floatgpt_control'
  | 'general_chat'
  | 'os_agent';

// ─── Command Shapes ─────────────────────────────────────────────

export interface OpenAppCommand {
  intent: 'os_action';
  action: 'open_app';
  appName: string;
  args?: string[];
}

export interface BrowserCommand {
  intent: 'browser_action';
  action: 'open_url' | 'search_web';
  query: string; // URL or search text
}

export interface MemoryQueryCommand {
  intent: 'memory_query';
  queryType:
    | 'today_tasks'
    | 'pending_work'
    | 'goals'
    | 'yesterday'
    | 'schedule'
    | 'habits'
    | 'momentum'
    | 'general';
  rawQuery: string;
}

export interface FloatControlCommand {
  intent: 'floatgpt_control';
  action:
    | 'show_orb'
    | 'hide_orb'
    | 'toggle_orb'
    | 'open_panel'
    | 'open_chat'
    | 'open_settings'
    | 'open_plan'
    | 'open_history';
}

export interface GeneralChatCommand {
  intent: 'general_chat';
  message: string;
}

export interface OsAgentCommand {
  intent: 'os_agent';
  action: 'open_app';
  appName: string;
}

export type FlowCommand =
  | OpenAppCommand
  | BrowserCommand
  | MemoryQueryCommand
  | FloatControlCommand
  | GeneralChatCommand
  | OsAgentCommand;

// ─── Response Shape ─────────────────────────────────────────────

export interface FlowResponse {
  success: boolean;
  message: string;
  /** Optional data payload (e.g., task list, goal list) */
  data?: any;
  /** The intent that was matched */
  intent: FlowIntent;
  /** Source of AI used: 'local', 'cloud', 'regex', or 'none' */
  source: 'local' | 'cloud' | 'regex' | 'none';
}

// ─── Regex Pattern Matchers ─────────────────────────────────────
// Used as fast-path before hitting any AI model.

export interface PatternRule {
  pattern: RegExp;
  extract: (match: RegExpMatchArray, raw: string) => FlowCommand;
}

/**
 * Built-in regex rules for common commands.
 * These fire instantly without needing any AI model.
 */
export const BUILTIN_PATTERNS: PatternRule[] = [
  // ── App Launch ────────────────────────────────────────────
  {
    pattern: /^(?:open|launch|start|run)\s+(.+?)(?:\s+(?:app|application))?$/i,
    extract: (_m, raw) => {
      const appName = raw.replace(/^(?:open|launch|start|run)\s+/i, '').replace(/\s+(?:app|application)$/i, '').trim();
      // Check if it's actually a URL
      if (/^https?:\/\//i.test(appName) || /\.(com|org|net|io|dev|ai)\b/i.test(appName)) {
        return { intent: 'browser_action', action: 'open_url', query: appName };
      }
      // Check if it's a FloatGPT control
      const lower = appName.toLowerCase();
      if (lower === 'floatgpt' || lower === 'float' || lower === 'float gpt') {
        return { intent: 'floatgpt_control', action: 'show_orb' };
      }
      return { intent: 'os_action', action: 'open_app', appName };
    },
  },

  // ── Web Search ────────────────────────────────────────────
  {
    pattern: /^(?:search|search for|google|look up|find)\s+(.+)$/i,
    extract: (m) => ({
      intent: 'browser_action',
      action: 'search_web',
      query: m[1].trim(),
    }),
  },

  // ── URL Navigation ────────────────────────────────────────
  {
    pattern: /^(?:go to|navigate to|visit|open)\s+(https?:\/\/.+)$/i,
    extract: (m) => ({
      intent: 'browser_action',
      action: 'open_url',
      query: m[1].trim(),
    }),
  },

  // ── FloatGPT Controls ────────────────────────────────────
  {
    pattern: /^(?:show|display|bring up|summon)\s+(?:float(?:gpt)?|orb)$/i,
    extract: () => ({ intent: 'floatgpt_control', action: 'show_orb' }),
  },
  {
    pattern: /^(?:hide|dismiss|close|minimize)\s+(?:float(?:gpt)?|orb)$/i,
    extract: () => ({ intent: 'floatgpt_control', action: 'hide_orb' }),
  },
  {
    pattern: /^(?:open|show|go to)\s+(?:settings|config)$/i,
    extract: () => ({ intent: 'floatgpt_control', action: 'open_settings' }),
  },
  {
    pattern: /^(?:open|show|go to)\s+(?:chat|conversation)$/i,
    extract: () => ({ intent: 'floatgpt_control', action: 'open_chat' }),
  },
  {
    pattern: /^(?:open|show|go to)\s+(?:plan|planner|planning)$/i,
    extract: () => ({ intent: 'floatgpt_control', action: 'open_plan' }),
  },
  {
    pattern: /^(?:open|show|go to)\s+(?:history|past|sessions)$/i,
    extract: () => ({ intent: 'floatgpt_control', action: 'open_history' }),
  },

  // ── Memory Queries ────────────────────────────────────────
  {
    pattern: /^(?:what(?:'s| is| are)|show me|list|tell me)\s+(?:my\s+)?(?:tasks?|to\s*-?\s*dos?)\s*(?:today|for today)?/i,
    extract: (_m, raw) => ({ intent: 'memory_query', queryType: 'today_tasks', rawQuery: raw }),
  },
  {
    pattern: /^(?:what(?:'s| is| are)|show me|list)\s+(?:my\s+)?(?:pending|remaining|incomplete|unfinished)\s*(?:tasks?|work)?/i,
    extract: (_m, raw) => ({ intent: 'memory_query', queryType: 'pending_work', rawQuery: raw }),
  },
  {
    pattern: /^(?:what(?:'s| is| are)|show me|list|tell me)\s+(?:my\s+)?goals?/i,
    extract: (_m, raw) => ({ intent: 'memory_query', queryType: 'goals', rawQuery: raw }),
  },
  {
    pattern: /^(?:what did i|what have i|show me what i)\s+(?:do|work on|accomplish)\s*(?:yesterday|last session)?/i,
    extract: (_m, raw) => ({ intent: 'memory_query', queryType: 'yesterday', rawQuery: raw }),
  },
  {
    pattern: /^(?:what(?:'s| is)|show me|tell me)\s+(?:my\s+)?(?:schedule|agenda|calendar)/i,
    extract: (_m, raw) => ({ intent: 'memory_query', queryType: 'schedule', rawQuery: raw }),
  },
  {
    pattern: /^(?:how am i|how(?:'s| is) my)\s+(?:doing|progress|performance|momentum)/i,
    extract: (_m, raw) => ({ intent: 'memory_query', queryType: 'momentum', rawQuery: raw }),
  },
  {
    pattern: /^(?:what(?:'s| is| are)|show me|tell me about)\s+(?:my\s+)?habits?/i,
    extract: (_m, raw) => ({ intent: 'memory_query', queryType: 'habits', rawQuery: raw }),
  },
  {
    pattern: /^(?:plan my day|what (?:should|do) i (?:do|work on)\s*(?:today|next|now)?)/i,
    extract: (_m, raw) => ({ intent: 'memory_query', queryType: 'today_tasks', rawQuery: raw }),
  },
  {
    pattern: /^(?:what do i need to do|what needs to be done|what's next)/i,
    extract: (_m, raw) => ({ intent: 'memory_query', queryType: 'pending_work', rawQuery: raw }),
  },
];
