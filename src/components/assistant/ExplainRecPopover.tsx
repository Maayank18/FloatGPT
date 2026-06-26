import React, { useState } from 'react';
import { ExplainabilityService, Explanation } from '../../lib/explainability';
import { Recommendation, AppState } from '../../types';
import { HelpCircle, Sparkles } from 'lucide-react';

interface ExplainRecPopoverProps {
  recommendation: Recommendation;
  state: AppState;
}

export const ExplainRecPopover: React.FC<ExplainRecPopoverProps> = ({ recommendation, state }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      setExplanation(ExplainabilityService.explainRecommendation(recommendation, state));
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative inline-block" onClick={e => e.stopPropagation()}>
      <button 
        onClick={toggleOpen}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider text-text-muted hover:text-text-primary hover:bg-panel-hover transition-colors"
        title="Why this recommendation?"
      >
        <HelpCircle className="w-3 h-3" />
        Why?
      </button>

      {isOpen && explanation && (
        <div className="absolute z-50 left-0 mt-2 w-64 bg-panel border border-card-border rounded-xl shadow-lg p-3 text-left">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-card-border">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-primary">Decision Reasoning</span>
          </div>
          
          <ul className="space-y-1.5 mb-3">
            {explanation.reasons.map((reason, idx) => (
              <li key={idx} className="text-xs text-text-secondary flex gap-1.5 leading-snug">
                <span className="text-text-muted mt-0.5">•</span>
                {reason}
              </li>
            ))}
          </ul>
          
          <div className="flex justify-between items-center bg-background/50 rounded p-1.5">
            <span className="text-[9px] uppercase tracking-wider text-text-muted font-bold">Execution Confidence</span>
            <span className={`text-[10px] font-mono font-bold ${explanation.confidencePercent >= 80 ? 'text-accent' : explanation.confidencePercent >= 50 ? 'text-warning' : 'text-danger'}`}>
              {explanation.confidencePercent}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
