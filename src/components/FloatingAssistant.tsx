import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue } from 'motion/react';
import { BrainCircuit, X, Send, Home, FolderKanban, MessageSquare, Focus, Trash2, Settings2, History, MessageSquarePlus } from 'lucide-react';
import { AppState, Project, Goal, Task, Resource } from '../types';
import { HomePanel } from './assistant/HomePanel';
import { PlanPanel } from './assistant/PlanPanel';
import { ChatPanel } from './assistant/ChatPanel';
import { SettingsPanel } from './assistant/SettingsPanel';
import { FocusPanel } from './assistant/FocusPanel';
import { HistoryPanel } from './assistant/HistoryPanel';
import { useGuardian } from '../lib/guardian';
import { performRollover } from '../state/store';
import { generateAIResponse } from '../lib/ai';
import { ReflectionService } from '../lib/reflection';
import { auth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from '../lib/firebase';
import { Lock } from 'lucide-react';
const ORB_SIZE = 56;
const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 560;

// Electron desktop mode constants
const ORB_PAD = 8;
const PANEL_GAP = 16;
const COLLAPSED_SIZE = ORB_SIZE + ORB_PAD * 2;

interface StoreProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  resetStore: () => void;
  generateId: () => string;
  user: any;
}

export function FloatingAssistant({ store }: { store: StoreProps }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'plan' | 'chat' | 'labs' | 'history'>('chat');
  
  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        setAuthError('Incorrect email or password. Please try again.');
      } else {
        setAuthError(err.message);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  // ─── Electron Desktop Mode State ────────────────────────────
  const isElectronEnv = typeof window !== 'undefined' && !!window.electronAPI;
  const isDraggingWin = useRef(false);
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

  const { status: guardianStatus, activeAlert } = useGuardian(store.state);

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

  // ─── Feature 1: Global Hotkey Listener ─────────────────────
  useEffect(() => {
    if (!isElectronEnv || !window.electronAPI?.onTogglePanel) return;
    const unsubscribe = window.electronAPI.onTogglePanel(() => {
      if (!isOpen) {
        handleElectronClick();
      }
    });
    return unsubscribe;
  }, [isElectronEnv, isOpen, isResizing]);

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
    }, 1000);
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

  // Dynamically adjust if activeAlert changes while closed
  useEffect(() => {
    if (isElectronEnv && window.electronAPI && !isOpen && !isDragging) {
        let targetW = COLLAPSED_SIZE;
        let targetH = COLLAPSED_SIZE;
        let newOrbX = ORB_PAD;
        let newOrbY = ORB_PAD;

        if (activeAlert) {
           targetW = 300; // Room for urgent alert text
           targetH = 140;
           if (electronLayout.panelDir === 'left') newOrbX = targetW - ORB_SIZE - ORB_PAD;
           else newOrbX = ORB_PAD;
           
           if (electronLayout.panelOnTop) newOrbY = targetH - ORB_SIZE - ORB_PAD;
           else newOrbY = targetH - ORB_SIZE - ORB_PAD; // Force orb to bottom when cloud is present so cloud fits above
        }

        window.electronAPI.resizeWindow({
          width: targetW,
          height: targetH,
          panelOnLeft: electronLayout.panelDir === 'left',
          panelOnTop: electronLayout.panelOnTop, // Actually we might need to override this for cloud space, but let's keep it simple
          collapsing: true,
        });
        setElectronLayout(prev => ({ ...prev, orbX: newOrbX, orbY: newOrbY }));
    }
  }, [activeAlert, isOpen, isElectronEnv]);

  // Dynamically manage click-through padding (Ghost Blocking Fix)
  useEffect(() => {
    if (isElectronEnv && window.electronAPI?.setIgnoreMouseEvents) {
      if (isOpen) {
        // When panel is open, we need the whole window to receive clicks
        window.electronAPI.setIgnoreMouseEvents(false);
      } else {
        // When collapsed to orb, make transparent padding click-through
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  }, [isOpen, isElectronEnv]);

  const handleOrbMouseEnter = () => {
    if (isElectronEnv && !isOpen && window.electronAPI?.setIgnoreMouseEvents) {
      window.electronAPI.setIgnoreMouseEvents(false);
    }
  };

  const handleOrbMouseLeave = () => {
    if (isDraggingWin.current) return;
    if (isElectronEnv && !isOpen && window.electronAPI?.setIgnoreMouseEvents) {
      // Re-enable click-through when mouse leaves the orb
      window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
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

  /** Handles orb click in Electron mode: expand/collapse the native window. */
  const handleElectronClick = async () => {
    if (isResizing) return;
    const api = window.electronAPI;
    if (!api) return;

    if (!isOpen) {
      setIsResizing(true);
      try {
        const { x: winX, y: winY } = await api.getWindowPosition();
        // Feature 5: Multi-Monitor — use nearest display instead of primary
        const nearest = api.getNearestDisplay 
          ? await api.getNearestDisplay()
          : { workArea: { x: 0, y: 0, ...(await api.getScreenSize()) } };
        const scrW = nearest.workArea.width;
        const scrH = nearest.workArea.height;
        const scrX = nearest.workArea.x || 0;
        const scrY = nearest.workArea.y || 0;

        const orbScreenCenterX = winX + ORB_PAD + ORB_SIZE / 2;
        const orbScreenCenterY = winY + ORB_PAD + ORB_SIZE / 2;
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
        });

        setIsOpen(true);
      } finally {
        setIsResizing(false);
      }
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

  const AuthOverlay = !store.user ? (
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
      
      {/* Close Button */}
      <button 
        onClick={closePanel} 
        className="absolute top-4 right-4 z-50 p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <X className="w-4 h-4" />
      </button>

      <div 
        className="bg-[#111111]/80 backdrop-blur-3xl border border-white/10 px-8 py-10 rounded-[32px] shadow-[0_0_80px_rgba(0,0,0,0.5)] w-[85%] max-w-[340px] relative z-10 overflow-y-auto max-h-[85vh] hide-scrollbar animate-in fade-in zoom-in-95 duration-500"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <div className="flex justify-center mb-6">
          <img src="/logo-2-chat-circular.png" alt="FloatGPT Logo" className="w-14 h-14 rounded-2xl shadow-lg border border-white/10" />
        </div>
        <h2 className="text-xl font-semibold text-white text-center mb-2 tracking-tight">Welcome to FloatGPT</h2>
        <p className="text-[13px] text-gray-400 text-center mb-6 leading-relaxed">Log in to sync your intelligent workspace across all devices.</p>
        
        {authError && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] rounded-xl text-center">{authError}</div>}
        
        <div className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" required autoComplete="off" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[13px] text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-500/70" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required autoComplete="current-password" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[13px] text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-500/70" />
            <button type="submit" className="w-full py-3 mt-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[13px] font-medium transition-colors shadow-lg shadow-indigo-600/20">
              Sign In to Workspace
            </button>
          </form>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px bg-white/10 flex-1"></div>
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Or</span>
            <div className="h-px bg-white/10 flex-1"></div>
          </div>

          <button 
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-gray-100 text-black rounded-xl text-[13px] font-medium transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (isElectronEnv) {
    return (
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <motion.div
          className={`w-14 h-14 rounded-full flex items-center justify-center border cursor-pointer hover:bg-text-muted/10 transition-colors ${getGuardianStyles()}`}
          style={{
            position: 'absolute',
            left: electronLayout.orbX,
            top: electronLayout.orbY,
            boxShadow: 'none', // Force no shadows in Electron mode to prevent square clipping against the native window bounds
            pointerEvents: 'auto',
            clipPath: 'circle(50% at 50% 50%)'
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onMouseEnter={handleOrbMouseEnter}
          onMouseLeave={handleOrbMouseLeave}
          title={isOpen ? "Close Panel" : "Open FloatGPT"}
          animate={isExtreme ? { backgroundColor: ['rgba(239, 68, 68, 0.1)', 'rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0.1)'], borderColor: ['rgba(239, 68, 68, 0.4)', 'rgba(239, 68, 68, 0.8)', 'rgba(239, 68, 68, 0.4)'] } : { backgroundColor: '', borderColor: '' }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BrainCircuit className={`w-6 h-6 transition-colors ${getIconColor()}`} />
        </motion.div>

        {activeAlert && !isOpen && (
          <div 
            className="absolute bg-danger text-white px-3 py-1.5 rounded-xl shadow-xl shadow-danger/20 text-[11px] font-semibold whitespace-nowrap z-50 animate-bounce electron-no-drag pointer-events-none border border-red-400"
            style={
              electronLayout.panelDir === 'left' 
                ? { right: ORB_PAD, top: electronLayout.orbY - 35 }
                : { left: ORB_PAD, top: electronLayout.orbY - 35 }
            }
          >
            🚨 <span className="uppercase font-extrabold mr-1">URGENT:</span> {activeAlert.timeText}
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
                    <span className="font-semibold text-text-primary text-xs tracking-wider">FloatGPT</span>
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
                      onClick={() => {
                        store.setState(s => {
                          const nextActive = !s.focusModeState.active;
                          let nextState = {
                            ...s,
                            focusModeState: {
                              ...s.focusModeState,
                              active: nextActive
                            }
                          };
                          return ReflectionService.onFocusToggled(nextState, nextActive);
                        });
                      }}
                      className={`p-1 rounded transition-colors ${store.state.focusModeState.active ? 'bg-accent/20 text-accent' : 'hover:bg-panel-hover text-text-muted hover:text-text-primary'}`}
                      title="Toggle Focus Mode"
                    >
                      <Focus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setActiveTab('labs'); }}
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

                {/* Tabs */}
                {!store.state.focusModeState.active && (
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
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col bg-bg">
                  {store.state.focusModeState.active ? (
                    <FocusPanel state={store.state} setState={store.setState} />
                  ) : (
                    <>
                      {activeTab === 'home' && <HomePanel state={store.state} setState={store.setState} />}
                      {activeTab === 'plan' && <PlanPanel state={store.state} setState={store.setState} generateId={store.generateId} />}
                      {activeTab === 'chat' && <ChatPanel state={store.state} setState={store.setState} generateId={store.generateId} />}
                      {activeTab === 'labs' && <SettingsPanel resetStore={store.resetStore} state={store.state} setState={store.setState} />}
                      {activeTab === 'history' && <HistoryPanel state={store.state} setState={store.setState} setActiveTab={setActiveTab as (tab: string) => void} />}
                    </>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    );
  }

  // ─── Web Browser Render Path ───────────────────────────────
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
      <motion.div 
        className={`w-14 h-14 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing border ${getGuardianStyles()}`}
        style={{
          ...((!activeAlert && guardianStatus === 'SAFE') ? { boxShadow: isOpen ? 'var(--orb-hover-shadow)' : 'var(--orb-shadow)' } : {}),
          pointerEvents: 'auto',
          clipPath: 'circle(50% at 50% 50%)'
        }}
        onClick={handleClick}
        animate={isExtreme ? { backgroundColor: ['rgba(239, 68, 68, 0.1)', 'rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0.1)'], borderColor: ['rgba(239, 68, 68, 0.4)', 'rgba(239, 68, 68, 0.8)', 'rgba(239, 68, 68, 0.4)'] } : { backgroundColor: '', borderColor: '' }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <BrainCircuit className={`w-6 h-6 transition-colors ${getIconColor()}`} />
      </motion.div>

      {activeAlert && !isOpen && (
        <div 
          className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-danger/10 border border-danger/50 text-danger px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest shadow-lg backdrop-blur-sm cursor-pointer hover:bg-danger/20 transition-colors"
          style={{ pointerEvents: 'auto' }}
          onClick={() => { setIsOpen(true); }}
        >
          🚨 <span className="uppercase font-extrabold mr-1">URGENT:</span> '{activeAlert.title}' {activeAlert.timeText}
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
                  <span className="font-semibold text-text-primary text-xs tracking-wider">FloatGPT</span>
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
                    onClick={() => {
                      store.setState(s => {
                        const nextActive = !s.focusModeState.active;
                        let nextState = { 
                          ...s, 
                          focusModeState: { 
                            ...s.focusModeState, 
                            active: nextActive 
                          } 
                        };
                        return ReflectionService.onFocusToggled(nextState, nextActive);
                      });
                    }}
                    className={`p-1 rounded transition-colors ${store.state.focusModeState.active ? 'bg-accent/20 text-accent' : 'hover:bg-panel-hover text-text-muted hover:text-text-primary'}`}
                    title="Toggle Focus Mode"
                  >
                    <Focus className="w-4 h-4" />
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
              
              {/* Tabs */}
              {store.user && !store.state.focusModeState.active && (
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
              )}

              {/* Content Area */}
              <div className="flex-1 overflow-hidden flex flex-col bg-bg">
                {store.state.focusModeState.active ? (
                  <FocusPanel state={store.state} setState={store.setState} />
                ) : (
                  <>
                    {activeTab === 'home' && <HomePanel state={store.state} setState={store.setState} />}
                    {activeTab === 'plan' && <PlanPanel state={store.state} setState={store.setState} generateId={store.generateId} />}
                    {activeTab === 'chat' && <ChatPanel state={store.state} setState={store.setState} generateId={store.generateId} />}
                    {activeTab === 'labs' && <SettingsPanel resetStore={store.resetStore} state={store.state} setState={store.setState} />}
                    {activeTab === 'history' && <HistoryPanel state={store.state} setState={store.setState} setActiveTab={setActiveTab as (tab: string) => void} />}
                  </>
                )}
              </div>
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
