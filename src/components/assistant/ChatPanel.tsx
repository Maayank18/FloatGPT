import React, { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Send, Loader2 } from 'lucide-react';
import { AppState, Message } from '../../types';
import { generateWorkspaceSummary } from '../../lib/summary';
import { ReflectionService } from '../../lib/reflection';

import { ExplainabilityService } from '../../lib/explainability';
import { getGlobalSortedTasks } from '../../lib/time';

export function ChatPanel({ state, setState, generateId }: { state: AppState, setState: any, generateId: any }) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const viewingSessionId = state.viewingSessionId || null;

  const activeMessages = viewingSessionId 
    ? state.pastSessions?.find(s => s.id === viewingSessionId)?.messages || []
    : state.messages || [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages, isTyping]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const currentInput = input;
    const userMsg: Message = { id: generateId(), role: 'user', content: currentInput, timestamp: Date.now() };
    setState((prev: AppState) => ({ ...prev, messages: [...prev.messages, userMsg] }));
    setInput('');
    setIsTyping(true);

    const summaryRegex = /remaining (task|work)|any task(s)? left|what.*pending|what.*remain(s)?|what.*still do|what.*left/i;
    if (summaryRegex.test(currentInput)) {
       const summaryMsg = generateWorkspaceSummary(state);
       setState((prev: AppState) => {
         const aiMsg: Message = { id: generateId(), role: 'assistant', content: summaryMsg, timestamp: Date.now() };
         return { ...prev, messages: [...prev.messages, aiMsg] };
       });
       setIsTyping(false);
       return;
    }

    const explainRegex = /why this(\?)?$|why is this first(\?)?$|why should i do this(\?)?$|explain (this|my current focus)(\?)?/i;
    if (explainRegex.test(currentInput)) {
       const allIncomplete = (state.tasks || []).filter(t => t.status !== 'Completed' && t.status !== 'Archived');
       const sorted = getGlobalSortedTasks(allIncomplete, Date.now());
       const topTask = sorted[0];
       
       let explainMsg = "I couldn't find an active task to explain.";
       if (topTask) {
          const explanation = ExplainabilityService.explainTask(topTask, state, 'Focus');
          explainMsg = `**${topTask.title}** is currently your top priority because:\n\n` +
             explanation.reasons.map(r => `• ${r}`).join('\n') +
             `\n\n*Execution Confidence: ${explanation.confidencePercent}%*`;
       }

       setState((prev: AppState) => {
         const aiMsg: Message = { id: generateId(), role: 'assistant', content: explainMsg, timestamp: Date.now() };
         return { ...prev, messages: [...prev.messages, aiMsg] };
       });
       setIsTyping(false);
       return;
    }

    try {
      const res = await fetch('/api/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentInput, state })
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      // Check for updates to plan
      if (
        (data.newTasks?.length > 0) ||
        (data.newGoals?.length > 0) ||
        (data.newProjects?.length > 0) ||
        (data.newRisks?.length > 0) ||
        (data.updatedTasks?.length > 0)
      ) {
        setToastMessage("Added to Plan");
        setTimeout(() => setToastMessage(null), 3000);
      }

      setState((prev: AppState) => {
        const aiMsg: Message = { id: generateId(), role: 'assistant', content: data.message, timestamp: Date.now() };
        
        // Merge updates safely
        let history = [...(prev.history || [])];

        const mergedGoals = (prev.goals || []).map(g => {
          const update = data.newGoals?.find((u: any) => u.id === g.id);
          if (update) {
            const isNewlyCompleted = update.progress === 100 && g.progress !== 100;
            if (isNewlyCompleted) {
              history.push({ id: `hist_g_${g.id}_${Date.now()}`, entityId: g.id, entityType: 'Goal', title: g.title, completedAt: Date.now() });
            }
            return {
              ...g,
              ...update,
              status: update.progress === 100 ? 'Completed' : (update.status || g.status),
              completedAt: isNewlyCompleted ? Date.now() : (update.completedAt || g.completedAt)
            };
          }
          return g;
        });
        const newlyAddedGoals = (data.newGoals || []).filter((ng: any) => !prev.goals?.some(g => g.id === ng.id));
        const updatedGoals = [...mergedGoals, ...newlyAddedGoals];

        const mergedProjects = (prev.projects || []).map(p => {
          const update = data.newProjects?.find((u: any) => u.id === p.id);
          if (update) {
            const isNewlyCompleted = update.progress === 100 && p.progress !== 100;
            if (isNewlyCompleted) {
              history.push({ id: `hist_p_${p.id}_${Date.now()}`, entityId: p.id, entityType: 'Project', title: p.title, completedAt: Date.now() });
            }
            return {
              ...p,
              ...update,
              status: update.progress === 100 ? 'Completed' : (update.status || p.status),
              completedAt: isNewlyCompleted ? Date.now() : (update.completedAt || p.completedAt)
            };
          }
          return p;
        });
        const newlyAddedProjects = (data.newProjects || []).filter((np: any) => !prev.projects?.some(p => p.id === np.id));
        const updatedProjects = [...mergedProjects, ...newlyAddedProjects];

        const mergedTasks = (prev.tasks || []).map(t => {
          const update = data.updatedTasks?.find((u: any) => u.id === t.id);
          const fullUpdate = data.newTasks?.find((u: any) => u.id === t.id);
          const targetUpdate = fullUpdate || update;
          if (targetUpdate) {
             if (targetUpdate.status === 'Completed' && t.status !== 'Completed') {
               history.push({ id: `hist_t_${t.id}_${Date.now()}`, entityId: t.id, entityType: 'Task', title: t.title, completedAt: Date.now() });
             }
             if (fullUpdate) return { ...t, ...fullUpdate };
             if (update) return { ...t, status: update.status };
          }
          return t;
        });
        const newlyAddedTasks = (data.newTasks || []).filter((nt: any) => !prev.tasks?.some(t => t.id === nt.id));
        const updatedTasks = [...mergedTasks, ...newlyAddedTasks];
        const updatedRisks = data.newRisks ? [...(prev.risks || []), ...data.newRisks] : (prev.risks || []);
        const updatedResources = data.newResources ? [...(prev.resources || []), ...data.newResources] : (prev.resources || []);
        const updatedRecommendations = data.newRecommendations ? [...(prev.recommendations || []), ...data.newRecommendations] : (prev.recommendations || []);

        const newHabitProfile = data.habitProfileUpdate 
          ? { ...prev.habitProfile, ...data.habitProfileUpdate }
          : prev.habitProfile;

        const newFocusModeState = data.focusModeUpdate
          ? { ...prev.focusModeState, ...data.focusModeUpdate }
          : prev.focusModeState;

        let nextState = {
          ...prev,
          messages: [...prev.messages, aiMsg],
          history,
          goals: updatedGoals,
          projects: updatedProjects,
          tasks: updatedTasks,
          risks: updatedRisks,
          resources: updatedResources,
          recommendations: updatedRecommendations,
          habitProfile: newHabitProfile,
          focusModeState: newFocusModeState
        };

        if (newlyAddedTasks.length > 0) {
          for (let i = 0; i < newlyAddedTasks.length; i++) {
             nextState = ReflectionService.onTaskCreated(nextState);
          }
        }

        // check for postponed tasks
        for (const fullUpdate of (data.newTasks || [])) {
           const oldTask = (prev.tasks || []).find(t => t.id === fullUpdate.id);
           if (oldTask && oldTask.deadlineAt && fullUpdate.deadlineAt && fullUpdate.deadlineAt > oldTask.deadlineAt) {
              nextState = ReflectionService.onTaskPostponed(nextState, oldTask);
           }
        }

        return nextState;
      });

    } catch (err) {
      console.error(err);
      setState((prev: AppState) => ({
        ...prev,
        messages: [...prev.messages, { id: generateId(), role: 'assistant', content: 'System error: Could not process request.', timestamp: Date.now() }]
      }));
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4" ref={scrollRef}>
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-accent/20 border border-accent/50 text-accent px-3 py-1.5 rounded-full text-[10px] font-medium uppercase tracking-widest shadow-lg shadow-accent/10 backdrop-blur-sm transition-all animate-in fade-in slide-in-from-top-2">
            {toastMessage}
          </div>
        )}

        {/* Initial empty state message */}
        {(!activeMessages || activeMessages.length === 0) && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-card border border-card-border flex items-center justify-center shrink-0">
              <BrainCircuit className="w-3.5 h-3.5 text-accent" />
            </div>
            <div className="bg-panel border border-card-border rounded-xl rounded-tl-none p-3 text-xs text-text-muted leading-relaxed">
              {viewingSessionId ? 'No messages in this session.' : 'I am your floating companion. I stay right here while you work. What should we focus on?'}
            </div>
          </div>
        )}

        {(activeMessages || []).map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-card border border-card-border flex items-center justify-center shrink-0">
                <BrainCircuit className="w-3.5 h-3.5 text-accent" />
              </div>
            )}
            <div className={`p-3 text-xs leading-relaxed max-w-[85%] whitespace-pre-wrap ${
              msg.role === 'user' 
                ? 'bg-accent text-white rounded-xl rounded-tr-none' 
                : 'bg-panel border border-card-border text-text-muted rounded-xl rounded-tl-none'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-card border border-card-border flex items-center justify-center shrink-0">
              <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
            </div>
          </div>
        )}
      </div>
      
      <div className="p-3 border-t border-card-border bg-bg-secondary">
        <form onSubmit={handleSend} className="flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isTyping || viewingSessionId !== null}
            placeholder={viewingSessionId ? "History is read-only" : "Message Float..."}
            className="flex-1 bg-card border border-card-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder-text-secondary disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={isTyping || !input.trim() || viewingSessionId !== null}
            className="bg-card-border border border-card-border hover:bg-accent hover:text-white hover:border-accent text-text-muted rounded-lg px-3 py-2 transition-colors flex items-center justify-center disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
