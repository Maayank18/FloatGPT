import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Play, X } from 'lucide-react';
import { FloatWait } from './FloatWait';

interface SecurityPromptCardProps {
  category: string;
  reason: string;
  script: string;
  onExecuted?: (output: string, success: boolean) => void;
}

export const SecurityPromptCard: React.FC<SecurityPromptCardProps> = ({
  category,
  reason,
  script,
  onExecuted
}) => {
  const [status, setStatus] = useState<'pending' | 'running' | 'executed' | 'cancelled'>('pending');
  const [note, setNote] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      setNote('That didn’t go through.');
      setStatus('executed');
      return;
    }

    setStatus('running');
    try {
      const res = await (window as any).electronAPI.flow.executeScript(script);
      setStatus('executed');
      setNote(res.success ? 'Done. Take a look.' : 'That didn’t go through.');
      if (onExecuted) onExecuted(res.output, res.success);
    } catch (err: any) {
      setStatus('executed');
      setNote('That didn’t go through.');
      if (onExecuted) onExecuted(err.message, false);
    }
  };

  const handleCancel = () => {
    setStatus('cancelled');
    setNote('Left it alone.');
  };

  const isSecurityViolation = note === 'I left that alone.';

  return (
    <div className={`mt-3 mb-2 rounded-xl border p-4 transition-all duration-300 ${
      isSecurityViolation
        ? 'bg-rose-950/30 border-rose-500/50 shadow-lg shadow-rose-500/10'
        : status === 'executed' 
        ? 'bg-panel border-card-border' 
        : status === 'cancelled'
        ? 'bg-panel/40 border-card-border/40 opacity-70'
        : 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-500/5'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          {isSecurityViolation ? (
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
          ) : status === 'executed' ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : status === 'cancelled' ? (
            <X className="w-4 h-4 text-text-muted shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          )}
          <span className="text-[12px] font-semibold text-text-primary">
            {isSecurityViolation
              ? 'Security Firewall — Action Blocked'
              : status === 'executed' 
              ? 'Action Completed' 
              : status === 'cancelled' 
              ? 'Action Cancelled' 
              : 'Security Firewall — Confirmation Required'}
          </span>
        </div>
        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
          isSecurityViolation
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
        }`}>
          {category}
        </span>
      </div>

      {/* Description */}
      <p className="text-[11px] text-text-secondary mb-3 leading-relaxed">
        {reason}
      </p>

      {/* Actions */}
      {status === 'pending' && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-bg font-medium rounded-lg text-[12px] flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Confirm & Execute
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="py-1.5 px-3 bg-panel hover:bg-card-border text-text-muted hover:text-text-primary font-medium rounded-lg text-[12px] border border-card-border flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Deny
          </button>
        </div>
      )}

      {status === 'running' && (
        <div className="flex items-center py-2">
          <FloatWait />
        </div>
      )}

      {note && status !== 'running' && (
        <p className="mt-2 text-[12px] text-text-primary">{note}</p>
      )}
    </div>
  );
};
