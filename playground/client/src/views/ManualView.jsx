import React from 'react';
import { DownloadCloud, ShieldAlert, Key, RefreshCw, Move, CheckCircle2, ArrowRight, Zap } from 'lucide-react';

export const ManualView = () => {
  return (
    <div className="flex-1 overflow-y-auto bg-bg custom-scrollbar text-text-primary p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div>
          <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 mb-6 flex items-center justify-center gap-3 w-full text-center shadow-sm">
             <Zap className="w-5 h-5 text-accent shrink-0 animate-pulse" />
             <p className="text-[15px] text-accent font-bold tracking-wide">
               This is just a preview! Download the Desktop App from the EXPLORE section to experience the real magic.
             </p>
          </div>
          <h1 className="text-2xl font-bold mb-2">Welcome to FloatGPT</h1>
          <p className="text-text-secondary text-[15px] leading-relaxed">
            FloatGPT is an always-on, floating AI companion designed to help you plan meetings, manage small tasks, stay organized, and reduce context switching so you can work smoothly without tab overload. This quick start guide will help you get set up in minutes.
          </p>
        </div>

        <hr className="border-card-border/50" />

        {/* Section 1: Download & Install */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-accent font-semibold text-lg">
            <DownloadCloud className="w-5 h-5" />
            <h2>1. Download FloatGPT Desktop</h2>
          </div>
          <p className="text-text-secondary text-[14px]">
            To unlock the full potential of FloatGPT, first navigate to the <strong>Download App</strong> section in the sidebar and download the Windows installer.
          </p>
          <div className="bg-panel/30 border border-card-border/50 rounded-xl p-4 mt-2">
            <h3 className="text-[13px] font-semibold text-text-primary mb-1">Install and open</h3>
            <p className="text-[13px] text-text-muted">
              Once downloaded, double-click the installer and follow the standard installation prompts. The app will launch automatically when finished.
            </p>
          </div>
        </div>

        {/* Section 2: Security Warning */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-accent font-semibold text-lg">
            <ShieldAlert className="w-5 h-5" />
            <h2>2. If Windows shows a warning</h2>
          </div>
          <p className="text-text-secondary text-[14px] leading-relaxed">
            Windows SmartScreen or your browser may show a blue security warning when opening the installer. This happens because FloatGPT is a newer application and has not yet built up enough reputation for automated trust systems. 
          </p>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mt-2 flex gap-3">
            <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] text-blue-100/90 leading-relaxed mb-4">
                If you encounter this screen, click <strong>"More info"</strong> and then <strong>"Run anyway"</strong>. Only proceed if you downloaded the installer directly from the official FloatGPT release.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-lg overflow-hidden border border-card-border/50">
                   <div className="p-2 text-[11px] font-semibold text-text-muted text-center border-b border-card-border/50">Step 1: Click "More info"</div>
                   <img src="/docs/warning_1.png" alt="Windows Security Warning Step 1" className="w-full object-cover" />
                </div>
                <div className="bg-black/20 rounded-lg overflow-hidden border border-card-border/50">
                   <div className="p-2 text-[11px] font-semibold text-text-muted text-center border-b border-card-border/50">Step 2: Click "Run anyway"</div>
                   <img src="/docs/warning_2.png" alt="Windows Security Warning Step 2" className="w-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: API Key */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-accent font-semibold text-lg">
            <Key className="w-5 h-5" />
            <h2>3. Add your API key</h2>
          </div>
          <p className="text-text-secondary text-[14px]">
            FloatGPT requires your own AI provider API key (like Groq, Google Gemini, or OpenAI) to function. You can set this key in either location:
          </p>
          <ul className="list-disc pl-5 text-[14px] text-text-secondary space-y-2 mt-2">
            <li>The <strong>FloatOrb Settings</strong> (click the gear icon in the floating app)</li>
            <li>The <strong>Float Studio API Keys</strong> section (in this web sidebar)</li>
          </ul>
          <div className="bg-panel border border-card-border p-4 rounded-xl mt-4">
             <h3 className="text-[13px] font-semibold text-text-primary mb-2">Get a Free API Key</h3>
             <p className="text-[13px] text-text-muted mb-3">You can get a completely free API key from these providers to start using FloatGPT immediately:</p>
             <div className="flex flex-wrap gap-2">
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-[12px] px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1.5">
                   Groq (Fastest) <ArrowRight className="w-3 h-3" />
                </a>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[12px] px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1.5">
                   Google AI Studio (Gemini) <ArrowRight className="w-3 h-3" />
                </a>
                <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-[12px] px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1.5">
                   OpenRouter <ArrowRight className="w-3 h-3" />
                </a>
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-[12px] px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1.5">
                   OpenAI <ArrowRight className="w-3 h-3" />
                </a>
             </div>
          </div>
        </div>

        {/* Section 4: Syncing */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-accent font-semibold text-lg">
            <RefreshCw className="w-5 h-5" />
            <h2>4. Sync between Orb and Playground</h2>
          </div>
          <p className="text-text-secondary text-[14px] leading-relaxed">
            Once you add your API key in either app, it automatically syncs across your entire FloatGPT workspace. The Orb and the Playground act as independent chat windows, but they share a powerful underlying memory capsule that tracks your goals, habits, and tasks seamlessly.
          </p>
        </div>

        {/* Section 5: Orb Controls */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-accent font-semibold text-lg">
            <Move className="w-5 h-5" />
            <h2>5. Open, hide, and drag the Orb</h2>
          </div>
          <p className="text-text-secondary text-[14px]">
            Once the API key is set, the Orb becomes ready and can be used right away. It is designed to hover over your other applications so you never have to leave your workflow.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="bg-panel border border-card-border p-4 rounded-xl flex items-start gap-3">
              <div className="bg-card px-2 py-1 rounded text-xs font-mono font-semibold shrink-0 border border-card-border">Ctrl+Shift+Space</div>
              <p className="text-[13px] text-text-secondary">Instantly hide or show the Orb from anywhere on your computer.</p>
            </div>
            <div className="bg-panel border border-card-border p-4 rounded-xl flex items-start gap-3">
              <Move className="w-5 h-5 text-accent shrink-0" />
              <p className="text-[13px] text-text-secondary">Drag the circular floating icon anywhere on your screen.</p>
            </div>
          </div>
        </div>

        {/* Section 6: Start Using */}
        <div className="pt-4">
          <div className="bg-gradient-to-br from-accent/20 to-bg border border-accent/30 rounded-2xl p-6 md:p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 blur-3xl rounded-full translate-x-10 -translate-y-10 pointer-events-none"></div>
            <CheckCircle2 className="w-12 h-12 text-accent mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Start using FloatGPT</h2>
            <p className="text-[14px] text-text-secondary mb-6 max-w-lg mx-auto">
              You are completely set up! Start using the Orb for quick, in-context questions, and come back to the Playground for deep analysis and history review.
            </p>
            <button onClick={() => window.location.hash = ''} className="bg-accent hover:bg-accent-hover text-white px-6 py-2.5 rounded-lg text-[13px] font-semibold transition-colors shadow-lg inline-flex items-center gap-2">
              Go to Playground <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="h-12"></div>
      </div>
    </div>
  );
};
