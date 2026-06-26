import React, { useState, useEffect } from 'react';
import { useFloating, autoUpdate, offset, flip, shift, useClick, useDismiss, useRole, useInteractions, FloatingPortal } from '@floating-ui/react';
import { ExplainabilityService, Explanation } from '../../lib/explainability';
import { Task, AppState } from '../../types';
import { HelpCircle, Sparkles, X } from 'lucide-react';

interface ExplainPopoverProps {
  task: Task;
  state: AppState;
  context: 'TimeCritical' | 'Strategic' | 'Queue' | 'Focus';
}

export const ExplainPopover: React.FC<ExplainPopoverProps> = ({ task, state, context }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [boundaryEl, setBoundaryEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setBoundaryEl(document.getElementById('floatgpt-panel'));
  }, []);

  const { refs, floatingStyles, context: floatingContext } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      setIsOpen(open);
      if (open && !explanation) {
        setExplanation(ExplainabilityService.explainTask(task, state, context));
      }
    },
    middleware: [
      offset(6),
      flip({ fallbackAxisSideDirection: 'end', padding: 8, boundary: boundaryEl || undefined }),
      shift({ padding: 8, boundary: boundaryEl || undefined })
    ],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(floatingContext);
  const dismiss = useDismiss(floatingContext);
  const role = useRole(floatingContext);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ]);

  return (
    <>
      <button 
        ref={refs.setReference}
        {...getReferenceProps({
          onClick(e) {
            e.stopPropagation();
          }
        })}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider text-text-muted hover:text-text-primary hover:bg-panel-hover transition-colors"
        title="Why this task?"
      >
        <HelpCircle className="w-3 h-3" />
        Why?
      </button>

      {isOpen && explanation && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps({
              onClick(e) {
                e.stopPropagation();
              }
            })}
            className="z-[10000] w-[280px] max-w-[90vw] bg-panel border border-card-border rounded-xl shadow-lg p-3 text-left"
          >
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-card-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-primary">Decision Reasoning</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <ul className="space-y-1.5 mb-3">
              {explanation.reasons.map((reason, idx) => (
                <li key={idx} className="text-xs text-text-secondary flex gap-1.5 leading-snug">
                  <span className="text-text-muted mt-0.5">•</span>
                  {reason}
                </li>
              ))}
            </ul>
            
            {explanation.confidencePercent !== undefined && (
              <div className="flex justify-between items-center bg-background/50 rounded p-1.5">
                <span className="text-[9px] uppercase tracking-wider text-text-muted font-bold">Execution Confidence</span>
                <span className={`text-[10px] font-mono font-bold ${explanation.confidencePercent >= 80 ? 'text-accent' : explanation.confidencePercent >= 50 ? 'text-warning' : 'text-danger'}`}>
                  {explanation.confidencePercent}%
                </span>
              </div>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
};
