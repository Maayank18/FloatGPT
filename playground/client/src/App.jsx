import React, { useState } from 'react';
import { 
  Menu, Sparkles, History, Box, Library, Settings, Bell, Key, DownloadCloud,
  ChevronDown, Code2, Play, Search, Mic, Plus, MoreHorizontal, Share2, SquareTerminal, Fingerprint, PanelRightClose, PanelRightOpen, HardDriveDownload, Check, Zap, HelpCircle, Monitor, Cpu, Clock, Terminal, Eye, EyeOff, Save, Trash, Lock,
  Activity, Target, Coffee, CheckCircle2, BrainCircuit, XCircle, ShieldCheck, Mail
} from 'lucide-react';
import { IngestionService } from '../../../src/services/ingestion';
import { auth, db, doc, getDoc, setDoc, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, onSnapshot, GoogleAuthProvider, signInWithPopup, updateProfile } from '../../../src/lib/firebase.ts';
import { INITIAL_STATE } from '../../../src/types.ts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const normalizeGlobalState = (raw) => {
  const source = raw || {};
  const settings = source.settings || {};
  const aiConfig = settings.aiConfig || {};

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
    metrics: { ...INITIAL_STATE.metrics, ...(source.metrics || {}) },
    uiState: { ...INITIAL_STATE.uiState, ...(source.uiState || {}) },
    settings: {
      ...INITIAL_STATE.settings,
      ...settings,
      appearance: { ...INITIAL_STATE.settings.appearance, ...(settings.appearance || {}) },
      system: { ...INITIAL_STATE.settings.system, ...(settings.system || {}) },
      features: { ...INITIAL_STATE.settings.features, ...(settings.features || {}) },
      productivity: { ...INITIAL_STATE.settings.productivity, ...(settings.productivity || {}) },
      accessibility: { ...INITIAL_STATE.settings.accessibility, ...(settings.accessibility || {}) },
      privacy: { ...INITIAL_STATE.settings.privacy, ...(settings.privacy || {}) },
      sync: { ...INITIAL_STATE.settings.sync, ...(settings.sync || {}) },
      aiConfig: {
        ...INITIAL_STATE.settings.aiConfig,
        ...aiConfig,
        apiKeys: { ...INITIAL_STATE.settings.aiConfig.apiKeys, ...(aiConfig.apiKeys || {}) },
        selectedModels: { ...INITIAL_STATE.settings.aiConfig.selectedModels, ...(aiConfig.selectedModels || {}) },
        parameters: { ...INITIAL_STATE.settings.aiConfig.parameters, ...(aiConfig.parameters || {}) },
      },
    },
  };
};

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

  // Sync selectedModels and keys when globalState changes (on mount / fetch)
  React.useEffect(() => {
    const aiConfig = globalState?.settings?.aiConfig || {};
    
    setSelectedModels({
      gemini: aiConfig.selectedModels?.google || 'gemini-2.5-flash',
      openai: aiConfig.selectedModels?.openai || 'gpt-4o',
      anthropic: aiConfig.selectedModels?.anthropic || 'claude-3-5-sonnet-20240620',
      groq: aiConfig.selectedModels?.groq || 'llama-3.3-70b-versatile'
    });

    setKeys({
      gemini: aiConfig.apiKeys?.google || '',
      openai: aiConfig.apiKeys?.openai || '',
      anthropic: aiConfig.apiKeys?.anthropic || '',
      groq: aiConfig.apiKeys?.groq || ''
    });
  }, [globalState]);

  const providerModels = {
    gemini: ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
    anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-haiku-20240307'],
    groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768']
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
      setDoc(doc(db, 'users', auth.currentUser.uid), newState, { merge: true })
        .catch(e => console.error("Failed to save to Firestore", e));
    }
    
    alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} configuration saved!`);
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
    await fetch(`${API_URL}/api/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newState)
    });
    
    if (auth.currentUser) {
      setDoc(doc(db, 'users', auth.currentUser.uid), newState, { merge: true })
        .catch(e => console.error("Failed to save to Firestore", e));
    }
    
    alert(`Active provider set to ${provider.charAt(0).toUpperCase() + provider.slice(1)}!`);
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
      setDoc(doc(db, 'users', auth.currentUser.uid), newState, { merge: true })
        .catch(e => console.error("Failed to save to Firestore", e));
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
      
      // We directly use GitHub Releases for fast, CDN-backed downloads 
      // instead of routing 100MB files through the Render backend.
      const githubRepo = 'Maayank18/FloatGPT';
      const version = 'v1.1.4';
      let downloadUrl = '';
      
      if (os === 'win') {
        downloadUrl = `https://github.com/${githubRepo}/releases/download/${version}/FloatGPT.Setup.1.1.4.exe`;
      } else {
        downloadUrl = `https://github.com/${githubRepo}/releases/download/${version}/FloatGPT-1.1.4.dmg`;
      }

      // Trigger download
      window.location.href = downloadUrl;
      
      // Reset state after a brief moment to show success
      setTimeout(() => {
        setDownloadState({ os: null, status: 'idle', error: null });
      }, 2000);
      
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
           <h1 className="text-4xl font-medium tracking-tight mb-4 text-text-primary">FloatGPT Desktop <span className="text-text-muted">v1.1.4</span></h1>
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
                <span className="flex items-center gap-1.5"><HardDriveDownload className="w-4 h-4" /> ~100 MB</span>
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
                    <DownloadCloud className="w-4 h-4" /> Download .zip (Installer)
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

          {/* Security Trust Notice */}
          <div className="w-full mb-20 p-5 rounded-xl border border-card-border bg-panel/50 flex items-start gap-4">
            <div className="mt-0.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-[13px] font-medium text-text-primary mb-1.5">Security Note</h4>
              <p className="text-[12px] text-text-muted leading-relaxed">
                Because FloatGPT is a new indie application, Windows SmartScreen may show an "unrecognized app" warning during installation.
                This is expected for any unsigned software. To proceed safely: click <strong className="text-text-secondary">"More Info"</strong> → <strong className="text-text-secondary">"Run anyway"</strong>.
                The installer is open-source and verifiable on <a href="https://github.com/Maayank18/FloatGPT" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">GitHub</a>.
              </p>
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
              
              <div className="relative border-l border-card-border ml-3 pl-8 space-y-8 py-2">
                {/* v1.1.1 - Latest */}
                <div className="relative">
                  <div className="absolute w-3 h-3 bg-accent rounded-full -left-[33.5px] top-1 ring-4 ring-bg"></div>
                  <div className="mb-1 flex items-center gap-3">
                    <h4 className="text-[16px] font-medium text-text-primary">v1.1.1 <span className="text-accent ml-2 text-[13px] bg-accent/10 px-2 py-0.5 rounded-md">Latest</span></h4>
                    <span className="text-[12px] text-text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> July 14, 2026</span>
                  </div>
                  <p className="text-[13px] text-text-secondary mb-4">The Stability Update — flawless multi-account data isolation, eradicated memory leaks, and enhanced Electron window physics.</p>
                  <ul className="space-y-2 text-[13px] text-text-primary">
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>State Isolation:</strong> API Keys and User State are now strictly wiped upon sign-out to guarantee security between multiple accounts.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Memory Optimization:</strong> Firebase snapshot listeners are now aggressively destroyed to completely prevent memory leaks.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Click-Through Physics:</strong> Transparent Orb padding now explicitly routes mouse clicks to background OS applications instead of ghost blocking.</span>
                    </li>
                  </ul>
                </div>

                {/* v1.1.0 */}
                <div className="relative">
                  <div className="absolute w-3 h-3 bg-card-border rounded-full -left-[33.5px] top-1 ring-4 ring-bg"></div>
                  <div className="mb-1 flex items-center gap-3">
                    <h4 className="text-[16px] font-medium text-text-primary">v1.1.0</h4>
                    <span className="text-[12px] text-text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> July 13, 2026</span>
                  </div>
                  <p className="text-[13px] text-text-secondary mb-4">The Analytics & Reliability Update — live dashboards, smart habit profiling, and bulletproof AI uptime.</p>
                  <ul className="space-y-2 text-[13px] text-text-primary">
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Live Analytics Engine:</strong> Completion Rate, Plan Accuracy, and Avg Delay now compute in real-time from your task data.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Dynamic Habit Profiles:</strong> Peak Focus Window, Active Hours, and Procrastination Hotspots auto-derive from your behavior.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>AI Multi-Key Fallback:</strong> 3-key Groq rotation system ensures 100% API uptime with zero interruptions.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Playground Chat Insights:</strong> AI generates real analysis and guidance about your schedule and routines.</span>
                    </li>
                  </ul>
                </div>

                {/* v1.0.0 */}
                <div className="relative">
                  <div className="absolute w-3 h-3 bg-text-muted/40 rounded-full -left-[33.5px] top-1 ring-4 ring-bg"></div>
                  <div className="mb-1 flex items-center gap-3">
                    <h4 className="text-[16px] font-medium text-text-primary">v1.0.0 <span className="text-text-muted ml-2 text-[13px] bg-panel px-2 py-0.5 rounded-md">Stable</span></h4>
                    <span className="text-[12px] text-text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> July 2, 2026</span>
                  </div>
                  <p className="text-[13px] text-text-secondary mb-4">Initial major release featuring the core intelligence engine and local telemetry.</p>
                  <ul className="space-y-2 text-[13px] text-text-primary">
                    <li className="flex items-start gap-3">
                      <span className="text-text-muted mt-0.5">•</span>
                      <span><strong>Conversational Firewall:</strong> AI strictly rejects small talk and grounds answers in your local habit telemetry.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-text-muted mt-0.5">•</span>
                      <span><strong>Global Hotkeys:</strong> Press <code>Ctrl+Shift+Space</code> anywhere on your OS to instantly summon or hide the FloatGPT orb.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-text-muted mt-0.5">•</span>
                      <span><strong>Web Speech API:</strong> Dictate prompts directly using the built-in microphone integration.</span>
                    </li>
                  </ul>
                </div>
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
                <div>
                  {!(globalState?.tasks || []).some((t) => t.status === 'Completed') ? (
                    <div className="text-center text-text-muted mt-20 flex flex-col items-center">
                      <Library className="w-8 h-8 mb-4 opacity-20" />
                      <p>No tasks completed yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(globalState?.tasks || []).filter((t) => t.status === 'Completed').map((task) => (
                         <div key={task.id} className="bg-panel border border-card-border rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                               <h3 className="text-[14px] font-medium text-text-primary line-through opacity-80">{task.title}</h3>
                               <p className="text-[12px] text-text-muted mt-1">Completed on {new Date(task.completedAt || Date.now()).toLocaleDateString()}</p>
                            </div>
                            <div className="bg-bg border border-card-border rounded-md px-3 py-1.5 text-[11px] font-bold tracking-wider text-accent uppercase">
                               Success
                            </div>
                         </div>
                      ))}
                    </div>
                  )}
                </div>
             )}

             {activeTab === 'analytics' && (() => {
                const tasks = globalState?.tasks || [];
                const completedTasks = tasks.filter((t) => t.status === 'Completed');
                
                // Live Analytics Computation
                const totalCreatedTasks = tasks.length;
                const completionRate = totalCreatedTasks === 0 ? 0 : Math.round((completedTasks.length / totalCreatedTasks) * 100);
                
                let totalDelayMins = 0;
                let accuracyCount = 0;
                let accurateHits = 0;
                const now = Date.now();
                
                tasks.forEach(t => {
                   if (t.deadlineAt) {
                      if (t.status === 'Completed') {
                         accuracyCount++;
                         const completedTime = t.completedAt || now;
                         if (completedTime > t.deadlineAt) {
                            totalDelayMins += Math.floor((completedTime - t.deadlineAt) / 60000);
                         } else {
                            accurateHits++;
                         }
                      } else if (t.status !== 'Archived') {
                         if (now > t.deadlineAt) {
                            totalDelayMins += Math.floor((now - t.deadlineAt) / 60000);
                            accuracyCount++;
                         }
                      }
                   }
                });
                
                const planAccuracy = accuracyCount === 0 ? 100 : Math.round((accurateHits / accuracyCount) * 100);
                const avgDelay = accuracyCount === 0 ? 0 : Math.floor(totalDelayMins / accuracyCount);
                const avgFocusTime = globalState?.executionProfile?.averageFocusDurationMinutes || 0;

                return (
                  <div>
                    {tasks.length === 0 ? (
                      <div className="text-center text-text-muted mt-20 flex flex-col items-center">
                        <Box className="w-8 h-8 mb-4 opacity-20" />
                        <p>Analytics will populate as you use FloatGPT.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-panel border border-card-border rounded-xl p-5 text-center">
                           <div className="text-[24px] font-bold text-accent mb-1">{completionRate}%</div>
                           <div className="text-[11px] text-text-muted uppercase tracking-wider font-bold">Completion Rate</div>
                        </div>
                        <div className="bg-panel border border-card-border rounded-xl p-5 text-center">
                           <div className="text-[24px] font-bold text-accent mb-1">{planAccuracy}%</div>
                           <div className="text-[11px] text-text-muted uppercase tracking-wider font-bold">Plan Accuracy</div>
                        </div>
                        <div className="bg-panel border border-card-border rounded-xl p-5 text-center">
                           <div className="text-[24px] font-bold text-text-primary mb-1">{avgFocusTime}m</div>
                           <div className="text-[11px] text-text-muted uppercase tracking-wider font-bold">Avg Focus Time</div>
                        </div>
                        <div className="bg-panel border border-card-border rounded-xl p-5 text-center">
                           <div className="text-[24px] font-bold text-warning mb-1">{avgDelay}m</div>
                           <div className="text-[11px] text-text-muted uppercase tracking-wider font-bold">Avg Delay</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
             })()}
           </div>
         </div>
      </div>
    );
  };

  // Habit Profile Dashboard Component
  const HabitProfileDashboardView = ({ globalState }) => {
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
              {(() => {
                 // Live Habit Profile Computation
                 const tasks = globalState?.tasks || [];
                 const completedTasks = tasks.filter((t) => t.status === 'Completed' && t.completedAt);
                 const now = Date.now();
                 
                 let peakFocus = globalState?.habitProfile?.focusWindow;
                 let prefSession = globalState?.habitProfile?.preferredSession;
                 let activeHours = globalState?.habitProfile?.activeHours;
                 let delayRisk = globalState?.habitProfile?.delayRisk;

                 if (!peakFocus || peakFocus === "Unknown") {
                    if (completedTasks.length > 0) {
                       const hours = completedTasks.map(t => new Date(t.completedAt).getHours());
                       const avgHour = Math.round(hours.reduce((a,b)=>a+b, 0) / hours.length);
                       if (avgHour >= 5 && avgHour < 12) { peakFocus = "Morning"; prefSession = "Early Day"; }
                       else if (avgHour >= 12 && avgHour < 17) { peakFocus = "Afternoon"; prefSession = "Mid Day"; }
                       else if (avgHour >= 17 && avgHour < 22) { peakFocus = "Evening"; prefSession = "Late Day"; }
                       else { peakFocus = "Night"; prefSession = "Late Night"; }
                       
                       const minHour = Math.min(...hours);
                       const maxHour = Math.max(...hours);
                       activeHours = `${minHour}:00 - ${maxHour}:00`;
                    } else {
                       peakFocus = "Not enough data";
                       prefSession = "Not enough data";
                       activeHours = "Not enough data";
                    }
                 }

                 if (!delayRisk || delayRisk === "Unknown") {
                    const overdueTasks = tasks.filter((t) => t.deadlineAt && t.deadlineAt < now && t.status !== 'Completed');
                    if (overdueTasks.length > 0) {
                       const categories = overdueTasks.map((t) => t.title.split(' ')[0]);
                       const mostCommon = categories.sort((a,b) => categories.filter(v => v===a).length - categories.filter(v => v===b).length).pop();
                       delayRisk = `High risk of delaying tasks related to "${mostCommon}".`;
                    } else {
                       delayRisk = "No major risks identified yet.";
                    }
                 }

                 return (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
                     <div className="bg-panel border border-card-border rounded-xl p-6 shadow-sm">
                       <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4 border-b border-card-border/50 pb-2">Cognitive Load Mapping</h3>
                       <div className="space-y-4">
                         <div>
                           <span className="text-xs text-text-muted uppercase tracking-wider block mb-1">Peak Focus Window</span>
                           <span className="text-base text-text-primary">{peakFocus}</span>
                         </div>
                         <div>
                           <span className="text-xs text-text-muted uppercase tracking-wider block mb-1">Preferred Work Session</span>
                           <span className="text-base text-text-primary">{prefSession}</span>
                         </div>
                         <div>
                           <span className="text-xs text-text-muted uppercase tracking-wider block mb-1">Active Hours</span>
                           <span className="text-base text-text-primary">{activeHours}</span>
                         </div>
                       </div>
                     </div>
                     
                     <div className="bg-panel border border-card-border rounded-xl p-6 shadow-sm">
                       <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4 border-b border-card-border/50 pb-2">Procrastination Hotspots</h3>
                       <div className="space-y-4">
                         <div>
                           <span className="text-xs text-danger uppercase tracking-wider block mb-1 font-bold">Identified Delay Risks</span>
                           <p className="text-base text-text-primary leading-relaxed">{delayRisk}</p>
                         </div>
                       </div>
                     </div>
                   </div>
                 );
              })()}

           </div>
         </div>
      </div>
    );
  };



function App() {
  const [activeMenu, setActiveMenu] = useState('playground');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false); // Closed by default
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  
  // Auth State
  const [authMode, setAuthMode] = useState('signin');
  const [fullName, setFullName] = useState('');
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Unified State Sync
  const [globalState, setGlobalState] = useState(null);

  // Playground Chat States & Logic
  const [inputText, setInputText] = useState("");
  const [isGroundingEnabled, setIsGroundingEnabled] = useState(true);
  const [isToolsEnabled, setIsToolsEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Right Panel States
  const [temperature, setTemperature] = useState(1.0);
  const [contextWindow, setContextWindow] = useState(20);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState({ name: 'Gemini 3 Flash Preview', id: 'gemini-3-flash-preview', provider: 'Google' });

  // Sync right panel state from global store once on load
  React.useEffect(() => {
    if (globalState?.uiState?.isRightPanelOpen !== undefined) {
      setIsRightPanelOpen(globalState.uiState.isRightPanelOpen);
    }
  }, [globalState?.sessionId]); // Run once when a session loads

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      if (!currentUser) setGlobalState(null);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalState(normalizeGlobalState(docSnap.data()));
      } else {
        setGlobalState(normalizeGlobalState({}));
      }
    }, (err) => {
      console.error("Failed to sync state from Firestore:", err);
    });
    
    return () => unsub();
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (userCredential.user && fullName) {
          await updateProfile(userCredential.user, { displayName: fullName });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  if (isAuthLoading) {
    return <div className="h-screen w-full bg-bg flex items-center justify-center text-text-muted">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="h-screen w-full bg-[#050505] flex items-center justify-center font-sans relative overflow-hidden">
        {/* Animated Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>
        
        {/* Floating Glowing Orbs */}
        <div className="absolute top-[20%] left-[15%] w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse pointer-events-none"></div>
        <div className="absolute bottom-[20%] right-[15%] w-[30rem] h-[30rem] bg-violet-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        
        {/* Geometric Accents */}
        <div className="absolute top-[15%] right-[10%] w-64 h-64 border border-white/5 rounded-full rotate-45 pointer-events-none"></div>
        <div className="absolute bottom-[10%] left-[10%] w-96 h-96 border border-indigo-500/10 rounded-full pointer-events-none"></div>

        {/* Brand Doodling Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-5">
          <div className="text-[180px] font-black tracking-tighter text-white leading-none rotate-[-5deg] scale-150">FLOATGPT</div>
        </div>
        
        <div className="bg-[#111111]/80 backdrop-blur-3xl border border-white/10 px-10 py-12 rounded-[32px] shadow-[0_0_80px_rgba(0,0,0,0.5)] max-w-[460px] w-full relative z-10 animate-in fade-in zoom-in-95 duration-500 my-8 overflow-y-auto max-h-[90vh] hide-scrollbar">
          <div className="flex justify-center mb-6">
            <img src="/logo-2-chat-circular.png" alt="FloatGPT Logo" className="w-16 h-16 rounded-2xl shadow-lg border border-white/10" />
          </div>
          <h2 className="text-2xl font-semibold text-text-primary text-center mb-2 tracking-tight">Welcome to FloatGPT</h2>
          <p className="text-[14px] text-text-muted text-center mb-6 leading-relaxed">Log in to sync your intelligent workspace across all devices.</p>
          
          {authError && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center">{authError}</div>}
          
          <div className="space-y-4">
            <div className="flex bg-bg/50 p-1.5 rounded-xl border border-card-border mb-4">
              <button
                type="button"
                onClick={() => setAuthMode('signin')}
                className={`flex-1 text-[14px] py-2 rounded-lg font-medium transition-all ${authMode === 'signin' ? 'bg-panel text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`flex-1 text-[14px] py-2 rounded-lg font-medium transition-all ${authMode === 'signup' ? 'bg-panel text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" required className="w-full bg-bg/80 border border-card-border rounded-xl px-4 py-2.5 text-[14px] text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-text-muted/70" />
                </div>
              )}
              <div>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" required autoComplete="off" className="w-full bg-bg/80 border border-card-border rounded-xl px-4 py-2.5 text-[14px] text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-text-muted/70" />
              </div>
              <div>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required autoComplete="new-password" className="w-full bg-bg/80 border border-card-border rounded-xl px-4 py-2.5 text-[14px] text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-text-muted/70" />
              </div>
              <button type="submit" className="w-full py-3 mt-4 bg-accent hover:bg-accent-hover text-white rounded-xl text-[14px] font-medium transition-colors shadow-lg shadow-accent/20">
                {authMode === 'signin' ? 'Sign In to Workspace' : 'Create Account'}
              </button>
            </form>

            <div className="flex items-center gap-4 py-3">
              <div className="h-px bg-card-border flex-1"></div>
              <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Or</span>
              <div className="h-px bg-card-border flex-1"></div>
            </div>

            <button 
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-gray-50 text-black rounded-xl text-[14px] font-medium transition-colors shadow-sm border border-gray-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    );
  }



  const chatHistory = globalState?.messages || [];

  const toggleRightPanel = async (open) => {
    setIsRightPanelOpen(open);
    if (globalState) {
      const newState = { ...globalState, uiState: { ...globalState.uiState, isRightPanelOpen: open } };
      setGlobalState(newState);
      if (auth.currentUser) {
        setDoc(doc(db, 'users', auth.currentUser.uid), newState, { merge: true })
          .catch(e => console.error(e));
      }
    }
  };

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
      const response = await fetch(`${API_URL}/api/intelligence`, {
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
        content: data.error || data.message || "An unexpected error occurred. No message received.", 
        data: data,
        timestamp: Date.now() 
      };
      
      const finalMessages = [...updatedMessages, aiMessage];
      const newState = { ...tempState, playgroundMessages: finalMessages };
      
      // Update state locally and push to central unified store
      setGlobalState(newState);
      if (auth.currentUser) {
        setDoc(doc(db, 'users', auth.currentUser.uid), newState, { merge: true })
          .catch(e => console.error(e));
      }
      
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
      case 'settings': return <PlaceholderView title="Settings" icon={Settings} />;
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
                    <button onClick={() => toggleRightPanel(true)} className="p-1.5 rounded-full hover:bg-panel text-text-secondary hover:text-text-primary transition-all cursor-pointer" title="Open Settings">
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
                  <div className="w-full flex flex-col items-center justify-center mt-12 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="w-16 h-16 bg-gradient-to-br from-panel to-bg border border-card-border rounded-2xl flex items-center justify-center shadow-xl mb-6 ring-1 ring-card-border/50">
                      <Sparkles className="w-8 h-8 text-accent" />
                    </div>
                    <h2 className="text-2xl font-medium text-text-primary mb-3 text-center tracking-tight">Welcome to FloatGPT Playground</h2>
                    <p className="text-text-secondary text-[14px] text-center max-w-lg mb-10 leading-relaxed">
                      Your intelligent, context-aware execution engine. Here is how you can get the most out of your persistent AI companion:
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                      
                      <div className="bg-panel border border-card-border rounded-xl p-5 hover:border-accent/30 transition-colors group text-left shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-bg border border-card-border rounded-lg group-hover:bg-accent/10 transition-colors">
                            <Target className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
                          </div>
                          <h3 className="text-[14px] font-medium text-text-primary">Plan & Prioritize</h3>
                        </div>
                        <p className="text-[12px] text-text-muted leading-relaxed pl-[44px]">
                          Ask FloatGPT to break down large projects into actionable steps, or ask what you should focus on next based on your deadlines.
                        </p>
                      </div>

                      <div className="bg-panel border border-card-border rounded-xl p-5 hover:border-accent/30 transition-colors group text-left shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-bg border border-card-border rounded-lg group-hover:bg-accent/10 transition-colors">
                            <BrainCircuit className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
                          </div>
                          <h3 className="text-[14px] font-medium text-text-primary">Multimodal Intelligence</h3>
                        </div>
                        <p className="text-[12px] text-text-muted leading-relaxed pl-[44px]">
                          Use the '+' icon below to upload PDFs, images, or text files. The AI will instantly read and incorporate them into your context.
                        </p>
                      </div>

                      <div className="bg-panel border border-card-border rounded-xl p-5 hover:border-accent/30 transition-colors group text-left shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-bg border border-card-border rounded-lg group-hover:bg-accent/10 transition-colors">
                            <Zap className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
                          </div>
                          <h3 className="text-[14px] font-medium text-text-primary">Always Connected</h3>
                        </div>
                        <p className="text-[12px] text-text-muted leading-relaxed pl-[44px]">
                          The Playground stays perfectly synced with your Desktop Orb. Your tasks, habits, and chat history travel with you everywhere.
                        </p>
                      </div>

                      <div className="bg-panel border border-card-border rounded-xl p-5 hover:border-accent/30 transition-colors group text-left shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-bg border border-card-border rounded-lg group-hover:bg-accent/10 transition-colors">
                            <Terminal className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
                          </div>
                          <h3 className="text-[14px] font-medium text-text-primary">Advanced Control</h3>
                        </div>
                        <p className="text-[12px] text-text-muted leading-relaxed pl-[44px]">
                          Open the right-side panel to tweak AI models, temperature, and system prompts. Enjoy direct access to cutting-edge reasoning engines.
                        </p>
                      </div>

                    </div>
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
                      className="w-full bg-transparent text-text-primary placeholder:text-text-muted text-[15px] resize-none focus:outline-none min-h-[48px] py-3 px-4 custom-scrollbar"
                      rows={1}
                      placeholder={activeMenu === 'history' ? "Search history..." : "Ask FloatGPT or press / for commands..."}
                    />
                    <div className="flex items-center justify-between px-3 pb-2 pt-1">
                      <div className="flex items-center gap-1.5 text-text-muted">
                        <label title="Upload File (PDF, Image, Text)" className="p-1.5 rounded-full hover:bg-bg hover:text-text-primary transition-all group cursor-pointer">
                          <input type="file" className="hidden" accept=".pdf,image/*,text/*" onChange={async (e) => {
                             if (e.target.files && e.target.files[0]) {
                               await IngestionService.ingestFile(e.target.files[0]);
                               setInputText(prev => prev + `\n[Reference Added: ${e.target.files[0].name}]`);
                             }
                          }} />
                          <Plus className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" />
                        </label>
                        <button className="p-1.5 rounded-full hover:bg-bg hover:text-text-primary transition-all group">
                          <Search className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={toggleRecording} className={`p-1.5 rounded-full transition-all group ${isRecording ? 'text-red-400 bg-red-400/10' : 'text-text-muted hover:bg-bg hover:text-text-primary'}`}>
                          <Mic className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" />
                        </button>
                        <button 
                          onClick={handleRun}
                          disabled={!inputText.trim() || isLoading}
                          className={`w-[32px] h-[32px] rounded-full flex items-center justify-center transition-all shadow-md ${!inputText.trim() || isLoading ? 'bg-panel-light text-text-muted shadow-none' : 'bg-white text-black hover:scale-105 hover:shadow-lg'}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
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
              <button onClick={() => setActiveMenu('habit')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-[13px] font-medium transition-all ${activeMenu === 'habit' ? 'bg-panel text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-panel'}`}>
                <Fingerprint className="w-[18px] h-[18px]" /> Habit Profile
              </button>
              <button onClick={() => setActiveMenu('download')} className={`w-full flex items-center justify-between px-3 py-2 rounded-full text-[13px] font-medium transition-all group ${activeMenu === 'download' ? 'bg-blue-500/10 text-text-primary shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-2 ring-blue-500' : 'text-text-secondary hover:text-blue-400 hover:bg-panel hover:shadow-[0_0_15px_rgba(59,130,246,0.1)]'}`}>
                <div className="flex items-center gap-3">
                  <DownloadCloud className={`w-[18px] h-[18px] transition-transform ${activeMenu !== 'download' && 'group-hover:-translate-y-0.5'}`} /> 
                  <span className={activeMenu === 'download' ? 'text-blue-400 font-bold drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]' : ''}>Download App</span>
                </div>
                <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(59,130,246,0.2)] animate-pulse hidden md:block">Explore</span>
              </button>
              <button onClick={() => setActiveMenu('keys')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-[13px] font-medium transition-all ${activeMenu === 'keys' ? 'bg-panel text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-panel'}`}>
                <Key className="w-[18px] h-[18px]" /> API Keys
              </button>
            </nav>
          </div>
        </div>

        {/* Growth Tracker / Execution Pulse */}
        <div className="px-3 mb-2 shrink-0">
           <div className="bg-panel/50 border border-card-border/50 rounded-xl p-3">
             <div className="flex items-center justify-between mb-2">
               <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Execution Pulse</span>
               <div className={`w-2 h-2 rounded-full ${globalState?.metrics?.momentumScore >= 50 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`}></div>
             </div>
             <div className="flex justify-between items-end">
               <div>
                 <div className="text-[20px] font-medium text-text-primary leading-none mb-1">{globalState?.metrics?.momentumScore || 50}</div>
                 <div className="text-[10px] text-text-muted">Momentum</div>
               </div>
               <div className="text-right">
                 <div className="text-[13px] font-medium text-text-primary leading-none mb-1">{globalState?.metrics?.completedTasksToday || 0} / {globalState?.metrics?.queriesToday || 0}</div>
                 <div className="text-[10px] text-text-muted">Tasks / Queries</div>
               </div>
             </div>
           </div>
        </div>

        {/* Footer Area (Account & Actions) */}
        <div className="p-3 shrink-0">
          <div className="bg-panel rounded-[16px] p-4 flex flex-col gap-2">
            <h4 className="text-[12px] font-bold text-text-primary mb-1 truncate">{user?.email}</h4>
            <button 
              onClick={() => signOut(auth)}
              className="text-[11px] text-danger hover:text-white bg-danger/10 hover:bg-danger/80 py-1.5 px-3 rounded-lg transition-colors font-bold w-full text-center uppercase tracking-wider"
            >
              Sign Out
            </button>
          </div>
          <div className="flex items-center justify-between mt-4 px-2 mb-2">
            <div className="flex gap-4 text-text-muted">
              <Bell onClick={() => alert('Notifications are currently active in the Orb only. Coming to Playground soon!')} className="w-[18px] h-[18px] cursor-pointer hover:text-text-primary transition-colors" />
              <Settings onClick={() => setActiveMenu('settings')} className="w-[18px] h-[18px] cursor-pointer hover:text-text-primary transition-colors" />
              <Search onClick={() => alert('Search is globally available via Ctrl+F / Cmd+F in Playground.')} className="w-[18px] h-[18px] cursor-pointer hover:text-text-primary transition-colors" />
              <Key onClick={() => setActiveMenu('keys')} className="w-[18px] h-[18px] cursor-pointer hover:text-text-primary transition-colors" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      {renderMainContent()}

      {/* 3. RIGHT SIDEBAR (Run Settings) - Collapsible */}
      {isRightPanelOpen && activeMenu === 'playground' && (
        <aside className="w-[300px] border-l border-card-border bg-bg flex flex-col shrink-0">
          <div className="h-[60px] flex items-center px-4 justify-between border-b border-card-border/50 shrink-0">
            <h2 className="text-[13px] font-medium text-text-primary">Run settings</h2>
            <div className="flex items-center gap-2">
               <button className="flex items-center gap-1 text-[13px] font-medium text-text-primary hover:bg-panel px-2 py-1.5 rounded-md transition-colors">
                  <Code2 className="w-[16px] h-[16px]" /> Get code
               </button>
               <button 
                  onClick={() => toggleRightPanel(false)}
                  className="p-1.5 rounded-full hover:bg-panel text-text-secondary hover:text-text-primary transition-all cursor-pointer"
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
