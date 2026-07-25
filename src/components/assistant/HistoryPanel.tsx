import React, { useState } from 'react';
import { AppState } from '../../types';
import { CalendarClock, ArrowRight, LayoutList, MessageSquare, Trash2 } from 'lucide-react';

export function HistoryPanel({ state, setState, setActiveTab }: { state: AppState, setState: any, setActiveTab: (tab: string) => void }) {
  const [historyMode, setHistoryMode] = useState<'plan' | 'chat'>('plan');

  const getLabel = (dateNum: number) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(dateNum));
  };

  const handleOpenSession = (sessionId: string | null) => {
    setState((prev: AppState) => ({ ...prev, viewingSessionId: sessionId }));
    setActiveTab(historyMode === 'plan' ? 'home' : 'chat');
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this past session?')) return;
    setState((prev: AppState) => {
      const newPastSessions = (prev.pastSessions || []).filter(s => s.id !== sessionId);
      import('../../lib/firebase').then(({ db, doc, setDoc, auth }) => {
        if (auth.currentUser) {
          setDoc(doc(db, 'users', auth.currentUser.uid), { pastSessions: newPastSessions }, { merge: true });
        }
      });
      return { 
        ...prev, 
        pastSessions: newPastSessions, 
        viewingSessionId: prev.viewingSessionId === sessionId ? null : prev.viewingSessionId 
      };
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
        <CalendarClock className="w-3.5 h-3.5" /> Session History
      </h3>

      <div className="flex bg-panel p-1 rounded-lg border border-card-border mb-4">
        <button
          onClick={() => setHistoryMode('plan')}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
            historyMode === 'plan' ? 'bg-card text-accent shadow-sm border border-card-border' : 'text-text-secondary hover:text-text-primary border border-transparent'
          }`}
        >
          <LayoutList className="w-3.5 h-3.5" /> Plan History
        </button>
        <button
          onClick={() => setHistoryMode('chat')}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
            historyMode === 'chat' ? 'bg-card text-accent shadow-sm border border-card-border' : 'text-text-secondary hover:text-text-primary border border-transparent'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Chat History
        </button>
      </div>

      <div className="space-y-2">
        <div className="relative group">
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!confirm('Are you sure you want to clear your active session? This will delete all current tasks, goals, and chat history.')) return;
              setState((prev: AppState) => {
                const clearedState = { 
                  ...prev, 
                  goals: [], 
                  tasks: [], 
                  projects: [], 
                  messages: [], 
                  playgroundMessages: [] 
                };
                import('../../lib/firebase').then(({ db, doc, setDoc, auth }) => {
                  if (auth.currentUser) {
                    setDoc(doc(db, 'users', auth.currentUser.uid), { goals: [], tasks: [], projects: [], messages: [], playgroundMessages: [] }, { merge: true });
                  }
                });
                return clearedState;
              });
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all bg-card shadow-sm z-10"
            title="Clear Active Session"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {(state.pastSessions || []).map(session => (
          <div key={session.id} className="relative group">
            <button
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
            <button
              onClick={(e) => handleDeleteSession(e, session.id)}
              className="absolute right-12 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all bg-card shadow-sm"
              title="Delete session"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
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
