import { AppState, INITIAL_STATE } from '../types';

export function normalizeSettings(settings: any) {
  const source = settings || {};
  const defaults = INITIAL_STATE.settings;
  const aiConfig = source.aiConfig || {};

  const normalizedGroqModel = (value: string | undefined) => {
    const validModels = [
      'openai/gpt-oss-20b',
      'openai/gpt-oss-120b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'deepseek-r1-distill-llama-70b',
      'gemma2-9b-it',
      'mixtral-8x7b-32768'
    ];
    return validModels.includes(value || '') ? value : 'openai/gpt-oss-20b';
  };

  const selectedModels = {
    ...defaults.aiConfig.selectedModels,
    ...(aiConfig.selectedModels || {}),
    groq: normalizedGroqModel((aiConfig.selectedModels || {}).groq),
  };

  return {
    ...defaults,
    ...source,
    appearance: { ...defaults.appearance, ...(source.appearance || {}) },
    system: { ...defaults.system, ...(source.system || {}) },
    features: { ...defaults.features, ...(source.features || {}) },
    productivity: { ...defaults.productivity, ...(source.productivity || {}) },
    accessibility: { ...defaults.accessibility, ...(source.accessibility || {}) },
    privacy: { ...defaults.privacy, ...(source.privacy || {}) },
    sync: { ...defaults.sync, ...(source.sync || {}) },
    aiConfig: {
      ...defaults.aiConfig,
      ...aiConfig,
      apiKeys: { ...defaults.aiConfig.apiKeys, ...(aiConfig.apiKeys || {}) },
      selectedModels,
      parameters: { ...defaults.aiConfig.parameters, ...(aiConfig.parameters || {}) },
    },
  };
}

export function normalizeAppState(raw: any): AppState {
  const source = raw || {};

  return {
    ...INITIAL_STATE,
    ...source,
    goals: Array.isArray(source.goals) ? source.goals : INITIAL_STATE.goals,
    projects: Array.isArray(source.projects) ? source.projects : INITIAL_STATE.projects,
    tasks: Array.isArray(source.tasks) ? source.tasks : INITIAL_STATE.tasks,
    risks: Array.isArray(source.risks) ? source.risks : INITIAL_STATE.risks,
    resources: Array.isArray(source.resources) ? source.resources : INITIAL_STATE.resources,
    history: Array.isArray(source.history) ? source.history : INITIAL_STATE.history,
    messages: Array.isArray(source.messages) ? source.messages : INITIAL_STATE.messages,
    playgroundMessages: Array.isArray(source.playgroundMessages) ? source.playgroundMessages : INITIAL_STATE.playgroundMessages,
    recommendations: Array.isArray(source.recommendations) ? source.recommendations : INITIAL_STATE.recommendations,
    knowledge: (Array.isArray(source.knowledge) && Array.isArray(source.messages) && source.messages.length > 0)
      ? source.knowledge
          .filter((k: any) => k && k.id)
          .map((k: any) => ({
            ...k,
            status: k.status === 'processing' ? 'ready' : k.status
          }))
      : [],
    habitProfile: { ...INITIAL_STATE.habitProfile, ...(source.habitProfile || {}) },
    executionProfile: { ...INITIAL_STATE.executionProfile, ...(source.executionProfile || {}) },
    focusModeState: { active: false },
    metrics: { ...INITIAL_STATE.metrics, ...(source.metrics || {}) },
    uiState: { ...INITIAL_STATE.uiState, ...(source.uiState || {}) },
    recoveryState: { ...INITIAL_STATE.recoveryState, ...(source.recoveryState || {}) },
    settings: normalizeSettings(source.settings),
  };
}
