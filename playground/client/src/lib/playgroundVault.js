const VAULT_KEY = 'floatgpt_playground_keys';

export function readPlaygroundVault() {
  try {
    const parsed = JSON.parse(localStorage.getItem(VAULT_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writePlaygroundVault(vault) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

export function applyPlaygroundVault(state) {
  if (!state) return state;
  const vault = readPlaygroundVault();
  const localKeys = vault.apiKeys || {};
  const hasLocal = Object.values(localKeys).some((value) => String(value || '').trim());
  if (!hasLocal) return state;
  const current = state.settings?.aiConfig?.apiKeys || {};
  const hasCurrent = Object.values(current).some((value) => String(value || '').trim());
  if (hasCurrent) return state;
  return {
    ...state,
    settings: {
      ...(state.settings || {}),
      aiConfig: {
        ...(state.settings?.aiConfig || {}),
        apiKeys: { ...current, ...localKeys },
        selectedModels: {
          ...(state.settings?.aiConfig?.selectedModels || {}),
          ...(vault.selectedModels || {}),
        },
        selectedProvider: state.settings?.aiConfig?.selectedProvider || vault.selectedProvider || 'groq',
      },
    },
  };
}
