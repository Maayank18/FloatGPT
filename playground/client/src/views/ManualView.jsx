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
          <h1 className="text-3xl font-bold mb-3">Quick Start Guide</h1>
          <p className="text-text-secondary text-[16px] leading-relaxed">
            Follow these 3 simple steps to get FloatGPT running on your computer. FloatGPT is an always-on, floating AI companion designed to help you execute tasks without distractions.
          </p>
        </div>

        <hr className="border-card-border/50" />

        {/* Section 1: Download & Install */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-accent font-semibold text-xl">
            <div className="bg-accent/10 p-2 rounded-lg"><DownloadCloud className="w-5 h-5" /></div>
            <h2>Step 1: Download & Install</h2>
          </div>
          <ol className="list-decimal list-inside text-[15px] text-text-secondary space-y-3 pl-2">
            <li>Go to the <strong>Download App</strong> section in the sidebar.</li>
            <li>Download the Windows Installer (<code>.exe</code>).</li>
            <li>Double-click the file to install. The app will launch automatically when done.</li>
          </ol>
          
          {/* Security Warning Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 mt-4 flex gap-4 items-start">
            <ShieldAlert className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[14px] font-bold text-blue-300 mb-2">Did you get a blue Windows screen?</h3>
              <p className="text-[14px] text-blue-100/90 leading-relaxed mb-4">
                Since FloatGPT is brand new, Windows SmartScreen might block it at first. Don't worry, this is normal!
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-lg overflow-hidden border border-card-border/50">
                   <div className="p-2 text-[12px] font-semibold text-text-muted text-center border-b border-card-border/50">1. Click "More info"</div>
                   <img src="/docs/warning_1.png" alt="Step 1" className="w-full object-cover" />
                </div>
                <div className="bg-black/20 rounded-lg overflow-hidden border border-card-border/50">
                   <div className="p-2 text-[12px] font-semibold text-text-muted text-center border-b border-card-border/50">2. Click "Run anyway"</div>
                   <img src="/docs/warning_2.png" alt="Step 2" className="w-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: API Key */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-3 text-accent font-semibold text-xl">
            <div className="bg-accent/10 p-2 rounded-lg"><Key className="w-5 h-5" /></div>
            <h2>Step 2: Add Your Free API Key</h2>
          </div>
          <p className="text-text-secondary text-[15px]">
            FloatGPT needs an AI "brain" to function. You can get one for completely free.
          </p>
          
          <div className="bg-panel border border-card-border p-5 rounded-xl">
             <h3 className="text-[14px] font-bold text-text-primary mb-3">Choose a provider to get your free key:</h3>
             <div className="flex flex-wrap gap-3">
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-[13px] px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-accent/20 hover:text-accent hover:border-accent/30 transition-all flex items-center gap-2">
                   Groq (Recommended - Very Fast) <ArrowRight className="w-3.5 h-3.5" />
                </a>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[13px] px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2">
                   Google AI Studio (Gemini) <ArrowRight className="w-3.5 h-3.5" />
                </a>
             </div>
             
             <div className="mt-5 pt-4 border-t border-card-border/50">
                <h3 className="text-[13px] font-bold text-text-primary mb-2">Where do I put the key?</h3>
                <ul className="list-disc list-inside text-[14px] text-text-secondary space-y-1">
                  <li>Paste it here in the web dashboard under <strong>API Keys</strong></li>
                  <li>Or paste it in the Desktop App (Click the ⚙️ Gear icon)</li>
                </ul>
                <p className="text-[13px] text-text-muted mt-2 italic flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Both apps sync with each other automatically!</p>
             </div>
          </div>
        </div>

        {/* Section 3: How to Use */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-3 text-accent font-semibold text-xl">
            <div className="bg-accent/10 p-2 rounded-lg"><Move className="w-5 h-5" /></div>
            <h2>Step 3: Master the Orb</h2>
          </div>
          <p className="text-text-secondary text-[15px]">
            Once your API key is saved, FloatGPT is ready. Here are the only two things you need to know:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="bg-panel border border-card-border p-5 rounded-xl flex flex-col gap-3 hover:border-accent/30 transition-colors">
              <div className="bg-card self-start px-3 py-1.5 rounded-lg text-[13px] font-mono font-bold border border-card-border shadow-sm text-accent">Ctrl + Shift + Space</div>
              <div>
                <h4 className="text-[14px] font-bold text-text-primary mb-1">Global Hotkey</h4>
                <p className="text-[13px] text-text-secondary leading-relaxed">Press this from anywhere on your computer to instantly hide or show FloatGPT. Perfect for quickly getting it out of your way.</p>
              </div>
            </div>
            <div className="bg-panel border border-card-border p-5 rounded-xl flex flex-col gap-3 hover:border-accent/30 transition-colors">
              <div className="bg-card self-start px-3 py-1.5 rounded-lg border border-card-border shadow-sm">
                 <Move className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-text-primary mb-1">Drag Anywhere</h4>
                <p className="text-[13px] text-text-secondary leading-relaxed">Click and drag the circular icon anywhere on your screen. Click the icon once to open your chat and planning tools.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-8 pb-4">
          <div className="bg-gradient-to-br from-accent/20 to-bg border border-accent/30 rounded-2xl p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-accent/10 blur-3xl rounded-full translate-x-10 -translate-y-10 pointer-events-none"></div>
            <CheckCircle2 className="w-14 h-14 text-accent mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-3">You're all set!</h2>
            <p className="text-[15px] text-text-secondary mb-8 max-w-lg mx-auto">
              You are ready to use FloatGPT. Keep the Desktop app running for daily tasks, and use this Playground website for analytics and deep planning.
            </p>
            <button onClick={() => window.location.hash = ''} className="bg-accent hover:bg-accent-hover text-white px-8 py-3 rounded-xl text-[14px] font-bold transition-colors shadow-lg shadow-accent/20 inline-flex items-center gap-2 group">
              Start Using FloatGPT <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        <div className="h-12"></div>
      </div>
    </div>
  );
};
