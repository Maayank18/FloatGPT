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

  return (
    <motion.div
      ref={orbRef}
      drag
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{ x, y, position: 'fixed', top: 0, left: 0, zIndex: 9999, touchAction: 'none' }}
      dragConstraints={{ left: 0, top: 0, right: windowBounds.width - ORB_SIZE, bottom: windowBounds.height - ORB_SIZE }}
    >
      <div 
        className={`w-14 h-14 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing border ${getGuardianStyles()}`}
        style={(!activeAlert && guardianStatus === 'SAFE') ? { boxShadow: isOpen ? 'var(--orb-hover-shadow)' : 'var(--orb-shadow)' } : undefined}
        onClick={handleClick}
      >
        <BrainCircuit className={`w-6 h-6 transition-colors ${getIconColor()}`} />
      </div>

      {activeAlert && !isOpen && (
        <div 
          className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-danger/10 border border-danger/50 text-danger px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg backdrop-blur-sm cursor-pointer hover:bg-danger/20 transition-colors"
          onClick={() => { setIsOpen(true); }}
        >
          🚨 {activeAlert.title} {activeAlert.timeText}
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
            cursor: 'default'
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
                onClick={() => {
                  setIsOpen(false);
                }}
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
                {activeTab === 'history' && <HistoryPanel state={store.state} setState={store.setState} setActiveTab={setActiveTab} />}
              </>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
