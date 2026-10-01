import React, { useState } from 'react';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { writePlaygroundVault } from '../lib/playgroundVault';

const PROVIDERS = [
  { id: 'groq', name: 'Groq', mark: 'Gq', detail: 'Fast replies. Llama and Mixtral.' },
  { id: 'gemini', name: 'Google Gemini', mark: 'Ge', detail: 'Gemini models from Google.' },
  { id: 'openai', name: 'OpenAI', mark: 'Ai', detail: 'GPT models.' },
  { id: 'anthropic', name: 'Anthropic', mark: 'An', detail: 'Claude models.' },
];

const PROVIDER_MODELS = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1'],
  anthropic: ['claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022'],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'deepseek-r1-distill-llama-70b',
    'gemma2-9b-it',
    'mixtral-8x7b-32768',
  ],
};

const MODEL_LABELS = {
  'llama-3.3-70b-versatile': 'Llama 3.3 70B',
  'llama-3.1-8b-instant': 'Llama 3.1 8B Instant',
  'deepseek-r1-distill-llama-70b': 'DeepSeek R1 Distill 70B',
  'gemma2-9b-it': 'Gemma 2 9B',
  'mixtral-8x7b-32768': 'Mixtral 8x7B',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
  'gemini-1.5-flash': 'Gemini 1.5 Flash',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'o3-mini': 'o3-mini',
  'o1': 'o1',
  'claude-3-7-sonnet-20250219': 'Claude 3.7 Sonnet',
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
};

const DEFAULT_MODELS = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o',
  anthropic: 'claude-3-7-sonnet-20250219',
  groq: 'llama-3.3-70b-versatile',
};

const providerKey = (id) => (id === 'gemini' ? 'google' : id);

const keysFromConfig = (aiConfig) => ({
  gemini: aiConfig?.apiKeys?.google || '',
  openai: aiConfig?.apiKeys?.openai || '',
  anthropic: aiConfig?.apiKeys?.anthropic || '',
  groq: aiConfig?.apiKeys?.groq || '',
});

const modelsFromConfig = (aiConfig) => ({
  gemini: aiConfig?.selectedModels?.google || DEFAULT_MODELS.gemini,
  openai: aiConfig?.selectedModels?.openai || DEFAULT_MODELS.openai,
  anthropic: aiConfig?.selectedModels?.anthropic || DEFAULT_MODELS.anthropic,
  groq: aiConfig?.selectedModels?.groq || DEFAULT_MODELS.groq,
});

export const ApiKeysView = ({ globalState, setGlobalState }) => {
  const [keys, setKeys] = useState(() => keysFromConfig(globalState?.settings?.aiConfig));
  const [models, setModels] = useState(() => modelsFromConfig(globalState?.settings?.aiConfig));
  const [visible, setVisible] = useState({});
  const [notice, setNotice] = useState('');

  React.useEffect(() => {
    const aiConfig = globalState?.settings?.aiConfig || {};
    setModels((prev) => {
      const next = modelsFromConfig(aiConfig);
      return PROVIDERS.reduce((acc, provider) => {
        acc[provider.id] = prev[provider.id] || next[provider.id];
        return acc;
      }, {});
    });
    setKeys((prev) => {
      const next = keysFromConfig(aiConfig);
      return PROVIDERS.reduce((acc, provider) => {
        acc[provider.id] = prev[provider.id] !== '' ? prev[provider.id] : next[provider.id];
        return acc;
      }, {});
    });
  }, [globalState]);

  const activeProvider = globalState?.settings?.aiConfig?.selectedProvider || 'groq';

  const persist = (providerId, nextKeys, nextModels, nextActive) => {
    const aiConfig = globalState?.settings?.aiConfig || {};
    const apiKeys = { ...(aiConfig.apiKeys || {}) };
    const selectedModels = { ...(aiConfig.selectedModels || {}) };
    PROVIDERS.forEach((provider) => {
      const storedId = providerKey(provider.id);
      apiKeys[storedId] = nextKeys[provider.id] || '';
      selectedModels[storedId] = nextModels[provider.id] || DEFAULT_MODELS[provider.id];
    });
    const selectedProvider = nextActive || aiConfig.selectedProvider || 'groq';
    writePlaygroundVault({ apiKeys, selectedModels, selectedProvider });
    setGlobalState({
      ...(globalState || {}),
      settings: {
        ...(globalState?.settings || {}),
        aiConfig: {
          ...aiConfig,
          apiKeys,
          selectedModels,
          selectedProvider,
        },
      },
    });
    setNotice(providerId);
    window.setTimeout(() => setNotice((current) => (current === providerId ? '' : current)), 1600);
  };

  const storedKeys = globalState?.settings?.aiConfig?.apiKeys || {};
  const savedCount = PROVIDERS.filter((provider) => String(storedKeys[providerKey(provider.id)] || '').trim()).length;
  const activeName = PROVIDERS.find((provider) => providerKey(provider.id) === activeProvider)?.name || 'Groq';

  return (
    <div className="custom-scrollbar flex-1 overflow-y-auto bg-bg text-text-primary">
      <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-col gap-5 border-b border-card-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-lg">
            <h1 className="text-[28px] font-semibold tracking-tight">API keys</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">
              A key stays in this browser. Save stores it. Use for chat sends the next reply through that provider. The orb keeps its own key.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="min-w-[132px] rounded-2xl border border-card-border bg-panel px-3.5 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">In use</p>
              <p className="mt-0.5 truncate text-[14px] font-semibold text-text-primary">{activeName}</p>
            </div>
            <div className="min-w-[88px] rounded-2xl border border-card-border bg-panel px-3.5 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Saved</p>
              <p className="mt-0.5 text-[14px] font-semibold text-text-primary">{savedCount} of {PROVIDERS.length}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {PROVIDERS.map((provider) => {
            const storedId = providerKey(provider.id);
            const inUse = activeProvider === storedId;
            const hasKey = Boolean(String(keys[provider.id] || '').trim());
            const stored = Boolean(String(storedKeys[storedId] || '').trim());
            const status = notice === provider.id ? 'Saved on this browser' : notice === `removed-${provider.id}` ? 'Removed' : '';
            return (
              <section
                key={provider.id}
                className={`overflow-hidden rounded-2xl border bg-panel shadow-[0_1px_0_rgba(255,255,255,0.03)] ${inUse ? 'border-accent/45' : 'border-card-border'}`}
              >
                <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-[13px] font-semibold ${inUse ? 'border-accent/40 bg-accent/10 text-accent' : 'border-card-border bg-card text-text-secondary'}`}>
                    {provider.mark}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[16px] font-semibold text-text-primary">{provider.name}</h2>
                      {inUse && (
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">In use</span>
                      )}
                      {!inUse && stored && (
                        <span className="rounded-full border border-card-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Saved</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[13px] text-text-muted">{provider.detail}</p>
                  </div>
                </div>

                <div className="grid gap-3 border-t border-card-border/70 bg-bg/50 px-4 py-4 sm:grid-cols-2 sm:px-5">
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-text-muted">Model</span>
                    <span className="relative block">
                      <select
                        value={models[provider.id]}
                        onChange={(event) => setModels({ ...models, [provider.id]: event.target.value })}
                        className="h-11 w-full appearance-none rounded-xl border border-card-border bg-card px-3 pr-9 text-[13px] text-text-primary outline-none transition-colors focus:border-accent"
                      >
                        {PROVIDER_MODELS[provider.id].map((model) => (
                          <option key={model} value={model}>{MODEL_LABELS[model] || model}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    </span>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-text-muted">Key</span>
                    <span className="relative block">
                      <input
                        type="text"
                        value={keys[provider.id]}
                        onChange={(event) => setKeys({ ...keys, [provider.id]: event.target.value })}
                        placeholder="Paste the key"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        style={visible[provider.id] ? undefined : { WebkitTextSecurity: 'disc' }}
                        className="h-11 w-full rounded-xl border border-card-border bg-card py-2 pl-3 pr-11 font-mono text-[13px] text-text-primary outline-none transition-colors placeholder:font-sans focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setVisible({ ...visible, [provider.id]: !visible[provider.id] })}
                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted hover:bg-bg hover:text-text-primary"
                        aria-label={visible[provider.id] ? 'Hide key' : 'Show key'}
                      >
                        {visible[provider.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </span>
                  </label>
                </div>

                <div className="flex min-h-[52px] flex-wrap items-center gap-2 border-t border-card-border/70 px-4 py-3 sm:px-5">
                  {hasKey ? (
                    <>
                      <button
                        type="button"
                        onClick={() => persist(provider.id, keys, models, inUse ? storedId : activeProvider)}
                        className="h-9 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-bg"
                      >
                        Save key
                      </button>
                      {!inUse && (
                        <button
                          type="button"
                          onClick={() => persist(provider.id, keys, models, storedId)}
                          className="h-9 rounded-lg border border-card-border bg-card px-3.5 text-[13px] font-semibold text-text-primary hover:border-accent/40"
                        >
                          Use for chat
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const nextKeys = { ...keys, [provider.id]: '' };
                          setKeys(nextKeys);
                          const nextActive = inUse ? 'groq' : activeProvider;
                          persist(`removed-${provider.id}`, nextKeys, models, nextActive);
                        }}
                        className="h-9 rounded-lg px-3 text-[13px] font-semibold text-text-muted hover:bg-card hover:text-text-primary"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <p className="text-[13px] text-text-muted">Paste a key, then save it on this browser.</p>
                  )}
                  <AnimatePresence>
                    {status && (
                      <motion.span
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-[13px] text-text-secondary"
                      >
                        {status}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};
