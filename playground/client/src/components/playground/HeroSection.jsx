import React from 'react';
import { Sparkles, Target, BrainCircuit, Zap, Terminal } from 'lucide-react';

export const HeroSection = () => {
  return (
    <div className="w-full flex flex-col items-center justify-center mt-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 mb-6 flex items-center justify-center gap-3 w-full max-w-2xl text-center shadow-sm">
         <Zap className="w-5 h-5 text-accent shrink-0 animate-pulse" />
         <p className="text-[15px] text-accent font-bold tracking-wide">
           This is just a preview! Download the Desktop App from the EXPLORE section to experience the real magic.
         </p>
      </div>
      <div className="w-16 h-16 bg-gradient-to-br from-panel to-bg rounded-2xl flex items-center justify-center shadow-xl mb-6 ring-1 ring-white/10 relative overflow-hidden group">
        <div className="absolute inset-0 bg-accent/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <Sparkles className="w-8 h-8 text-text-primary relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
      </div>
      <h2 className="text-3xl font-semibold text-transparent bg-clip-text bg-gradient-to-b from-white to-text-secondary mb-3 text-center tracking-tight drop-shadow-sm">Welcome to FloatGPT</h2>
      <p className="text-text-muted text-[14px] text-center max-w-[480px] mb-12 leading-relaxed">
        Your intelligent, context-aware execution engine. A premium workspace engineered for focus, clarity, and speed.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
        
        <div className="bg-panel border border-card-border/50 rounded-2xl p-5 hover:border-accent/40 hover:-translate-y-1 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] transition-all duration-300 group text-left flex flex-col min-h-[150px] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="flex items-center gap-3 mb-3 relative z-10">
            <div className="p-2 bg-white/5 border border-white/5 rounded-xl group-hover:bg-accent/10 group-hover:border-accent/20 transition-colors shadow-inner">
              <Target className="w-4 h-4 text-text-primary group-hover:text-accent transition-colors drop-shadow-sm" />
            </div>
            <h3 className="text-[14px] font-semibold text-text-primary tracking-wide">Plan & Prioritize</h3>
          </div>
          <p className="text-[13px] text-text-muted leading-[1.6] mt-auto relative z-10">
            Break down massive projects into actionable tasks. Ask the engine what you should focus on next based on active deadlines.
          </p>
        </div>

        <div className="bg-panel border border-card-border/50 rounded-2xl p-5 hover:border-accent/40 hover:-translate-y-1 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] transition-all duration-300 group text-left flex flex-col min-h-[150px] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="flex items-center gap-3 mb-3 relative z-10">
            <div className="p-2 bg-white/5 border border-white/5 rounded-xl group-hover:bg-accent/10 group-hover:border-accent/20 transition-colors shadow-inner">
              <BrainCircuit className="w-4 h-4 text-text-primary group-hover:text-accent transition-colors drop-shadow-sm" />
            </div>
            <h3 className="text-[14px] font-semibold text-text-primary tracking-wide">Multimodal Intelligence</h3>
          </div>
          <p className="text-[13px] text-text-muted leading-[1.6] mt-auto relative z-10">
            Instantly analyze text, images, or documents. Upload files to the context window and get exact answers instantly.
          </p>
        </div>

        <div className="bg-panel border border-card-border/50 rounded-2xl p-5 hover:border-accent/40 hover:-translate-y-1 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] transition-all duration-300 group text-left flex flex-col min-h-[150px] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="flex items-center gap-3 mb-3 relative z-10">
            <div className="p-2 bg-white/5 border border-white/5 rounded-xl group-hover:bg-accent/10 group-hover:border-accent/20 transition-colors shadow-inner">
              <Zap className="w-4 h-4 text-text-primary group-hover:text-accent transition-colors drop-shadow-sm" />
            </div>
            <h3 className="text-[14px] font-semibold text-text-primary tracking-wide">Always Connected</h3>
          </div>
          <p className="text-[13px] text-text-muted leading-[1.6] mt-auto relative z-10">
            Perfectly synced with your Desktop Orb. Your tasks, habits, and encrypted history travel securely across devices.
          </p>
        </div>

        <div className="bg-panel border border-card-border/50 rounded-2xl p-5 hover:border-accent/40 hover:-translate-y-1 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] transition-all duration-300 group text-left flex flex-col min-h-[150px] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="flex items-center gap-3 mb-3 relative z-10">
            <div className="p-2 bg-white/5 border border-white/5 rounded-xl group-hover:bg-accent/10 group-hover:border-accent/20 transition-colors shadow-inner">
              <Terminal className="w-4 h-4 text-text-primary group-hover:text-accent transition-colors drop-shadow-sm" />
            </div>
            <h3 className="text-[14px] font-semibold text-text-primary tracking-wide">Advanced Control</h3>
          </div>
          <p className="text-[13px] text-text-muted leading-[1.6] mt-auto relative z-10">
            Toggle the right panel to swap reasoning engines, tweak generation temperature, or customize the system directives.
          </p>
        </div>

      </div>
    </div>
  );
};
