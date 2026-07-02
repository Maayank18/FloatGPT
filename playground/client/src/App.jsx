import React, { useState } from 'react';
import { 
  Menu, Sparkles, History, Box, Library, Settings, Bell, Key, DownloadCloud,
  ChevronDown, Code2, Play, Search, Mic, Plus, MoreHorizontal, Share2, SquareTerminal, Fingerprint, PanelRightClose, PanelRightOpen, HardDriveDownload, Check, Zap, HelpCircle, Monitor, Cpu, Clock, Terminal, Eye, EyeOff, Save, Trash, Lock,
  Activity, Target, Coffee, CheckCircle2, BrainCircuit, XCircle
} from 'lucide-react';

// Placeholder View for unfinished pages
const PlaceholderView = ({ title, icon: Icon }) => (
  <div className="flex-1 flex flex-col items-center justify-center bg-bg">
    <div className="w-12 h-12 rounded-2xl bg-panel border border-card-border flex items-center justify-center mb-6">
      <Icon className="w-6 h-6 text-text-muted" />
    </div>
    <h2 className="text-lg font-medium mb-2">{title}</h2>
    <p className="text-text-muted text-[13px]">This module is under construction.</p>
  </div>
);

// API Keys View Component
const ApiKeysView = ({ globalState, setGlobalState }) => {
  const [keys, setKeys] = useState({
    gemini: localStorage.getItem('floatgpt_gemini_key') || '',
    openai: localStorage.getItem('floatgpt_openai_key') || '',
    anthropic: localStorage.getItem('floatgpt_anthropic_key') || '',
    groq: localStorage.getItem('floatgpt_groq_key') || ''
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

  // Sync selectedModels when globalState changes (on mount / fetch)
  React.useEffect(() => {
    if (globalState?.settings?.aiConfig?.selectedModels) {
       setSelectedModels({
         gemini: globalState.settings.aiConfig.selectedModels.google || 'gemini-2.5-flash',
         openai: globalState.settings.aiConfig.selectedModels.openai || 'gpt-4o',
         anthropic: globalState.settings.aiConfig.selectedModels.anthropic || 'claude-3-5-sonnet-20240620',
         groq: globalState.settings.aiConfig.selectedModels.groq || 'llama-3.3-70b-versatile'
       });
    }
  }, [globalState]);

  const providerModels = {
    gemini: ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
    anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-haiku-20240307'],
    groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768']
  };

  const handleSave = async (provider) => {
    localStorage.setItem(`floatgpt_${provider}_key`, keys[provider]);
    
    const stateProviderKey = provider === 'gemini' ? 'google' : provider;
    
    if (globalState) {
       const aiConfig = globalState.settings?.aiConfig || {};
       const newState = {
         ...globalState,
         settings: {
           ...globalState.settings,
           aiConfig: {
             ...aiConfig,
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
       await fetch('http://127.0.0.1:3000/api/state', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(newState)
       });
    }
    
    alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} configuration saved!`);
  };

  const handleSetActive = async (provider) => {
    const stateProviderKey = provider === 'gemini' ? 'google' : provider;
    
    if (globalState) {
       const newState = {
         ...globalState,
         settings: {
           ...globalState.settings,
           aiConfig: {
             ...(globalState.settings?.aiConfig || {}),
             selectedProvider: stateProviderKey
           }
         }
       };
       setGlobalState(newState);
       await fetch('http://127.0.0.1:3000/api/state', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(newState)
       });
       alert(`Active provider set to ${provider.charAt(0).toUpperCase() + provider.slice(1)}!`);
    }
  };

  const handleDelete = async (provider) => {
    localStorage.removeItem(`floatgpt_${provider}_key`);
    setKeys({ ...keys, [provider]: '' });
    
    const stateProviderKey = provider === 'gemini' ? 'google' : provider;
    
    if (globalState) {
       const aiConfig = globalState.settings?.aiConfig || {};
       const newState = {
         ...globalState,
         settings: {
           ...globalState.settings,
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
       await fetch('http://127.0.0.1:3000/api/state', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(newState)
       });
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
                     {providerModels[p.id].map(m => (
                        <option key={m} value={m}>{m}</option>
                     ))}
                   </select>
                   <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                     <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                     </svg>
                   </div>
                 </div>

                 {/* API Key Input */}
                 <div className="relative flex-1 w-full md:w-[320px]">
                   <input 
                     type={showKey[p.id] ? "text" : "password"}
                     value={keys[p.id]}
                     onChange={(e) => setKeys({...keys, [p.id]: e.target.value})}
                     placeholder="sk-..."
                     autoComplete="new-password"
                     data-lpignore="true"
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


// Download View Component
const DownloadView = () => {
  const [downloadState, setDownloadState] = React.useState({ os: null, status: 'idle', error: null });

  const handleDownload = async (os) => {
    try {
      setDownloadState({ os, status: 'downloading', error: null });
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/download/${os}`);
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = os === 'win' ? 'FloatGPT.Setup.1.0.0.exe' : 'FloatGPT-1.0.0.dmg';
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setDownloadState({ os: null, status: 'idle', error: null });
    } catch (err) {
      console.error("Download failed:", err);
      setDownloadState({ os, status: 'error', error: err.message || "Network error" });
      setTimeout(() => setDownloadState({ os: null, status: 'idle', error: null }), 5000);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg overflow-y-auto items-center p-8 hide-scrollbar relative">
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-accent/5 blur-[120px] rounded-full pointer-events-none"></div>
       
       <div className="max-w-4xl w-full relative z-10 flex flex-col items-center mt-10">
         
         {/* Hero Section */}
         <div className="text-center mb-16">
           <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[12px] font-medium tracking-wide uppercase mb-6">
             <Sparkles className="w-3.5 h-3.5" /> Latest Release
           </div>
           <div className="h-[60px] flex items-center justify-center mb-6 overflow-hidden">
              <img src="/logo.png" alt="FloatGPT Logo" className="h-[120px] w-auto max-w-none object-contain" />
           </div>
           <h1 className="text-4xl font-medium tracking-tight mb-4 text-text-primary">FloatGPT Desktop <span className="text-text-muted">v1.0.0</span></h1>
           <p className="text-[15px] text-text-secondary max-w-2xl leading-relaxed mx-auto">
             Bring context-aware AI directly to your operating system. FloatGPT monitors your habits, manages your schedule, and analyzes your screen in real-time.
           </p>
         </div>
         
         {/* Download Cards */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-20">
           
           {/* Windows Card */}
           <div className="bg-panel border border-card-border rounded-2xl p-8 flex flex-col items-center text-center group hover:border-accent/50 transition-colors">
              <div className="w-16 h-16 bg-bg border border-card-border rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                <Monitor className="w-8 h-8 text-text-primary" />
              </div>
              <h2 className="text-[18px] font-medium text-text-primary mb-2">Windows (x64)</h2>
              <div className="flex items-center gap-4 text-[13px] text-text-muted mb-8">
                <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4" /> x64 Architecture</span>
                <span>•</span>
                <span className="flex items-center gap-1.5"><HardDriveDownload className="w-4 h-4" /> ~85 MB</span>
              </div>
              {downloadState.error && downloadState.os === 'win' && (
                <div className="text-red-400 text-xs mb-3 font-medium bg-red-400/10 py-1.5 px-3 rounded-lg w-full">
                  {downloadState.error}
                </div>
              )}
              <button 
                onClick={() => downloadState.status !== 'downloading' && handleDownload('win')} 
                disabled={downloadState.status === 'downloading'}
                className={`w-full py-3.5 bg-accent text-bg font-medium rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-[14px] ${downloadState.status === 'downloading' && downloadState.os === 'win' ? 'opacity-80 cursor-wait' : 'hover:bg-accent-hover cursor-pointer'}`}>
                {downloadState.status === 'downloading' && downloadState.os === 'win' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin"></div>
                    Preparing download...
                  </>
                ) : downloadState.status === 'error' && downloadState.os === 'win' ? (
                  <>
                    <XCircle className="w-4 h-4" /> Try Again
                  </>
                ) : (
                  <>
                    <DownloadCloud className="w-4 h-4" /> Download .exe
                  </>
                )}
              </button>
           </div>

           {/* macOS / Linux Card */}
           <div className="bg-panel border border-card-border rounded-2xl p-8 flex flex-col items-center text-center group hover:border-text-secondary transition-colors">
              <div className="w-16 h-16 bg-bg border border-card-border rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                <Terminal className="w-8 h-8 text-text-primary" />
              </div>
              <h2 className="text-[18px] font-medium text-text-primary mb-2">macOS & Linux</h2>
              <div className="flex items-center gap-4 text-[13px] text-text-muted mb-8">
                <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4" /> ARM64 / x64</span>
                <span>•</span>
                <span className="flex items-center gap-1.5"><HardDriveDownload className="w-4 h-4" /> ~92 MB</span>
              </div>
              {downloadState.error && downloadState.os === 'mac' && (
                <div className="text-red-400 text-xs mb-3 font-medium bg-red-400/10 py-1.5 px-3 rounded-lg w-full">
                  {downloadState.error}
                </div>
              )}
              <button 
                onClick={() => downloadState.status !== 'downloading' && handleDownload('mac')} 
                disabled={downloadState.status === 'downloading'}
                className={`w-full py-3.5 bg-transparent border border-card-border text-text-primary font-medium rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-[14px] ${downloadState.status === 'downloading' && downloadState.os === 'mac' ? 'opacity-50 cursor-wait' : 'hover:bg-card cursor-pointer'}`}>
                {downloadState.status === 'downloading' && downloadState.os === 'mac' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin"></div>
                    Preparing download...
                  </>
                ) : downloadState.status === 'error' && downloadState.os === 'mac' ? (
                  <>
                    <XCircle className="w-4 h-4" /> Try Again
                  </>
                ) : (
                  <>
                    <DownloadCloud className="w-4 h-4" /> Download .dmg / .AppImage
                  </>
                )}
              </button>
           </div>

         </div>

         {/* Details Grid (Reqs & Changelog) */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 w-full text-left">
            
            {/* System Requirements */}
            <div className="col-span-1">
              <h3 className="text-[14px] font-medium text-text-primary uppercase tracking-wider mb-6 flex items-center gap-2">
                <Settings className="w-4 h-4 text-text-muted" /> System Requirements
              </h3>
              <div className="space-y-4 text-[13px]">
                <div className="border-b border-card-border pb-3">
                  <span className="block text-text-muted mb-1">Operating System</span>
                  <span className="text-text-primary font-medium">Windows 10/11, macOS 12+, Ubuntu 20.04+</span>
                </div>
                <div className="border-b border-card-border pb-3">
                  <span className="block text-text-muted mb-1">Processor</span>
                  <span className="text-text-primary font-medium">Intel Core i5 / Apple M1 or better</span>
                </div>
                <div className="border-b border-card-border pb-3">
                  <span className="block text-text-muted mb-1">Memory (RAM)</span>
                  <span className="text-text-primary font-medium">8 GB minimum (16 GB recommended)</span>
                </div>
                <div className="pb-3">
                  <span className="block text-text-muted mb-1">Storage</span>
                  <span className="text-text-primary font-medium">500 MB available space</span>
                </div>
              </div>
            </div>

            {/* Version History */}
            <div className="col-span-2">
              <h3 className="text-[14px] font-medium text-text-primary uppercase tracking-wider mb-6 flex items-center gap-2">
                <History className="w-4 h-4 text-text-muted" /> Version History
              </h3>
              
              <div className="relative border-l border-card-border ml-3 pl-8 py-2">
                {/* Timeline Dot */}
                <div className="absolute w-3 h-3 bg-accent rounded-full -left-[1.5px] top-4 -translate-x-1/2 ring-4 ring-bg"></div>
                
                <div className="mb-1 flex items-center gap-3">
                  <h4 className="text-[16px] font-medium text-text-primary">v1.0.0 <span className="text-accent ml-2 text-[13px] bg-accent/10 px-2 py-0.5 rounded-md">Stable</span></h4>
                  <span className="text-[12px] text-text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> Just now</span>
                </div>
                <p className="text-[13px] text-text-secondary mb-4">Initial major release featuring the core intelligence engine and local telemetry.</p>
                
                <ul className="space-y-2 text-[13px] text-text-primary">
                  <li className="flex items-start gap-3">
                    <span className="text-accent mt-0.5">•</span>
                    <span><strong>Conversational Firewall:</strong> AI strictly rejects small talk and grounds answers in your local habit telemetry.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent mt-0.5">•</span>
                    <span><strong>Global Hotkeys:</strong> Press <code>Ctrl+Shift+Space</code> anywhere on your OS to instantly summon or hide the FloatGPT orb.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent mt-0.5">•</span>
                    <span><strong>Web Speech API:</strong> Dictate prompts directly using the built-in microphone integration.</span>
                  </li>
                </ul>
              </div>
            </div>

         </div>
         
         <div className="h-24"></div> {/* Bottom padding */}
       </div>
    </div>
  );
};

// History Dashboard Component
const HistoryDashboardView = ({ globalState }) => {
  const [activeTab, setActiveTab] = useState('chat');
  const historyMessages = globalState?.messages || [];

    return (
      <div className="flex-1 flex flex-col min-w-0 bg-bg overflow-hidden relative">
         <div className="absolute top-0 right-0 w-[600px] h-[300px] bg-accent/5 blur-[120px] rounded-full pointer-events-none"></div>
         
         <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full relative z-10 px-8 pt-10 pb-0">
           
           {/* Header */}
           <div className="mb-8">
             <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-panel border border-card-border shadow-sm mb-4">
                <History className="w-6 h-6 text-text-primary" />
             </div>
             <h1 className="text-3xl font-medium tracking-tight mb-2 text-text-primary">History & Analytics</h1>
             <p className="text-[14px] text-text-secondary leading-relaxed">
               Review your past interactions, track completed work, and analyze your productivity behavior.
             </p>
           </div>
           
           {/* Sub-navigation */}
           <div className="flex bg-panel p-1 rounded-xl border border-card-border mb-6 w-fit">
              <button onClick={() => setActiveTab('chat')} className={`px-4 py-2 text-[12px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === 'chat' ? 'bg-bg text-text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:text-text-primary'}`}>
                 Chat Archives
              </button>
              <button onClick={() => setActiveTab('ledger')} className={`px-4 py-2 text-[12px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === 'ledger' ? 'bg-bg text-text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:text-text-primary'}`}>
                 Execution Ledger
              </button>
              <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 text-[12px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === 'analytics' ? 'bg-bg text-text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:text-text-primary'}`}>
                 Performance Analytics
              </button>
           </div>

           {/* Content Area */}
           <div className="flex-1 overflow-y-auto pb-12 hide-scrollbar pr-4">
             {activeTab === 'chat' && (
                <div>
                  {historyMessages.length === 0 ? (
                    <div className="text-center text-text-muted mt-20 flex flex-col items-center">
                      <Sparkles className="w-8 h-8 mb-4 opacity-20" />
                      <p>No chat history available from the Desktop Orb.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-panel border border-card-border rounded-2xl p-5">
                         <h3 className="text-[13px] font-bold text-text-muted uppercase tracking-wider mb-4 border-b border-card-border/50 pb-2">Desktop Orb Sessions</h3>
                         <div className="space-y-4">
                           {historyMessages.map((msg, idx) => (
                             msg.role === 'user' ? (
                               <div key={idx} className="flex gap-4">
                                 <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center shrink-0 border border-card-border"><span className="text-xs font-medium">U</span></div>
                                 <div className="pt-1 text-[13px] text-text-primary"><p>{msg.content}</p></div>
                               </div>
                             ) : (
                               <div key={idx} className="flex gap-4">
                                 <div className="w-8 h-8 shrink-0 flex items-center justify-center"><img src="/logo-chat.png" className="w-full h-full object-contain scale-[1.2]" alt="FloatGPT" /></div>
                                 <div className="pt-1 text-[13px] text-text-primary">
                                   <p className="mb-2">{msg.content}</p>
                                   {msg.data && msg.data.newTasks && msg.data.newTasks.length > 0 && (
                                     <div className="bg-card p-3 rounded-lg border border-card-border inline-block">
                                       <ul className="list-disc pl-4 space-y-1 text-text-secondary">
                                         {msg.data.newTasks.map(t => <li key={t.id}>{t.title}</li>)}
                                       </ul>
                                     </div>
                                   )}
                                 </div>
                               </div>
                             )
                           ))}
                         </div>
                      </div>
                    </div>
                  )}
                </div>
             )}

             {activeTab === 'ledger' && (
                <div className="text-center text-text-muted mt-20 flex flex-col items-center">
                  <Library className="w-8 h-8 mb-4 opacity-20" />
                  <p>No tasks completed yet.</p>
                </div>
             )}

             {activeTab === 'analytics' && (
                <div className="text-center text-text-muted mt-20 flex flex-col items-center">
                  <Box className="w-8 h-8 mb-4 opacity-20" />
                  <p>Analytics will populate as you use FloatGPT.</p>
                </div>
             )}
           </div>
         </div>
      </div>
    );
  };

  // Habit Profile Dashboard Component
  const HabitProfileDashboardView = () => {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-bg overflow-hidden relative">
         <div className="absolute top-0 right-0 w-[600px] h-[300px] bg-accent/5 blur-[120px] rounded-full pointer-events-none"></div>
         
         <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full relative z-10 px-8 pt-10 pb-0 h-full overflow-hidden">
           
           {/* Header */}
           <div className="mb-8 flex flex-col md:flex-row justify-between items-start gap-4 shrink-0">
             <div>
               <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-panel border border-card-border shadow-sm mb-4">
                  <Fingerprint className="w-6 h-6 text-accent" />
               </div>
               <h1 className="text-3xl font-medium tracking-tight mb-2 text-text-primary">Habit Profile</h1>
               <p className="text-[14px] text-text-secondary leading-relaxed max-w-xl">
                 Your personalized behavioral analysis. FloatGPT tracks your execution trends to help you understand your peak performance zones.
               </p>
             </div>
             <div className="bg-panel border border-card-border rounded-xl p-4 flex flex-col items-end shadow-sm">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Behavioral Archetype</span>
                         <div className="flex items-center gap-2 text-text-muted mt-1">
                           <Zap className="w-4 h-4 text-amber-500" />
                           <span className="text-[15px] font-bold text-text-primary">{globalState?.habitProfile?.archetype || "The Sprint Executor"}</span>
                         </div>
                         <p className="text-[11px] text-text-muted mt-1 text-right max-w-[200px]">Analyzed from {globalState?.tasks?.length || 0} tasks and history.</p>
             </div>
           </div>
           
           {/* Content Area */}
           <div className="flex-1 overflow-y-auto pb-12 hide-scrollbar pr-4 space-y-6">
              
              <div className="text-center text-text-muted mt-20 flex flex-col items-center">
                <Activity className="w-8 h-8 mb-4 opacity-20" />
                <h2 className="text-[15px] font-medium text-text-primary mb-2">Gathering Habit Data</h2>
                <p className="max-w-md text-[13px]">FloatGPT is currently analyzing your conversation history and task execution patterns. Your cognitive load mapping, procrastination hotspots, and personalized counter-habits will appear here once enough data is collected.</p>
              </div>

           </div>
         </div>
      </div>
    );
  };



function App() {
  const [activeMenu, setActiveMenu] = useState('playground');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  
  // Unified State Sync
  const [globalState, setGlobalState] = useState(null);

  React.useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3000/api/state');
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        if (data) setGlobalState(data);
      } catch (err) {
        console.error("Failed to sync state from main server:", err);
      }
    };
    
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, []);

  // Playground Chat States & Logic
  const chatHistory = globalState?.messages || [];
  const [inputText, setInputText] = useState("");
  const [isGroundingEnabled, setIsGroundingEnabled] = useState(true);
  const [isToolsEnabled, setIsToolsEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRun = async () => {
    if (!inputText.trim() || isLoading) return;
    
    const userMessage = { 
      id: Math.random().toString(36).substring(2, 9), 
      role: 'user', 
      content: inputText, 
      timestamp: Date.now() 
    };
    
    const updatedMessages = [...(globalState?.playgroundMessages || []), userMessage];
    const tempState = { ...globalState, playgroundMessages: updatedMessages };
    setGlobalState(tempState);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await fetch('http://127.0.0.1:3000/api/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage.content,
          state: tempState,
          isPlayground: true
        })
      });
      const data = await response.json();
      
      const aiMessage = { 
        id: Math.random().toString(36).substring(2, 9), 
        role: 'assistant', 
        content: data.message || "Done.", 
        data: data,
        timestamp: Date.now() 
      };
      
      const finalMessages = [...updatedMessages, aiMessage];
      const newState = { ...tempState, playgroundMessages: finalMessages };
      
      // Update state locally and push to central unified store
      setGlobalState(newState);
      await fetch('http://127.0.0.1:3000/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newState)
      });
      
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    
    if (isRecording) {
      setIsRecording(false);
    } else {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      
      recognition.onstart = () => setIsRecording(true);
      
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results).map(result => result[0].transcript).join('');
        setInputText(prev => prev + (prev ? " " : "") + transcript);
      };
      
      recognition.onerror = (event) => {
        console.error("Speech error", event.error);
        alert(`Microphone Error: ${event.error}. Please ensure microphone permissions are granted.`);
        setIsRecording(false);
      };
      
      recognition.onend = () => setIsRecording(false);
      
      recognition.start();
    }
  };

  // Right Panel States
  const [temperature, setTemperature] = useState(1.0);
  const [contextWindow, setContextWindow] = useState(20);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState({ name: 'Gemini 3 Flash Preview', id: 'gemini-3-flash-preview', provider: 'Google' });

  const models = [
    { name: 'Gemini 3 Flash Preview', id: 'gemini-3-flash-preview', provider: 'Google' },
    { name: 'Gemini 1.5 Pro', id: 'gemini-1.5-pro', provider: 'Google' },
    { name: 'Llama 3.3 70B', id: 'llama-3.3-70b-versatile', provider: 'Groq' },
    { name: 'GPT-4o', id: 'gpt-4o', provider: 'OpenAI' }
  ];

  // Helper to render the active view
  const renderMainContent = () => {
    switch (activeMenu) {
      case 'download': return <DownloadView />;
      case 'keys': return <ApiKeysView globalState={globalState} setGlobalState={setGlobalState} />;
      case 'history': return <HistoryDashboardView globalState={globalState} />;
      case 'personas': return <PlaceholderView title="My Personas" icon={Box} />;
      case 'habit': return <HabitProfileDashboardView globalState={globalState} />;
      case 'playground':
      default:
        return (
          <main className="flex-1 flex flex-col min-w-0 bg-bg relative">
            {/* Header */}
            <header className="h-[60px] px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)} className="p-1.5 rounded-full hover:bg-panel text-text-secondary transition-colors cursor-pointer"><Menu className="w-[18px] h-[18px]" /></button>
                <h1 className="text-[16px] font-normal text-text-primary">Playground</h1>
              </div>
              <div className="flex items-center gap-2">
                 {!isRightPanelOpen && (
                    <button onClick={() => setIsRightPanelOpen(true)} className="p-1.5 rounded-full hover:bg-panel text-text-secondary transition-colors cursor-pointer" title="Open Settings">
                      <PanelRightOpen className="w-[18px] h-[18px]" />
                    </button>
                 )}
                 <button className="p-1.5 rounded-full hover:bg-panel text-text-secondary transition-colors"><Share2 className="w-[18px] h-[18px]" /></button>
                 <button className="p-1.5 rounded-full hover:bg-panel text-text-secondary transition-colors"><Plus className="w-[20px] h-[20px]" /></button>
                 <button className="p-1.5 rounded-full hover:bg-panel text-text-secondary transition-colors"><MoreHorizontal className="w-[20px] h-[20px]" /></button>
              </div>
            </header>

            {/* Chat Canvas (Much tighter and closer to Google's style) */}
            <div className="flex-1 overflow-y-auto px-4 lg:px-24 py-4 custom-scrollbar">
              <div className="max-w-[760px] mx-auto flex flex-col gap-6">
                {(globalState?.playgroundMessages || []).length === 0 && (
                  <div className="text-center text-text-muted mt-20 flex flex-col items-center">
                    <Sparkles className="w-8 h-8 mb-4 opacity-20" />
                    <p>Start a conversation to see the FloatGPT AI in action.</p>
                  </div>
                )}
                {(globalState?.playgroundMessages || []).map((msg, idx) => (
                  msg.role === 'user' ? (
                    <div key={idx} className="flex justify-end">
                       <div className="bg-panel px-4 py-2.5 rounded-[20px] text-[14px] leading-[1.6] max-w-[85%] text-text-primary font-normal">
                          {msg.content}
                       </div>
                    </div>
                  ) : (
                    <div key={idx} className="flex gap-4 max-w-[100%]">
                       <div className="w-9 h-9 shrink-0 mt-0.5 flex items-center justify-center">
                         <img src="/logo-chat.png" className="w-full h-full object-contain scale-[1.2]" alt="FloatGPT" />
                       </div>
                       <div className="pt-1 text-[14px] text-text-primary leading-[1.6] w-full">
                          <p>{msg.content}</p>
                          {msg.data && msg.data.newTasks && msg.data.newTasks.length > 0 && (
                             <div className="mt-3 text-xs bg-panel p-3 rounded-lg border border-card-border">
                               <p className="font-semibold mb-2">Generated Tasks:</p>
                               <ul className="list-disc pl-4 space-y-1">
                                 {msg.data.newTasks.map(t => <li key={t.id}>{t.title}</li>)}
                               </ul>
                             </div>
                          )}
                       </div>
                    </div>
                  )
                ))}
                {isLoading && (
                  <div className="flex gap-4 max-w-[100%]">
                     <div className="w-9 h-9 shrink-0 mt-0.5 flex items-center justify-center">
                       <img src="/logo-chat.png" className="w-full h-full object-contain scale-[1.2] opacity-50 animate-pulse" alt="Loading" />
                     </div>
                     <div className="pt-2 text-[14px] text-text-muted">Thinking...</div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Area (Very thin Pill like Google AI Studio) */}
            <div className="px-4 lg:px-24 pb-6 pt-2 bg-bg">
               <div className="max-w-[760px] mx-auto">
                 <div className="bg-panel rounded-[24px] flex flex-col focus-within:ring-1 focus-within:ring-card-border transition-shadow duration-200">
                    <textarea 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => { 
                        if (e.key === 'Enter' && !e.shiftKey) { 
                          e.preventDefault(); 
                          handleRun(); 
                        } 
                      }}
                      className="w-full bg-transparent text-[14px] px-5 py-4 resize-none focus:outline-none min-h-[56px] max-h-[200px] placeholder:text-text-muted text-text-primary custom-scrollbar leading-relaxed"
                      placeholder="Start typing a prompt to see what our models can do"
                    />
                    
                    <div className="flex justify-between items-center px-2 pb-2">
                       <div className="flex items-center gap-1">
                         <button onClick={async () => {
                            if (!globalState) return;
                            const newState = { ...globalState, playgroundMessages: [] };
                            setGlobalState(newState);
                            await fetch('http://127.0.0.1:3000/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newState) });
                         }} className="p-2 rounded-full hover:bg-card text-text-muted hover:text-text-primary transition-colors cursor-pointer" title="Clear Chat">
                            <Zap className="w-[18px] h-[18px]" />
                         </button>
                         <button onClick={() => setIsToolsEnabled(!isToolsEnabled)} className={`h-8 flex items-center gap-2 px-3 rounded-full transition-colors cursor-pointer ${isToolsEnabled ? 'bg-card hover:bg-card-border text-text-primary' : 'bg-transparent text-text-muted hover:bg-card'}`}>
                            <Box className="w-[14px] h-[14px] text-current" />
                            <span className="text-[13px] font-medium text-current">Tools</span>
                         </button>
                         <button onClick={() => setIsGroundingEnabled(!isGroundingEnabled)} className={`h-8 flex items-center gap-2 px-3 rounded-full transition-colors ml-1 cursor-pointer ${isGroundingEnabled ? 'bg-accent/10 hover:bg-accent/20 text-accent' : 'bg-transparent text-text-muted hover:bg-card'}`}>
                            <img src="/logo-chat.png" className={`w-4 h-4 object-cover rounded-full ${!isGroundingEnabled && 'grayscale opacity-50'}`} alt="G" />
                            <span className="text-[13px] font-medium text-current">Grounding with Habit Data</span>
                         </button>
                       </div>

                       <div className="flex items-center gap-1">
                         <button onClick={toggleRecording} className={`p-2 rounded-full transition-colors cursor-pointer ${isRecording ? 'text-red-500 bg-red-500/10' : 'hover:bg-card text-text-muted hover:text-text-primary'}`} title="Use Microphone">
                            <Mic className="w-[18px] h-[18px]" />
                         </button>
                         <label className="p-2 rounded-full hover:bg-card text-text-muted hover:text-text-primary transition-colors cursor-pointer" title="Add Attachment">
                            <input type="file" className="hidden" onChange={(e) => {
                               if (e.target.files && e.target.files[0]) {
                                 setInputText(prev => prev + `\n[Attached: ${e.target.files[0].name}]`);
                               }
                            }} />
                            <Plus className="w-[18px] h-[18px]" />
                         </label>
                         <button onClick={handleRun} disabled={isLoading || !inputText.trim()} className={`h-8 px-4 rounded-full border border-card-border flex items-center justify-center transition-all ml-1 ${isLoading || !inputText.trim() ? 'bg-transparent opacity-50 cursor-not-allowed' : 'bg-transparent hover:bg-card text-text-primary cursor-pointer'}`}>
                            <span className="text-[13px] font-medium">Run ↵</span>
                         </button>
                       </div>
                    </div>
                 </div>
               </div>
            </div>
          </main>
        );
    }
  };

  return (
    <div className="flex h-screen bg-bg text-text-primary overflow-hidden selection:bg-accent/30 font-sans text-[13px]">
      
      {/* 1. LEFT SIDEBAR (Ultra Slim) */}
      <aside className={`bg-bg flex flex-col shrink-0 transition-all duration-300 relative z-20 ${isLeftPanelOpen ? 'w-[240px]' : 'w-0 overflow-hidden opacity-0'}`}>
        
        <div className="h-[88px] flex items-center px-4 shrink-0">
          <div className="flex items-center w-full min-w-0">
            <div className="h-[60px] w-full min-w-0 flex items-center">
              <img
                src="/logo-sidebar.png"
                alt="FloatGPT Logo"
                className="block w-full max-w-[204px] h-full object-contain object-left"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-3 space-y-6 hide-scrollbar">
          
          {/* Explore */}
          <div>
            <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2 px-3">Explore</p>
            <nav className="space-y-0.5">
              <button onClick={() => setActiveMenu('playground')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-[13px] font-medium transition-colors ${activeMenu === 'playground' ? 'bg-panel text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-panel'}`}>
                <Sparkles className="w-[18px] h-[18px]" /> Playground
              </button>
              <button onClick={() => setActiveMenu('history')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-[13px] font-medium transition-colors ${activeMenu === 'history' ? 'bg-panel text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-panel'}`}>
                <History className="w-[18px] h-[18px]" /> History
              </button>
            </nav>
          </div>



          {/* Manage */}
          <div>
            <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2 px-3">Manage</p>
            <nav className="space-y-0.5">
              <button onClick={() => setActiveMenu('habit')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-[13px] font-medium transition-colors ${activeMenu === 'habit' ? 'bg-panel text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-panel'}`}>
                <Fingerprint className="w-[18px] h-[18px]" /> Habit Profile
              </button>
              <button onClick={() => setActiveMenu('download')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-[13px] font-medium transition-colors ${activeMenu === 'download' ? 'bg-panel text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-panel'}`}>
                <DownloadCloud className="w-[18px] h-[18px]" /> Download App
              </button>
              <button onClick={() => setActiveMenu('keys')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-[13px] font-medium transition-colors ${activeMenu === 'keys' ? 'bg-panel text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-panel'}`}>
                <Key className="w-[18px] h-[18px]" /> API Keys
              </button>
            </nav>
          </div>
        </div>

        {/* Footer Area (Upgrade Card) */}
        <div className="p-3 shrink-0">
          <div className="bg-panel rounded-[16px] p-4 cursor-pointer hover:bg-card-border transition-colors">
            <h4 className="text-[13px] font-medium text-text-primary mb-1">Upgrade to unlock more</h4>
            <p className="text-[12px] text-text-secondary">Access higher limits, Pro models, and more.</p>
          </div>
          <div className="flex items-center justify-between mt-4 px-2 mb-2">
            <div className="flex gap-4 text-text-muted">
              <Bell className="w-[18px] h-[18px] cursor-pointer hover:text-text-primary transition-colors" />
              <Settings className="w-[18px] h-[18px] cursor-pointer hover:text-text-primary transition-colors" />
              <Search className="w-[18px] h-[18px] cursor-pointer hover:text-text-primary transition-colors" />
              <Key className="w-[18px] h-[18px] cursor-pointer hover:text-text-primary transition-colors" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      {renderMainContent()}

      {/* 3. RIGHT SIDEBAR (Run Settings) - Collapsible */}
      {isRightPanelOpen && activeMenu === 'playground' && (
        <aside className="w-[280px] bg-bg border-l border-card-border flex flex-col shrink-0 transition-all duration-300 relative z-10">
          
          {/* Header */}
          <div className="h-[60px] px-4 flex items-center justify-between shrink-0">
             <span className="text-[13px] font-medium text-text-secondary">Run settings</span>
             <div className="flex items-center gap-2">
               <button className="flex items-center gap-1 text-[13px] font-medium text-text-primary hover:bg-panel px-2 py-1.5 rounded-md transition-colors">
                  <Code2 className="w-[16px] h-[16px]" /> Get code
               </button>
               <button 
                  onClick={() => setIsRightPanelOpen(false)}
                  className="p-1.5 rounded-full hover:bg-panel text-text-secondary transition-colors"
               >
                  <PanelRightClose className="w-[18px] h-[18px]" />
               </button>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6 custom-scrollbar">
             
             {/* Model Selection with Dropdown Logic */}
             <div className="relative">
                <div 
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className={`flex flex-col cursor-pointer group p-3 bg-panel rounded-[12px] transition-colors hover:bg-card-border`}
                >
                   <div className="flex items-center justify-between mb-1">
                     <h3 className="text-[14px] font-medium text-text-primary">{selectedModel.name}</h3>
                   </div>
                   <p className="text-[11px] text-text-muted font-mono mb-2">{selectedModel.id}</p>
                   <p className="text-[12px] text-text-secondary leading-snug">
                     Our most intelligent model built for speed, combining frontier intelligence with superior search and grounding.
                   </p>
                </div>
                
                {/* Dropdown Menu */}
                {isModelDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-card-border rounded-xl shadow-2xl overflow-hidden z-50 py-1">
                     {models.map(model => (
                       <div 
                         key={model.id}
                         onClick={() => {
                           setSelectedModel(model);
                           setIsModelDropdownOpen(false);
                         }}
                         className="px-4 py-2.5 hover:bg-panel cursor-pointer flex items-center justify-between transition-colors"
                       >
                         <div>
                           <div className="text-[13px] font-medium text-text-primary">{model.name}</div>
                           <div className="text-[11px] text-text-muted font-mono">{model.provider}</div>
                         </div>
                         {selectedModel.id === model.id && <Check className="w-4 h-4 text-accent" />}
                       </div>
                     ))}
                  </div>
                )}
             </div>

             {/* System Instructions */}
             <div>
               <h3 className="text-[13px] font-medium text-text-primary mb-1">System instructions</h3>
               <p className="text-[12px] text-text-muted mb-2 leading-snug">Optional tone and style instructions for the model.</p>
               <div className="bg-panel border border-transparent rounded-[12px] p-3 focus-within:border-card-border transition-colors">
                  <textarea 
                    className="w-full h-20 bg-transparent text-[13px] text-text-primary resize-none focus:outline-none placeholder:text-text-muted custom-scrollbar"
                    placeholder="Optional tone and style..."
                  />
               </div>
             </div>

             <hr className="border-card-border" />

             {/* Sliders with real-time state */}
             <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                     <label className="text-[13px] font-medium text-text-primary">Temperature</label>
                     <input 
                       type="number" 
                       value={temperature}
                       onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
                       className="w-10 bg-transparent text-right text-[13px] text-text-primary focus:outline-none" 
                     />
                  </div>
                  <input 
                    type="range" min="0" max="2" step="0.1" 
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                     <label className="text-[13px] font-medium text-text-primary">Thinking level</label>
                     <select className="bg-bg border border-card-border rounded-md px-2 py-1 text-[12px] focus:outline-none focus:border-text-muted">
                        <option>High</option>
                        <option>Medium</option>
                        <option>Low</option>
                     </select>
                  </div>
                </div>
             </div>

             <hr className="border-card-border" />

             {/* Tools Accordion */}
             <div>
               <div className="flex items-center justify-between mb-4 cursor-pointer group">
                 <h3 className="text-[13px] font-medium text-text-primary">Tools</h3>
                 <ChevronDown className="w-4 h-4 text-text-muted group-hover:text-text-primary" />
               </div>
               
               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <span className="text-[13px] text-text-primary">Structured outputs</span>
                     <div className="flex items-center gap-2">
                       <span className="text-[12px] text-text-muted cursor-pointer hover:text-text-primary">Edit</span>
                       <div className="w-8 h-4 bg-card-border rounded-full relative cursor-pointer"><div className="w-3 h-3 bg-text-muted rounded-full absolute left-0.5 top-0.5"></div></div>
                     </div>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-[13px] text-text-primary">Code execution</span>
                     <div className="w-8 h-4 bg-card-border rounded-full relative cursor-pointer"><div className="w-3 h-3 bg-text-muted rounded-full absolute left-0.5 top-0.5"></div></div>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-[13px] text-text-primary">Function calling</span>
                     <div className="flex items-center gap-2">
                       <span className="text-[12px] text-text-muted cursor-pointer hover:text-text-primary">Edit</span>
                       <div className="w-8 h-4 bg-card-border rounded-full relative cursor-pointer"><div className="w-3 h-3 bg-text-muted rounded-full absolute left-0.5 top-0.5"></div></div>
                     </div>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-[13px] text-text-primary">Grounding with Habit Data</span>
                     <div className="w-8 h-4 bg-accent rounded-full relative cursor-pointer"><div className="w-3 h-3 bg-white rounded-full absolute right-0.5 top-0.5"></div></div>
                  </div>
               </div>
             </div>

          </div>
        </aside>
      )}

    </div>
  );
}

export default App;
