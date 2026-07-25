import { AppState } from '../../types';

export const AIConfigResolver = {
  /**
   * Resolves the current active AI configuration based on the unified state.
   */
  resolve(state: AppState) {
    const config = state.settings.aiConfig;
    const provider = config.selectedProvider || 'google';
    
    // Get the provider's specific API key
    const apiKey = config.apiKeys[provider] || '';
    
    // Get the model for the provider
    const defaultModelMapping: Record<string, string> = {
      google: 'gemini-1.5-flash',
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-haiku-20240307',
      groq: 'llama-3.1-8b-instant'
    };
    
    const model = config.selectedModels[provider] || defaultModelMapping[provider];

    return {
      providerId: provider,
      modelId: model,
      apiKey: apiKey,
      parameters: config.parameters,
      isSystemScope: false
    };
  }
};
