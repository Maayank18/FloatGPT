import React from 'react';
import { Menu, PanelRightOpen, Share2, MoreHorizontal, RotateCcw } from 'lucide-react';

export const TopBar = ({ 
  isLeftPanelOpen, 
  setIsLeftPanelOpen, 
  isRightPanelOpen, 
  toggleRightPanel,
  handleClearChat
}) => {
  return (
    <header className="h-[72px] px-6 flex items-center justify-between shrink-0 border-b border-card-border/30">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)} 
          className="p-2 rounded-xl hover:bg-white/5 text-text-secondary hover:text-white transition-colors cursor-pointer group"
        >
          <Menu className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" />
        </button>
        <div className="flex flex-col">
           <h1 className="text-[15px] font-semibold text-text-primary tracking-tight">FloatGPT Engine</h1>
           <span className="text-[11px] text-text-muted font-medium">Session: active</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
         {!isRightPanelOpen && (
            <button 
              onClick={() => toggleRightPanel(true)} 
              className="p-2 rounded-xl hover:bg-white/5 text-text-secondary hover:text-white transition-all cursor-pointer group" 
              title="Open Settings"
            >
              <PanelRightOpen className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" />
            </button>
         )}
         <button 
            onClick={handleClearChat}
            className="p-2 rounded-xl hover:bg-white/5 text-text-secondary hover:text-white transition-colors group"
            title="Clear Chat"
         >
            <RotateCcw className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" />
         </button>
         <button className="p-2 rounded-xl hover:bg-white/5 text-text-secondary hover:text-white transition-colors group">
            <Share2 className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" />
         </button>
         <button className="p-2 rounded-xl hover:bg-white/5 text-text-secondary hover:text-white transition-colors group">
            <MoreHorizontal className="w-[20px] h-[20px] group-hover:scale-110 transition-transform" />
         </button>
      </div>
    </header>
  );
};
