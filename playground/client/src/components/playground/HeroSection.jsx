import React from 'react';
import { Zap } from 'lucide-react';

export const HeroSection = () => {
  return (
    <div className="w-full flex flex-col items-center justify-start pt-2 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 mb-10 flex items-center justify-center gap-3 w-full max-w-2xl text-center shadow-sm">
         <Zap className="w-5 h-5 text-accent shrink-0 animate-pulse" />
         <p className="text-[14px] text-accent font-bold tracking-wide">
           This is just a preview! Download the Desktop App from the EXPLORE section to experience the real magic.
         </p>
      </div>

      <div className="text-center w-full relative">
        {/* Floating monospaced labels */}
        <div className="absolute -top-8 left-12 md:left-24 text-[10px] font-mono text-text-muted tracking-widest uppercase hidden md:block">
          STATUS[ONLINE]
        </div>
        <div className="absolute top-1/2 right-12 md:right-16 text-[10px] font-mono text-text-muted tracking-widest uppercase hidden md:block rotate-90 origin-right">
          LATENCY: 14MS
        </div>

        {/* Massive Typography */}
        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-[#a0a0a0] tracking-tighter leading-none drop-shadow-lg uppercase select-none">
          Welcome to<br/> FloatGPT
        </h1>
        
        {/* Subtitle */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <p className="text-text-secondary font-mono text-[12px] md:text-[14px] tracking-widest uppercase max-w-lg leading-relaxed">
            Your intelligent, context-aware execution engine. A premium workspace engineered for focus and speed.
          </p>
        </div>
      </div>

    </div>
  );
};
