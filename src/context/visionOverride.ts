import { AppState } from '../types';
import type { OverrideConfig } from '../ai/providers/types';

/** Prefer a vision-capable provider when a glance screenshot is attached. */
export function resolveVisionOverride(state: AppState, hasImage: boolean): OverrideConfig | undefined {
  if (!hasImage) return undefined;
  const config = state.settings?.aiConfig;
  if (!config) return undefined;
  const keys = config.apiKeys || ({} as Record<string, string>);
  const selected = config.selectedProvider;

  if (selected === 'google' && keys.google?.trim()) return undefined;
  if (selected === 'openai' && keys.openai?.trim()) return undefined;

  if (keys.google?.trim()) {
    return {
      providerId: 'google',
      model: config.selectedModels?.google || 'gemini-2.5-flash',
      apiKey: keys.google.trim()
    };
  }
  if (keys.openai?.trim()) {
    return {
      providerId: 'openai',
      model: config.selectedModels?.openai || 'gpt-4o',
      apiKey: keys.openai.trim()
    };
  }
  return undefined;
}
