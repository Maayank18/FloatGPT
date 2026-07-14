import React, { useEffect } from 'react';
import { useAppStore } from './lib/store';
import { FloatingAssistant } from './components/FloatingAssistant';
import { UpdateNotifier } from './components/UpdateNotifier';
import { Sun, Moon } from 'lucide-react';

export default function App() {
  const store = useAppStore();
  const isElectronEnv = typeof window !== 'undefined' && !!window.electronAPI;

  useEffect(() => {
    store.init();
    
    // Bulletproof fallback: If the store fails to set isLoaded for any reason, force it locally after 5s.
    const failSafe = setTimeout(() => {
      if (!useAppStore.getState().isLoaded) {
        useAppStore.setState({ isLoaded: true });
      }
    }, 5000);
    return () => clearTimeout(failSafe);
  }, []);

  useEffect(() => {
    if (!store.isLoaded) return;
    
    const root = document.documentElement;

    // Electron Desktop Mode — mark root for CSS overrides
    if (isElectronEnv) {
      root.setAttribute('data-electron', '');
    }
    
    // Theme Mode
    if (store.state.settings.theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }

    // Larger Text
    if (store.state.settings.accessibility?.largerTextMode) {
      root.classList.add('text-large');
    } else {
      root.classList.remove('text-large');
    }

    // Icon Style
    if (store.state.settings.appearance?.iconStyle === 'solid') {
      root.classList.add('icon-solid');
    } else {
      root.classList.remove('icon-solid');
    }

    // High Contrast Mode
    if (store.state.settings.accessibility?.highContrastMode) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Reduced Motion
    if (store.state.settings.accessibility?.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    // Layout Density
    if (store.state.settings.appearance?.panelDensity === 'compact') {
      root.classList.add('compact-density');
    } else {
      root.classList.remove('compact-density');
    }

    // Accent Color
    const colors = {
      indigo: { base: '#6366f1', hover: '#4f46e5', glow: 'rgba(99, 102, 241, 0.25)' },
      blue: { base: '#3b82f6', hover: '#2563eb', glow: 'rgba(59, 130, 246, 0.25)' },
      emerald: { base: '#10b981', hover: '#059669', glow: 'rgba(16, 185, 129, 0.25)' },
      rose: { base: '#f43f5e', hover: '#e11d48', glow: 'rgba(244, 63, 94, 0.25)' },
      amber: { base: '#f59e0b', hover: '#d97706', glow: 'rgba(245, 158, 11, 0.25)' },
    };
    
    const accent = store.state.settings.appearance?.accentColor || 'indigo';
    const selected = colors[accent as keyof typeof colors] || colors.indigo;
    
    root.style.setProperty('--accent', selected.base);
    root.style.setProperty('--accent-hover', selected.hover);
    root.style.setProperty('--accent-glow', selected.glow);

  }, [store.state.settings, store.isLoaded]);

  const toggleTheme = () => {
    store.setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme: prev.settings.theme === 'light' ? 'dark' : 'light'
      }
    }));
  };

  if (!store.isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--bg)] text-text-muted">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-4 border-accent border-t-transparent animate-spin mb-4"></div>
          <span className="text-xs uppercase tracking-widest font-semibold">Initializing Neural Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-full text-[var(--text-primary)] font-sans overflow-hidden items-center justify-center relative transition-colors duration-300${isElectronEnv ? '' : ' bg-[var(--bg)]'}`}>
      
      {/* Onboarding / Explainer Panel — hidden in Electron desktop mode */}
      {!isElectronEnv && (<>
      <div className="absolute top-0 left-0 bottom-0 w-full max-w-lg p-12 lg:p-16 flex flex-col justify-center z-0">
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4 text-[var(--text-primary)]">
          FloatGPT
        </h1>
        <p className="text-base text-[var(--text-secondary)] mb-10 leading-relaxed font-medium">
          Your own <span className="font-bold text-[var(--text-primary)]">persistent AI execution companion</span> — available throughout your laptop workflow, ready when you are, and designed to help you execute without missing critical deadlines.
        </p>

        <ul className="space-y-6">
          <li className="flex items-start gap-4">
            <div className="mt-1 w-2 h-2 rounded-full bg-accent shrink-0" />
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Traditional tools are static. FloatGPT stays with you <span className="font-bold text-[var(--text-primary)]">throughout your workflow</span> — across desktop use, meetings, work sessions, and daily execution.
            </p>
          </li>
          <li className="flex items-start gap-4">
            <div className="mt-1 w-2 h-2 rounded-full bg-accent shrink-0" />
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              The <span className="font-bold text-[var(--text-primary)]">draggable orb</span> can be placed anywhere for maximum convenience and minimal distraction.
            </p>
          </li>
          <li className="flex items-start gap-4">
            <div className="mt-1 w-2 h-2 rounded-full bg-accent shrink-0" />
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Simply <span className="font-bold text-[var(--text-primary)]">Click on Orb to explore more</span> your main workspace, manage tasks, and engage with your copilot.
            </p>
          </li>
          <li className="flex items-start gap-4">
            <div className="mt-1 w-2 h-2 rounded-full bg-accent shrink-0" />
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              FloatGPT autonomously helps you <span className="font-bold text-[var(--text-primary)]">plan / prioritize / recover</span> from delays and stay on course until the work is finished.
            </p>
          </li>
        </ul>
      </div>

      {/* Theme Toggle (Testing) */}
      <div className="absolute top-6 right-6 z-10 flex bg-panel border border-card-border rounded-lg p-1 shadow-sm">
        <button
          onClick={() => toggleTheme()}
          className={`px-3 py-1.5 flex items-center gap-2 rounded-md transition-colors text-xs font-medium uppercase tracking-wider ${store.state.settings.theme === 'light' ? 'bg-bg text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
        >
          <Sun className="w-3.5 h-3.5" /> Light
        </button>
        <button
          onClick={() => toggleTheme()}
          className={`px-3 py-1.5 flex items-center gap-2 rounded-md transition-colors text-xs font-medium uppercase tracking-wider ${store.state.settings.theme === 'dark' ? 'bg-bg text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
        >
          <Moon className="w-3.5 h-3.5" /> Dark
        </button>
      </div>

      {/* Background Shell (Empty Canvas) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none select-none">
        <div className="text-center">
          <div className="text-[120px] font-black tracking-tighter text-[var(--text-primary)] leading-none mb-4">FLOAT</div>
          <div className="text-sm font-semibold uppercase tracking-[0.4em] text-[var(--text-secondary)]">Copilot Active</div>
        </div>
      </div>
      </>)}

      <FloatingAssistant store={store} />
      <UpdateNotifier />
    </div>
  );
}
