import React, { useState } from 'react';
import { Key, Check, X, Sparkles, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, Copy, Cpu, ShieldCheck } from 'lucide-react';
import { AppState, AIProvider } from '../../types';
import { validateApiKey } from '../../lib/apiKeyValidator';

interface QuickApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export const PROVIDERS: { id: AIProvider; name: string; desc: string; placeholder: string }[] = [
  { id: 'groq', name: 'Groq', desc: 'Ultra-fast inference (Llama, GPT OSS)', placeholder: 'gsk_...' },
  { id: 'google', name: 'Google Gemini', desc: 'Multimodal vision & web search', placeholder: 'AIzaSy...' },
  { id: 'openai', name: 'OpenAI', desc: 'GPT-4o & flagship reasoning', placeholder: 'sk-proj-...' },
  { id: 'anthropic', name: 'Anthropic', desc: 'Claude 3.7 Sonnet & Haiku', placeholder: 'sk-ant-...' }
];

export const PROVIDER_MODELS: Record<AIProvider, { id: string; name: string; tag?: string }[]> = {
  groq: [
    { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B (Default Reasoning)', tag: 'Recommended' },
    { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B (Deep Reasoning)', tag: 'Flagship' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Versatile)' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Ultra-fast)', tag: 'Fast' },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B (Reasoning)', tag: 'Reasoning' }
  ],
  google: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast Reasoning)', tag: 'Recommended' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Deep Coding & Logic)', tag: 'Flagship' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Multimodal)', tag: 'Multimodal' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Lightweight)' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Long Context)' }
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o (Omni Flagship)', tag: 'Flagship' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Smart)', tag: 'Recommended' },
    { id: 'o3-mini', name: 'o3-mini (Deep STEM Reasoning)', tag: 'Reasoning' },
    { id: 'o1', name: 'o1 (Advanced Reasoning)', tag: 'Reasoning' }
  ],
  anthropic: [
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (Hybrid Reasoning)', tag: 'Flagship' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Ultra-Fast)', tag: 'Fast' }
  ]
};

export const QuickApiKeyModal: React.FC<QuickApiKeyModalProps> = ({
  isOpen,
  onClose,
  state,
  setState
}) => {
  const { settings } = state;
  const activeProvider = settings.aiConfig.selectedProvider || 'groq';
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(activeProvider);
  const [selectedModel, setSelectedModel] = useState<string>(
    settings.aiConfig.selectedModels?.[activeProvider] || PROVIDER_MODELS[activeProvider]?.[0]?.id || ''
  );
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState<string>(settings.aiConfig.apiKeys?.[selectedProvider] || '');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleProviderSelect = (pId: AIProvider) => {
    setSelectedProvider(pId);
    setKeyInput(settings.aiConfig.apiKeys?.[pId] || '');
    setSelectedModel(settings.aiConfig.selectedModels?.[pId] || PROVIDER_MODELS[pId]?.[0]?.id || '');
    setValidationResult(null);
  };

  const handleSaveAndActivate = async () => {
    setIsValidating(true);
    setValidationResult(null);

    // If key is provided, validate it
    if (keyInput.trim()) {
      const result = await validateApiKey(selectedProvider, keyInput.trim());
      setValidationResult(result);
      if (!result.isValid) {
        setIsValidating(false);
        return;
      }
    }

    setState(prev => {
      const currentKeys = { ...(prev.settings.aiConfig.apiKeys || {}) } as Record<AIProvider, string>;
      if (keyInput.trim()) {
        currentKeys[selectedProvider] = keyInput.trim();
      }
      const updatedModels = {
        ...(prev.settings.aiConfig.selectedModels || {}),
        [selectedProvider]: selectedModel
      };

      return {
        ...prev,
        settings: {
          ...prev.settings,
          aiConfig: {
            ...prev.settings.aiConfig,
            selectedProvider: selectedProvider,
            selectedModels: updatedModels,
            apiKeys: currentKeys
          }
        }
      };
    });

    setIsValidating(false);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setKeyInput(text.trim());
    } catch {}
  };

  const availableModels = PROVIDER_MODELS[selectedProvider] || [];

  return (
    <div 
      className="absolute inset-0 z-50 bg-panel text-text-primary flex flex-col rounded-2xl overflow-hidden font-sans border border-card-border shadow-2xl animate-in fade-in zoom-in-95 duration-150 electron-no-drag"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Native FloatGPT Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-card-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center">
            <Key className="w-3.5 h-3.5 text-accent" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-text-primary">AI Models & API Keys</h3>
            <p className="text-[10px] text-text-muted">Manage providers, active models, and credentials</p>
          </div>
        </div>
        <button 
          type="button"
          onClick={onClose}
          className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-card-border/30 transition-colors cursor-pointer"
          title="Close Key Manager"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 hide-scrollbar">
        {/* Provider Cards */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
            Select Provider
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map(p => {
              const isCurrentActive = activeProvider === p.id;
              const isSelected = selectedProvider === p.id;
              const hasConfiguredKey = !!(settings.aiConfig.apiKeys?.[p.id] || (p.id === 'groq'));

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderSelect(p.id)}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-accent/15 border-accent shadow-sm ring-1 ring-accent/30' 
                      : 'bg-card border-card-border/60 hover:border-card-border hover:bg-card-border/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-text-primary">{p.name}</span>
                    {isCurrentActive && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Active Provider" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-text-muted truncate max-w-[80px]">{p.desc.split(' ')[0]}</span>
                    <span className={`px-1.5 py-0.2 rounded font-mono ${hasConfiguredKey ? 'text-emerald-400 bg-emerald-500/10' : 'text-text-muted'}`}>
                      {hasConfiguredKey ? 'Ready' : 'No Key'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Model Selection */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-accent" /> Active Model ({PROVIDERS.find(p => p.id === selectedProvider)?.name})
            </label>
            <span className="text-[10px] text-accent font-mono">
              {availableModels.find(m => m.id === selectedModel)?.tag || 'Custom'}
            </span>
          </div>
          <select 
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full bg-bg border border-card-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent font-medium cursor-pointer shadow-sm"
          >
            {availableModels.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} {m.tag ? `[${m.tag}]` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* API Key Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              {PROVIDERS.find(p => p.id === selectedProvider)?.name} API Key
            </label>
            <button
              type="button"
              onClick={handlePaste}
              className="text-[10px] text-accent hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <Copy className="w-2.5 h-2.5" /> Paste Key
            </button>
          </div>

          <div className="relative">
            <input 
              type={showKey ? 'text' : 'password'}
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder={PROVIDERS.find(p => p.id === selectedProvider)?.placeholder || 'Enter API key...'}
              className="w-full bg-bg border border-card-border rounded-xl px-3 py-2 pr-9 text-xs text-text-primary focus:outline-none focus:border-accent font-mono shadow-sm"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 cursor-pointer"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          {selectedProvider === 'groq' && (
            <p className="text-[10px] text-emerald-400 flex items-center gap-1 leading-snug pt-0.5">
              <ShieldCheck className="w-3 h-3 shrink-0" /> Multi-Key failover pool active (7 background keys configured).
            </p>
          )}

          {/* Validation Feedback */}
          {validationResult && (
            <div className={`p-2 rounded-xl text-xs flex items-center gap-2 ${
              validationResult.isValid 
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                : 'bg-danger/10 border border-danger/30 text-danger'
            }`}>
              {validationResult.isValid ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
              <span className="text-[11px] leading-tight">{validationResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-card-border bg-bg-secondary/80 shrink-0 flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-2 rounded-xl text-xs text-text-muted hover:text-text-primary hover:bg-card-border/30 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSaveAndActivate}
          disabled={isValidating}
          className="flex-1 py-2 px-3 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          {isValidating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Verifying Key...</span>
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Set as Active Provider</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
