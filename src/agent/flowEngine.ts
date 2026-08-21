/**
 * Flow Engine — Configuration and Entry Point
 * 
 * Re-exports processCommand which delegates to the new flowRouter.
 */

import { type FlowResponse } from './commandSchemas';
import { type OSActionType } from './osActions';
import { routeCommand } from './flowRouter';

export interface FlowConfig {
  enabled: boolean;
  aiProvider: 'local' | 'cloud' | 'auto';
  ollamaModel: string;
  ollamaReasoningModel: string;
  cloudFallback: boolean;
  permittedActions: OSActionType[];
  orbAutoShow: boolean;
}

const DEFAULT_CONFIG: FlowConfig = {
  enabled: true,
  aiProvider: 'auto',
  ollamaModel: 'gemma2:2b',
  ollamaReasoningModel: 'gemma2:2b',
  cloudFallback: true,
  permittedActions: ['open_url', 'search_web', 'show_floatgpt', 'hide_floatgpt', 'toggle_floatgpt'],
  orbAutoShow: true,
};

let config: FlowConfig = { ...DEFAULT_CONFIG };

export function updateFlowConfig(newConfig: Partial<FlowConfig>): void {
  config = { ...config, ...newConfig };
  console.log('[Flow] Config updated:', config);
}

export function getFlowConfig(): FlowConfig {
  return { ...config };
}

export async function processCommand(rawText: string): Promise<FlowResponse> {
  if (!config.enabled) {
    return {
      success: false,
      message: 'Flow assistant is disabled. Enable it in Settings → Desktop Agent.',
      intent: 'general_chat',
      source: 'none',
    };
  }

  const text = rawText.trim();
  if (!text) {
    return {
      success: false,
      message: 'Empty command.',
      intent: 'general_chat',
      source: 'none',
    };
  }

  console.log(`[Flow] Processing command: "${text}"`);
  return await routeCommand(text);
}
