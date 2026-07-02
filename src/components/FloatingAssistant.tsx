import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue } from 'motion/react';
import { BrainCircuit, X, Send, Home, FolderKanban, MessageSquare, Focus, Trash2, Settings2, History, MessageSquarePlus } from 'lucide-react';
import { AppState } from '../types';
import { HomePanel } from './assistant/HomePanel';
import { PlanPanel } from './assistant/PlanPanel';
import { ChatPanel } from './assistant/ChatPanel';
import { SettingsPanel } from './assistant/SettingsPanel';
import { FocusPanel } from './assistant/FocusPanel';
import { HistoryPanel } from './assistant/HistoryPanel';
import { useGuardian } from '../lib/guardian';
import { performRollover } from '../lib/store';
import { ReflectionService } from '../lib/reflection';

const ORB_SIZE = 56;
const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 560;

// Electron desktop mode constants
const ORB_PAD = 0;
const PANEL_GAP = 16;
const COLLAPSED_SIZE = ORB_SIZE + ORB_PAD * 2;

interface StoreProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  resetStore: () => void;
  generateId: () => string;
}

export function FloatingAssistant({ store }: { store: StoreProps }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'plan' | 'chat' | 'labs' | 'history'>('chat');

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
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ─── Feature 1: Global Hotkey Listener ─────────────────────
  useEffect(() => {
    if (!isElectronEnv || !window.electronAPI?.onTogglePanel) return;
    const unsubscribe = window.electronAPI.onTogglePanel(() => {
      handleElectronClick();
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
    if (isElectronEnv && window.electronAPI) {
      setTimeout(() => {
        let targetW = COLLAPSED_SIZE;
        let targetH = COLLAPSED_SIZE;
        let newOrbX = ORB_PAD;
        let newOrbY = ORB_PAD;

        if (activeAlert) {
           targetW = 220; // Room for cloud
           targetH = 140; // Room for cloud
           if (electronLayout.panelDir === 'left') newOrbX = targetW - ORB_SIZE - ORB_PAD;
           if (electronLayout.panelOnTop) newOrbY = targetH - ORB_SIZE - ORB_PAD;
        }

        window.electronAPI!.resizeWindow({
          width: targetW,
          height: targetH,
          panelOnLeft: electronLayout.panelDir === 'left',
          panelOnTop: electronLayout.panelOnTop,
          collapsing: true,
        });
        setElectronLayout(prev => ({ ...prev, orbX: newOrbX, orbY: newOrbY }));
      }, 30);
    }
  };

  // Dynamically adjust if activeAlert changes while closed
  useEffect(() => {
    if (isElectronEnv && window.electronAPI && !isOpen && !isDragging) {
        let targetW = COLLAPSED_SIZE;
        let targetH = COLLAPSED_SIZE;
        let newOrbX = ORB_PAD;
        let newOrbY = ORB_PAD;

        if (activeAlert) {
           targetW = 220;
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

  const handlePointerDown = async (e: React.PointerEvent) => {
    if (e.button !== 0 || !isElectronEnv) return;
    const api = window.electronAPI;
    if (!api) return;
    
    isDraggingWin.current = true;
    hasMoved.current = false;
    
    const { x: winX, y: winY } = await api.getWindowPosition();
    dragOffset.current = {
      x: e.screenX - winX,
      y: e.screenY - winY
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

        setElectronLayout({
          orbX: eOrbX, orbY: eOrbY, panelX: ePanelX, panelY: ePanelY,
          panelDir: isOnLeft ? 'right' : 'left',
          panelOnTop: !isOnTop,
        });

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
          title={isOpen ? "Close Panel" : "Open FloatGPT"}
          animate={isExtreme ? { backgroundColor: ['rgba(239, 68, 68, 0.1)', 'rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0.1)'], borderColor: ['rgba(239, 68, 68, 0.4)', 'rgba(239, 68, 68, 0.8)', 'rgba(239, 68, 68, 0.4)'] } : { backgroundColor: '', borderColor: '' }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BrainCircuit className={`w-6 h-6 transition-colors ${getIconColor()}`} />
        </motion.div>

        {activeAlert && !isOpen && (
          <div 
            className="absolute bg-danger text-white px-3 py-1.5 rounded-xl shadow-xl shadow-danger/20 text-[11px] font-semibold whitespace-nowrap z-50 animate-bounce electron-no-drag pointer-events-none border border-red-400"
            style={{
              left: electronLayout.orbX + ORB_SIZE / 2,
              top: electronLayout.orbY - 35,
              transform: 'translateX(-50%)'
            }}
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
              width: PANEL_WIDTH,
              height: PANEL_HEIGHT,
              left: electronLayout.panelX,
              top: electronLayout.panelY,
              cursor: 'default',
              pointerEvents: 'auto',
            }}
          >
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
        </motion.div>
      )}
    </motion.div>
  );
}
