import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue } from 'motion/react';
import { BrainCircuit, X, Send, Home, FolderKanban, MessageSquare, Trash2, Settings2, History, MessageSquarePlus, Paintbrush, Loader2, Bell, BellOff, Lock, Mic, Volume2, Sparkles } from 'lucide-react';
import { AppState, Project, Goal, Task, Resource, Message } from '../types';
import type { WhatsAppLinkNotice, WhatsAppLinkStatus } from '../electron';
import { HomePanel } from './assistant/HomePanel';
import { PlanPanel } from './assistant/PlanPanel';
import { ChatPanel } from './assistant/ChatPanel';
import { SettingsPanel } from './assistant/SettingsPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { HistoryPanel } from './assistant/HistoryPanel';
import { QuickApiKeyModal } from './assistant/QuickApiKeyModal';
import { useGuardian } from '../lib/guardian';
import { StatusCloudBubble } from './assistant/StatusCloud';
import { performRollover } from '../state/store';
import { generateAIResponse } from '../lib/ai';
import { signInWithEmail, signInWithGoogleAccount, signUpWithEmail, subscribeAccountSession } from '../lib/accountSession';
import { authErrorMessage } from '../lib/authErrors';
import { GoogleMark } from './GoogleMark';
import { CanvasToolbar } from './canvas/CanvasToolbar';
import { useCanvasStore } from './canvas/canvasStore';
import { UpdateNotifier } from './UpdateNotifier';
import { VoiceService } from '../lib/voiceService';
// Hands-free VAD / wake word is parked. Voice is click-the-mic and right-click-hold only.
// import { AmbientWakeEngine } from '../lib/wakeEngine';
import { playSpeech, spokenAnswer, stopSpeech } from '../lib/speechPlayer';
import { tryFastRoute } from '../ai/fastRouter';
import { resolveCommandIntent, executeRoutedCommand } from '../agent/flowRouter';
const ORB_SIZE = 56;
const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 560;

// Electron desktop mode constants
const ORB_PAD = 8;
const PANEL_GAP = 16;
const COLLAPSED_SIZE = ORB_SIZE + ORB_PAD * 2;

const SEEN_NOTICE_KEY = 'floatgpt_seen_notices';
const DISMISSED_NOTICE_KEY = 'floatgpt_dismissed_notices';

function loadNoticeIds(key: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(raw) ? raw.filter((id) => typeof id === 'string' && id) : []);
  } catch {
    return new Set();
  }
}

function saveNoticeIds(key: string, ids: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids].slice(-200)));
  } catch {}
}

function groupNotices(notices: WhatsAppLinkNotice[]) {
  const groups = new Map<string, WhatsAppLinkNotice[]>();
  for (const item of notices) {
    const key = item.jid || item.from || item.id;
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.values()].map((items) => {
    const ordered = [...items].sort((a, b) => a.at - b.at);
    const latest = ordered[ordered.length - 1];
    return {
      key: latest.jid || latest.from || latest.id,
      from: latest.from,
      items: ordered,
      important: ordered.some((item) => item.important),
      at: latest.at,
    };
  }).sort((a, b) => b.at - a.at);
}

function NoticeChat({
  from,
  items,
  important,
  onDismiss,
}: {
  from: string;
  items: WhatsAppLinkNotice[];
  important: boolean;
  onDismiss: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(items.length <= 3);
  const shown = open ? items : items.slice(-2);
  const hidden = items.length - shown.length;
  return (
    <li className="rounded-lg border border-card-border px-2 py-1.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-[11px] font-semibold text-text-primary truncate">{from}</span>
        <span className="flex items-center gap-2 shrink-0">
          {important && <span className="text-[9px] font-bold uppercase text-text-muted">Important</span>}
          {items.length > 1 && <span className="text-[10px] font-semibold text-text-muted">{items.length}</span>}
        </span>
      </button>
      <div className="mt-1 space-y-1">
        {hidden > 0 && (
          <button type="button" onClick={() => setOpen(true)} className="text-[10px] font-semibold text-text-muted hover:text-text-primary">
            {hidden} earlier
          </button>
        )}
        {shown.map((item) => (
          <p key={item.id} className="whitespace-pre-wrap text-[11px] leading-snug text-text-secondary">{item.text}</p>
        ))}
      </div>
      <div className="mt-1.5 flex justify-end">
        <button
          type="button"
          onClick={() => onDismiss(items.map((item) => item.id))}
          className="text-[10px] font-semibold text-text-muted hover:text-text-primary"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

function NoticeMute({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!muted}
      aria-label={muted ? 'Turn notifications on' : 'Turn notifications off'}
      onClick={onToggle}
      className="flex items-center gap-2 text-left"
    >
      <span className={`relative h-3.5 w-6 shrink-0 rounded-full transition-colors ${muted ? 'bg-card-border' : 'bg-accent'}`}>
        <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${muted ? 'left-0.5' : 'left-3'}`} />
      </span>
      <span className="text-[10px] font-semibold text-text-muted">{muted ? 'Off' : 'On'}</span>
    </button>
  );
}

function NoticeInbox({
  open,
  notices,
  linkNote,
  focusNote,
  muted,
  onToggleMute,
  onDismiss,
}: {
  open: boolean;
  notices: WhatsAppLinkNotice[];
  linkNote: string;
  focusNote: string;
  muted: boolean;
  onToggleMute: () => void;
  onDismiss: (ids: string[]) => void;
}) {
  if (!open) return null;
  const empty = !muted && notices.length === 0 && !linkNote && !focusNote;
  const chats = muted ? [] : groupNotices(notices);
  return (
    <div className="max-h-80 overflow-y-auto border-b border-card-border bg-bg px-3 py-2">
      <div className="mb-1.5 flex items-center">
        <NoticeMute muted={muted} onToggle={onToggleMute} />
      </div>
      {empty && <p className="text-[11px] text-text-muted">No notifications.</p>}
      {!muted && focusNote && <p className="mb-2 text-[11px] text-text-primary">{focusNote}</p>}
      {!muted && linkNote && <p className="mb-2 text-[11px] text-text-secondary">{linkNote}</p>}
      <ul className="space-y-1.5">
        {chats.map((chat) => (
          <NoticeChat key={chat.key} from={chat.from} items={chat.items} important={chat.important} onDismiss={onDismiss} />
        ))}
      </ul>
    </div>
  );
}

interface StoreProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  resetStore: () => void;
  generateId: () => string;
  user: any;
}

export function FloatingAssistant({ 
  store,
  isCanvasOpen,
  onToggleCanvas 
}: { 
  store: StoreProps;
  isCanvasOpen?: boolean;
  onToggleCanvas?: () => void;
}) {
  const canvasStore = useCanvasStore();
  const canvasActive = isCanvasOpen ?? canvasStore.isOpen;
  const toggleCanvas = onToggleCanvas ?? canvasStore.toggleOpen;
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'plan' | 'chat' | 'labs' | 'history'>('chat');
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [waNotices, setWaNotices] = useState<WhatsAppLinkNotice[]>([]);
  const [linkNote, setLinkNote] = useState('');
  const [unseenNotices, setUnseenNotices] = useState(0);
  const [noticesMuted, setNoticesMuted] = useState(() => {
    try { return localStorage.getItem('floatgpt_notices_muted') === '1'; } catch { return false; }
  });
  const noticesMutedRef = useRef(noticesMuted);
  const latestNotices = useRef<WhatsAppLinkNotice[]>([]);
  const latestLinkNote = useRef('');
  const seenNoticeIds = useRef(loadNoticeIds(SEEN_NOTICE_KEY));
  const dismissedNoticeIds = useRef(loadNoticeIds(DISMISSED_NOTICE_KEY));
  const noticeOpenRef = useRef(false);

  useEffect(() => {
    noticeOpenRef.current = noticeOpen;
  }, [noticeOpen]);

  useEffect(() => {
    noticesMutedRef.current = noticesMuted;
    if (noticesMuted) setUnseenNotices(0);
  }, [noticesMuted, unseenNotices]);

  useEffect(() => {
    const api = window.electronAPI?.whatsapp;
    if (!api?.onLinked && !api?.linkedStatus) return undefined;
    const take = (status: WhatsAppLinkStatus) => {
      const list = (status?.recent || []).filter((item) => item?.id && !dismissedNoticeIds.current.has(item.id));
      latestNotices.current = list;
      latestLinkNote.current = status?.error || '';
      if (noticesMutedRef.current) {
        setWaNotices([]);
        setLinkNote('');
        setUnseenNotices(0);
        return;
      }
      setWaNotices(list);
      setLinkNote(latestLinkNote.current);
      // A new message only updates the bell. It must not open the panel.
      if (noticeOpenRef.current) {
        list.forEach((item) => { if (item.id) seenNoticeIds.current.add(item.id); });
        saveNoticeIds(SEEN_NOTICE_KEY, seenNoticeIds.current);
        setUnseenNotices(0);
        return;
      }
      if (noticesMutedRef.current) {
        setUnseenNotices(0);
        return;
      }
      const fresh = list.filter((item) => item.id && !seenNoticeIds.current.has(item.id));
      setUnseenNotices(new Set(fresh.map((item) => item.jid || item.from || item.id)).size);
    };
    api.linkedStatus?.().then(take).catch(() => {});
    return api.onLinked?.(take);
  }, []);

  const dismissNotice = (ids: string[]) => {
    const chosen = ids.filter(Boolean);
    if (!chosen.length) return;
    for (const id of chosen) {
      dismissedNoticeIds.current.add(id);
      seenNoticeIds.current.add(id);
    }
    saveNoticeIds(DISMISSED_NOTICE_KEY, dismissedNoticeIds.current);
    saveNoticeIds(SEEN_NOTICE_KEY, seenNoticeIds.current);
    setWaNotices((list) => list.filter((item) => !chosen.includes(item.id)));
  };

  const showHeldNotices = () => {
    const list = latestNotices.current.filter((item) => item?.id && !dismissedNoticeIds.current.has(item.id));
    setWaNotices(list);
    setLinkNote(latestLinkNote.current);
    if (noticeOpenRef.current) {
      list.forEach((item) => { if (item.id) seenNoticeIds.current.add(item.id); });
      saveNoticeIds(SEEN_NOTICE_KEY, seenNoticeIds.current);
      setUnseenNotices(0);
      return;
    }
    if (noticesMutedRef.current) {
      setUnseenNotices(0);
      return;
    }
    const fresh = list.filter((item) => item.id && !seenNoticeIds.current.has(item.id));
    setUnseenNotices(new Set(fresh.map((item) => item.jid || item.from || item.id)).size);
  };

  const toggleNotices = () => {
    setNoticesMuted((muted) => {
      const next = !muted;
      noticesMutedRef.current = next;
      try { localStorage.setItem('floatgpt_notices_muted', next ? '1' : '0'); } catch { /* keep the choice for this session */ }
      if (next) {
        setWaNotices([]);
        setLinkNote('');
        setUnseenNotices(0);
      } else {
        const refresh = window.electronAPI?.whatsapp?.linkedStatus;
        if (!refresh) {
          showHeldNotices();
        } else {
          refresh().then((status) => {
            if (noticesMutedRef.current || !status) return;
            latestNotices.current = (status.recent || []).filter((item) => item?.id && !dismissedNoticeIds.current.has(item.id));
            latestLinkNote.current = status.error || '';
            showHeldNotices();
          }).catch(() => showHeldNotices());
        }
      }
      return next;
    });
  };

  const openNotices = () => {
    setNoticeOpen((open) => {
      const next = !open;
      if (next) {
        waNotices.forEach((item) => { if (item.id) seenNoticeIds.current.add(item.id); });
        saveNoticeIds(SEEN_NOTICE_KEY, seenNoticeIds.current);
        setUnseenNotices(0);
      }
      return next;
    });
  };
  
  // Orb Appearance Settings
  const { 
    orbScale = 1.0, 
    orbOpacity = 1.0, 
    orbShape = 'circle', 
    orbGlow = 'subtle' 
  } = store.state.settings.appearance || {};

  // Auth State
  const [isAuthDismissed, setIsAuthDismissed] = useState(() => {
    try {
      return localStorage.getItem('floatgpt_auth_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const dismissAuth = () => {
    setIsAuthDismissed(true);
    try {
      localStorage.setItem('floatgpt_auth_dismissed', 'true');
    } catch {}
  };

  useEffect(() => {
    return subscribeAccountSession((user) => {
      if (!user) setIsAuthDismissed(false);
    });
  }, []);

  // Focus mode (the 25-minute timer screen) is parked. A saved "on" state
  // would keep the window watcher running with no button left to turn it off.
  useEffect(() => {
    const productivity = store.state.settings.productivity;
    if (!store.state.focusModeState.active && productivity?.focusMode !== true) return;
    store.setState(s => ({
      ...s,
      focusModeState: { ...s.focusModeState, active: false },
      settings: {
        ...s.settings,
        productivity: { ...s.settings.productivity, focusMode: false },
      },
    }));
  }, [store]);

  const handleGoogle = async () => {
    setAuthError('');
    setAuthNotice('');
    setAuthLoading(true);
    try {
      await signInWithGoogleAccount();
      dismissAuth();
    } catch (err: any) {
      setAuthError(err?.code ? authErrorMessage(err.code, 'signin') : (err?.message || 'Google sign-in did not finish. Try again.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    const data = new FormData(e.currentTarget);
    const emailValue = String(data.get('email') || '').trim();
    const passwordValue = String(data.get('password') || '');
    const nameValue = String(data.get('name') || '').trim();
    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        if (passwordValue.length < 6) {
          setAuthError('Use a password of at least 6 characters.');
          return;
        }
        await signUpWithEmail(emailValue, passwordValue, nameValue);
      } else {
        await signInWithEmail(emailValue, passwordValue);
      }
      dismissAuth();
    } catch (err: any) {
      setAuthError(err?.message || 'Sign-in did not finish. Try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  // ─── Electron Desktop Mode State ────────────────────────────
  const isElectronEnv = typeof window !== 'undefined' && !!window.electronAPI;
  const isDraggingWin = useRef(false);
  const isOpenRef = useRef(false);
  const openPanelRef = useRef<(tab?: 'home' | 'plan' | 'chat' | 'labs' | 'history') => Promise<void>>(async () => {});
  const dragOffset = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  const [isResizing, setIsResizing] = useState(false);
  const [electronLayout, setElectronLayout] = useState({
    orbX: ORB_PAD,
    orbY: ORB_PAD,
    panelX: 0,
    panelY: 0,
    panelH: PANEL_HEIGHT,
    panelDir: 'right' as 'left' | 'right',
    panelOnTop: false,
  });
  const orbRef = useRef<HTMLDivElement>(null);
  
  const getInitial = () => {
    try {
      const saved = localStorage.getItem('floatgpt_orb_pos');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return { x: window.innerWidth - ORB_SIZE - 40, y: window.innerHeight - ORB_SIZE - 40 };
  };

  const initialPos = getInitial();
  const x = useMotionValue(initialPos.x);
  const y = useMotionValue(initialPos.y);

  const [windowBounds, setWindowBounds] = useState({ width: window.innerWidth, height: window.innerHeight });

  const { status: guardianStatus, statusCloud } = useGuardian(store.state);

  useEffect(() => {
    if (!noticeOpen) return undefined;
    const hasFocus = Boolean(guardianStatus && guardianStatus !== 'SAFE');
    if (waNotices.length > 0 || linkNote || hasFocus) return undefined;
    const timer = window.setTimeout(() => setNoticeOpen(false), 900);
    return () => window.clearTimeout(timer);
  }, [noticeOpen, waNotices.length, linkNote, guardianStatus]);
  const [isViolatingFocus, setIsViolatingFocus] = useState(false);
  const [dismissedCloudKey, setDismissedCloudKey] = useState<string | null>(null);
  const cloudAnchor = useRef(false);
  const showCloud = !!statusCloud && !isOpen && dismissedCloudKey !== `${statusCloud.taskId}:${statusCloud.band}`;

  const openCloud = () => {
    void openPanelRef.current('home');
  };
  const dismissCloud = () => {
    if (!statusCloud) return;
    setDismissedCloudKey(`${statusCloud.taskId}:${statusCloud.band}`);
  };

  useEffect(() => {
    if (!showCloud || !isElectronEnv || !window.electronAPI?.forceShow) return;
    window.electronAPI.forceShow();
  }, [showCloud, statusCloud?.taskId, statusCloud?.band, isElectronEnv]);

  useEffect(() => {
    if (!isElectronEnv || statusCloud?.band !== 'EMERGENCY' || !showCloud) return;
    const pull = () => { window.electronAPI?.forceShow?.(); };
    pull();
    const id = window.setInterval(pull, 20000);
    return () => window.clearInterval(id);
  }, [statusCloud?.band, showCloud, isElectronEnv]);

  useEffect(() => {
    if (!isElectronEnv || !window.electronAPI) return;

    let unsubViolation = () => {};
    if (window.electronAPI.onGuardianViolation) {
      unsubViolation = window.electronAPI.onGuardianViolation((data: any) => {
        setIsViolatingFocus(true);
        if (window.electronAPI?.forceShow) {
          window.electronAPI.forceShow();
        }
        // Pulse for 5 seconds then turn off
        setTimeout(() => setIsViolatingFocus(false), 5000);
      });
    }

    return () => {
      unsubViolation();
    };
  }, [isElectronEnv]);

  useEffect(() => {
    if (isElectronEnv && window.electronAPI?.forceShow) {
      if (guardianStatus === 'EMERGENCY' || guardianStatus === 'CRITICAL' || guardianStatus === 'WARNING' || guardianStatus === 'OVERDUE' || isViolatingFocus) {
        window.electronAPI.forceShow();
      }
    }
  }, [isElectronEnv, guardianStatus, isViolatingFocus]);
  useEffect(() => {
    const handleResize = () => {
      setWindowBounds({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);

    // Boot synchronization: Apply settings to backend & ensure window is safely on screen
    if (isElectronEnv && window.electronAPI) {
      window.electronAPI.applySettings(store.state.settings);
      // Wait a tiny bit for bounds to settle, then snap if stranded off-screen
      setTimeout(() => {
        window.electronAPI?.snapToBounds();
      }, 500);
    }

    return () => window.removeEventListener('resize', handleResize);
  }, [isElectronEnv]);

  // ─── Feature: Voice Push-to-Talk (Right-Click & Hold) ────────
  const [orbVoiceState, setOrbVoiceState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [voiceInterimText, setVoiceInterimText] = useState('');
  const isHoldingRightClick = useRef(false);
  const rightClickStartTime = useRef(0);
  const voiceServiceRef = useRef<VoiceService | null>(null);
  const interimTextRef = useRef('');

  useEffect(() => {
    const groqKey = store.state?.settings?.aiConfig?.apiKeys?.groq;
    const openaiKey = store.state?.settings?.aiConfig?.apiKeys?.openai;
    const primaryKey = groqKey || openaiKey;
    const fallbackKeys = [groqKey, openaiKey].filter((k): k is string => Boolean(k) && k !== primaryKey);

    voiceServiceRef.current = new VoiceService({
      apiKey: primaryKey,
      provider: primaryKey?.startsWith('sk-') ? 'openai' : 'groq',
      fallbackKeys,
      onInterimResult: (text) => {
        if (text) {
          interimTextRef.current = text;
          setVoiceInterimText(text);
        }
      },
      onError: (err) => {
        console.warn('[FloatingAssistant Voice Error]', err);
        setOrbVoiceState('idle');
        isHoldingRightClick.current = false;
      }
    });

    return () => {
      if (voiceServiceRef.current) {
        voiceServiceRef.current.stop();
      }
      stopSpeech();
    };
  }, [store.state?.settings?.aiConfig?.apiKeys?.groq, store.state?.settings?.aiConfig?.apiKeys?.openai]);

  const executeVoicePrompt = async (prompt: string) => {
    const normalizedPrompt = prompt.trim().toLowerCase();
    const isStopOrExit = /^(?:(?:hey\s+)?(?:float|flow)\s+)?(stop|exit|done|finish|cancel|dismiss|nevermind|never\s+mind|close|band\s+karo|chup)$/i.test(normalizedPrompt);
    if (isStopOrExit) {
      stopSpeech();
      setOrbVoiceState('idle');
      setVoiceInterimText('');
      wakeEngineRef.current?.notifyAssistantIdle();
      if (isOpen) {
        setIsOpen(false);
      }
      return;
    }

    setOrbVoiceState('processing');
    if (store.state.settings.desktopAgent?.orbAutoShow !== false && !isOpenRef.current) {
      await openPanelRef.current('chat');
    }

    const userMsg: Message = {
      id: store.generateId(),
      role: 'user',
      content: prompt,
      timestamp: Date.now()
    };

    const newMessages = [...(store.state.messages || []), userMsg];
    store.setState(prev => ({
      ...prev,
      messages: newMessages
    }));

    // Sync to Firestore
    import('../lib/firebase').then(({ db, doc, setDoc, auth }) => {
      if (auth.currentUser) {
        setDoc(doc(db, 'users', auth.currentUser.uid), { messages: newMessages }, { merge: true });
      }
    });

    const sayAloud = (message: string) => {
      const spoken = spokenAnswer(message);
      if (!spoken) {
        setOrbVoiceState('idle');
        return;
      }
      setOrbVoiceState('speaking');
      playSpeech(spoken, { onEnd: () => setOrbVoiceState('idle') }).catch(() => setOrbVoiceState('idle'));
    };

    try {
      // 1. Zero-Token Deterministic Fast-Path (Media, Diagnostics, Launch)
      const fast = await tryFastRoute(prompt, store.state);
      if (fast.handled && fast.message) {
        const asstId = store.generateId();
        const asstMsg: Message = {
          id: asstId,
          role: 'assistant',
          content: fast.message,
          timestamp: Date.now()
        };
        store.setState(prev => ({
          ...prev,
          messages: [...prev.messages, asstMsg]
        }));

        sayAloud(fast.message);
        return;
      }

      // 2. Agentic Command Routing (OS / browser / desktop agent)
      const intent = await resolveCommandIntent(prompt);
      if (['browser_action', 'os_action', 'floatgpt_control', 'os_agent', 'memory_query'].includes(intent.intent)) {
        const flowResult = await executeRoutedCommand(intent, prompt);
        const asstId = store.generateId();
        const asstMsg: Message = {
          id: asstId,
          role: 'assistant',
          content: flowResult.message,
          timestamp: Date.now()
        };
        store.setState(prev => ({
          ...prev,
          messages: [...prev.messages, asstMsg]
        }));

        sayAloud(flowResult.message);
        return;
      }

      // 3. Fallback: Standard AI Generation
      const data = await generateAIResponse(store.state, prompt);
      const asstId = store.generateId();
      const asstMsg: Message = {
        id: asstId,
        role: 'assistant',
        content: data.message,
        timestamp: Date.now()
      };
      store.setState(prev => ({
        ...prev,
        messages: [...prev.messages, asstMsg]
      }));

      sayAloud(data.message);
    } catch (err: any) {
      console.error('[FloatingAssistant] Voice execution error:', err);
      const errorMsg = err?.message || 'Failed to process voice command. Please check your API keys and connection.';
      const asstMsg: Message = {
        id: store.generateId(),
        role: 'assistant',
        content: `⚠️ Voice Command Error: ${errorMsg}`,
        timestamp: Date.now()
      };
      store.setState(prev => ({
        ...prev,
        messages: [...prev.messages, asstMsg]
      }));
      setOrbVoiceState('idle');
    }
  };

  // Hands-free VAD and "Hey Float" wake word are off.
  // Voice stays on the chat mic button and right-click-hold on the orb (VoiceService below).
  const wakeEngineRef = useRef<{ pause: () => void; notifyAssistantIdle: () => void } | null>(null);

  const handleOrbMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) {
      // Right-click down: Initiate Push-to-Talk
      e.preventDefault();
      e.stopPropagation();
      wakeEngineRef.current?.pause();
      isHoldingRightClick.current = true;
      rightClickStartTime.current = Date.now();
      interimTextRef.current = '';
      setVoiceInterimText('');
      setOrbVoiceState('listening');

      if (voiceServiceRef.current) {
        voiceServiceRef.current.start().catch((err) => {
          console.warn('[FloatingAssistant] Failed to start voice:', err);
          setOrbVoiceState('idle');
          isHoldingRightClick.current = false;
        });
      }

      const handleGlobalRelease = (upEvent: MouseEvent | PointerEvent) => {
        if (upEvent.button === 2) {
          cleanup();
          handleOrbRightClickRelease();
        }
      };

      const handleCancel = () => {
        if (isHoldingRightClick.current) {
          cleanup();
          isHoldingRightClick.current = false;
          setOrbVoiceState('idle');
          if (voiceServiceRef.current) {
            voiceServiceRef.current.stop().catch(() => {});
          }
        }
      };

      const cleanup = () => {
        window.removeEventListener('mouseup', handleGlobalRelease);
        window.removeEventListener('pointerup', handleGlobalRelease);
        window.removeEventListener('blur', handleCancel);
      };

      window.addEventListener('mouseup', handleGlobalRelease);
      window.addEventListener('pointerup', handleGlobalRelease);
      window.addEventListener('blur', handleCancel);
    }
  };

  const handleOrbRightClickRelease = async () => {
    if (!isHoldingRightClick.current) return;
    isHoldingRightClick.current = false;
    const holdDuration = Date.now() - rightClickStartTime.current;

    if (!voiceServiceRef.current) {
      setOrbVoiceState('idle');
      return;
    }

    setOrbVoiceState('processing');
    try {
      const transcript = await voiceServiceRef.current.stop();
      const finalPrompt = (transcript || interimTextRef.current).trim();

      // Clear interim text buffer immediately so next voice session starts completely fresh
      interimTextRef.current = '';
      setVoiceInterimText('');

      if (!finalPrompt || holdDuration < 250) {
        setOrbVoiceState('idle');
        if (holdDuration >= 250) {
          const missed: Message = {
            id: store.generateId(),
            role: 'assistant',
            content: 'I didn’t catch that. Hold the button and say the whole question in one go.',
            timestamp: Date.now()
          };
          store.setState(prev => ({ ...prev, messages: [...(prev.messages || []), missed] }));
        }
        return;
      }

      await executeVoicePrompt(finalPrompt);
    } catch (err) {
      console.error('[FloatingAssistant] Voice stop error:', err);
      interimTextRef.current = '';
      setVoiceInterimText('');
      setOrbVoiceState('idle');
    }
  };

  // ─── Feature 1: Global Hotkey ─────────────────────
  useEffect(() => {
    if (!isElectronEnv) return;

    let unsubHotkey = () => {};

    if (window.electronAPI?.onTogglePanel) {
      unsubHotkey = window.electronAPI.onTogglePanel(() => {
        setActiveTab('chat');
        if (!isOpen) handleElectronClick();
      });
    }

    return () => {
      unsubHotkey();
    };
  }, [isElectronEnv, isOpen, isResizing, store.state.settings.desktopAgent?.orbAutoShow]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let needsUpdate = false;

      const TWO_HOURS = 2 * 60 * 60 * 1000;

      const updatedTasks = (store.state.tasks || []).map(task => {
        if (task.status === 'Completed' && task.completedAt && (now - task.completedAt > TWO_HOURS)) {
           needsUpdate = true;
           return { ...task, status: 'Archived' as const };
        }
        return task;
      });

      const updatedGoals = (store.state.goals || []).map(goal => {
        if ((goal.status === 'Completed' || goal.progress >= 100) && goal.status !== 'Archived') {
           if (!goal.completedAt) goal.completedAt = now;
           if (now - goal.completedAt > TWO_HOURS) {
             needsUpdate = true;
             return { ...goal, status: 'Archived' as const };
           }
           if (goal.status !== 'Completed') {
             needsUpdate = true;
             return { ...goal, status: 'Completed' as const };
           }
        }
        return goal;
      });

      const updatedProjects = (store.state.projects || []).map(project => {
        if ((project.status === 'Completed' || project.progress >= 100) && project.status !== 'Archived') {
           if (!project.completedAt) project.completedAt = now;
           if (now - project.completedAt > TWO_HOURS) {
             needsUpdate = true;
             return { ...project, status: 'Archived' as const };
           }
           if (project.status !== 'Completed') {
             needsUpdate = true;
             return { ...project, status: 'Completed' as const };
           }
        }
        return project;
      });

      if (needsUpdate) {
        store.setState(s => ({ ...s, tasks: updatedTasks, goals: updatedGoals, projects: updatedProjects }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [store.state.tasks, store.state.goals, store.setState]);

  const handleDragStart = () => {
    setIsDragging(true);
    if (isOpen) setIsOpen(false);
  };

  const handleDragEnd = () => {
    setTimeout(() => setIsDragging(false), 150);
    const currentX = x.get();
    const currentY = y.get();
    localStorage.setItem('floatgpt_orb_pos', JSON.stringify({ x: currentX, y: currentY }));
  };

  const handleClick = () => {
    if (!isDragging) {
      setIsOpen(!isOpen);
    }
  };

  // ─── Electron Desktop Mode Handlers ─────────────────────────

  /** Closes the panel and shrinks the Electron window back to orb size. */
  const closePanel = () => {
    setIsOpen(false);
  };

  // Dynamically adjust if activeAlert or canvasActive changes while closed
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const panelWasOpen = useRef(false);
  useEffect(() => {
    if (panelWasOpen.current && !isOpen) {
      stopSpeech();
      setOrbVoiceState((current) => (current === 'speaking' ? 'idle' : current));
    }
    panelWasOpen.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (isElectronEnv && window.electronAPI && !isOpen && !isDragging) {
      let cancelled = false;
      const updateBounds = async () => {
        let targetW = COLLAPSED_SIZE;
        let targetH = COLLAPSED_SIZE;
        let newOrbX = ORB_PAD;
        let newOrbY = ORB_PAD;

        if (canvasActive) {
          const display = window.electronAPI?.getNearestDisplay 
            ? await window.electronAPI.getNearestDisplay()
            : { workArea: { width: window.screen.width, height: window.screen.height } };
          if (cancelled || isOpenRef.current) return;
            
          targetW = display.workArea.width;
          targetH = display.workArea.height;
          newOrbX = (targetW - ORB_SIZE) / 2; // Center the Orb horizontally
          newOrbY = 20; // Position orb near top of screen
        } else if (showCloud) {
           targetW = 240;
           targetH = 208;
           if (electronLayout.panelDir === 'left') newOrbX = targetW - ORB_SIZE - ORB_PAD;
           else newOrbX = ORB_PAD;
           newOrbY = targetH - ORB_SIZE - ORB_PAD;
        }

        if (cancelled || isOpenRef.current) return;
        const anchorTop = showCloud || cloudAnchor.current;
        cloudAnchor.current = showCloud;
        window.electronAPI!.resizeWindow({
          width: targetW,
          height: targetH,
          panelOnLeft: electronLayout.panelDir === 'left',
          panelOnTop: anchorTop || electronLayout.panelOnTop,
          collapsing: !canvasActive,
          fixedOrb: true,
          currentOrbX: electronLayout.orbX,
          currentOrbY: electronLayout.orbY,
          newOrbX: newOrbX,
          newOrbY: newOrbY,
        });
        setElectronLayout(prev => ({ ...prev, orbX: newOrbX, orbY: newOrbY }));
      };
      updateBounds();
      return () => { cancelled = true; };
    }
  }, [showCloud, canvasActive, isOpen, isElectronEnv]);

  // Dynamically manage click-through padding (Ghost Blocking Fix)
  useEffect(() => {
    if (isElectronEnv && window.electronAPI?.setIgnoreMouseEvents) {
      if (isOpen) {
        window.electronAPI.setIgnoreMouseEvents(false);
      } else if (canvasActive) {
        if (canvasStore.tool === 'pointer') {
          // When in pointer mode, allow clicks to pass through to OS
          window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
        } else {
          // Drawing mode, capture clicks for canvas
          window.electronAPI.setIgnoreMouseEvents(false);
        }
      } else {
        // When collapsed to orb, make transparent padding click-through
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  }, [isOpen, canvasActive, canvasStore.tool, isElectronEnv]);

  const handleOrbMouseEnter = () => {
    if (isElectronEnv && !isOpen && window.electronAPI?.setIgnoreMouseEvents) {
      window.electronAPI.setIgnoreMouseEvents(false);
    }
  };

  const handleOrbMouseLeave = () => {
    if (isDraggingWin.current) return;
    if (isElectronEnv && !isOpen && window.electronAPI?.setIgnoreMouseEvents) {
      if (!canvasActive) {
        // Re-enable click-through when mouse leaves the orb (only if canvas is inactive)
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  };

  // ─── Shared Render Logic ───────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !isElectronEnv) return;
    
    isDraggingWin.current = true;
    hasMoved.current = false;
    
    // Synchronously grab the exact offset of the mouse relative to the window's top-left corner
    dragOffset.current = {
      x: e.clientX,
      y: e.clientY
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingWin.current || !isElectronEnv) return;
    hasMoved.current = true;
    const api = window.electronAPI;
    if (!api) return;
    
    api.setWindowPosition(e.screenX - dragOffset.current.x, e.screenY - dragOffset.current.y);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingWin.current || !isElectronEnv) return;
    isDraggingWin.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    if (!hasMoved.current) {
      handleElectronClick();
    } else {
      // Safely snap to bounds after dragging finishes
      window.electronAPI?.snapToBounds({ orbX: electronLayout.orbX, orbY: electronLayout.orbY, orbSize: ORB_SIZE });
    }
  };

  /** Opens the panel and grows the native window to fit it. */
  const openPanel = async (tab?: 'home' | 'plan' | 'chat' | 'labs' | 'history') => {
    const api = window.electronAPI;
    if (!isElectronEnv || !api) {
      if (tab) setActiveTab(tab);
      setIsOpen(true);
      return;
    }
    const clipped = window.innerWidth < PANEL_WIDTH - 8;
    if (isOpenRef.current && !clipped) return;
    if (tab) setActiveTab(tab);
    if (isResizing) return;
    setIsResizing(true);
    try {
      const { x: winX, y: winY } = await api.getWindowPosition();
      const nearest = api.getNearestDisplay
        ? await api.getNearestDisplay()
        : { workArea: { x: 0, y: 0, ...(await api.getScreenSize()) } };
      const scrW = nearest.workArea.width;
      const scrH = nearest.workArea.height;
      const scrX = nearest.workArea.x || 0;
      const scrY = nearest.workArea.y || 0;

      const orbScreenCenterX = winX + electronLayout.orbX + ORB_SIZE / 2;
      const orbScreenCenterY = winY + electronLayout.orbY + ORB_SIZE / 2;
      const isOnLeft = orbScreenCenterX < scrX + scrW / 2;
      const isOnTop = orbScreenCenterY < scrY + scrH / 2;

      const ePanelH = Math.min(PANEL_HEIGHT, scrH - 32);
      const totalW = ORB_PAD * 2 + ORB_SIZE + PANEL_GAP + PANEL_WIDTH;
      const totalH = ORB_PAD * 2 + Math.max(ORB_SIZE, ePanelH);

      let eOrbX: number, eOrbY: number, ePanelX: number, ePanelY: number;
      if (isOnLeft) {
        eOrbX = ORB_PAD;
        ePanelX = ORB_PAD + ORB_SIZE + PANEL_GAP;
      } else {
        eOrbX = ORB_PAD + PANEL_WIDTH + PANEL_GAP;
        ePanelX = ORB_PAD;
      }
      if (isOnTop) {
        eOrbY = ORB_PAD;
        ePanelY = ORB_PAD;
      } else {
        eOrbY = totalH - ORB_PAD - ORB_SIZE;
        ePanelY = ORB_PAD;
      }

      setElectronLayout(prev => ({
        ...prev,
        orbX: eOrbX,
        orbY: eOrbY,
        panelX: ePanelX,
        panelY: ePanelY,
        panelH: ePanelH,
        panelDir: isOnLeft ? 'right' : 'left',
        panelOnTop: !isOnTop
      }));

      await api.resizeWindow({
        width: totalW,
        height: totalH,
        panelOnLeft: !isOnLeft,
        panelOnTop: !isOnTop,
        collapsing: false,
        fixedOrb: true,
        currentOrbX: electronLayout.orbX,
        currentOrbY: electronLayout.orbY,
        newOrbX: eOrbX,
        newOrbY: eOrbY,
      });
      setIsOpen(true);
    } finally {
      setIsResizing(false);
    }
  };
  openPanelRef.current = openPanel;

  useEffect(() => {
    if (!isElectronEnv || !isOpen) return;
    if (window.innerWidth >= PANEL_WIDTH - 8) return;
    void openPanelRef.current();
  }, [isOpen, isElectronEnv, windowBounds.width]);

  /** Handles orb click in Electron mode: expand/collapse the native window. */
  const handleElectronClick = async () => {
    if (isResizing) return;
    if (!isOpen) {
      await openPanel('chat');
    } else {
      closePanel();
    }
  };

  // Safe Panel Sizing and Positioning Logic
  const orbX = x.get();
  const orbY = y.get();
  
  const MAX_PANEL_HEIGHT = 600;
  const panelW = Math.min(PANEL_WIDTH, windowBounds.width - 32);
  const panelH = Math.min(MAX_PANEL_HEIGHT, windowBounds.height - 32);

  const isLeft = orbX < windowBounds.width / 2;
  const isTop = orbY < windowBounds.height / 2;

  const idealAbsTop = isTop ? orbY : orbY - (panelH - ORB_SIZE);
  let clampedAbsTop = idealAbsTop;
  if (clampedAbsTop < 16) clampedAbsTop = 16;
  if (clampedAbsTop + panelH > windowBounds.height - 16) clampedAbsTop = windowBounds.height - 16 - panelH;
  const relativeTop = clampedAbsTop - orbY;

  const idealAbsLeft = isLeft ? orbX + ORB_SIZE + 16 : orbX - panelW - 16;
  let clampedAbsLeft = idealAbsLeft;
  if (clampedAbsLeft < 16) clampedAbsLeft = 16;
  if (clampedAbsLeft + panelW > windowBounds.width - 16) clampedAbsLeft = windowBounds.width - 16 - panelW;
  const relativeLeft = clampedAbsLeft - orbX;

  // Guardian Visuals
  const getGuardianStyles = () => {
    switch (guardianStatus) {
      case 'EMERGENCY': return 'bg-danger/20 border-danger shadow-[0_0_20px_var(--color-danger)] animate-pulse scale-105';
      case 'OVERDUE': return 'bg-danger/10 border-danger/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]';
      case 'CRITICAL': return 'bg-danger/10 border-danger/60 shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all duration-[2000ms] ease-in-out glow-pulse-fast';
      case 'WARNING': return 'bg-warning/10 border-warning/60 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all duration-[3000ms] ease-in-out glow-pulse';
      case 'WATCH':
      case 'SAFE':
      default: return 'bg-panel border-card-border hover:border-accent/50';
    }
  };

  const getIconColor = () => {
    if (isOpen) return 'text-accent';
    switch (guardianStatus) {
      case 'EMERGENCY':
      case 'OVERDUE':
      case 'CRITICAL': return 'text-danger';
      case 'WARNING': return 'text-warning';
      case 'WATCH':
      case 'SAFE':
      default: return 'text-icon';
    }
  };

  // ─── Electron Desktop Render Path ──────────────────────────
  const isExtreme = guardianStatus === 'EMERGENCY'; // Strictly active only in [-10m, +10m]

  const AuthOverlay = (!store.user && !isAuthDismissed) ? (
    <div 
      className="flex-1 flex flex-col items-center justify-center relative overflow-hidden h-full min-h-[400px] w-full bg-[#050505] font-sans"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Animated Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>
      
      {/* Floating Glowing Orbs */}
      <div className="absolute top-[20%] left-[15%] w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px] mix-blend-screen animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[15%] w-64 h-64 bg-violet-600/20 rounded-full blur-[80px] mix-blend-screen animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      
      {/* Geometric Accents */}
      <div className="absolute top-[15%] right-[10%] w-64 h-64 border border-white/5 rounded-full rotate-45 pointer-events-none"></div>
      <div className="absolute bottom-[10%] left-[10%] w-80 h-80 border border-indigo-500/10 rounded-full pointer-events-none"></div>

      {/* Brand Doodling Text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-5">
        <div className="text-[120px] font-black tracking-tighter text-white leading-none rotate-[-5deg] scale-150">FLOATGPT</div>
      </div>
      
      {/* Close / Dismiss Button */}
      <button 
        onClick={dismissAuth} 
        className="absolute top-4 right-4 z-50 p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors cursor-pointer"
        style={{ WebkitAppRegion: 'no-drag' } as any}
        title="Continue in Local Mode"
      >
        <X className="w-4 h-4" />
      </button>

      <div 
        className="bg-[#111111]/90 backdrop-blur-3xl border border-white/10 px-7 py-8 rounded-[32px] shadow-[0_0_80px_rgba(0,0,0,0.5)] w-[88%] max-w-[340px] relative z-10 overflow-y-auto max-h-[85vh] hide-scrollbar animate-in fade-in zoom-in-95 duration-500"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <div className="flex justify-center mb-4">
          <img src="/logo-2-chat-circular.png" alt="FloatGPT Logo" className="w-12 h-12 rounded-2xl shadow-lg border border-white/10" />
        </div>
        <h2 className="text-lg font-bold text-white text-center mb-1 tracking-tight">Welcome to FloatGPT</h2>
        <p className="text-[12px] text-gray-400 text-center mb-4 leading-relaxed">Sync your intelligent workspace across all devices.</p>
        
        {authError && (
          <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] rounded-xl text-center leading-relaxed">
            {authError}
          </div>
        )}
        {authNotice && (
          <div className="mb-4 p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] rounded-xl text-center leading-relaxed">
            {authNotice}
          </div>
        )}
        
        <div className="space-y-3">
          {/* Sign In vs Create Account Switcher */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 mb-2">
            <button
              type="button"
              onClick={() => { setAuthMode('signin'); setAuthError(''); setAuthNotice(''); }}
              className={`flex-1 text-[12px] py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                authMode === 'signin' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthNotice(''); }}
              className={`flex-1 text-[12px] py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                authMode === 'signup' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={authLoading}
            className="w-full py-2.5 bg-white text-[#1f1f1f] hover:bg-white/90 disabled:opacity-50 rounded-xl text-[13px] font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <GoogleMark />
            Continue with Google
          </button>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-gray-500">
            <div className="h-px flex-1 bg-white/10" />
            or email
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleLogin} className="space-y-2.5">
            {authMode === 'signup' && (
              <div>
                <input 
                  name="name"
                  type="text" 
                  placeholder="Full Name (optional)" 
                  autoComplete="name"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-[13px] text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-500/70" 
                />
              </div>
            )}
            <div>
              <input 
                name="email"
                type="email" 
                placeholder="Email address" 
                required 
                autoComplete="email" 
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-[13px] text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-500/70" 
              />
            </div>
            <div>
              <input 
                name="password"
                type="password" 
                placeholder={authMode === 'signup' ? 'Password (min 6 characters)' : 'Password'} 
                required 
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} 
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-[13px] text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-500/70" 
              />
            </div>
            <button 
              type="submit" 
              disabled={authLoading}
              className="w-full py-2.5 mt-1 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-[13px] font-medium transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {authLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {authMode === 'signin' ? 'Sign In to Workspace' : 'Create Free Account'}
            </button>
          </form>

          <button
            type="button"
            onClick={dismissAuth}
            className="w-full text-center py-1 text-[11px] font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            Continue in Local Mode (Skip Sign In) →
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const showFlowDot = !!store.state.settings.desktopAgent?.enabled && store.state.settings.desktopAgent?.showStatusIndicator !== false;

  if (isElectronEnv) {
    return (
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1000 }}>
        <UpdateNotifier />
        {showFlowDot && (
          <div
            style={{
              position: 'absolute',
              left: electronLayout.orbX + 42,
              top: electronLayout.orbY + 2,
              width: 10,
              height: 10,
              borderRadius: 999,
              background: 'var(--accent)',
              boxShadow: '0 0 0 2px var(--bg)',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />
        )}
        {!isOpen && !noticesMuted && unseenNotices > 0 && (
          <span
            style={{
              position: 'absolute',
              left: electronLayout.orbX + ORB_SIZE - 16,
              top: electronLayout.orbY,
              pointerEvents: 'none',
              zIndex: 4,
            }}
            className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[8px] font-bold text-white"
          >
            {unseenNotices > 9 ? '9+' : unseenNotices}
          </span>
        )}
        <motion.div
          className={`w-14 h-14 flex items-center justify-center border cursor-pointer hover:bg-text-muted/10 transition-colors ${getGuardianStyles()} ${orbShape === 'squircle' ? 'rounded-2xl' : 'rounded-full'}`}
          style={{
            position: 'absolute',
            left: electronLayout.orbX,
            top: electronLayout.orbY,
            boxShadow: 'none', // Force no shadows in Electron mode to prevent square clipping against the native window bounds
            pointerEvents: 'auto',
            clipPath: orbShape === 'squircle' ? 'inset(0% round 16px)' : 'circle(50% at 50% 50%)',
            opacity: (!isOpen && !isDragging) ? orbOpacity : 1,
            transition: 'opacity 0.3s ease',
          }}
          onMouseDown={handleOrbMouseDown}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onMouseEnter={handleOrbMouseEnter}
          onMouseLeave={handleOrbMouseLeave}
          title={
            orbVoiceState === 'listening'
              ? "🎤 Listening... (Say command or release)"
              : orbVoiceState === 'processing'
                ? "⚡ Processing command..."
                : orbVoiceState === 'speaking'
                  ? "🔊 Speaking response..."
                  : (isOpen ? "Close Panel" : "FloatGPT (right-click and hold to talk)")
          }
          animate={
            orbVoiceState === 'processing'
              ? {
                  scale: [orbScale, orbScale * 1.05, orbScale],
                  borderColor: ['rgba(99, 102, 241, 0.8)', 'rgba(168, 85, 247, 1)', 'rgba(56, 189, 248, 1)', 'rgba(99, 102, 241, 0.8)'],
                  backgroundColor: 'rgba(99, 102, 241, 0.25)',
                }
              : orbVoiceState === 'listening'
                ? {
                    scale: [orbScale, orbScale * 1.1, orbScale],
                    borderColor: ['rgba(236, 72, 153, 0.8)', 'rgba(168, 85, 247, 1)', 'rgba(236, 72, 153, 0.8)'],
                    backgroundColor: 'rgba(168, 85, 247, 0.3)',
                  }
                : orbVoiceState === 'speaking'
                  ? {
                      scale: [orbScale, orbScale * 1.06, orbScale],
                      borderColor: ['rgba(34, 197, 94, 0.8)', 'rgba(16, 185, 129, 1)', 'rgba(34, 197, 94, 0.8)'],
                      backgroundColor: 'rgba(34, 197, 94, 0.25)',
                    }
                  : isViolatingFocus 
                    ? { 
                        x: [-3, 3, -3, 3, 0],
                        backgroundColor: ['rgba(255, 0, 0, 0.2)', 'rgba(255, 0, 0, 0.5)', 'rgba(255, 0, 0, 0.2)'],
                        borderColor: ['rgba(255, 0, 0, 0.8)', 'rgba(255, 0, 0, 1)', 'rgba(255, 0, 0, 0.8)'],
                        scale: orbScale
                      }
                    : isExtreme 
                      ? { backgroundColor: ['rgba(239, 68, 68, 0.1)', 'rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0.1)'], borderColor: ['rgba(239, 68, 68, 0.4)', 'rgba(239, 68, 68, 0.8)', 'rgba(239, 68, 68, 0.4)'], scale: orbScale } 
                      : { backgroundColor: 'var(--color-panel)', borderColor: 'var(--color-card-border)', x: 0, scale: orbScale }
          }
          transition={
            orbVoiceState === 'processing'
              ? {
                  scale: { duration: 1.0, repeat: Infinity, ease: 'easeInOut' },
                  borderColor: { duration: 2.0, repeat: Infinity, ease: 'linear' },
                }
              : orbVoiceState === 'listening'
                ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }
                : orbVoiceState === 'speaking'
                  ? { duration: 1.0, repeat: Infinity, ease: 'easeInOut' }
                  : isViolatingFocus 
                    ? { duration: 0.15, repeat: Infinity, ease: 'linear' }
                    : { duration: 0.25, ease: 'easeInOut' }
          }
        >
          {orbVoiceState === 'processing' && (
            <div className={`absolute inset-0 border-2 border-t-cyan-400 border-r-indigo-500 border-b-purple-500 border-l-transparent animate-spin pointer-events-none ${orbShape === 'squircle' ? 'rounded-2xl' : 'rounded-full'}`} />
          )}
          {orbVoiceState === 'listening' ? (
            <Mic className="w-6 h-6 text-fuchsia-300 animate-pulse relative z-10" />
          ) : orbVoiceState === 'processing' ? (
            <Sparkles className="w-6 h-6 text-cyan-300 animate-spin relative z-10" />
          ) : orbVoiceState === 'speaking' ? (
            <Volume2 className="w-6 h-6 text-emerald-300 animate-bounce relative z-10" />
          ) : (
            <BrainCircuit className={`w-6 h-6 transition-colors relative z-10 ${isViolatingFocus ? 'text-red-500 glow-pulse-fast drop-shadow-[0_0_15px_rgba(255,0,0,0.8)]' : getIconColor()} ${orbGlow !== 'none' && !isOpen && !isViolatingFocus ? (orbGlow === 'intense' ? 'glow-pulse-fast drop-shadow-[0_0_15px_rgba(99,102,241,0.8)]' : 'glow-pulse drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]') : ''}`} style={{ transform: 'none' }} />
          )}
        </motion.div>

        {showCloud && statusCloud && (
          <StatusCloudBubble
            cloud={statusCloud}
            onOpen={openCloud}
            onDismiss={dismissCloud}
            onEnter={handleOrbMouseEnter}
            onLeave={handleOrbMouseLeave}
            align={electronLayout.panelDir === 'left' ? 'right' : 'left'}
            style={{
              bottom: `calc(100% - ${Math.max(0, electronLayout.orbY - 4)}px)`,
              left: electronLayout.panelDir === 'left' ? undefined : 8,
              right: electronLayout.panelDir === 'left' ? 8 : undefined,
            }}
          />
        )}

        {/* Attached Canvas Toolbar below Orb when panel is closed */}
        {!isOpen && canvasActive && (
          <div 
            className="absolute flex items-center justify-center z-50 electron-no-drag"
            style={{
              left: electronLayout.orbX + (ORB_SIZE / 2),
              transform: 'translateX(-50%)',
              top: electronLayout.orbY + ORB_SIZE + 12,
              pointerEvents: 'none',
            }}
          >
            <div 
              style={{ pointerEvents: 'auto' }}
              onMouseEnter={handleOrbMouseEnter}
              onMouseLeave={handleOrbMouseLeave}
            >
              <CanvasToolbar onClose={() => toggleCanvas()} />
            </div>
          </div>
        )}

        {/* Panel */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="absolute bg-panel border border-card-border rounded-2xl shadow-2xl flex flex-col overflow-hidden electron-no-drag"
            style={{
              width: isElectronEnv ? PANEL_WIDTH : '100%',
              height: isElectronEnv ? electronLayout.panelH : '100%',
              left: isElectronEnv ? electronLayout.panelX : 0,
              top: isElectronEnv ? electronLayout.panelY : 0,
              cursor: 'default',
              pointerEvents: 'auto',
            }}
          >
            {AuthOverlay ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-bg">
                {AuthOverlay}
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-card-border bg-bg-secondary" style={{ WebkitAppRegion: 'drag' } as any}>
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-accent" />
                    <span className="font-semibold text-text-primary text-xs tracking-wider shrink-0 whitespace-nowrap">FloatGPT</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <button
                      onClick={() => {
                        const todayId = new Date().toISOString().split('T')[0];
                        store.setState(s => {
                          const newId = s.sessionId === todayId ? `${todayId}-${store.generateId()}` : todayId;
                          const nextState = performRollover(s, newId);
                          return { ...nextState, viewingSessionId: null };
                        });
                        setActiveTab('chat');
                      }}
                      className="p-1 hover:bg-panel-hover rounded text-text-muted hover:text-text-primary transition-colors"
                      title="New Conversation"
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setActiveTab('history'); }}
                      className={`p-1 rounded transition-colors ${activeTab === 'history' ? 'bg-panel-hover text-text-primary' : 'hover:bg-panel-hover text-text-muted hover:text-text-primary'}`}
                      title="History"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={toggleCanvas}
                      className={`electron-no-drag p-1 rounded transition-all cursor-pointer ${canvasActive ? 'bg-accent text-white shadow-sm ring-1 ring-accent/40' : 'hover:bg-panel-hover text-text-muted hover:text-text-primary'}`}
                      style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
                      title="Screen Canvas & Drawing Overlay (Draw on screen)"
                    >
                      <Paintbrush className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={openNotices}
                      className={`electron-no-drag relative p-1 rounded transition-colors cursor-pointer ${noticeOpen ? 'bg-panel-hover text-text-primary' : 'hover:bg-panel-hover text-text-muted hover:text-text-primary'}`}
                      style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
                      title={noticesMuted ? 'Notifications are off' : 'Notifications'}
                    >
                      {noticesMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                      {!noticesMuted && unseenNotices > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[8px] font-bold text-white">
                          {unseenNotices > 9 ? '9+' : unseenNotices}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveTab('labs'); }}
                      className={`electron-no-drag p-1 rounded transition-colors cursor-pointer ${activeTab === 'labs' ? 'bg-panel-hover text-text-primary' : 'hover:bg-panel-hover text-text-muted hover:text-text-primary'}`}
                      style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
                      title="Settings & Labs"
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={closePanel}
                      className="electron-no-drag p-1 hover:bg-panel-hover rounded text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                      style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <NoticeInbox
                  open={noticeOpen}
                  notices={waNotices}
                  linkNote={linkNote}
                  focusNote={guardianStatus && guardianStatus !== 'SAFE' ? `Focus guard: ${String(guardianStatus).toLowerCase()}` : ''}
                  muted={noticesMuted}
                  onToggleMute={toggleNotices}
                  onDismiss={dismissNotice}
                />

                {canvasActive && (
                  <div className="px-3 py-1.5 border-b border-card-border bg-bg-secondary/70 flex items-center justify-center">
                    <CanvasToolbar className="w-full justify-between shadow-none border-0 bg-transparent px-0 py-0" onClose={() => toggleCanvas()} />
                  </div>
                )}

                  <div className="flex border-b border-card-border bg-bg-secondary">
                    <button
                      onClick={() => { setActiveTab('home'); }}
                      className={`flex-1 py-3 text-[11px] font-medium uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'home' ? 'border-accent text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
                    >
                      <Home className="w-3.5 h-3.5" /> Home
                    </button>
                    <button
                      onClick={() => { setActiveTab('plan'); }}
                      className={`flex-1 py-3 text-[11px] font-medium uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'plan' ? 'border-accent text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
                    >
                      <FolderKanban className="w-3.5 h-3.5" /> Plan
                    </button>
                    <button
                      onClick={() => { setActiveTab('chat'); }}
                      className={`flex-1 py-3 text-[11px] font-medium uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'chat' ? 'border-accent text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Chat
                    </button>
                  </div>

                <div className="flex-1 overflow-hidden flex flex-col bg-bg">
                      {activeTab === 'home' && <HomePanel state={store.state} setState={store.setState} onOpenPlan={() => setActiveTab('plan')} />}
                      {activeTab === 'plan' && <PlanPanel state={store.state} setState={store.setState} generateId={store.generateId} />}
                      {activeTab === 'chat' && (
                        <ErrorBoundary compact>
                          <ChatPanel 
                            state={store.state} 
                            setState={store.setState} 
                            generateId={store.generateId} 
                          />
                        </ErrorBoundary>
                      )}
                      {activeTab === 'labs' && (
                        <ErrorBoundary compact>
                          <SettingsPanel resetStore={store.resetStore} state={store.state} setState={store.setState} onOpenKeys={() => setIsKeyModalOpen(true)} />
                        </ErrorBoundary>
                      )}
                      {activeTab === 'history' && <HistoryPanel state={store.state} setState={store.setState} setActiveTab={setActiveTab as (tab: string) => void} />}
                </div>

                {/* In-Panel Quick API Key & Model Hub */}
                <QuickApiKeyModal
                  isOpen={isKeyModalOpen}
                  onClose={() => setIsKeyModalOpen(false)}
                  state={store.state}
                  setState={store.setState}
                />
              </>
            )}
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <motion.div
      ref={orbRef}
      drag
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{ x, y, position: 'fixed', top: 0, left: 0, zIndex: 9999, touchAction: 'none', pointerEvents: 'none' }}
      dragConstraints={{ left: 0, top: 0, right: windowBounds.width - ORB_SIZE, bottom: windowBounds.height - ORB_SIZE }}
    >
      {showFlowDot && (
        <div
          style={{
            position: 'absolute',
            left: 44,
            top: 2,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: 'var(--accent)',
            boxShadow: '0 0 0 2px var(--bg)',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />
      )}
      {!isOpen && !noticesMuted && unseenNotices > 0 && (
        <span
          style={{ position: 'absolute', left: 40, top: 0, pointerEvents: 'none', zIndex: 4 }}
          className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[8px] font-bold text-white"
        >
          {unseenNotices > 9 ? '9+' : unseenNotices}
        </span>
      )}
      <motion.div 
        className={`w-14 h-14 flex items-center justify-center cursor-grab active:cursor-grabbing border ${getGuardianStyles()} ${orbShape === 'squircle' ? 'rounded-2xl' : 'rounded-full'}`}
        style={{
          ...((!statusCloud && guardianStatus === 'SAFE') ? { boxShadow: isOpen ? 'var(--orb-hover-shadow)' : 'var(--orb-shadow)' } : {}),
          pointerEvents: 'auto',
          clipPath: orbShape === 'squircle' ? 'inset(0% round 16px)' : 'circle(50% at 50% 50%)',
          opacity: (!isOpen && !isDragging) ? orbOpacity : 1,
          transition: 'opacity 0.3s ease',
        }}
        onClick={handleClick}
        onMouseDown={handleOrbMouseDown}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        title={
          orbVoiceState === 'listening'
            ? "🎤 Listening... (Say command or release)"
            : orbVoiceState === 'processing'
              ? "⚡ Processing command..."
              : orbVoiceState === 'speaking'
                ? "🔊 Speaking response..."
                : (isOpen ? "Close Panel" : "FloatGPT (right-click and hold to talk)")
        }
        animate={
          orbVoiceState === 'processing'
            ? {
                scale: [orbScale, orbScale * 1.05, orbScale],
                borderColor: ['rgba(99, 102, 241, 0.8)', 'rgba(168, 85, 247, 1)', 'rgba(56, 189, 248, 1)', 'rgba(99, 102, 241, 0.8)'],
                backgroundColor: 'rgba(99, 102, 241, 0.25)',
              }
            : orbVoiceState === 'listening'
              ? {
                  scale: [orbScale, orbScale * 1.1, orbScale],
                  borderColor: ['rgba(236, 72, 153, 0.8)', 'rgba(168, 85, 247, 1)', 'rgba(236, 72, 153, 0.8)'],
                  backgroundColor: 'rgba(168, 85, 247, 0.3)',
                }
              : orbVoiceState === 'speaking'
                ? {
                    scale: [orbScale, orbScale * 1.06, orbScale],
                    borderColor: ['rgba(34, 197, 94, 0.8)', 'rgba(16, 185, 129, 1)', 'rgba(34, 197, 94, 0.8)'],
                    backgroundColor: 'rgba(34, 197, 94, 0.25)',
                  }
                : isExtreme 
                  ? { backgroundColor: ['rgba(239, 68, 68, 0.1)', 'rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0.1)'], borderColor: ['rgba(239, 68, 68, 0.4)', 'rgba(239, 68, 68, 0.8)', 'rgba(239, 68, 68, 0.4)'], scale: orbScale } 
                  : { backgroundColor: 'var(--color-panel)', borderColor: 'var(--color-card-border)', scale: orbScale }
        }
        transition={
          orbVoiceState === 'processing'
            ? {
                scale: { duration: 1.0, repeat: Infinity, ease: 'easeInOut' },
                borderColor: { duration: 2.0, repeat: Infinity, ease: 'linear' },
              }
            : orbVoiceState === 'listening'
              ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }
              : orbVoiceState === 'speaking'
                ? { duration: 1.0, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.25, ease: 'easeInOut' }
        }
      >
        {orbVoiceState === 'processing' && (
          <div className={`absolute inset-0 border-2 border-t-cyan-400 border-r-indigo-500 border-b-purple-500 border-l-transparent animate-spin pointer-events-none ${orbShape === 'squircle' ? 'rounded-2xl' : 'rounded-full'}`} />
        )}
        {orbVoiceState === 'listening' ? (
          <Mic className="w-6 h-6 text-fuchsia-300 animate-pulse relative z-10" />
        ) : orbVoiceState === 'processing' ? (
          <Sparkles className="w-6 h-6 text-cyan-300 animate-spin relative z-10" />
        ) : orbVoiceState === 'speaking' ? (
          <Volume2 className="w-6 h-6 text-emerald-300 animate-bounce relative z-10" />
        ) : (
          <BrainCircuit className={`w-6 h-6 transition-colors relative z-10 ${getIconColor()} ${orbGlow !== 'none' && !isOpen ? (orbGlow === 'intense' ? 'glow-pulse-fast drop-shadow-[0_0_15px_rgba(99,102,241,0.8)]' : 'glow-pulse drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]') : ''}`} style={{ transform: 'none' }} />
        )}
      </motion.div>

      {orbVoiceState !== 'idle' && (
        <div 
          className={`absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-3.5 py-1.5 rounded-full text-[10px] font-bold tracking-wider shadow-2xl backdrop-blur-md transition-all border flex items-center gap-1.5 z-50 ${
            orbVoiceState === 'listening'
              ? 'bg-fuchsia-600/95 text-white border-fuchsia-400 shadow-fuchsia-500/40 animate-pulse'
              : orbVoiceState === 'processing'
                ? 'bg-indigo-600/95 text-white border-cyan-400 shadow-indigo-500/40'
                : 'bg-emerald-600/95 text-white border-emerald-400 shadow-emerald-500/40'
          }`}
          style={{ pointerEvents: 'none' }}
        >
          <span>{orbVoiceState === 'listening' ? '🎤' : orbVoiceState === 'processing' ? '⚡' : '🔊'}</span>
          <span className="uppercase font-extrabold tracking-wide">
            {orbVoiceState === 'listening' ? 'LISTENING:' : orbVoiceState === 'processing' ? 'PROCESSING:' : 'SPEAKING:'}
          </span>
          <span className="truncate max-w-[180px] font-medium font-mono text-[9px]">
            {orbVoiceState === 'listening' ? (voiceInterimText || 'Speak command...') : orbVoiceState === 'processing' ? 'Executing action...' : 'Playing response...'}
          </span>
        </div>
      )}

      {showCloud && statusCloud && (
        <StatusCloudBubble
          cloud={statusCloud}
          onOpen={openCloud}
          onDismiss={dismissCloud}
          align={isLeft ? 'left' : 'right'}
          style={{
            bottom: ORB_SIZE + 6,
            left: isLeft ? 0 : undefined,
            right: isLeft ? undefined : 0,
          }}
        />
      )}

      {/* Attached Canvas Toolbar below Orb in Web Mode */}
      {!isOpen && canvasActive && (
        <div 
          className="absolute flex items-center justify-center z-50"
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
            top: ORB_SIZE + 12,
            pointerEvents: 'auto',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseEnter={handleOrbMouseEnter}
          onMouseLeave={handleOrbMouseLeave}
        >
          <CanvasToolbar onClose={() => toggleCanvas()} />
        </div>
      )}

      {isOpen && (
        <motion.div 
          id="floatgpt-panel"
          initial={{ opacity: 0, scale: 0.95, transformOrigin: isLeft ? 'left center' : 'right center' }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="absolute bg-panel border border-card-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            width: panelW,
            height: panelH,
            left: relativeLeft,
            top: relativeTop,
            cursor: 'default',
            pointerEvents: 'auto'
          }}
          onPointerDown={(e) => e.stopPropagation()} 
        >
          {AuthOverlay ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-bg">
              {AuthOverlay}
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-card-border bg-bg-secondary">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-accent" />
                  <span className="font-semibold text-text-primary text-xs tracking-wider shrink-0 whitespace-nowrap">FloatGPT</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const todayId = new Date().toISOString().split('T')[0];
                      store.setState(s => {
                        const newId = s.sessionId === todayId ? `${todayId}-${store.generateId()}` : todayId;
                        const nextState = performRollover(s, newId);
                        return { ...nextState, viewingSessionId: null };
                      });
                      setActiveTab('chat');
                    }}
                    className="p-1 hover:bg-panel-hover rounded text-text-muted hover:text-text-primary transition-colors"
                    title="New Conversation"
                  >
                    <MessageSquarePlus className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      setActiveTab('history');
                    }}
                    className={`p-1 rounded transition-colors ${activeTab === 'history' ? 'bg-panel-hover text-text-primary' : 'hover:bg-panel-hover text-text-muted hover:text-text-primary'}`}
                    title="History"
                  >
                    <History className="w-4 h-4" />
                  </button>
                  <button
                    onClick={toggleCanvas}
                    className={`p-1 rounded transition-all ${canvasActive ? 'bg-accent text-white shadow-sm ring-1 ring-accent/40' : 'hover:bg-panel-hover text-text-muted hover:text-text-primary'}`}
                    title="Screen Canvas & Drawing Overlay (Draw on screen)"
                  >
                    <Paintbrush className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={openNotices}
                    className={`relative p-1 rounded transition-colors cursor-pointer ${noticeOpen ? 'bg-panel-hover text-text-primary' : 'hover:bg-panel-hover text-text-muted hover:text-text-primary'}`}
                    title={noticesMuted ? 'Notifications are off' : 'Notifications'}
                  >
                    {noticesMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                    {!noticesMuted && unseenNotices > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[8px] font-bold text-white">
                        {unseenNotices > 9 ? '9+' : unseenNotices}
                      </span>
                    )}
                  </button>
                  <button 
                    onClick={() => {
                      setActiveTab('labs');
                    }}
                    className={`p-1 rounded transition-colors ${activeTab === 'labs' ? 'bg-panel-hover text-text-primary' : 'hover:bg-panel-hover text-text-muted hover:text-text-primary'}`}
                    title="Settings & Labs"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={closePanel}
                    className="p-1 hover:bg-panel-hover rounded text-text-muted hover:text-text-primary transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <NoticeInbox
                open={noticeOpen}
                notices={waNotices}
                linkNote={linkNote}
                focusNote={guardianStatus && guardianStatus !== 'SAFE' ? `Focus guard: ${String(guardianStatus).toLowerCase()}` : ''}
                muted={noticesMuted}
                onToggleMute={toggleNotices}
                onDismiss={dismissNotice}
              />

              {/* Canvas Toolbar when panel is open */}
              {canvasActive && (
                <div className="px-3 py-1.5 border-b border-card-border bg-bg-secondary/70 flex items-center justify-center">
                  <CanvasToolbar className="w-full justify-between shadow-none border-0 bg-transparent px-0 py-0" onClose={() => toggleCanvas()} />
                </div>
              )}

              {/* Tabs */}
                <div className="flex border-b border-card-border bg-bg-secondary">
                  <button 
                    onClick={() => { setActiveTab('home'); }}
                    className={`flex-1 py-3 text-[11px] font-medium uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'home' ? 'border-accent text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
                  >
                    <Home className="w-3.5 h-3.5" /> Home
                  </button>
                  <button 
                    onClick={() => { setActiveTab('plan'); }}
                    className={`flex-1 py-3 text-[11px] font-medium uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'plan' ? 'border-accent text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
                  >
                    <FolderKanban className="w-3.5 h-3.5" /> Plan
                  </button>
                  <button 
                    onClick={() => { setActiveTab('chat'); }}
                    className={`flex-1 py-3 text-[11px] font-medium uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'chat' ? 'border-accent text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Chat
                  </button>
                </div>

              {/* Content Area */}
              <div className="flex-1 overflow-hidden flex flex-col bg-bg">
                    {activeTab === 'home' && <HomePanel state={store.state} setState={store.setState} onOpenPlan={() => setActiveTab('plan')} />}
                    {activeTab === 'plan' && <PlanPanel state={store.state} setState={store.setState} generateId={store.generateId} />}
                    {activeTab === 'chat' && (
                      <ErrorBoundary compact>
                        <ChatPanel 
                          state={store.state} 
                          setState={store.setState} 
                          generateId={store.generateId} 
                        />
                      </ErrorBoundary>
                    )}
                    {activeTab === 'labs' && (
                      <ErrorBoundary compact>
                        <SettingsPanel resetStore={store.resetStore} state={store.state} setState={store.setState} onOpenKeys={() => setIsKeyModalOpen(true)} />
                      </ErrorBoundary>
                    )}
                    {activeTab === 'history' && <HistoryPanel state={store.state} setState={store.setState} setActiveTab={setActiveTab as (tab: string) => void} />}
              </div>

              {/* In-Panel Quick API Key & Model Hub */}
              <QuickApiKeyModal
                isOpen={isKeyModalOpen}
                onClose={() => setIsKeyModalOpen(false)}
                state={store.state}
                setState={store.setState}
              />
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
