import React, { useState } from 'react';
import { AppState } from '../../types';
import { CalendarClock, ArrowRight, LayoutList, MessageSquare, Trash2, Calendar, Clock } from 'lucide-react';

export function HistoryPanel({ state, setState, setActiveTab }: { state: AppState, setState: any, setActiveTab: (tab: string) => void }) {
  const [historyMode, setHistoryMode] = useState<'plan' | 'chat'>('plan');

  const getLabel = (rawDate: any, fallbackTitle?: string) => {
    if (!rawDate && !fallbackTitle) return 'Past Session';
    if (!rawDate) return fallbackTitle!;

    const timestamp = typeof rawDate === 'string' && !isNaN(Number(rawDate)) ? Number(rawDate) : rawDate;
    const d = new Date(timestamp);

    if (isNaN(d.getTime())) {
      return fallbackTitle || 'Past Session';
    }

    try {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(d);
    } catch {
      return fallbackTitle || 'Past Session';
    }
  };

  const getSmartTitle = (session: any) => {
    // If explicit custom title was saved and isn't a raw date string
    if (session.title && !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3}\s+\d+/i.test(session.title)) {
      return session.title;
    }
    // Try to extract first user message
    const msgs = session.messages || (session as any).playgroundMessages || [];
    const firstUserMsg = msgs.find((m: any) => m.role === 'user' || m.sender === 'user');
    if (firstUserMsg && (firstUserMsg.content || firstUserMsg.text)) {
      const text = (firstUserMsg.content || firstUserMsg.text).trim().replace(/^[\r\n\s]+/, '');
      return text.length > 40 ? text.slice(0, 40) + '...' : text;
    }
    // Try first goal or task
    if (session.goals && session.goals.length > 0 && session.goals[0].title) {
      return session.goals[0].title;
    }
    if (session.tasks && session.tasks.length > 0 && session.tasks[0].title) {
      return session.tasks[0].title;
    }
    return getLabel(session.date || (session as any).createdAt, 'Chat Session');
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

  const handleClearAllHistory = () => {
    if (!confirm('Are you sure you want to delete ALL past session history?')) return;
    setState((prev: AppState) => {
      import('../../lib/firebase').then(({ db, doc, setDoc, auth }) => {
        if (auth.currentUser) {
          setDoc(doc(db, 'users', auth.currentUser.uid), { pastSessions: [] }, { merge: true });
        }
      });
      return { ...prev, pastSessions: [], viewingSessionId: null };
    });
  };

  const validPastSessions = (state.pastSessions || []).filter(session => {
    const taskCount = Array.isArray(session.tasks) ? session.tasks.length : 0;
    const messageCount = Array.isArray(session.messages) 
      ? session.messages.length 
      : (Array.isArray((session as any).playgroundMessages) ? (session as any).playgroundMessages.length : 0);
    return taskCount > 0 || messageCount > 0;
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
          <CalendarClock className="w-3.5 h-3.5" /> Session History
        </h3>
        {(state.pastSessions || []).length > 0 && (
          <button
            onClick={handleClearAllHistory}
            className="text-[10px] font-semibold text-danger hover:text-red-300 flex items-center gap-1 px-2 py-0.5 rounded bg-danger/10 hover:bg-danger/20 transition-all"
            title="Clear all saved history"
          >
            <Trash2 className="w-3 h-3" /> Clear All History
          </button>
        )}
      </div>

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
        {/* Active Session Card */}
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
              <div className="text-xs font-semibold">Current Active Session</div>
              <div className="text-[10px] text-text-muted mt-0.5">Live workspace and continuous chat</div>
            </div>
            {!state.viewingSessionId && <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Active</span>}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!confirm('Are you sure you want to clear your current active chat?')) return;
              setState((prev: AppState) => {
                const clearedState = { 
                  ...prev, 
                  messages: [], 
                  playgroundMessages: []
                };
                import('../../lib/firebase').then(({ db, doc, setDoc, auth }) => {
                  if (auth.currentUser) {
                    setDoc(doc(db, 'users', auth.currentUser.uid), { messages: [], playgroundMessages: [] }, { merge: true });
                  }
                });
                return clearedState;
              });
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all bg-card shadow-sm z-10"
            title="Clear Active Chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Past Sessions List */}
        {validPastSessions.map((session, idx) => {
          const sessionDate = session.date || (session as any).updatedAt || (session as any).createdAt;
          const sessionTitle = getSmartTitle(session);
          const taskCount = Array.isArray(session.tasks) ? session.tasks.length : 0;
          const messageCount = Array.isArray(session.messages) 
            ? session.messages.length 
            : (Array.isArray((session as any).playgroundMessages) ? (session as any).playgroundMessages.length : 0);

          return (
            <div key={session.id || idx} className="relative group">
              <button
                onClick={() => handleOpenSession(session.id)}
                className={`w-full text-left p-3 rounded-xl border transition-colors flex items-center justify-between ${
                  state.viewingSessionId === session.id
                    ? 'bg-accent/10 border-accent/30 text-text-primary'
                    : 'bg-card border-card-border hover:border-accent/50 text-text-secondary hover:text-text-primary'
                }`}
              >
                <div className="min-w-0 pr-8">
                  <div className="text-xs font-semibold truncate text-text-primary">{sessionTitle}</div>
                  <div className="text-[10px] text-text-muted mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-text-muted" />
                    <span>{getLabel(sessionDate, 'Saved Session')}</span>
                    <span>•</span>
                    <span>{taskCount} tasks</span>
                    <span>•</span>
                    <span>{messageCount} messages</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted opacity-50 shrink-0" />
              </button>
              <button
                onClick={(e) => handleDeleteSession(e, session.id)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all bg-card shadow-sm z-10"
                title="Delete session"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
        
        {validPastSessions.length === 0 && (
          <div className="text-center py-8 border border-dashed border-card-border rounded-lg bg-bg-secondary">
            <p className="text-[11px] font-medium text-text-secondary mb-1">No past sessions yet</p>
            <p className="text-[10px] text-text-muted px-4">Archived chat sessions and plans will appear here when you start a new chat.</p>
          </div>
        )}
      </div>
    </div>
  );
}
