import { AppState, INITIAL_STATE } from '../types';

export function normalizeSettings(settings: any) {
  const source = settings || {};
  const defaults = INITIAL_STATE.settings;
  const aiConfig = source.aiConfig || {};

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
      selectedModels: { ...defaults.aiConfig.selectedModels, ...(aiConfig.selectedModels || {}) },
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
    notifications: Array.isArray(source.notifications) ? source.notifications : INITIAL_STATE.notifications,
    knowledge: Array.isArray(source.knowledge) ? source.knowledge : INITIAL_STATE.knowledge,
    pastSessions: Array.isArray(source.pastSessions) ? source.pastSessions : INITIAL_STATE.pastSessions,
    habitProfile: { ...INITIAL_STATE.habitProfile, ...(source.habitProfile || {}) },
    executionProfile: { ...INITIAL_STATE.executionProfile, ...(source.executionProfile || {}) },
    focusModeState: { ...INITIAL_STATE.focusModeState, ...(source.focusModeState || {}) },
    metrics: { ...INITIAL_STATE.metrics, ...(source.metrics || {}) },
    uiState: { ...INITIAL_STATE.uiState, ...(source.uiState || {}) },
    recoveryState: { ...INITIAL_STATE.recoveryState, ...(source.recoveryState || {}) },
    settings: normalizeSettings(source.settings),
  };
}
