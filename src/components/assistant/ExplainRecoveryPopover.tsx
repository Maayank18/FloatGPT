import React, { useState } from 'react';
import { AppState } from '../../types';
import { HelpCircle, Sparkles } from 'lucide-react';

interface ExplainRecoveryPopoverProps {
  state: AppState;
}

export const ExplainRecoveryPopover: React.FC<ExplainRecoveryPopoverProps> = ({ state }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const confidence = state.recoveryState?.missionConfidencePercent || 100;

  return (
    <div className="relative inline-block" onClick={e => e.stopPropagation()}>
      <button 
        onClick={toggleOpen}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider text-warning hover:text-warning/80 hover:bg-warning/10 transition-colors"
        title="Why is recovery active?"
      >
        <HelpCircle className="w-3 h-3" />
        Why?
      </button>

      {isOpen && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 mt-2 w-60 bg-panel border border-warning/30 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] p-3 text-left">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-card-border">
            <Sparkles className="w-3.5 h-3.5 text-warning" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-primary">Decision Reasoning</span>
          </div>
          
          <ul className="space-y-1.5 mb-3">
             <li className="text-xs text-text-secondary flex gap-1.5 leading-snug">
                <span className="text-text-muted mt-0.5">•</span>
                Multiple deadlines were missed, triggering the autonomous recovery engine.
             </li>
             <li className="text-xs text-text-secondary flex gap-1.5 leading-snug">
                <span className="text-text-muted mt-0.5">•</span>
                Low-priority tasks were deferred to protect your hard deadlines.
             </li>
             <li className="text-xs text-text-secondary flex gap-1.5 leading-snug">
                <span className="text-text-muted mt-0.5">•</span>
                Your execution schedule has been optimized to fit realistic daily capacity.
             </li>
          </ul>
          
          <div className="flex justify-between items-center bg-background/50 rounded p-1.5 border border-warning/20">
            <span className="text-[9px] uppercase tracking-wider text-text-muted font-bold">Execution Confidence</span>
            <span className={`text-[10px] font-mono font-bold ${confidence >= 80 ? 'text-accent' : confidence >= 50 ? 'text-warning' : 'text-danger'}`}>
              {confidence}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
