/**
 * Deterministic OS Media & Playback Controller.
 * 
 * Provides zero-token, hardware-accelerated media key control (Play, Pause, Mute, Volume).
 * Allows users to say "pause video", "play video", "resume", "mute" to instantly control
 * active YouTube, Spotify, Netflix, or media streams across any browser or app.
 */

export type MediaAction = 
  | 'toggle' 
  | 'play' 
  | 'pause' 
  | 'mute' 
  | 'volume_up' 
  | 'volume_down' 
  | 'next' 
  | 'prev'
  | 'zoom_in'
  | 'zoom_out'
  | 'zoom_reset'
  | 'switch_tab'
  | 'prev_tab'
  | 'switch_app'
  | 'scroll_down'
  | 'scroll_up'
  | 'scroll_top'
  | 'scroll_bottom'
  | 'find_on_page';

export interface MediaIntentResult {
  action: MediaAction;
  label: string;
  response: string;
  query?: string;
  steps?: number;
}

/**
 * Normalizes input text for media intent parsing.
 */
function normalizeMedia(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[?!.,]+/g, ' ')
    .replace(/\b(can you|could you|would you|please|pls|yaar|bhai|just|tell me|hey|hi|hello|float|flow|flo)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects whether a spoken prompt is requesting media playback control.
 */
export function detectMediaIntent(raw: string): MediaIntentResult | null {
  const lower = normalizeMedia(raw);
  if (!lower) return null;

  const pauseWord = /\bpause\b/.test(lower);
  const stopWord = /\bstop\b/.test(lower);
  const mediaNoun = /\b(video|playback|music|song|youtube|track|stream|player|playing|screen)\b/.test(lower);
  const barePause = /^(pause)( it| this| that)?$/.test(lower) || /^(stop)( it| this| that)$/.test(lower);
  if (
    barePause ||
    /^(pause video|pause playback|pause the video|pause music|pause song|stop the video|stop video|ruko|rok do)$/i.test(lower) ||
    ((pauseWord || stopWord) && mediaNoun)
  ) {
    const isYt = lower.includes('youtube');
    return {
      action: 'pause',
      label: 'Pause Playback',
      response: isYt ? '⏸️ Paused YouTube video playback.' : '⏸️ Paused the video on your screen.'
    };
  }

  const playWord = /\b(play|resume|unpause)\b/.test(lower);
  const barePlay = /^(play|resume|unpause)( it| this| that)?$/.test(lower);
  if (
    barePlay ||
    /^(resume playback|play video|play the video|resume video|play music|resume music|chalao|chala do)$/i.test(lower) ||
    (playWord && mediaNoun)
  ) {
    const isYt = lower.includes('youtube');
    return {
      action: 'play',
      label: 'Play / Resume Playback',
      response: isYt ? '▶️ Resumed YouTube video playback.' : '▶️ Resumed playback.'
    };
  }

  // 3. Toggle Play/Pause
  if (
    /^(toggle video|toggle music|toggle playback|toggle youtube|play pause|toggle media)$/i.test(lower) ||
    (/\btoggle\b/.test(lower) && /\b(video|playback|music|song|youtube|media)\b/.test(lower))
  ) {
    const isYt = lower.includes('youtube');
    return {
      action: 'toggle',
      label: 'Toggle Play/Pause',
      response: isYt ? '⏯️ Toggled YouTube video playback.' : '⏯️ Toggled media playback.'
    };
  }

  // 4. Mute / Unmute
  if (
    /^(mute|unmute|mute audio|mute sound|mute volume|chup karo)$/i.test(lower) ||
    (/\b(mute|unmute)\b/.test(lower) && /\b(audio|sound|volume|pc|laptop|music)\b/.test(lower))
  ) {
    return {
      action: 'mute',
      label: 'Mute / Unmute Audio',
      response: '🔇 Toggled audio mute.'
    };
  }

  // 5. Volume Up
  if (
    /^(volume up|turn it up|louder|increase volume|awaaz badhao)$/i.test(lower) ||
    (/\b(volume|sound|audio)\b/.test(lower) && /\b(up|increase|raise|boost|more|higher|badhao)\b/.test(lower))
  ) {
    return {
      action: 'volume_up',
      label: 'Volume Up',
      response: '🔊 Increased volume.'
    };
  }

  // 6. Volume Down
  if (
    /^(volume down|turn it down|quieter|decrease volume|awaaz kam karo)$/i.test(lower) ||
    (/\b(volume|sound|audio)\b/.test(lower) && /\b(down|decrease|lower|less|kam)\b/.test(lower))
  ) {
    return {
      action: 'volume_down',
      label: 'Volume Down',
      response: '🔉 Decreased volume.'
    };
  }

  // 7. Track Navigation (Next / Previous)
  if (/\b(next song|next video|next track|skip song|skip video|skip track|agle gaane)\b/.test(lower)) {
    return {
      action: 'next',
      label: 'Next Track',
      response: '⏭️ Skipped to next track.'
    };
  }

  if (/\b(prev song|previous song|previous video|previous track|prev track)\b/.test(lower)) {
    return {
      action: 'prev',
      label: 'Previous Track',
      response: '⏮️ Replayed previous track.'
    };
  }

  // 8. Screen Zoom In
  if (
    /^(zoom in|enlarge|enlarge screen|magnify|magnify screen|zoom screen in|zoom in screen|zoom karo)$/i.test(lower) ||
    (/\b(enlarge|magnify)\s+(the\s+)?screen\b/i.test(lower)) ||
    (/\bzoom\b/.test(lower) && /\b(in|badhao|bada)\b/.test(lower))
  ) {
    return {
      action: 'zoom_in',
      label: 'Zoom In',
      response: '🔍 Zoomed in.'
    };
  }

  // 9. Screen Zoom Out
  if (
    /^(zoom out|shrink zoom|zoom screen out|zoom out screen|zoom kam karo)$/i.test(lower) ||
    (/\bzoom\b/.test(lower) && /\b(out|kam|chota)\b/.test(lower))
  ) {
    return {
      action: 'zoom_out',
      label: 'Zoom Out',
      response: '🔍 Zoomed out.'
    };
  }

  // 10. Screen Zoom Reset
  if (
    /^(reset zoom|normal zoom|default zoom|zoom 100|zoom reset)$/i.test(lower) ||
    (/\b(reset|normal|default)\b/.test(lower) && /\bzoom\b/.test(lower))
  ) {
    return {
      action: 'zoom_reset',
      label: 'Reset Zoom',
      response: '🔍 Reset screen zoom to default.'
    };
  }

  // 11. Browser / App Tab Switching (Next Tab)
  if (
    /^(switch tab|next tab|change tab|agla tab|tab badlo)$/i.test(lower) ||
    (/\b(switch|next|change)\b/.test(lower) && /\btab\b/.test(lower))
  ) {
    return {
      action: 'switch_tab',
      label: 'Switch Tab',
      response: '📑 Switched to next tab.'
    };
  }

  // 12. Browser / App Tab Switching (Previous Tab)
  if (
    /^(prev tab|previous tab|last tab|back tab|pichla tab)$/i.test(lower) ||
    (/\b(prev|previous|back)\b/.test(lower) && /\btab\b/.test(lower))
  ) {
    return {
      action: 'prev_tab',
      label: 'Previous Tab',
      response: '📑 Switched to previous tab.'
    };
  }

  // 13. Window / App Switching
  if (
    /^(switch app|switch window|next window|next app|window badlo)$/i.test(lower) ||
    (/\b(switch|next)\b/.test(lower) && /\b(app|window)\b/.test(lower))
  ) {
    return {
      action: 'switch_app',
      label: 'Switch Window',
      response: '🪟 Switched active window.'
    };
  }

  // 14. Hands-Free Viewport Scrolling: Down
  if (
    /^(scroll down|scroll lower|page down|scroll page down|scroll down page|down scroll|niche scroll|scroll karo niche)$/i.test(lower) ||
    (/\b(scroll|page)\b/.test(lower) && /\b(down|lower|niche)\b/.test(lower))
  ) {
    return {
      action: 'scroll_down',
      label: 'Scroll Down',
      response: '📜 Scrolled down page.'
    };
  }

  // 15. Hands-Free Viewport Scrolling: Up
  if (
    /^(scroll up|scroll higher|page up|scroll page up|scroll up page|up scroll|upar scroll|scroll karo upar)$/i.test(lower) ||
    (/\b(scroll|page)\b/.test(lower) && /\b(up|higher|upar)\b/.test(lower))
  ) {
    return {
      action: 'scroll_up',
      label: 'Scroll Up',
      response: '📜 Scrolled up page.'
    };
  }

  // 16. Hands-Free Viewport Scrolling: Top of Document / Page
  if (
    /^(scroll to top|jump to top|go to top|scroll top|page top|top of page|move to top|shuru mein jao)$/i.test(lower) ||
    (/\b(scroll|jump|go|move)\b/.test(lower) && /\b(to the top|to top|top of page)\b/.test(lower))
  ) {
    return {
      action: 'scroll_top',
      label: 'Scroll to Top',
      response: '🔝 Scrolled to top of page.'
    };
  }

  // 17. Hands-Free Viewport Scrolling: Bottom of Document / Page
  if (
    /^(scroll to bottom|jump to bottom|go to bottom|scroll bottom|scroll to end|jump to end|page bottom|page end|bottom of page|move to end)$/i.test(lower) ||
    (/\b(scroll|jump|go|move)\b/.test(lower) && /\b(to the bottom|to bottom|to the end|to end|bottom of page)\b/.test(lower))
  ) {
    return {
      action: 'scroll_bottom',
      label: 'Scroll to Bottom',
      response: '🔚 Scrolled to bottom of page.'
    };
  }

  // 18. Universal In-App Find on Page (Ctrl+F + Clipboard Injection)
  const findMatch = lower.match(/^(?:find|search(?:\s+for)?)\s+(.+?)(?:\s+(?:on|in)(?:\s+this)?(?:\s+the)?\s+(?:page|screen|document|file))$/i) ||
                    lower.match(/^(?:find|search(?:\s+for)?)\s+(?:on|in)(?:\s+this)?(?:\s+the)?\s+(?:page|screen|document|file)\s+(?:for\s+)?(.+)$/i);
  if (findMatch && findMatch[1]?.trim()) {
    const query = findMatch[1].trim();
    return {
      action: 'find_on_page',
      label: `Find "${query}" on Page`,
      response: `🔎 Searching page for "${query}"...`,
      query
    };
  }

  if (/^(find on page|search on page|find in page|find bar|open find)$/i.test(lower)) {
    return {
      action: 'find_on_page',
      label: 'Find on Page',
      response: '🔎 Opened in-page search.'
    };
  }

  return null;
}

/**
 * Dispatches the media action to the native OS hardware keys.
 */
export async function executeMediaIntent(
  action: MediaAction,
  opts?: { query?: string; steps?: number }
): Promise<{ ok: boolean; message: string }> {
  const win = typeof window !== 'undefined' ? window : (globalThis as any).window;
  const api = win?.electronAPI?.media?.control || (globalThis as any).electronAPI?.media?.control;

  if (api) {
    try {
      const res = await api(action, opts);
      return {
        ok: !!res?.ok,
        message: res?.ok ? `Success: ${action}` : (res?.error || 'Media control failed')
      };
    } catch (err: any) {
      return { ok: false, message: err.message || 'Media control failed' };
    }
  }

  return { ok: false, message: 'Media control requires the FloatGPT desktop app.' };
}
