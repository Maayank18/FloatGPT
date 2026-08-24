import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, Terminal, Play, X, Copy, Check, Loader2 } from 'lucide-react';

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
  const [output, setOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = async () => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      setOutput('Cannot execute: Not running inside desktop Electron runtime.');
      setStatus('executed');
      return;
    }

    setStatus('running');
    try {
      const res = await (window as any).electronAPI.flow.executeScript(script);
      setStatus('executed');
      setOutput(res.output || (res.success ? 'Command executed with no output.' : 'Execution returned an empty error.'));
      if (onExecuted) onExecuted(res.output, res.success);
    } catch (err: any) {
      setStatus('executed');
      setOutput(err.message || 'Execution failed.');
      if (onExecuted) onExecuted(err.message, false);
    }
  };

  const handleCancel = () => {
    setStatus('cancelled');
    setOutput('Execution cancelled by user.');
  };

  const isSecurityViolation = output?.includes('SECURITY VIOLATION') || output?.includes('blocked by FloatGPT');

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

      {/* Script Code Box */}
      <div className="relative rounded-lg bg-black/40 border border-card-border p-2.5 mb-3 font-mono text-[11px] text-emerald-300 break-all select-all flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 overflow-x-auto">
          <Terminal className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />
          <code>{script}</code>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 p-1 hover:bg-card-border/40 rounded text-text-muted hover:text-text-primary transition-colors"
          title="Copy command"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Actions / Output */}
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
        <div className="flex items-center justify-center gap-2 py-2 text-[12px] text-amber-300 font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          Executing PowerShell script securely...
        </div>
      )}

      {output && status !== 'running' && (
        <div className="mt-2 pt-2 border-t border-card-border/40">
          <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mb-1">
            Terminal Output:
          </span>
          <pre className="p-2 rounded bg-black/60 border border-card-border text-[11px] font-mono text-text-muted max-h-32 overflow-y-auto whitespace-pre-wrap">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
};
