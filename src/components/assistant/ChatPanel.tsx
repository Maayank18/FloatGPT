import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BrainCircuit, Send, Loader2, Globe, Paperclip, X, Image as ImageIcon, Mic, MicOff, Camera, Plus } from 'lucide-react';
import { AppState, Message, Attachment } from '../../types';
import { generateWorkspaceSummary } from '../../lib/summary';
import { ReflectionService } from '../../lib/reflection';
import { generateAIResponse } from '../../lib/ai';

import { ExplainabilityService } from '../../lib/explainability';
import { getGlobalSortedTasks } from '../../lib/time';

const Toggle = React.memo(({ active, onClick }: { active: boolean, onClick: () => void }) => (
  <button 
    type="button"
    onClick={onClick}
    className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0 ${active ? 'bg-accent' : 'bg-card-border hover:bg-text-muted/30'}`}
    aria-pressed={active}
  >
    <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${active ? 'translate-x-[18px]' : 'translate-x-[2px]'}`}></div>
  </button>
));
Toggle.displayName = 'Toggle';

export function ChatPanel({ state, setState, generateId }: { state: AppState, setState: any, generateId: any }) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [draftContext, setDraftContext] = useState(state.settings.aiConfig.customChatContext || '');
  const [isContextSaved, setIsContextSaved] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const isElectronEnv = typeof window !== 'undefined' && !!window.electronAPI;

  // Close menu if clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.chat-input-menu-container')) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // ─── Feature 2: Web Speech API (Voice-to-Text) ──────────────
  const hasSpeechRecognition = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const toggleVoiceInput = useCallback(() => {
    if (!hasSpeechRecognition) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      setInput(prev => {
        // Replace any previous interim with the latest
        const base = finalTranscript || prev;
        return (base + interim).trim();
      });
    };

    recognition.onerror = (event: any) => {
      console.error('[FloatGPT] Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscript.trim()) {
        setInput(finalTranscript.trim());
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, hasSpeechRecognition]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    };
  }, []);

  // ─── Feature 4: Desktop Screenshot ──────────────────────────
  const handleScreenshot = useCallback(async () => {
    if (!isElectronEnv || !window.electronAPI?.captureScreenshot) return;
    setIsCapturing(true);
    try {
      const dataUrl = await window.electronAPI.captureScreenshot();
      if (dataUrl) {
        setAttachments(prev => [...prev, {
          name: `screenshot-${Date.now()}.png`,
          mimeType: 'image/png',
          data: dataUrl,
        }]);
      }
    } catch (err) {
      console.error('[FloatGPT] Screenshot failed:', err);
    } finally {
      setIsCapturing(false);
    }
  }, [isElectronEnv]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAttachments(prev => [...prev, {
            name: file.name,
            mimeType: file.type,
            data: event.target!.result as string
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const viewingSessionId = state.viewingSessionId || null;

  const activeMessages = viewingSessionId 
    ? state.pastSessions?.find(s => s.id === viewingSessionId)?.messages || []
    : state.messages || [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages, isTyping]);

  const updateAiSetting = (key: keyof typeof state.settings.aiConfig, value: any) => {
    setState((prev: AppState) => ({
      ...prev,
      settings: {
        ...prev.settings,
        aiConfig: {
          ...prev.settings.aiConfig,
          [key]: value
        }
      }
    }));
  };

  const handleSaveContext = () => {
    updateAiSetting('customChatContext', draftContext);
    setIsContextSaved(true);
    setTimeout(() => setIsContextSaved(false), 2000);
  };

  const isPlanMode = state.settings.aiConfig.isPlanMode !== false;

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const currentInput = input;
    const currentAttachments = attachments.length > 0 ? [...attachments] : undefined;
    const userMsg: Message = { id: generateId(), role: 'user', content: currentInput, timestamp: Date.now(), attachments: currentAttachments, usedWebSearch: useWebSearch };
    setState((prev: AppState) => ({ ...prev, messages: [...prev.messages, userMsg] }));
    setInput('');
    setAttachments([]);
    setIsTyping(true);


    try {
      const data = await generateAIResponse(state, currentInput, currentAttachments, useWebSearch);

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
            const updatedCompletedAt = update.completedAt ? (typeof update.completedAt === 'string' ? new Date(update.completedAt).getTime() : update.completedAt) : p.completedAt;
            if (isNewlyCompleted) {
              history.push({ id: `hist_p_${p.id}_${Date.now()}`, entityId: p.id, entityType: 'Project', title: p.title, completedAt: Date.now() });
            }
            return {
              ...p,
              ...update,
              status: update.progress === 100 ? 'Completed' : (update.status || p.status),
              completedAt: isNewlyCompleted ? Date.now() : updatedCompletedAt
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
             if (fullUpdate) {
               const parsedCreatedAt = fullUpdate.createdAt ? (typeof fullUpdate.createdAt === 'string' ? new Date(fullUpdate.createdAt).getTime() : fullUpdate.createdAt) : t.createdAt;
               const parsedDeadlineAt = fullUpdate.deadlineAt ? (typeof fullUpdate.deadlineAt === 'string' ? new Date(fullUpdate.deadlineAt).getTime() : fullUpdate.deadlineAt) : t.deadlineAt;
               return { ...t, ...fullUpdate, createdAt: parsedCreatedAt, deadlineAt: parsedDeadlineAt };
             }
             if (update) return { ...t, status: update.status };
          }
          return t;
        });
        const newlyAddedTasks = (data.newTasks || []).filter((nt: any) => !prev.tasks?.some(t => t.id === nt.id)).map((nt: any) => ({
          ...nt,
          createdAt: nt.createdAt ? (typeof nt.createdAt === 'string' ? new Date(nt.createdAt).getTime() : nt.createdAt) : Date.now(),
          deadlineAt: nt.deadlineAt ? (typeof nt.deadlineAt === 'string' ? new Date(nt.deadlineAt).getTime() : nt.deadlineAt) : undefined
        }));
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

    } catch (err: any) {
      console.error(err);
      setState((prev: AppState) => ({
        ...prev,
        messages: [...prev.messages, { id: generateId(), role: 'assistant', content: `System error: ${err.message || 'Could not process request.'}`, timestamp: Date.now() }]
      }));
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Plan Mode Header */}
      {!viewingSessionId && (
        <div className="shrink-0 px-4 py-3 border-b border-card-border bg-bg-secondary flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-text-primary">Plan Mode</span>
               <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-card-border/50 bg-panel text-text-muted">
                 {isPlanMode ? 'Execution Agent' : 'Conversational Chat'}
               </span>
            </div>
            <Toggle active={isPlanMode} onClick={() => updateAiSetting('isPlanMode', !isPlanMode)} />
          </div>
          {!isPlanMode && (
             <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2 fade-in duration-200">
               <div className="flex items-center justify-between">
                 <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                   <BrainCircuit className="w-3 h-3 text-amber-500" />
                   Custom Context
                 </label>
                 <button 
                   onClick={handleSaveContext}
                   className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors"
                 >
                   {isContextSaved ? 'Saved!' : 'Save'}
                 </button>
               </div>
               <textarea 
                  value={draftContext}
                  onChange={(e) => setDraftContext(e.target.value)}
                  placeholder="Act as a helpful general assistant..."
                  className="w-full bg-card border border-amber-500/20 rounded-lg px-2.5 py-1.5 text-[11px] text-text-primary focus:outline-none focus:border-amber-500/50 resize-none hide-scrollbar placeholder-text-muted/50"
                  rows={2}
               />
             </div>
          )}
        </div>
      )}

      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4" ref={scrollRef}>
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-accent/20 border border-accent/50 text-accent px-3 py-1.5 rounded-full text-[10px] font-medium uppercase tracking-widest shadow-lg shadow-accent/10 backdrop-blur-sm transition-all animate-in fade-in slide-in-from-top-2">
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
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {msg.attachments.map((att, i) => (
                    <div key={i} className="w-16 h-16 rounded overflow-hidden border border-white/20 bg-black/10 flex items-center justify-center">
                       {att.mimeType.startsWith('image/') ? (
                         <img src={att.data} alt="attachment" className="w-full h-full object-cover" />
                       ) : (
                         <Paperclip className="w-6 h-6 opacity-50" />
                       )}
                    </div>
                  ))}
                </div>
              )}
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
      
      
      <div className="flex flex-col bg-bg-secondary border-t border-card-border">
        {attachments.length > 0 && (
          <div className="px-3 py-2 border-b border-card-border/50 flex gap-2 overflow-x-auto">
            {attachments.map((att, i) => (
              <div key={i} className="relative w-12 h-12 rounded-lg bg-card border border-card-border flex items-center justify-center shrink-0 overflow-hidden group">
                {att.mimeType.startsWith('image/') ? (
                  <img src={att.data} alt={att.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <Paperclip className="w-4 h-4 text-text-muted" />
                    <span className="text-[8px] text-text-muted truncate w-full text-center px-1">{att.name}</span>
                  </div>
                )}
                <button 
                  type="button" 
                  onClick={() => removeAttachment(i)}
                  className="absolute top-0 right-0 bg-danger/80 text-white p-0.5 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="p-3">
          <form onSubmit={handleSend} className="flex gap-2">
            <input 
              type="file" 
              multiple 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*,application/pdf,text/plain"
            />
            {/* Tools Menu */}
            <div className="relative chat-input-menu-container flex items-center">
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                disabled={isTyping || viewingSessionId !== null}
                className={`p-2 shrink-0 transition-colors border rounded-lg disabled:opacity-50 ${isMenuOpen ? 'bg-card border-text-muted text-text-primary' : 'bg-card border-card-border text-text-muted hover:text-text-primary'}`}
                title="More options"
              >
                <Plus className={`w-4 h-4 transition-transform ${isMenuOpen ? 'rotate-45' : ''}`} />
              </button>
              
              {isMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 bg-card border border-card-border rounded-lg shadow-xl shadow-black/50 p-2 flex gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
                  <button 
                    type="button"
                    onClick={() => { fileInputRef.current?.click(); setIsMenuOpen(false); }}
                    disabled={isTyping || viewingSessionId !== null}
                    className="p-2 text-text-muted hover:bg-card-border hover:text-text-primary transition-colors rounded-lg flex items-center justify-center disabled:opacity-50"
                    title="Attach media/file"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      if (state.settings.aiConfig.selectedProvider !== 'google') {
                        setToastMessage("Web Search requires Google Gemini provider");
                        setTimeout(() => setToastMessage(null), 3000);
                      } else {
                        setUseWebSearch(!useWebSearch);
                      }
                      setIsMenuOpen(false);
                    }}
                    disabled={isTyping || viewingSessionId !== null}
                    className={`p-2 transition-colors rounded-lg flex items-center justify-center disabled:opacity-50 ${useWebSearch ? 'bg-accent/20 text-accent hover:bg-accent/30' : 'text-text-muted hover:bg-card-border hover:text-text-primary'}`}
                    title="Toggle Web Search Grounding"
                  >
                    <Globe className="w-4 h-4" />
                  </button>
                  {hasSpeechRecognition && (
                    <button 
                      type="button"
                      onClick={() => { toggleVoiceInput(); setIsMenuOpen(false); }}
                      disabled={isTyping || viewingSessionId !== null}
                      className={`p-2 transition-colors rounded-lg flex items-center justify-center disabled:opacity-50 ${isListening ? 'bg-danger/20 text-danger hover:bg-danger/30 animate-pulse' : 'text-text-muted hover:bg-card-border hover:text-text-primary'}`}
                      title={isListening ? 'Stop listening' : 'Voice input'}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  )}
                  {isElectronEnv && window.electronAPI?.captureScreenshot && (
                    <button 
                      type="button"
                      onClick={() => { handleScreenshot(); setIsMenuOpen(false); }}
                      disabled={isTyping || isCapturing || viewingSessionId !== null}
                      className={`p-2 transition-colors rounded-lg flex items-center justify-center disabled:opacity-50 ${isCapturing ? 'bg-accent/20 text-accent hover:bg-accent/30 animate-pulse' : 'text-text-muted hover:bg-card-border hover:text-text-primary'}`}
                      title="Capture screenshot"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={isTyping || viewingSessionId !== null}
              placeholder={viewingSessionId ? "History is read-only" : (isListening ? "🎤 Listening..." : (isPlanMode ? "Message Float..." : "Chat with Float..."))}
              className={`flex-1 min-w-0 bg-card border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 disabled:opacity-50 transition-colors ${isPlanMode ? 'border-card-border focus:border-accent focus:ring-accent placeholder-text-secondary' : 'border-amber-500/30 focus:border-amber-500 focus:ring-amber-500 bg-amber-500/5 placeholder-amber-500/50'}`}
            />
            <button 
              type="submit"
              disabled={isTyping || (!input.trim() && attachments.length === 0) || viewingSessionId !== null}
              className={`shrink-0 border rounded-lg px-3 py-2 transition-colors flex items-center justify-center disabled:opacity-50 ${isPlanMode ? 'bg-card-border border-card-border hover:bg-accent hover:text-white hover:border-accent text-text-muted' : 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500 hover:text-white hover:border-amber-500 text-amber-500'}`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
