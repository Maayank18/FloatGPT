import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Save, Trash } from 'lucide-react';
import { auth, db, doc, setDoc } from '../../../../src/lib/firebase';
import { motion } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const ApiKeysView = ({ globalState, setGlobalState }) => {
  const [keys, setKeys] = useState({
    gemini: globalState?.settings?.aiConfig?.apiKeys?.google || '',
    openai: globalState?.settings?.aiConfig?.apiKeys?.openai || '',
    anthropic: globalState?.settings?.aiConfig?.apiKeys?.anthropic || '',
    groq: globalState?.settings?.aiConfig?.apiKeys?.groq || ''
  });

  const [showKey, setShowKey] = useState({
    gemini: false, openai: false, anthropic: false, groq: false
  });

  // Load models from globalState if available
  const [selectedModels, setSelectedModels] = useState({
    gemini: globalState?.settings?.aiConfig?.selectedModels?.google || 'gemini-2.5-flash',
    openai: globalState?.settings?.aiConfig?.selectedModels?.openai || 'gpt-4o',
    anthropic: globalState?.settings?.aiConfig?.selectedModels?.anthropic || 'claude-3-5-sonnet-20240620',
    groq: globalState?.settings?.aiConfig?.selectedModels?.groq || 'llama-3.3-70b-versatile'
  });

  // Sync selectedModels and keys when globalState changes (on mount / fetch), but don't overwrite user typing
  React.useEffect(() => {
    const aiConfig = globalState?.settings?.aiConfig || {};
    
    setSelectedModels(prev => ({
      gemini: aiConfig.selectedModels?.google || prev.gemini,
      openai: aiConfig.selectedModels?.openai || prev.openai,
      anthropic: aiConfig.selectedModels?.anthropic || prev.anthropic,
      groq: aiConfig.selectedModels?.groq || prev.groq
    }));

    setKeys(prev => ({
      gemini: prev.gemini !== '' ? prev.gemini : (aiConfig.apiKeys?.google || ''),
      openai: prev.openai !== '' ? prev.openai : (aiConfig.apiKeys?.openai || ''),
      anthropic: prev.anthropic !== '' ? prev.anthropic : (aiConfig.apiKeys?.anthropic || ''),
      groq: prev.groq !== '' ? prev.groq : (aiConfig.apiKeys?.groq || '')
    }));
  }, [globalState]);

  const providerModels = {
    gemini: ['gemini-2.5-flash', 'gemini-1.5-pro'],
    openai: ['gpt-4o', 'gpt-4o-mini'],
    anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-haiku-20240307'],
    groq: [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.6-27b',
      'llama-3.3-70b-versatile'
    ]
  };

  const modelLabels = {
    'openai/gpt-oss-120b': 'GPT OSS 120B (Reasoning / Flagship)',
    'openai/gpt-oss-20b': 'GPT OSS 20B (Fast Reasoning)',
    'qwen/qwen3.6-27b': 'Qwen 3.6 27B (Vision & Reasoning)',
    'llama-3.3-70b-versatile': 'Llama 3.3 70B (Versatile)',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-1.5-pro': 'Gemini 1.5 Pro',
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'claude-3-5-sonnet-20240620': 'Claude 3.5 Sonnet',
    'claude-3-haiku-20240307': 'Claude 3 Haiku'
  };

  const handleSave = async (provider) => {
    
    const stateProviderKey = provider === 'gemini' ? 'google' : provider;
    
    const currentState = globalState || {};
    const aiConfig = currentState.settings?.aiConfig || {};
    const newState = {
      ...currentState,
      settings: {
        ...(currentState.settings || {}),
        aiConfig: {
          ...aiConfig,
          // FIX: Also persist selectedProvider so it survives refresh
          selectedProvider: stateProviderKey,
          apiKeys: {
            ...(aiConfig.apiKeys || {}),
            [stateProviderKey]: keys[provider]
          },
          selectedModels: {
            ...(aiConfig.selectedModels || {}),
            [stateProviderKey]: selectedModels[provider]
          }
        }
      }
    };
    
    setGlobalState(newState);
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), { settings: newState.settings }, { merge: true });
        alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} configuration saved and set as active!`);
      } catch (e) {
        console.error("Failed to save to Firestore", e);
        alert(`⚠️ SAVE FAILED: ${e.message}\n\nYour API key was NOT saved to the cloud. Please check your Firebase Security Rules.`);
      }
    } else {
      alert("Error: You must be logged in to save API keys.");
    }
  };

  const handleSetActive = async (provider) => {
    const stateProviderKey = provider === 'gemini' ? 'google' : provider;
    
    const currentState = globalState || {};
    const newState = {
      ...currentState,
      settings: {
        ...(currentState.settings || {}),
        aiConfig: {
          ...(currentState.settings?.aiConfig || {}),
          selectedProvider: stateProviderKey
        }
      }
    };
    
    setGlobalState(newState);
    
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), { settings: newState.settings }, { merge: true });
        alert(`Active provider set to ${provider.charAt(0).toUpperCase() + provider.slice(1)}!`);
      } catch (e) {
        console.error("Failed to save to Firestore", e);
        alert(`Failed to set active provider: ${e.message}`);
      }
    } else {
      alert("Error: You must be logged in to change settings.");
    }
  };

  const handleDelete = async (provider) => {
    setKeys({ ...keys, [provider]: '' });
    
    const stateProviderKey = provider === 'gemini' ? 'google' : provider;
    
    const currentState = globalState || {};
    const aiConfig = currentState.settings?.aiConfig || {};
    
    const newState = {
      ...currentState,
      settings: {
        ...(currentState.settings || {}),
        aiConfig: {
          ...aiConfig,
          apiKeys: {
            ...(aiConfig.apiKeys || {}),
            [stateProviderKey]: ''
          }
        }
      }
    };
    
    setGlobalState(newState);
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), { settings: newState.settings }, { merge: true });
      } catch (e) {
        console.error("Failed to save to Firestore", e);
        alert(`⚠️ DELETE FAILED: ${e.message}`);
      }
    }
  };

  const providers = [
    { id: 'gemini', name: 'Google Gemini', desc: 'Required for default FloatGPT models.' },
    { id: 'openai', name: 'OpenAI', desc: 'Required for GPT-4o and o1 models.' },
    { id: 'anthropic', name: 'Anthropic', desc: 'Required for Claude 3.5 Sonnet.' },
    { id: 'groq', name: 'Groq', desc: 'Required for ultra-fast Llama 3 models.' }
  ];

  const activeProvider = globalState?.settings?.aiConfig?.selectedProvider || 'groq';

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg overflow-y-auto items-center p-8 hide-scrollbar relative">
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-accent/5 blur-[120px] rounded-full pointer-events-none"></div>
       
       <div className="max-w-4xl w-full relative z-10 flex flex-col mt-10">
         
         {/* Animated Cloud Banner */}
         <div className="w-full mb-10 overflow-hidden rounded-2xl border border-accent/20 bg-accent/5 relative h-[100px] flex items-center justify-center">
            <motion.div 
              className="absolute whitespace-nowrap flex items-center gap-4 text-accent/80 font-bold text-xl tracking-wide uppercase"
              animate={{ x: [1000, -1500] }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            >
              <span>☁️</span>
              YOU CAN ALSO DIRECTLY ADD API KEYS IN THE ORB. DOWNLOAD THE ORB AND ADD THEM THERE FOR EXTRA SECURITY.
              <span>☁️</span>
              YOU CAN ALSO DIRECTLY ADD API KEYS IN THE ORB. DOWNLOAD THE ORB AND ADD THEM THERE FOR EXTRA SECURITY.
            </motion.div>
         </div>

         {/* Header */}
         <div className="text-center mb-12">
           <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-panel to-bg border border-card-border shadow-xl mb-6 ring-1 ring-card-border/50">
              <Lock className="w-7 h-7 text-text-primary" />
           </div>
           <h1 className="text-3xl font-medium tracking-tight mb-3 text-text-primary">API Key Vault</h1>
           <p className="text-[14px] text-text-secondary max-w-xl mx-auto leading-relaxed">
             Keys are stored securely in your local browser storage. They are sent directly to AI providers and never touch our servers.
           </p>
         </div>
         
         {/* Vault List */}
         <div className="space-y-4 w-full">
           {providers.map(p => (
             <div key={p.id} className={`bg-panel border ${activeProvider === (p.id === 'gemini' ? 'google' : p.id) ? 'border-accent shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'border-card-border'} rounded-2xl p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-6 hover:border-accent/30 transition-all duration-300 shadow-sm hover:shadow-md group relative overflow-hidden`}>
               <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/5 to-accent/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>
               
               <div className="flex-1 relative z-10">
                 <div className="flex items-center gap-3 mb-1">
                   <h3 className="text-[15px] font-semibold text-text-primary flex items-center gap-2">
                     {p.name}
                     {keys[p.id] && <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>}
                   </h3>
                   {activeProvider === (p.id === 'gemini' ? 'google' : p.id) && (
                     <span className="px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold tracking-wide uppercase">Active</span>
                   )}
                 </div>
                 <p className="text-[13px] text-text-muted">{p.desc}</p>
               </div>
               
               <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto relative z-10">
                 
                 {/* Model Selection */}
                 <div className="relative w-full md:w-[220px]">
                   <select
                     value={selectedModels[p.id]}
                     onChange={(e) => setSelectedModels({...selectedModels, [p.id]: e.target.value})}
                     className="w-full bg-bg border border-card-border rounded-xl px-4 py-2.5 text-[13px] text-text-primary focus:outline-none focus:border-accent transition-all duration-200 appearance-none cursor-pointer hover:border-text-muted font-medium"
                   >
                     {(providerModels[p.id] || []).map(m => (
                        <option key={m} value={m}>{modelLabels[m] || m}</option>
                     ))}
                   </select>
                   <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                     <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                     </svg>
                   </div>
                 </div>

                 {/* API Key Input — uses type="text" with CSS masking to defeat Chrome autofill */}
                 <div className="relative flex-1 w-full md:w-[320px]">
                   <input 
                     type="text"
                     id={`apikey-input-${p.id}`}
                     value={keys[p.id]}
                     onChange={(e) => setKeys({...keys, [p.id]: e.target.value})}
                     placeholder="sk-..."
                     autoComplete="off"
                     autoCorrect="off"
                     autoCapitalize="off"
                     spellCheck="false"
                     data-lpignore="true"
                     data-form-type="other"
                     data-1p-ignore="true"
                     style={!showKey[p.id] ? { WebkitTextSecurity: 'disc', textSecurity: 'disc' } : {}}
                     className="w-full bg-bg border border-card-border rounded-xl pl-4 pr-10 py-2.5 text-[13px] text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-200 font-mono placeholder:font-sans hover:border-text-muted"
                   />
                   <button 
                     onClick={() => setShowKey({...showKey, [p.id]: !showKey[p.id]})}
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                   >
                     {showKey[p.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                   </button>
                 </div>
                 
                 <div className="flex items-center gap-2">
                   <button 
                     onClick={() => handleSave(p.id)}
                     disabled={!keys[p.id]}
                     className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer font-medium text-[13px] ${keys[p.id] ? 'bg-accent text-white hover:bg-accent-hover shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-bg border border-card-border text-text-muted opacity-50 cursor-not-allowed'}`}
                     title="Save Configuration"
                   >
                     <Save className="w-4 h-4" />
                   </button>

                   {keys[p.id] && activeProvider !== (p.id === 'gemini' ? 'google' : p.id) && (
                     <button 
                       onClick={() => handleSetActive(p.id)}
                       className="px-3 py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer font-medium text-[12px] bg-bg border border-card-border text-text-primary hover:border-accent hover:text-accent shadow-sm"
                       title="Set as Active Provider"
                     >
                       Set Active
                     </button>
                   )}
                   
                   <button 
                     onClick={() => handleDelete(p.id)}
                     disabled={!keys[p.id]}
                     className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer ${keys[p.id] ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-400' : 'bg-bg border border-card-border text-text-muted opacity-50 cursor-not-allowed'}`}
                     title="Delete Key"
                   >
                     <Trash className="w-4 h-4" />
                   </button>
                 </div>
               </div>
             </div>
           ))}
         </div>

         <div className="h-24"></div>
       </div>
    </div>
  );
};
