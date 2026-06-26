import React from 'react';
import { AppState } from '../../types';
import { CalendarClock, ArrowRight } from 'lucide-react';

export function HistoryPanel({ state, setState, setActiveTab }: { state: AppState, setState: any, setActiveTab: (tab: string) => void }) {
  const getLabel = (dateNum: number) => {
    const diff = Math.floor((Date.now() - dateNum) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return `${diff} Days Ago`;
  };

  const handleOpenSession = (sessionId: string | null) => {
    setState((prev: AppState) => ({ ...prev, viewingSessionId: sessionId }));
    setActiveTab('home');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
        <CalendarClock className="w-3.5 h-3.5" /> Session History
      </h3>

      <div className="space-y-2">
        <button
          onClick={() => handleOpenSession(null)}
          className={`w-full text-left p-3 rounded-xl border transition-colors flex items-center justify-between ${
            !state.viewingSessionId
              ? 'bg-accent/10 border-accent/30 text-text-primary'
              : 'bg-card border-card-border hover:border-accent/50 text-text-secondary hover:text-text-primary'
          }`}
        >
          <div>
            <div className="text-xs font-semibold">Current Session</div>
            <div className="text-[10px] text-text-muted mt-0.5">Active Workspace</div>
          </div>
          {!state.viewingSessionId && <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Active</span>}
        </button>

        {(state.pastSessions || []).map(session => (
          <button
            key={session.id}
            onClick={() => handleOpenSession(session.id)}
            className={`w-full text-left p-3 rounded-xl border transition-colors flex items-center justify-between ${
              state.viewingSessionId === session.id
                ? 'bg-accent/10 border-accent/30 text-text-primary'
                : 'bg-card border-card-border hover:border-accent/50 text-text-secondary hover:text-text-primary'
            }`}
          >
            <div>
              <div className="text-xs font-semibold">{getLabel(session.date)}</div>
              <div className="text-[10px] text-text-muted mt-0.5">
                {session.tasks.length} tasks • {session.messages.length} messages
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted opacity-50" />
          </button>
        ))}
        
        {(!state.pastSessions || state.pastSessions.length === 0) && (
          <div className="text-center py-8 border border-dashed border-card-border rounded-lg bg-bg-secondary">
            <p className="text-[11px] font-medium text-text-secondary mb-1">No past sessions</p>
            <p className="text-[10px] text-text-muted px-4">Your history will appear here after a daily rollover.</p>
          </div>
        )}
      </div>
    </div>
  );
}
