/**
 * Flow Agent — OS Actions
 *
 * Defines the safe OS-level actions that Flow can execute.
 * These are all dispatched through Electron IPC from the renderer.
 * The actual platform-specific execution happens in electron/osActionHandler.cjs.
 *
 * Every action is permission-gated. By default, only "safe" actions
 * (open URLs, search web, show/hide FloatGPT) are allowed.
 */

import type { FlowResponse } from './commandSchemas';

// ─── Types ──────────────────────────────────────────────────────

export type OSActionType =
  | 'open_app'
  | 'open_url'
  | 'search_web'
  | 'focus_window'
  | 'show_floatgpt'
  | 'hide_floatgpt'
  | 'toggle_floatgpt';

export interface OSActionRequest {
  type: OSActionType;
  payload: string; // app name, URL, search query, or window title
}

// ─── Default Permissions ────────────────────────────────────────

const DEFAULT_PERMITTED_ACTIONS: OSActionType[] = [
  'open_url',
  'search_web',
  'show_floatgpt',
  'hide_floatgpt',
  'toggle_floatgpt',
];

// ─── Action Executor ────────────────────────────────────────────

/**
 * Execute an OS action through the Electron IPC bridge.
 * Returns a FlowResponse indicating success or failure.
 */
export async function executeOSAction(
  action: OSActionRequest,
  permittedActions: OSActionType[] = DEFAULT_PERMITTED_ACTIONS
): Promise<FlowResponse> {
  // Permission check
  if (!permittedActions.includes(action.type)) {
    return {
      success: false,
      message: `Action "${action.type}" is not permitted. Enable it in Settings → Desktop Agent → Permissions.`,
      intent: action.type.startsWith('show') || action.type.startsWith('hide') || action.type.startsWith('toggle')
        ? 'floatgpt_control'
        : 'os_action',
      source: 'none',
    };
  }

  const api = typeof window !== 'undefined' ? (window as any).electronAPI : null;

  if (!api) {
    return {
      success: false,
      message: 'OS actions are only available in the desktop app.',
      intent: 'os_action',
      source: 'none',
    };
  }

  try {
    switch (action.type) {
      case 'open_url': {
        const url = normalizeUrl(action.payload);
        await api.openExternal(url);
        return {
          success: true,
          message: `Opened ${url}`,
          intent: 'browser_action',
          source: 'regex',
        };
      }

      case 'search_web': {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(action.payload)}`;
        await api.openExternal(searchUrl);
        return {
          success: true,
          message: `Searching for "${action.payload}"`,
          intent: 'browser_action',
          source: 'regex',
        };
      }

      case 'open_app': {
        if (api.flow?.openApp) {
          const result = await api.flow.openApp(action.payload);
          return {
            success: result,
            message: result ? `Opened ${action.payload}` : `Could not find "${action.payload}". Make sure it's installed.`,
            intent: 'os_action',
            source: 'regex',
          };
        }
        return {
          success: false,
          message: 'App launching requires the latest desktop version.',
          intent: 'os_action',
          source: 'none',
        };
      }

      case 'focus_window': {
        if (api.flow?.focusWindow) {
          const result = await api.flow.focusWindow(action.payload);
          return {
            success: result,
            message: result ? `Focused ${action.payload}` : `Could not find window "${action.payload}"`,
            intent: 'os_action',
            source: 'regex',
          };
        }
        return {
          success: false,
          message: 'Window focus requires the latest desktop version.',
          intent: 'os_action',
          source: 'none',
        };
      }

      case 'show_floatgpt':
      case 'hide_floatgpt':
      case 'toggle_floatgpt': {
        // These are handled by the renderer directly via the existing toggle mechanism
        return {
          success: true,
          message: action.type === 'show_floatgpt' ? 'FloatGPT is now visible'
            : action.type === 'hide_floatgpt' ? 'FloatGPT is now hidden'
            : 'FloatGPT toggled',
          intent: 'floatgpt_control',
          source: 'regex',
        };
      }

      default:
        return {
          success: false,
          message: `Unknown action type: ${action.type}`,
          intent: 'os_action',
          source: 'none',
        };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Action failed: ${err.message}`,
      intent: 'os_action',
      source: 'none',
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Normalize a URL — add https:// if no protocol is specified.
 */
function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  let url = trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    if (/\.(com|org|net|io|dev|ai|edu|gov)\b/i.test(trimmed)) {
      url = `https://${trimmed}`;
    } else {
      url = `https://${trimmed}`;
    }
  }
  return encodeURI(url);
}
