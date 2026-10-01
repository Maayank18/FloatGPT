import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Loader2, BrainCircuit, GripVertical, ExternalLink, Activity, Filter, FilterX, Settings, X, Maximize2, MoreVertical, Clock, History, Calendar, Play, Pause, Square, BarChart2, Plus, Paperclip, Camera, Mic, MicOff, Globe, Send, Copy, Check, Paintbrush, Trash2, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { AILogger } from '../../ai/observability/logger';
import { UploadManager } from '../../ui/uploads/UploadManager';
import { IngestionService } from '../../ingestion';
import { summarizer } from '../../memory/summarizer';
import { AppState, Message, Attachment } from '../../types';
import { generateWorkspaceSummary } from '../../lib/summary';
import { ReflectionService } from '../../lib/reflection';
import { generateAIResponse } from '../../lib/ai';
import { parseStructuredResponse } from '../../ai/validation/response';
import { resolveCommandIntent, executeRoutedCommand } from '../../agent/flowRouter';
import { tryFastRoute } from '../../ai/fastRouter';
import { COMMAND_SCHEMAS, ALL_COMMANDS, COMMAND_GROUPS, SlashCommandType } from '../../chat/commandSchemas';
import { isModelSlash } from '../../chat/commandRouter';
import { usesLocalChat } from '../../ai/providers/localModel';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { MessengerAgent } from '../../agents/messenger';
import { detectGlanceIntent, buildGlancePromptBlock, formatLocalFolderReply } from '../../context/glanceIntent';
import { detectFillFormIntent } from '../../identity/fieldMapper';
import { runFormFill } from '../../identity/runFormFill';
import { resolveVisionOverride } from '../../context/visionOverride';
import { ContextGraph } from '../../fabric/contextGraph';
import { detectSystemDiagIntent, runSystemDiagnostics } from '../../platform/osDiagnostics';

import { ExplainabilityService } from '../../lib/explainability';
import { getGlobalSortedTasks } from '../../lib/time';
import { checkFloatGPTUpdate, UpdateInfo } from '../../lib/updateService';
import { VoiceService } from '../../lib/voiceService';
import { playSpeech, stopSpeech } from '../../lib/speechPlayer';

const DISPATCH_CONFIRM_MARKER = 'FLOATGPT_DISPATCH_CONFIRM';

function DispatchConfirmCard({
  content,
  generateId,
  setState
}: {
  content: string;
  generateId: () => string;
  setState: any;
}) {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [resolved, setResolved] = useState(false);
  const busyRef = useRef(false);

  const finish = useCallback(async (mode: 'send' | 'cancel') => {
    if (busyRef.current) return;
    busyRef.current = true;
    setResolved(true);
    const result = mode === 'cancel'
      ? await MessengerAgent.cancelPendingSend()
      : await MessengerAgent.confirmPendingSend();
    if (result?.message) {
      setState((prev: AppState) => ({
        ...prev,
        messages: [...prev.messages, {
          id: generateId(),
          role: 'assistant',
          content: result.message,
          timestamp: Date.now()
        }]
      }));
    }
  }, [generateId, setState]);

  useEffect(() => {
    if (resolved) return undefined;
    const tick = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [resolved]);

  useEffect(() => {
    if (!resolved && secondsLeft === 0) {
      void finish('send');
    }
  }, [secondsLeft, resolved, finish]);

  const cleaned = content.replace(/<!--FLOATGPT_DISPATCH_CONFIRM-->\s*/g, '');

  return (
    <div className="flex flex-col gap-2">
      <MarkdownRenderer content={cleaned} />
      {!resolved && (
        <div className="flex items-center gap-2 mt-1">
          <button
            type="button"
            onClick={() => void finish('send')}
            className="px-2.5 py-1 rounded-lg bg-accent text-white text-[10px] font-semibold hover:opacity-90 transition-opacity"
          >
            Send Now
          </button>
          <button
            type="button"
            onClick={() => void finish('cancel')}
            className="px-2.5 py-1 rounded-lg bg-card border border-card-border text-text-primary text-[10px] font-semibold hover:bg-card-border/40 transition-colors"
          >
            Cancel
          </button>
          <span className="text-[10px] text-text-muted font-mono">Auto-send in {secondsLeft}s</span>
        </div>
      )}
    </div>
  );
}

function slashMatches(cmd: SlashCommandType, typed: string) {
  if (`/${cmd}`.startsWith(typed)) return true;
  return COMMAND_SCHEMAS[cmd].aliases.some((alias) => `/${alias}`.startsWith(typed));
}

function SlashMenu({ typed, onPick }: { typed: string; onPick: (cmd: SlashCommandType) => void }) {
  const grouped = new Set(COMMAND_GROUPS.flatMap((group) => group.commands));
  const sections = [
    ...COMMAND_GROUPS.map((group) => ({
      label: group.label,
      commands: group.commands.filter((cmd) => slashMatches(cmd, typed)),
    })),
    {
      label: 'More',
      commands: ALL_COMMANDS.filter((cmd) => !grouped.has(cmd) && slashMatches(cmd, typed)),
    },
  ].filter((section) => section.commands.length > 0);

  return (
    <div className="absolute bottom-full left-3 right-3 mb-2 bg-card border border-card-border rounded-xl shadow-2xl shadow-black/80 z-50 overflow-hidden">
      <div className="px-3 py-2 border-b border-card-border flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-text-muted">Commands</span>
        <span className="text-[10px] text-text-muted">Type to filter</span>
      </div>
      <div className="max-h-[min(52vh,340px)] overflow-y-auto custom-scrollbar px-1.5 py-1">
        {sections.length === 0 && (
          <div className="px-2 py-3 text-center text-[11px] text-text-muted">No matching commands.</div>
        )}
        {sections.map((section) => (
          <div key={section.label} className="pb-1">
            <p className="px-2 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-text-muted">
              {section.label}
            </p>
            {section.commands.map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => onPick(cmd)}
                className="w-full grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-bg-secondary"
              >
                <span className="text-[11px] font-semibold text-accent truncate">/{cmd}</span>
                <span className="text-[11px] text-text-secondary truncate">{COMMAND_SCHEMAS[cmd].description}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChatPanel({ 
  state, 
  setState, 
  generateId,
  isCanvasOpen,
  onToggleCanvas
}: { 
  state: AppState; 
  setState: any; 
  generateId: any;
  isCanvasOpen?: boolean;
  onToggleCanvas?: () => void;
}) {
  const [chatUpdateInfo, setChatUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateBlink, setShowUpdateBlink] = useState(false);

  useEffect(() => {
    checkFloatGPTUpdate(true).then((info) => {
      if (info && info.hasUpdate) {
        const lastNotifiedKey = `floatgpt_chat_blink_${info.latestVersion}`;
        const lastNotified = localStorage.getItem(lastNotifiedKey);
        const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
        
        if (!lastNotified || (Date.now() - Number(lastNotified) > THREE_DAYS)) {
          setChatUpdateInfo(info);
          setShowUpdateBlink(true);
          try {
            localStorage.setItem(lastNotifiedKey, String(Date.now()));
          } catch {}

          const timer = setTimeout(() => {
            setShowUpdateBlink(false);
          }, 5000);
          return () => clearTimeout(timer);
        }
      }
    });
  }, []);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Working on that');
  const [busyProgress, setBusyProgress] = useState(0);
  const runSeq = useRef(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [draftContext, setDraftContext] = useState(state.settings.aiConfig.customChatContext || '');
  const [isContextSaved, setIsContextSaved] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
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

  // ─── Feature 2: Hybrid Voice-to-Text Transcription & Neural Edge-TTS ──────────────
  const voiceServiceRef = useRef<VoiceService | null>(null);
  const prevInputRef = useRef<string>('');
  const sentViaVoiceRef = useRef<boolean>(false);
  const submitVoiceRef = useRef<(text: string) => void>(() => {});
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(() => {
    try {
      return localStorage.getItem('floatgpt_auto_speak') === 'true';
    } catch {
      return false;
    }
  });


  const speakResponse = useCallback((text: string, msgId?: string) => {
    if (msgId) setSpeakingMsgId(msgId);
    playSpeech(text, {
      onEnd: () => setSpeakingMsgId(null)
    });
  }, []);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  useEffect(() => {
    const groqKey = state?.settings?.aiConfig?.apiKeys?.groq;
    const openaiKey = state?.settings?.aiConfig?.apiKeys?.openai;
    const primaryKey = groqKey || openaiKey;
    const fallbackKeys = [groqKey, openaiKey].filter((k): k is string => Boolean(k) && k !== primaryKey);

    voiceServiceRef.current = new VoiceService({
      apiKey: primaryKey,
      provider: primaryKey?.startsWith('sk-') ? 'openai' : 'groq',
      fallbackKeys,
      onInterimResult: (text) => {
        if (text) {
          const base = prevInputRef.current ? prevInputRef.current.trim() + ' ' : '';
          setInput(base + text);
        }
      },
      onFinalResult: (text) => {
        if (text) {
          const base = prevInputRef.current ? prevInputRef.current.trim() + ' ' : '';
          setInput(base + text);
        }
      },
      onStateChange: (recording) => {
        setIsListening(recording);
      },
      onError: (err) => {
        console.warn('[FloatGPT Voice Error]', err);
        setIsListening(false);
      }
    });

    return () => {
      if (voiceServiceRef.current) {
        voiceServiceRef.current.stop();
      }
    };
  }, [state?.settings?.aiConfig?.apiKeys?.groq, state?.settings?.aiConfig?.apiKeys?.openai]);

  const toggleVoiceInput = useCallback(async () => {
    if (!voiceServiceRef.current) return;

    if (isListening) {
      const result = await voiceServiceRef.current.stop();
      if (result) {
        const base = prevInputRef.current ? prevInputRef.current.trim() + ' ' : '';
        prevInputRef.current = '';
        setInput('');
        submitVoiceRef.current((base + result).trim());
      } else {
        setToastMessage('I didn’t catch that. Hold the mic and say the whole question.');
        setTimeout(() => setToastMessage(null), 3000);
      }
    } else {
      prevInputRef.current = input;
      await voiceServiceRef.current.start();
    }
  }, [isListening, input]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    // Instead of local attachments, ingest them centrally for multimodal context
    for (const file of files) {
      await IngestionService.ingestFile(file);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const viewingSessionId = state.viewingSessionId || null;
  const viewingSession = viewingSessionId ? state.pastSessions?.find(s => s.id === viewingSessionId) : null;

  const activeMessages: Message[] = viewingSession 
    ? (Array.isArray(viewingSession.messages) && viewingSession.messages.length > 0 
        ? viewingSession.messages 
        : (Array.isArray((viewingSession as any).playgroundMessages) ? (viewingSession as any).playgroundMessages : []))
    : (state.messages || []);

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
    setContextOpen(false);
    setIsContextSaved(true);
    setTimeout(() => setIsContextSaved(false), 1400);
  };

  const setPlanMode = (next: boolean) => {
    updateAiSetting('isPlanMode', next);
    if (next) setContextOpen(false);
  };

  const isPlanMode = state.settings.aiConfig.isPlanMode === true;
  const savedContext = (state.settings.aiConfig.customChatContext || '').trim();

  useEffect(() => {
    if (!isTyping) {
      setBusyProgress(0);
      return undefined;
    }
    setBusyProgress(12);
    const timer = setInterval(() => {
      setBusyProgress((current) => (current >= 92 ? 92 : current + Math.max(1, Math.round((92 - current) * 0.12))));
    }, 350);
    return () => clearInterval(timer);
  }, [isTyping]);

  const cancelActiveRun = () => {
    runSeq.current += 1;
    setIsTyping(false);
    setBusyProgress(0);
  };

  const handleSend = async (e?: React.FormEvent, spokenText?: string) => {
    e?.preventDefault();
    const currentInput = (spokenText ?? input).trim();
    if (!currentInput || isTyping) return;
    const speakThis = autoSpeak || sentViaVoiceRef.current || spokenText !== undefined;
    sentViaVoiceRef.current = false;
    const say = (text: string, id: string) => {
      if (speakThis && text) speakResponse(text, id);
    };

    const runToken = ++runSeq.current;
    const stillRunning = () => runSeq.current === runToken;

    const currentAttachments = attachments.length > 0 ? [...attachments] : undefined;
    const userMsg: Message = { id: generateId(), role: 'user', content: currentInput, timestamp: Date.now(), attachments: currentAttachments, usedWebSearch: useWebSearch };
    
    const newMessages = [...state.messages, userMsg];
    setState((prev: AppState) => ({ ...prev, messages: newMessages }));
    
    // Explicitly persist to Firestore to bypass global state stripping
    import('../../lib/firebase').then(({ db, doc, setDoc, auth }) => {
      if (auth.currentUser) {
        setDoc(doc(db, 'users', auth.currentUser.uid), { messages: newMessages }, { merge: true });
      }
    });

    setInput('');
    setAttachments([]);
    const modelSlash = isModelSlash(currentInput);
    const glanceNow = detectGlanceIntent(currentInput);
    setBusyLabel(modelSlash ? 'Writing that' : glanceNow.wantsGlance ? 'Reading your screen' : detectSystemDiagIntent(currentInput) ? 'Checking this PC' : 'Working on that');
    setIsTyping(true);

    try {
      if (!modelSlash && detectFillFormIntent(currentInput)) {
        const fillMsg = await runFormFill();
        if (!stillRunning()) return;
        const fillId = generateId();
        setState((prev: AppState) => ({
          ...prev,
          messages: [...prev.messages, { id: fillId, role: 'assistant', content: fillMsg, timestamp: Date.now() }]
        }));
        say(fillMsg, fillId);
        setIsTyping(false);
        return;
      }

      const glanceIntent = detectGlanceIntent(currentInput);
      const glanceOn = state.settings?.privacy?.screenGlanceEnabled !== false;
      const glanceApi = typeof window !== 'undefined' ? window.electronAPI?.desktopContext : undefined;

      if (!modelSlash && glanceOn && glanceIntent.wantsGlance && glanceApi?.glance) {
        const allowShot = state.settings?.privacy?.screenGlanceIncludeScreenshot !== false;
        const packet = await glanceApi.glance({
          includeScreenshot: allowShot && (glanceIntent.wantsVisual || !glanceIntent.wantsFolder),
          includeFolder: glanceIntent.wantsFolder,
          forceDesktop: /\bdesktop\b/i.test(currentInput)
        });

        if (!stillRunning()) return;
        if (packet && packet.ok !== false) {
          ContextGraph.updateContext({
            activeApplication: packet.foreground?.app,
            activeWindow: packet.foreground?.title,
            activeWebsite: packet.foreground?.host || undefined,
            activeFiles: packet.folder?.items || []
          });

          if (glanceIntent.wantsFolder && !glanceIntent.wantsVisual && packet.folder?.path) {
            const local = formatLocalFolderReply(packet);
            if (local) {
              const localId = generateId();
              setState((prev: AppState) => ({
                ...prev,
                messages: [...prev.messages, { id: localId, role: 'assistant', content: local, timestamp: Date.now() }]
              }));
              say(local, localId);
              setIsTyping(false);
              return;
            }
          }

          const needShot = allowShot && (glanceIntent.wantsVisual || !packet.folder);
          let shotPacket = packet;
          if (needShot && !packet.screenshot && !packet.redacted) {
            const second = await glanceApi.glance({ includeScreenshot: true, includeFolder: glanceIntent.wantsFolder });
            if (second && second.ok !== false) shotPacket = second;
          }
          if (!stillRunning()) return;

          const hasShot = !!shotPacket.screenshot && !shotPacket.redacted;
          const glancePrompt = `${buildGlancePromptBlock({
            foreground: shotPacket.foreground,
            openWindows: shotPacket.openWindows,
            folder: shotPacket.folder,
            redacted: shotPacket.redacted,
            lookedAtSelf: shotPacket.lookedAtSelf,
            hasScreenshot: hasShot
          })}\n\nUser: ${currentInput}`;

          const glanceAttachments: Attachment[] = hasShot
            ? [{ name: 'desktop-glance.png', mimeType: 'image/png', data: shotPacket.screenshot as string }]
            : (currentAttachments || []);

          const visionOverride = resolveVisionOverride(state, hasShot);
          const glanceAttachmentsForModel: Attachment[] | undefined = hasShot && (visionOverride || usesLocalChat(state) || ['google', 'openai'].includes(state.settings?.aiConfig?.selectedProvider))
            ? glanceAttachments
            : (!hasShot && currentAttachments?.length ? currentAttachments : undefined);
          const noVisionNote = hasShot && !glanceAttachmentsForModel
            ? '\nYou cannot see pixels. The first window is the app they are using. Do not describe a Picture-in-Picture overlay as the main app.'
            : '';
          let glanceData = await generateAIResponse(
            state,
            glancePrompt + noVisionNote,
            glanceAttachmentsForModel,
            useWebSearch,
            { ...(visionOverride || {}), skipHistory: true },
            isThinkingMode
          );

          if (!stillRunning()) return;
          const windowLine = (shotPacket.openWindows || []).filter(Boolean).slice(0, 6);
          const mainTitle = windowLine[0]
            || shotPacket.foreground?.title
            || shotPacket.foreground?.app
            || 'this screen';
          const using = /\bcursor\b/i.test(mainTitle) ? 'Cursor' : mainTitle.replace(/\s*\(small overlay.*\)$/i, '');
          const refused = /visibility|can(?:not|'t) (?:see|determine|read the pixel)|do not have|don't have|cannot read the pixel/i.test(glanceData.message || '');
          const facts = [
            `You're using **${using}**.`,
            windowLine.length ? windowLine.map((name: string) => `- ${name}`).join('\n') : ''
          ].filter(Boolean).join('\n');
          if (typeof glanceData.message === 'string') {
            const body = refused ? facts : glanceData.message;
            glanceData = {
              ...glanceData,
              message: `*Looked at: ${using}*\n\n${facts}\n\n${refused ? '' : body}`.trim()
            };
          }

          const glanceId = generateId();
          setState((prev: AppState) => ({
            ...prev,
            messages: [...prev.messages, { id: glanceId, role: 'assistant', content: glanceData.message, timestamp: Date.now() }]
          }));
          say(glanceData.message, glanceId);
          setIsTyping(false);
          return;
        }
      }

      const fast = modelSlash ? { handled: false } : await tryFastRoute(currentInput, state);
      if (!stillRunning()) return;
      if (fast.handled && fast.message) {
        const asstId = generateId();
        setState((prev: AppState) => ({
          ...prev,
          messages: [...prev.messages, { id: asstId, role: 'assistant', content: fast.message as string, timestamp: Date.now() }]
        }));
        say(fast.message as string, asstId);
        setIsTyping(false);
        return;
      }

      // 1. Try agentic routing first. Slash commands stay on the writing path.
      const intent = modelSlash ? null : await resolveCommandIntent(currentInput);
      
      if (intent && (intent.intent === 'browser_action' || intent.intent === 'os_action' || intent.intent === 'floatgpt_control' || intent.intent === 'os_agent' || intent.intent === 'memory_query')) {
        const flowResult = await executeRoutedCommand(intent, currentInput);
        if (!stillRunning()) return;
        const asstId = generateId();
        
        const msgContent = flowResult.message || 'Action executed successfully.';
        setState((prev: AppState) => {
          const aiMsg: Message = { id: asstId, role: 'assistant', content: msgContent, timestamp: Date.now() };
          return {
            ...prev,
            messages: [...prev.messages, aiMsg]
          };
        });
        
        say(msgContent, asstId);

        // Persist the agentic action message to Firestore
        import('../../lib/firebase').then(({ db, doc, setDoc, auth }) => {
          if (auth.currentUser) {
            const finalMessages = [...newMessages, { id: asstId, role: 'assistant', content: flowResult.message, timestamp: Date.now() }];
            setDoc(doc(db, 'users', auth.currentUser.uid), { messages: finalMessages }, { merge: true });
          }
        });
        
        setIsTyping(false);
        return;
      }

      // 2. Fall back to standard AI generation
      let data = await generateAIResponse(
        { ...state, messages: newMessages },
        currentInput,
        currentAttachments,
        useWebSearch,
        undefined,
        isThinkingMode
      );
      if (!stillRunning()) return;

      // Defense-In-Depth: If data.message is a raw JSON string containing structured plan keys, parse and unpack it
      if (typeof data.message === 'string' && data.message.trim().startsWith('{') && (data.message.includes('"newGoals"') || data.message.includes('"newTasks"') || data.message.includes('"newProjects"'))) {
        try {
          const parsed = parseStructuredResponse(data.message, 'chat-fallback');
          if (parsed && (parsed.newGoals || parsed.newTasks || parsed.newProjects || parsed.message)) {
            data = { ...data, ...parsed };
          }
        } catch {
          // ignore error
        }
      }

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

      const standardAsstId = generateId();
      const standardContent = data?.message || (typeof data === 'string' ? data : 'Processed successfully.');
      setState((prev: AppState) => {
        const aiMsg: Message = { id: standardAsstId, role: 'assistant', content: standardContent, timestamp: Date.now() };
        
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
          // Strict immutability: Completed or Archived tasks can never be uncompleted
          if (t.status === 'Completed' || t.status === 'Archived') {
            return t;
          }
          const update = data.updatedTasks?.find((u: any) => u.id === t.id);
          const fullUpdate = data.newTasks?.find((u: any) => u.id === t.id);
          const targetUpdate = fullUpdate || update;
          if (targetUpdate) {
             if (targetUpdate.status === 'Completed') {
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

        const finalMessages = [...prev.messages, aiMsg];
        
        import('../../lib/firebase').then(({ db, doc, setDoc, auth }) => {
          if (auth.currentUser) {
            setDoc(doc(db, 'users', auth.currentUser.uid), { messages: finalMessages }, { merge: true });
          }
        });

        let nextState = {
          ...prev,
          messages: finalMessages,
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

        // Trigger asynchronous summarization for the Workspace Memory
        setTimeout(() => summarizer.summarizeSession(nextState), 100);

        return nextState;
      });

      say(standardContent, standardAsstId);

    } catch (err: any) {
      if (!stillRunning()) return;
      console.error(err);

      // Offline / network failure fallback: check if request is an OS query
      const diagKind = detectSystemDiagIntent(currentInput);
      if (diagKind) {
        try {
          const diagMsg = await runSystemDiagnostics(diagKind);
          const diagAsstId = generateId();
          setState((prev: AppState) => {
            const aiMsg: Message = { id: diagAsstId, role: 'assistant', content: diagMsg, timestamp: Date.now() };
            const finalMessages = [...prev.messages, aiMsg];
            import('../../lib/firebase').then(({ db, doc, setDoc, auth }) => {
              if (auth.currentUser) {
                setDoc(doc(db, 'users', auth.currentUser.uid), { messages: finalMessages }, { merge: true });
              }
            });
            return { ...prev, messages: finalMessages };
          });
          say(diagMsg, diagAsstId);
          setIsTyping(false);
          return;
        } catch (diagErr) {
          console.warn('[ChatPanel] Offline OS diag fallback error:', diagErr);
        }
      }

      setState((prev: AppState) => {
        const errMessages = [...prev.messages, { id: generateId(), role: 'assistant', content: `System error: ${err.message || 'Could not process request.'}`, timestamp: Date.now() }];
        import('../../lib/firebase').then(({ db, doc, setDoc, auth }) => {
          if (auth.currentUser) {
            setDoc(doc(db, 'users', auth.currentUser.uid), { messages: errMessages }, { merge: true });
          }
        });
        return {
          ...prev,
          messages: errMessages
        };
      });
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    submitVoiceRef.current = (text: string) => {
      sentViaVoiceRef.current = true;
      void handleSend(undefined, text);
    };
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* 5-Second Update Notification Banner (Blinks for few days upon rollout) */}
      {showUpdateBlink && chatUpdateInfo && (
        <div className="shrink-0 mx-3 my-2 p-2.5 rounded-xl bg-linear-to-r from-accent/20 via-indigo-500/20 to-purple-500/20 border border-accent/40 shadow-lg shadow-accent/10 flex items-center justify-between animate-pulse transition-all duration-500 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-accent shrink-0" />
            <span className="text-xs font-bold text-text-primary truncate">
              ✨ New FloatGPT v{chatUpdateInfo.latestVersion} Available!
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).electronAPI?.openExternal) {
                  (window as any).electronAPI.openExternal(chatUpdateInfo.releaseUrl);
                } else {
                  window.open(chatUpdateInfo.releaseUrl, '_blank');
                }
                setShowUpdateBlink(false);
              }}
              className="px-2.5 py-1 text-[11px] font-bold bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              Update
            </button>
            <button
              onClick={() => setShowUpdateBlink(false)}
              className="p-1 text-text-muted hover:text-text-primary rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Past Session Banner */}
      {viewingSessionId && (
        <div className="shrink-0 px-4 py-2 bg-accent/10 border-b border-accent/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-semibold text-text-primary">Viewing Past Session (Read-Only)</span>
          </div>
          <button
            onClick={() => setState((prev: AppState) => ({ ...prev, viewingSessionId: null }))}
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-accent text-white rounded-md hover:bg-accent/80 transition-colors cursor-pointer"
          >
            Return to Active
          </button>
        </div>
      )}

      {/* Plan / Chat mode. Context stays collapsed until Chat asks for it. */}
      {!viewingSessionId && (
        <div className="shrink-0 px-3 py-2 border-b border-card-border bg-bg-secondary flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            <div className="flex items-center justify-end min-w-0 pr-2.5">
              {activeMessages.length > 0 && (
                <button
                  onClick={() => {
                    if (!confirm('Are you sure you want to clear current chat messages?')) return;
                    setState((prev: AppState) => {
                      const cleared = { ...prev, messages: [], playgroundMessages: [] };
                      import('../../lib/firebase').then(({ db, doc, setDoc, auth }) => {
                        if (auth.currentUser) {
                          setDoc(doc(db, 'users', auth.currentUser.uid), { messages: [], playgroundMessages: [] }, { merge: true });
                        }
                      });
                      return cleared;
                    });
                  }}
                  className="mr-auto p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                  title="Clear chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setPlanMode(true)}
                className={`text-[11px] font-semibold tracking-wide transition-colors cursor-pointer ${isPlanMode ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
              >
                Plan
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPlanMode(!isPlanMode)}
              aria-label={isPlanMode ? 'Switch to chat' : 'Switch to plan'}
              aria-pressed={isPlanMode}
              className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0 ${isPlanMode ? 'bg-accent' : 'bg-amber-500'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${isPlanMode ? 'translate-x-0.5' : 'translate-x-4.5'}`} />
            </button>
            <div className="flex items-center justify-start gap-2 min-w-0 pl-2.5">
              <button
                type="button"
                onClick={() => setPlanMode(false)}
                className={`text-[11px] font-semibold tracking-wide transition-colors cursor-pointer ${!isPlanMode ? 'text-amber-500' : 'text-text-muted hover:text-text-secondary'}`}
              >
                Chat
              </button>
              {!isPlanMode && (
                <button
                  type="button"
                  onClick={() => setContextOpen((open) => !open)}
                  className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                    isContextSaved || contextOpen || savedContext
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                      : 'border-card-border text-text-muted hover:text-text-primary'
                  }`}
                  title={savedContext ? 'Edit context' : 'Add context'}
                >
                  {isContextSaved ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {isContextSaved ? 'Saved' : 'Context'}
                </button>
              )}
            </div>
          </div>
          {!isPlanMode && contextOpen && (
            <div className="flex items-start gap-1.5 animate-in slide-in-from-top-1 fade-in duration-200">
              <textarea
                value={draftContext}
                onChange={(e) => setDraftContext(e.target.value)}
                placeholder="Act as a helpful general assistant..."
                className="min-w-0 flex-1 bg-card border border-amber-500/25 rounded-lg px-2.5 py-1.5 text-[11px] text-text-primary focus:outline-none focus:border-amber-500/60 resize-none hide-scrollbar placeholder-text-muted/50"
                rows={2}
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveContext}
                className="shrink-0 self-center text-[10px] font-bold px-2.5 py-1.5 rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors cursor-pointer"
              >
                Save
              </button>
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

        {(activeMessages || []).map((msg, msgIdx) => {
          const isLiveConfirm = msg.role === 'assistant'
            && msg.content.includes(DISPATCH_CONFIRM_MARKER)
            && msgIdx === activeMessages.length - 1
            && MessengerAgent.hasPendingSession();
          return (
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
              {msg.role === 'assistant' ? (
                <div>
                  {isLiveConfirm ? (
                    <DispatchConfirmCard content={msg.content} generateId={generateId} setState={setState} />
                  ) : (
                    <MarkdownRenderer content={msg.content.replace(/<!--FLOATGPT_DISPATCH_CONFIRM-->\s*/g, '')} />
                  )}
                  {!isLiveConfirm && (
                    <div className="mt-2 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          setCopiedMsgId(msg.id);
                          window.setTimeout(() => {
                            setCopiedMsgId((current) => (current === msg.id ? null : current));
                          }, 1600);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-card-border bg-card text-text-muted hover:text-accent"
                        title="Copy response"
                      >
                        {copiedMsgId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-accent" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (speakingMsgId === msg.id) {
                            stopSpeech();
                            setSpeakingMsgId(null);
                          } else {
                            speakResponse(msg.content, msg.id);
                          }
                        }}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-card-border bg-card hover:text-accent ${speakingMsgId === msg.id ? 'text-accent' : 'text-text-muted'}`}
                        title={speakingMsgId === msg.id ? 'Stop speaking' : 'Read aloud'}
                      >
                        {speakingMsgId === msg.id ? (
                          <VolumeX className="w-3.5 h-3.5" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
          );
        })}

        {isTyping && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-card border border-card-border flex items-center justify-center shrink-0">
              <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
            </div>
          </div>
        )}
      </div>
      
      <div className="px-3">
        <UploadManager />
      </div>
      
      <div className="flex flex-col bg-bg-secondary border-t border-card-border mt-2">
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
        
        <div className="p-3 relative">
          {isTyping && (
            <div className="mb-2 rounded-xl border border-card-border bg-card px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-[11px] font-semibold text-text-primary">{busyLabel}… {busyProgress}%</p>
                <button
                  type="button"
                  onClick={cancelActiveRun}
                  className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-md border border-card-border text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                >
                  Cancel
                </button>
              </div>
              <div className="h-1.5 w-full rounded-full bg-bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${busyProgress}%` }}
                />
              </div>
            </div>
          )}
          {input.startsWith('/') && !input.includes(' ') && (
            <SlashMenu
              typed={input.toLowerCase()}
              onPick={(cmd) => {
                setInput(`/${cmd} `);
                composerRef.current?.focus();
              }}
            />
          )}
          <form onSubmit={handleSend} className="flex gap-2">
            <input 
              type="file" 
              multiple 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*,application/pdf,text/plain,audio/*"
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
                  <button 
                    type="button"
                    onClick={() => {
                      setIsThinkingMode(!isThinkingMode);
                      setIsMenuOpen(false);
                    }}
                    disabled={isTyping || viewingSessionId !== null}
                    className={`p-2 transition-colors rounded-lg flex items-center justify-center disabled:opacity-50 ${isThinkingMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'text-text-muted hover:bg-card-border hover:text-text-primary'}`}
                    title="Toggle Deep Thinking Mode (Reasoning Models)"
                  >
                    <BrainCircuit className="w-4 h-4" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      if (onToggleCanvas) onToggleCanvas();
                      setIsMenuOpen(false);
                    }}
                    disabled={isTyping || viewingSessionId !== null}
                    className={`p-2 transition-colors rounded-lg flex items-center justify-center disabled:opacity-50 ${isCanvasOpen ? 'bg-accent/20 text-accent hover:bg-accent/30' : 'text-text-muted hover:bg-card-border hover:text-text-primary'}`}
                    title="Toggle Screen Canvas / Annotator"
                  >
                    <Paintbrush className="w-4 h-4" />
                  </button>
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
              ref={composerRef}
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={isTyping || viewingSessionId !== null}
              placeholder={viewingSessionId ? "History is read-only" : isTyping ? "Wait for this reply, or press Cancel" : (isListening ? "🎤 Listening to voice... Click mic to stop and insert text..." : (isPlanMode ? "Message Float..." : "Type / to explore more..."))}
              className={`flex-1 min-w-0 bg-card border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 disabled:opacity-50 transition-colors ${isListening ? 'border-danger/60 ring-1 ring-danger/40 bg-danger/5 placeholder-danger/60' : (isPlanMode ? 'border-card-border focus:border-accent focus:ring-accent placeholder-text-secondary' : 'border-amber-500/30 focus:border-amber-500 focus:ring-amber-500 bg-amber-500/5 placeholder-amber-500/50')}`}
            />
            <button 
              type="button"
              onClick={toggleVoiceInput}
              disabled={isTyping || viewingSessionId !== null}
              className={`shrink-0 border rounded-lg px-2.5 py-2 transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer ${isListening ? 'bg-danger text-white border-danger animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'bg-card border-card-border hover:bg-card-border hover:text-text-primary text-text-muted'}`}
              title={isListening ? "Stop Recording (Convert to Text)" : "Voice Dictation (Speak to Type)"}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5 text-white" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
            <button
              type={isTyping ? 'button' : 'submit'}
              onClick={isTyping ? cancelActiveRun : undefined}
              disabled={!isTyping && ((!input.trim() && attachments.length === 0) || viewingSessionId !== null)}
              className={`shrink-0 border rounded-lg px-3 py-2 transition-colors flex items-center justify-center disabled:opacity-50 ${isTyping ? 'bg-card border-card-border text-text-primary hover:bg-danger/10 hover:text-danger hover:border-danger/40' : isPlanMode ? 'bg-card-border border-card-border hover:bg-accent hover:text-white hover:border-accent text-text-muted' : 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500 hover:text-white hover:border-amber-500 text-amber-500'}`}
              title={isTyping ? 'Cancel this reply' : 'Send'}
            >
              {isTyping ? <Square className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
