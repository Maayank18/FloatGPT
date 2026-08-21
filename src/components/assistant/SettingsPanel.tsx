import React, { useState, useRef, useEffect } from 'react';
import { Trash2, ShieldAlert, Sparkles, Volume2, Beaker, BrainCircuit, Moon, Sun, Monitor, Eye, PaintBucket, Home, Folder, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppState, Settings } from '../../types';
import { auth, signOut } from '../../lib/firebase';

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

const SectionHeader = ({ title, description }: { title: string, description?: string }) => (
  <div className="mb-3">
    <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">{title}</h3>
    {description && <p className="text-[10px] text-text-secondary mt-0.5 leading-relaxed">{description}</p>}
  </div>
);

export function SettingsPanel({ state, setState, resetStore }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>>, resetStore: () => void }) {
  const { settings } = state;
  const [activeSection, setActiveSection] = useState<'appearance' | 'system' | 'features' | 'productivity' | 'ai' | 'privacy' | 'accessibility' | 'advanced' | 'agent'>('appearance');
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true); // Default true since it usually overflows
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const checkScroll = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
      setShowLeft(scrollLeft > 0);
      setShowRight(scrollLeft + clientWidth < scrollWidth - 1); // -1 for pixel rounding
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  // Sync settings with Electron OS layer
  useEffect(() => {
    if (window.electronAPI?.applySettings) {
      window.electronAPI.applySettings(settings);
    }
    // Sync desktop agent settings separately
    if (window.electronAPI?.flow?.applyAgentSettings && settings.desktopAgent) {
      window.electronAPI.flow.applyAgentSettings(settings.desktopAgent);
    }
  }, [settings]);

  const updateSetting = <K extends keyof Settings, SK extends keyof Settings[K]>(category: K, key: SK, value: Settings[K][SK]) => {
    if (category === 'system') {
      showToast(`${String(key)} updated`);
    }
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [category]: {
          ...(prev.settings[category] as Record<string, unknown>),
          [key]: value
        }
      }
    }));
  };

  const updateTheme = (theme: Settings['theme']) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, theme }
    }));
  };

  const tabs = [
    { id: 'appearance', label: 'Appearance' },
    { id: 'system', label: 'System' },
    { id: 'productivity', label: 'Productivity' },
    { id: 'features', label: 'Features' },
    { id: 'ai', label: 'AI Config' },
    { id: 'agent', label: 'Flow Agent' },
    { id: 'privacy', label: 'Privacy' },
    { id: 'accessibility', label: 'Accessibility' },
    { id: 'advanced', label: 'Advanced' }
  ] as const;

  // Calculate active features for summary
  const activeFeaturesCount = [
    settings.features.autoPlanSync,
    settings.features.habitMemory,
    settings.features.personalizedRecommendations,
    settings.features.soundAlerts
  ].filter(Boolean).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-panel text-text-primary">
      {/* Premium Pill Tabs */}
      <div className="px-3 pt-3 pb-2 shrink-0 border-b border-card-border bg-panel">
        <div className="relative group">
          {showLeft && (
            <button 
              onClick={() => tabsRef.current?.scrollBy({ left: -150, behavior: 'smooth' })}
              className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-bg-secondary via-bg-secondary/90 to-transparent flex items-center justify-start pl-1.5 rounded-l-xl z-10 hover:bg-card transition-colors cursor-pointer"
              title="Scroll left"
            >
               <ChevronLeft className="w-3.5 h-3.5 text-text-primary shadow-sm" />
            </button>
          )}
          <div 
            ref={tabsRef}
            onScroll={checkScroll}
            className="flex bg-bg-secondary p-1 rounded-xl border border-card-border shadow-sm overflow-x-auto hide-scrollbar relative z-0" 
            style={{ scrollbarWidth: 'none' }}
          >
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`whitespace-nowrap flex-none sm:flex-1 py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${activeSection === tab.id ? 'bg-panel text-text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:text-text-primary hover:bg-card-border/30 border border-transparent'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {showRight && (
            <button 
              onClick={() => tabsRef.current?.scrollBy({ left: 150, behavior: 'smooth' })}
              className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-bg-secondary via-bg-secondary/90 to-transparent flex items-center justify-end pr-1.5 rounded-r-xl z-10 hover:bg-card transition-colors cursor-pointer"
              title="Scroll right"
            >
               <ChevronRight className="w-3.5 h-3.5 text-text-primary shadow-sm" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pl-4 pr-1.5 py-5">
        <div className="space-y-8 pr-2.5">


        {activeSection === 'appearance' && (
          <div className="space-y-6">
            
            {/* Theme Selection */}
            <div>
              {/* System Summary (Moved to Appearance) */}
              <div className="bg-card border border-card-border p-3.5 rounded-2xl flex items-center justify-between shadow-sm mb-6">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Current Configuration</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-semibold text-text-primary capitalize flex items-center gap-1.5">
                      {settings.theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-accent"/> : <Sun className="w-3.5 h-3.5 text-accent"/>}
                      {settings.theme}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-card-border"></span>
                    <span className="text-[11px] font-semibold text-text-primary capitalize flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: `var(--${settings.appearance.accentColor}-500, #6366f1)` }}></div>
                      {settings.appearance.accentColor}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                   <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Active</span>
                   <span className="text-[11px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-md mt-1">{activeFeaturesCount} Features</span>
                </div>
              </div>

              <SectionHeader title="Theme Mode" description="Choose how FloatGPT looks and feels." />
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => updateTheme('dark')}
                  className={`flex flex-col gap-3 p-3 rounded-2xl border transition-all ${settings.theme === 'dark' ? 'border-accent bg-accent/5 ring-1 ring-accent/30 shadow-sm' : 'border-card-border bg-card hover:border-text-muted/40 hover:bg-card/80'}`}
                >
                  <div className="w-full h-16 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col p-2 gap-1.5 relative overflow-hidden shadow-inner">
                      <div className="w-1/2 h-2 bg-neutral-800 rounded-full"></div>
                      <div className="w-full h-6 bg-neutral-800 rounded-md mt-auto"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Moon className={`w-4 h-4 ${settings.theme === 'dark' ? 'text-accent' : 'text-text-muted'}`} />
                    <span className={`text-[11px] font-semibold ${settings.theme === 'dark' ? 'text-text-primary' : 'text-text-secondary'}`}>Dark Mode</span>
                  </div>
                </button>
                <button 
                  onClick={() => updateTheme('light')}
                  className={`flex flex-col gap-3 p-3 rounded-2xl border transition-all ${settings.theme === 'light' ? 'border-accent bg-accent/5 ring-1 ring-accent/30 shadow-sm' : 'border-card-border bg-card hover:border-text-muted/40 hover:bg-card/80'}`}
                >
                  <div className="w-full h-16 rounded-xl bg-neutral-100 border border-neutral-200 flex flex-col p-2 gap-1.5 relative overflow-hidden shadow-inner">
                      <div className="w-1/2 h-2 bg-neutral-200 rounded-full"></div>
                      <div className="w-full h-6 bg-neutral-200 rounded-md mt-auto"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sun className={`w-4 h-4 ${settings.theme === 'light' ? 'text-accent' : 'text-text-muted'}`} />
                    <span className={`text-[11px] font-semibold ${settings.theme === 'light' ? 'text-text-primary' : 'text-text-secondary'}`}>Light Mode</span>
                  </div>
                </button>
                <button 
                  onClick={() => updateTheme('cream')}
                  className={`flex flex-col gap-3 p-3 rounded-2xl border transition-all ${settings.theme === 'cream' ? 'border-amber-600 bg-amber-500/5 ring-1 ring-amber-600/30 shadow-sm' : 'border-card-border bg-card hover:border-text-muted/40 hover:bg-card/80'}`}
                >
                  <div className="w-full h-16 rounded-xl bg-[#F9EBC8] border border-[#E6CD9A] flex flex-col p-2 gap-1.5 relative overflow-hidden shadow-inner">
                      <div className="w-1/2 h-2 bg-[#E6CD9A] rounded-full"></div>
                      <div className="w-full h-6 bg-[#E6CD9A] rounded-md mt-auto"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sun className={`w-4 h-4 ${settings.theme === 'cream' ? 'text-amber-600' : 'text-text-muted'}`} />
                    <span className={`text-[11px] font-semibold ${settings.theme === 'cream' ? 'text-text-primary' : 'text-text-secondary'}`}>Cream (Soft)</span>
                  </div>
                </button>
                <button 
                  onClick={() => updateTheme('mocha')}
                  className={`flex flex-col gap-3 p-3 rounded-2xl border transition-all ${settings.theme === 'mocha' ? 'border-orange-400 bg-orange-400/5 ring-1 ring-orange-400/30 shadow-sm' : 'border-card-border bg-card hover:border-text-muted/40 hover:bg-card/80'}`}
                >
                  <div className="w-full h-16 rounded-xl bg-[#2C2421] border border-[#4A3E38] flex flex-col p-2 gap-1.5 relative overflow-hidden shadow-inner">
                      <div className="w-1/2 h-2 bg-[#4A3E38] rounded-full"></div>
                      <div className="w-full h-6 bg-[#4A3E38] rounded-md mt-auto"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Moon className={`w-4 h-4 ${settings.theme === 'mocha' ? 'text-orange-400' : 'text-text-muted'}`} />
                    <span className={`text-[11px] font-semibold ${settings.theme === 'mocha' ? 'text-text-primary' : 'text-text-secondary'}`}>Mocha (Comfort)</span>
                  </div>
                </button>
                <button 
                  onClick={() => updateTheme('peach')}
                  className={`flex flex-col gap-3 p-3 rounded-2xl border transition-all ${settings.theme === 'peach' ? 'border-orange-600 bg-orange-600/5 ring-1 ring-orange-600/30 shadow-sm' : 'border-card-border bg-card hover:border-text-muted/40 hover:bg-card/80'}`}
                >
                  <div className="w-full h-16 rounded-xl bg-[#FFD6C9] border border-[#FFAD94] flex flex-col p-2 gap-1.5 relative overflow-hidden shadow-inner">
                      <div className="w-1/2 h-2 bg-[#FFAD94] rounded-full"></div>
                      <div className="w-full h-6 bg-[#FFAD94] rounded-md mt-auto"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sun className={`w-4 h-4 ${settings.theme === 'peach' ? 'text-orange-500' : 'text-text-muted'}`} />
                    <span className={`text-[11px] font-semibold ${settings.theme === 'peach' ? 'text-text-primary' : 'text-text-secondary'}`}>Peach (Warm)</span>
                  </div>
                </button>
                <button 
                  onClick={() => updateTheme('pistachio')}
                  className={`flex flex-col gap-3 p-3 rounded-2xl border transition-all ${settings.theme === 'pistachio' ? 'border-green-600 bg-green-600/5 ring-1 ring-green-600/30 shadow-sm' : 'border-card-border bg-card hover:border-text-muted/40 hover:bg-card/80'}`}
                >
                  <div className="w-full h-16 rounded-xl bg-[#D1E5D1] border border-[#A6CCA6] flex flex-col p-2 gap-1.5 relative overflow-hidden shadow-inner">
                      <div className="w-1/2 h-2 bg-[#A6CCA6] rounded-full"></div>
                      <div className="w-full h-6 bg-[#A6CCA6] rounded-md mt-auto"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sun className={`w-4 h-4 ${settings.theme === 'pistachio' ? 'text-green-600' : 'text-text-muted'}`} />
                    <span className={`text-[11px] font-semibold ${settings.theme === 'pistachio' ? 'text-text-primary' : 'text-text-secondary'}`}>Pistachio (Relax)</span>
                  </div>
                </button>
                <button 
                  onClick={() => updateTheme('midnight')}
                  className={`flex flex-col gap-3 p-3 rounded-2xl border transition-all ${settings.theme === 'midnight' ? 'border-indigo-400 bg-indigo-400/5 ring-1 ring-indigo-400/30 shadow-sm' : 'border-card-border bg-card hover:border-text-muted/40 hover:bg-card/80'}`}
                >
                  <div className="w-full h-16 rounded-xl bg-[#030308] border border-[#1C1C33] flex flex-col p-2 gap-1.5 relative overflow-hidden shadow-inner">
                      <div className="w-1/2 h-2 bg-[#1C1C33] rounded-full"></div>
                      <div className="w-full h-6 bg-[#1C1C33] rounded-md mt-auto"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Moon className={`w-4 h-4 ${settings.theme === 'midnight' ? 'text-indigo-400' : 'text-text-muted'}`} />
                    <span className={`text-[11px] font-semibold ${settings.theme === 'midnight' ? 'text-text-primary' : 'text-text-secondary'}`}>Midnight (OLED)</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Accent Color Selection */}
            <div>
              <SectionHeader title="Accent Color" description="Personalize the primary highlight color across the interface." />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { name: 'indigo', hex: '#6366f1' },
                  { name: 'blue', hex: '#3b82f6' },
                  { name: 'emerald', hex: '#10b981' },
                  { name: 'rose', hex: '#f43f5e' },
                  { name: 'amber', hex: '#f59e0b' }
                ].map(({ name: color, hex }) => (
                  <button
                    key={color}
                    onClick={() => updateSetting('appearance', 'accentColor', color)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${settings.appearance.accentColor === color ? 'border-text-primary bg-bg-secondary shadow-sm ring-1 ring-text-primary/30' : 'border-card-border bg-card hover:border-text-muted/40 hover:bg-card/80'}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full shadow-sm ${settings.appearance.accentColor === color ? 'ring-2 ring-offset-2 ring-offset-card' : ''}`} style={{ backgroundColor: hex, borderColor: hex }}></div>
                    <span className={`text-xs font-semibold capitalize ${settings.appearance.accentColor === color ? 'text-text-primary' : 'text-text-secondary'}`}>{color === 'emerald' ? 'Green' : color === 'rose' ? 'Pink/Rose' : color === 'amber' ? 'Amber/Orange' : color}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Icon Style Selection */}
            <div>
              <SectionHeader title="Icon Style" description="Select the visual weight of interface icons." />
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => updateSetting('appearance', 'iconStyle', 'outline')}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-2.5 transition-all ${settings.appearance.iconStyle === 'outline' ? 'border-accent bg-accent/5 ring-1 ring-accent/30 shadow-sm' : 'border-card-border bg-card hover:border-text-muted/40 hover:bg-card/80'}`}
                >
                  <div className={`flex gap-3 mb-1 ${settings.appearance.iconStyle === 'outline' ? 'text-accent' : 'text-text-muted'}`}>
                    <Home className="w-5 h-5" />
                    <Folder className="w-5 h-5" />
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-semibold ${settings.appearance.iconStyle === 'outline' ? 'text-text-primary' : 'text-text-secondary'}`}>Outline</span>
                </button>
                <button 
                  onClick={() => updateSetting('appearance', 'iconStyle', 'solid')}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-2.5 transition-all ${settings.appearance.iconStyle === 'solid' ? 'border-accent bg-accent/5 ring-1 ring-accent/30 shadow-sm' : 'border-card-border bg-card hover:border-text-muted/40 hover:bg-card/80'}`}
                >
                  <div className={`flex gap-3 mb-1 ${settings.appearance.iconStyle === 'solid' ? 'text-accent' : 'text-text-muted'}`}>
                    <Home className="w-5 h-5" fill="currentColor" />
                    <Folder className="w-5 h-5" fill="currentColor" />
                    <CheckCircle2 className="w-5 h-5" fill="currentColor" />
                  </div>
                  <span className={`text-xs font-semibold ${settings.appearance.iconStyle === 'solid' ? 'text-text-primary' : 'text-text-secondary'}`}>Solid</span>
                </button>
              </div>
            </div>

            {/* Panel Density */}
            <div>
              <SectionHeader title="Layout Density" description="Adjust the compactness of list items and cards." />
              <div className="flex bg-bg-secondary p-1 rounded-xl border border-card-border">
                <button 
                  onClick={() => updateSetting('appearance', 'panelDensity', 'comfortable')}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${settings.appearance.panelDensity === 'comfortable' ? 'bg-panel text-text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Comfortable
                </button>
                <button 
                  onClick={() => updateSetting('appearance', 'panelDensity', 'compact')}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${settings.appearance.panelDensity === 'compact' ? 'bg-panel text-text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Compact
                </button>
                <button 
                  onClick={() => updateSetting('appearance', 'panelDensity', 'dense')}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${settings.appearance.panelDensity === 'dense' ? 'bg-panel text-text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Dense
                </button>
                <button 
                  onClick={() => updateSetting('appearance', 'panelDensity', 'micro')}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${settings.appearance.panelDensity === 'micro' ? 'bg-panel text-text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Micro
                </button>
              </div>
            </div>

            {/* Orb Settings */}
            <div>
              <SectionHeader title="Orb Appearance" description="Customize how the floating orb looks on your screen." />
              <div className="bg-card border border-card-border p-4 rounded-2xl flex flex-col gap-5 shadow-sm">
                
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-text-primary">Orb Size (Scale)</span>
                    <span className="text-xs font-mono text-text-muted">{(settings.appearance.orbScale || 1.0).toFixed(2)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" max="2.0" step="0.1" 
                    value={settings.appearance.orbScale || 1.0}
                    onChange={(e) => updateSetting('appearance', 'orbScale', parseFloat(e.target.value))}
                    className="w-full accent-accent bg-card-border h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-text-muted font-medium mt-1">
                    <span>Small</span>
                    <span>Default</span>
                    <span>Large</span>
                  </div>
                </div>

                <div className="w-full h-px bg-card-border/50"></div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-text-primary">Idle Transparency</span>
                    <span className="text-xs font-mono text-text-muted">{Math.round((settings.appearance.orbOpacity || 1.0) * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.2" max="1.0" step="0.05" 
                    value={settings.appearance.orbOpacity || 1.0}
                    onChange={(e) => updateSetting('appearance', 'orbOpacity', parseFloat(e.target.value))}
                    className="w-full accent-accent bg-card-border h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-text-muted font-medium mt-1">
                    <span>Ghost</span>
                    <span>Translucent</span>
                    <span>Solid</span>
                  </div>
                </div>

                <div className="w-full h-px bg-card-border/50"></div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-text-primary">Orb Shape</span>
                  <div className="flex bg-bg-secondary p-1 rounded-xl border border-card-border">
                    <button 
                      onClick={() => updateSetting('appearance', 'orbShape', 'circle')}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${settings.appearance.orbShape === 'circle' || !settings.appearance.orbShape ? 'bg-panel text-text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      <div className="w-3 h-3 rounded-full border border-current"></div> Circle
                    </button>
                    <button 
                      onClick={() => updateSetting('appearance', 'orbShape', 'squircle')}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${settings.appearance.orbShape === 'squircle' ? 'bg-panel text-text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      <div className="w-3 h-3 rounded-[4px] border border-current"></div> Squircle
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-1">
                  <span className="text-xs font-semibold text-text-primary">Idle Glow Intensity</span>
                  <div className="flex bg-bg-secondary p-1 rounded-xl border border-card-border">
                    <button 
                      onClick={() => updateSetting('appearance', 'orbGlow', 'none')}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${settings.appearance.orbGlow === 'none' ? 'bg-panel text-text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      None
                    </button>
                    <button 
                      onClick={() => updateSetting('appearance', 'orbGlow', 'subtle')}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${settings.appearance.orbGlow === 'subtle' || !settings.appearance.orbGlow ? 'bg-panel text-text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      Subtle
                    </button>
                    <button 
                      onClick={() => updateSetting('appearance', 'orbGlow', 'intense')}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${settings.appearance.orbGlow === 'intense' ? 'bg-panel text-text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      Intense
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {activeSection === 'system' && (
          <div className="space-y-6">
            <div>
              <SectionHeader title="OS Integration" description="Deep integration with the Windows environment." />
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden divide-y divide-card-border shadow-sm">
                
                <div className="flex items-center justify-between p-4 bg-card hover:bg-bg-secondary/50 transition-colors">
                  <div className="flex gap-3">
                    <div className="mt-0.5 w-6 h-6 rounded bg-accent/10 flex items-center justify-center shrink-0">
                      <Monitor className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-primary">Launch on Startup</p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed pr-4">Boot FloatGPT silently in the system tray when Windows starts.</p>
                    </div>
                  </div>
                  <Toggle active={settings.system.launchOnStartup} onClick={() => updateSetting('system', 'launchOnStartup', !settings.system.launchOnStartup)} />
                </div>

                <div className="flex items-center justify-between p-4 bg-card hover:bg-bg-secondary/50 transition-colors">
                  <div className="flex gap-3">
                    <div className="mt-0.5 w-6 h-6 rounded bg-accent/10 flex items-center justify-center shrink-0">
                      <Eye className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-primary">Always on Top</p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed pr-4">Keep the FloatGPT Orb floating above all other windows and games.</p>
                    </div>
                  </div>
                  <Toggle active={settings.system.alwaysOnTop} onClick={() => updateSetting('system', 'alwaysOnTop', !settings.system.alwaysOnTop)} />
                </div>

                <div className="flex flex-col p-4 bg-card hover:bg-bg-secondary/50 transition-colors">
                  <div className="flex justify-between mb-3">
                    <div className="flex gap-3">
                      <div className="mt-0.5 w-6 h-6 rounded bg-accent/10 flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text-primary">Global Hotkey</p>
                        <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed pr-4">The shortcut to instantly summon FloatGPT from anywhere.</p>
                      </div>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={settings.system.globalHotkey}
                    onChange={(e) => updateSetting('system', 'globalHotkey', e.target.value)}
                    className="w-full bg-panel text-xs text-text-primary px-3 py-2 rounded-lg border border-card-border focus:border-accent focus:outline-none transition-colors"
                    placeholder="e.g. CommandOrControl+Shift+Space"
                  />
                </div>

              </div>
            </div>
          </div>
        )}

        {activeSection === 'productivity' && (
          <div className="space-y-6">
            <div>
              <SectionHeader title="Focus Engine" description="Block distractions and enforce deep work." />
              <div className="bg-card border border-card-border p-4 rounded-2xl shadow-sm mb-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs font-bold text-text-primary">Pomodoro Intervals</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-text-secondary mb-1 block">Work (Minutes)</label>
                    <input 
                      type="number" 
                      value={settings.productivity.pomodoroWorkMins}
                      onChange={(e) => updateSetting('productivity', 'pomodoroWorkMins', parseInt(e.target.value) || 25)}
                      className="w-full bg-panel text-xs text-text-primary px-3 py-2 rounded-lg border border-card-border focus:border-accent focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-text-secondary mb-1 block">Break (Minutes)</label>
                    <input 
                      type="number" 
                      value={settings.productivity.pomodoroBreakMins}
                      onChange={(e) => updateSetting('productivity', 'pomodoroBreakMins', parseInt(e.target.value) || 5)}
                      className="w-full bg-panel text-xs text-text-primary px-3 py-2 rounded-lg border border-card-border focus:border-accent focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-card border border-card-border p-4 rounded-2xl shadow-sm mb-4">
                <p className="text-xs font-bold text-text-primary mb-1">Focus Blocklist</p>
                <p className="text-[10px] text-text-secondary mb-3 leading-relaxed">Websites blocked within FloatGPT while Focus Mode is active. (Comma separated)</p>
                <textarea 
                  value={settings.productivity.focusBlocklist.join(', ')}
                  onChange={(e) => updateSetting('productivity', 'focusBlocklist', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  className="w-full h-20 resize-none bg-panel text-xs text-text-primary px-3 py-2 rounded-lg border border-card-border focus:border-accent focus:outline-none transition-colors"
                  placeholder="reddit.com, twitter.com"
                />
              </div>

              <div className="bg-card border border-card-border p-4 rounded-2xl shadow-sm">
                <p className="text-xs font-bold text-text-primary mb-3">Guardian Pulse Sensitivity</p>
                <div className="flex bg-bg-secondary p-1 rounded-xl border border-card-border">
                  {['High', 'Normal', 'Low', 'Muted'].map(level => (
                    <button 
                      key={level}
                      onClick={() => updateSetting('productivity', 'pulseSensitivity', level as any)}
                      className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${settings.productivity.pulseSensitivity === level ? 'bg-panel text-text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'features' && (
          <div className="space-y-6">
            <div>
              <SectionHeader title="AI Capabilities & Automation" description="Configure how the FloatGPT agents assist you." />
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden divide-y divide-card-border shadow-sm">
                
                <div className="flex items-center justify-between p-4 bg-card hover:bg-bg-secondary/50 transition-colors">
                  <div className="flex gap-3">
                    <div className="mt-0.5 w-6 h-6 rounded bg-accent/10 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-primary">Auto Plan Sync</p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed pr-4">Chat intents automatically generate projects and schedules.</p>
                    </div>
                  </div>
                  <Toggle active={settings.features.autoPlanSync} onClick={() => updateSetting('features', 'autoPlanSync', !settings.features.autoPlanSync)} />
                </div>

                <div className="flex items-center justify-between p-4 bg-card hover:bg-bg-secondary/50 transition-colors">
                  <div className="flex gap-3">
                    <div className="mt-0.5 w-6 h-6 rounded bg-accent/10 flex items-center justify-center shrink-0">
                      <BrainCircuit className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-primary">Habit Memory</p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed pr-4">Learn your behavior and optimal productivity patterns over time.</p>
                    </div>
                  </div>
                  <Toggle active={settings.features.habitMemory} onClick={() => updateSetting('features', 'habitMemory', !settings.features.habitMemory)} />
                </div>

                <div className="flex items-center justify-between p-4 bg-card hover:bg-bg-secondary/50 transition-colors">
                  <div className="flex gap-3">
                    <div className="mt-0.5 w-6 h-6 rounded bg-accent/10 flex items-center justify-center shrink-0">
                      <Beaker className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-primary">Coaching & Recommendations</p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed pr-4">Receive personalized tactical advice when facing blockers.</p>
                    </div>
                  </div>
                  <Toggle active={settings.features.personalizedRecommendations} onClick={() => updateSetting('features', 'personalizedRecommendations', !settings.features.personalizedRecommendations)} />
                </div>

                <div className="flex items-center justify-between p-4 bg-card hover:bg-bg-secondary/50 transition-colors">
                  <div className="flex gap-3">
                    <div className="mt-0.5 w-6 h-6 rounded bg-text-muted/20 flex items-center justify-center shrink-0">
                      <Volume2 className="w-3.5 h-3.5 text-text-muted" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-primary">Sound Alerts</p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed pr-4">Play soft acoustic chimes during critical deadlines and warnings.</p>
                    </div>
                  </div>
                  <Toggle active={settings.features.soundAlerts} onClick={() => updateSetting('features', 'soundAlerts', !settings.features.soundAlerts)} />
                </div>

              </div>
            </div>

            {settings.features.habitMemory && (
              <div className="pt-2">
                <SectionHeader title="Learned Profile Insights" description="Insights gathered by the Habit Agent." />
                <div className="p-4 bg-bg-secondary border border-card-border rounded-2xl space-y-3 shadow-sm">
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-card-border/50">
                    <span className="text-text-secondary font-medium">Optimal Focus Window</span>
                    <span className="text-text-primary font-bold bg-panel px-2 py-1 rounded-md border border-card-border">{state.habitProfile?.focusWindow || 'Learning...'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-card-border/50">
                    <span className="text-text-secondary font-medium">Procrastination Risk</span>
                    <span className="text-text-primary font-bold bg-panel px-2 py-1 rounded-md border border-card-border">{state.habitProfile?.delayRisk || 'Learning...'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-secondary font-medium">Preferred Session Length</span>
                    <span className="text-text-primary font-bold bg-panel px-2 py-1 rounded-md border border-card-border">{state.habitProfile?.preferredSession || 'Learning...'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'ai' && (
          <div className="space-y-6">
            <div>
              <SectionHeader title="LLM Provider" description="Select the AI engine powering FloatGPT." />
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm p-3">
                <select 
                  value={settings.aiConfig.selectedProvider}
                  onChange={(e) => updateSetting('aiConfig', 'selectedProvider', e.target.value as any)}
                  className="w-full bg-bg-secondary border border-card-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="google">Google (Gemini)</option>
                  <option value="groq">Groq (Llama / Mixtral)</option>
                  <option value="openai">OpenAI (GPT)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                </select>
              </div>
            </div>

            <div>
              <SectionHeader title="API Configuration" description="Enter the API key for the selected provider." />
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm p-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">API Key</label>
                  <input 
                    type="password"
                    value={settings.aiConfig.apiKeys[settings.aiConfig.selectedProvider] || ''}
                    onChange={(e) => {
                      const newApiKeys = { ...settings.aiConfig.apiKeys, [settings.aiConfig.selectedProvider]: e.target.value };
                      updateSetting('aiConfig', 'apiKeys', newApiKeys);
                    }}
                    placeholder="Enter your API key..."
                    className="w-full bg-bg-secondary border border-card-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent"
                  />
                  <p className="text-[9px] text-text-muted mt-2 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    API keys are stored securely in your local browser and are never sent to external servers.
                  </p>
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Model</label>
                  <select 
                    value={settings.aiConfig.selectedModels[settings.aiConfig.selectedProvider]}
                    onChange={(e) => {
                      const newModels = { ...settings.aiConfig.selectedModels, [settings.aiConfig.selectedProvider]: e.target.value };
                      updateSetting('aiConfig', 'selectedModels', newModels);
                    }}
                    className="w-full bg-bg-secondary border border-card-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent"
                  >
                    {settings.aiConfig.selectedProvider === 'google' && (
                      <>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                        <option value="gemini-1.5-pro-latest">Gemini 1.5 Pro</option>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      </>
                    )}
                    {settings.aiConfig.selectedProvider === 'groq' && (
                      <>
                        <option value="openai/gpt-oss-120b">GPT OSS 120B (Reasoning / Flagship)</option>
                        <option value="openai/gpt-oss-20b">GPT OSS 20B (Fast Reasoning)</option>
                        <option value="qwen/qwen3.6-27b">Qwen 3.6 27B (Vision & Reasoning)</option>
                        <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Versatile)</option>
                      </>
                    )}
                    {settings.aiConfig.selectedProvider === 'openai' && (
                      <>
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <SectionHeader title="System Persona" description="Override FloatGPT's core personality instructions." />
              <div className="bg-card border border-card-border rounded-2xl shadow-sm p-4 mb-6">
                <textarea 
                  value={settings.aiConfig.systemPersona || ''}
                  onChange={(e) => updateSetting('aiConfig', 'systemPersona', e.target.value)}
                  className="w-full h-32 resize-none bg-panel text-xs text-text-primary px-3 py-2 rounded-lg border border-card-border focus:border-accent focus:outline-none transition-colors"
                  placeholder="You are FloatGPT, an elite and strict productivity Guardian..."
                />
              </div>

              <SectionHeader title="Advanced Parameters" description="Fine-tune the model's generation behavior." />
              <div className="bg-card border border-card-border rounded-2xl shadow-sm p-4 space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Memory Horizon</label>
                    <span className="text-xs font-mono text-accent">{settings.aiConfig.memoryHorizonDays || 7} Days</span>
                  </div>
                  <input 
                    type="range" min="1" max="30" step="1"
                    value={settings.aiConfig.memoryHorizonDays || 7}
                    onChange={(e) => updateSetting('aiConfig', 'memoryHorizonDays', parseInt(e.target.value))}
                    className="w-full accent-accent"
                  />
                  <div className="flex justify-between text-[9px] text-text-muted mt-1">
                    <span>1 Day</span>
                    <span>30 Days</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Temperature</label>
                    <span className="text-xs font-mono text-accent">{settings.aiConfig.parameters.temperature}</span>
                  </div>
                  <input 
                    type="range" min="0" max="2" step="0.1"
                    value={settings.aiConfig.parameters.temperature}
                    onChange={(e) => {
                      const newParams = { ...settings.aiConfig.parameters, temperature: parseFloat(e.target.value) };
                      updateSetting('aiConfig', 'parameters', newParams);
                    }}
                    className="w-full accent-accent"
                  />
                  <div className="flex justify-between text-[9px] text-text-muted mt-1">
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Max Tokens</label>
                    <span className="text-xs font-mono text-accent">{settings.aiConfig.parameters.maxTokens}</span>
                  </div>
                  <input 
                    type="range" min="256" max="8192" step="256"
                    value={settings.aiConfig.parameters.maxTokens}
                    onChange={(e) => {
                      const newParams = { ...settings.aiConfig.parameters, maxTokens: parseInt(e.target.value) };
                      updateSetting('aiConfig', 'parameters', newParams);
                    }}
                    className="w-full accent-accent"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Context Window</label>
                    <span className="text-xs font-mono text-accent">{settings.aiConfig.parameters.contextWindow} msgs</span>
                  </div>
                  <input 
                    type="range" min="5" max="50" step="5"
                    value={settings.aiConfig.parameters.contextWindow}
                    onChange={(e) => {
                      const newParams = { ...settings.aiConfig.parameters, contextWindow: parseInt(e.target.value) };
                      updateSetting('aiConfig', 'parameters', newParams);
                    }}
                    className="w-full accent-accent"
                  />
                  <div className="flex justify-between text-[9px] text-text-muted mt-1">
                    <span>Short memory</span>
                    <span>Long memory</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'privacy' && (
          <div className="space-y-6">
            <div>
              <SectionHeader title="Data Privacy & Backups" description="Manage your local data footprint and security." />
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden divide-y divide-card-border shadow-sm">
                
                <div className="flex flex-col p-4 bg-card hover:bg-bg-secondary/50 transition-colors">
                  <div className="flex justify-between mb-3">
                    <div className="flex gap-3">
                      <div className="mt-0.5 w-6 h-6 rounded bg-accent/10 flex items-center justify-center shrink-0">
                        <Folder className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text-primary">Auto Backup Frequency</p>
                        <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed pr-4">Automatically backup your state.json. 0 = Disabled.</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min="0" max="30" step="1"
                      value={settings.privacy.autoBackupDays}
                      onChange={(e) => updateSetting('privacy', 'autoBackupDays', parseInt(e.target.value))}
                      className="flex-1 accent-accent"
                    />
                    <span className="text-xs font-bold text-text-primary w-16 text-right">{settings.privacy.autoBackupDays === 0 ? 'Disabled' : `${settings.privacy.autoBackupDays} Days`}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-card hover:bg-bg-secondary/50 transition-colors">
                  <div className="flex gap-3">
                    <div className="mt-0.5 w-6 h-6 rounded bg-accent/10 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-primary">Vault Encryption (Beta)</p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed pr-4">Encrypt your local state file at rest.</p>
                    </div>
                  </div>
                  <Toggle active={settings.privacy.encryptionEnabled} onClick={() => updateSetting('privacy', 'encryptionEnabled', !settings.privacy.encryptionEnabled)} />
                </div>

              </div>
            </div>
          </div>
        )}

        {activeSection === 'accessibility' && (
          <div className="space-y-6">
            <div>
              <SectionHeader title="Display & Interaction" description="Adapt the interface for comfort and clarity." />
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden divide-y divide-card-border shadow-sm">
                
                <div className="flex items-center justify-between p-4 bg-card hover:bg-bg-secondary/50 transition-colors">
                  <div className="flex gap-3">
                    <div className="mt-0.5 w-6 h-6 rounded bg-text-muted/20 flex items-center justify-center shrink-0">
                      <Monitor className="w-3.5 h-3.5 text-text-muted" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-primary">Reduced Motion</p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed pr-4">Minimize UI animations and panel transitions.</p>
                    </div>
                  </div>
                  <Toggle active={settings.accessibility.reducedMotion} onClick={() => updateSetting('accessibility', 'reducedMotion', !settings.accessibility.reducedMotion)} />
                </div>

                <div className="flex items-center justify-between p-4 bg-card hover:bg-bg-secondary/50 transition-colors">
                  <div className="flex gap-3">
                    <div className="mt-0.5 w-6 h-6 rounded bg-text-muted/20 flex items-center justify-center shrink-0">
                      <Eye className="w-3.5 h-3.5 text-text-muted" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-primary">Larger Text</p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed pr-4">Increase base font size across the application.</p>
                    </div>
                  </div>
                  <Toggle active={settings.accessibility.largerTextMode} onClick={() => updateSetting('accessibility', 'largerTextMode', !settings.accessibility.largerTextMode)} />
                </div>

                <div className="flex items-center justify-between p-4 bg-card hover:bg-bg-secondary/50 transition-colors">
                  <div className="flex gap-3">
                    <div className="mt-0.5 w-6 h-6 rounded bg-text-muted/20 flex items-center justify-center shrink-0">
                      <Eye className="w-3.5 h-3.5 text-text-muted" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-primary">High Contrast</p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed pr-4">Increase text visibility and boundary distinctness.</p>
                    </div>
                  </div>
                  <Toggle active={settings.accessibility.highContrastMode} onClick={() => updateSetting('accessibility', 'highContrastMode', !settings.accessibility.highContrastMode)} />
                </div>

              </div>
            </div>
          </div>
        )}

        {activeSection === 'advanced' && (
          <div className="space-y-6">
            <div>
              <SectionHeader title="Experimental Features" description="Early access to upcoming capabilities." />
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
                <div className="flex items-center justify-between p-4 bg-card hover:bg-bg-secondary/50 transition-colors">
                  <div className="flex gap-3">
                    <div className="mt-0.5 w-6 h-6 rounded bg-text-muted/20 flex items-center justify-center shrink-0">
                      <Beaker className="w-3.5 h-3.5 text-text-muted" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-primary">Labs Mode</p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed pr-4">Enable bleeding-edge functionality. May be unstable.</p>
                    </div>
                  </div>
                  <Toggle active={settings.features.experimentalFeatures} onClick={() => updateSetting('features', 'experimentalFeatures', !settings.features.experimentalFeatures)} />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <SectionHeader title="Danger Zone" description="Account actions and destructive operations." />
              <div className="bg-danger/5 border border-danger/20 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <button 
                  onClick={() => signOut(auth)}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-card border border-card-border hover:bg-bg-secondary text-text-primary rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm mb-2"
                >
                  Sign Out
                </button>
                <div className="h-px w-full bg-danger/20 my-1"></div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Resetting the workspace will permanently delete all projects, tasks, history, and learned AI profile data. 
                </p>
                {isConfirmingReset ? (
                  <div className="w-full flex flex-col gap-2">
                    <p className="text-xs font-bold text-danger text-center">Are you absolutely sure?</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsConfirmingReset(false)}
                        className="flex-1 p-3 bg-card border border-card-border hover:bg-bg-secondary text-text-primary rounded-xl text-xs font-bold transition-colors shadow-sm"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => {
                          setIsConfirmingReset(false);
                          resetStore();
                        }}
                        className="flex-1 flex items-center justify-center gap-2 p-3 bg-danger text-white hover:bg-danger/90 rounded-xl text-xs font-bold tracking-wider transition-colors shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" /> Confirm Reset
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsConfirmingReset(true)}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-danger/10 border border-danger/30 hover:bg-danger/20 text-danger rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" /> Factory Reset Workspace
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Desktop Agent (Flow) Section ─────────────────── */}
        {activeSection === 'agent' && (
          <div className="space-y-4">
            <SectionHeader title="Flow Assistant" description="Transform FloatGPT into a persistent desktop AI agent." />
            <div className="space-y-3">
              {/* Enable Flow */}
              <div className="flex items-center justify-between gap-2 p-3 bg-card border border-card-border rounded-xl shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary">Enable Flow Agent</p>
                  <p className="text-[10px] text-text-secondary">Persistent background assistant with voice & OS control</p>
                </div>
                <Toggle active={settings.desktopAgent?.enabled ?? false} onClick={() => updateSetting('desktopAgent', 'enabled', !settings.desktopAgent?.enabled)} />
              </div>

              {/* Auto-start */}
              <div className="flex items-center justify-between gap-2 p-3 bg-card border border-card-border rounded-xl shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary">Auto-start with System</p>
                  <p className="text-[10px] text-text-secondary">Launch FloatGPT when your computer starts</p>
                </div>
                <Toggle active={settings.desktopAgent?.autoStart ?? false} onClick={() => updateSetting('desktopAgent', 'autoStart', !settings.desktopAgent?.autoStart)} />
              </div>

              {/* Start Minimized */}
              <div className="flex items-center justify-between gap-2 p-3 bg-card border border-card-border rounded-xl shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary">Start Minimized to Tray</p>
                  <p className="text-[10px] text-text-secondary">Run in background without showing the Orb on startup</p>
                </div>
                <Toggle active={settings.desktopAgent?.startMinimized ?? false} onClick={() => updateSetting('desktopAgent', 'startMinimized', !settings.desktopAgent?.startMinimized)} />
              </div>

              {/* Show Status Indicator */}
              <div className="flex items-center justify-between gap-2 p-3 bg-card border border-card-border rounded-xl shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary">Show Status Indicator</p>
                  <p className="text-[10px] text-text-secondary">Display a dot on the Orb showing Flow's state</p>
                </div>
                <Toggle active={settings.desktopAgent?.showStatusIndicator ?? true} onClick={() => updateSetting('desktopAgent', 'showStatusIndicator', !settings.desktopAgent?.showStatusIndicator)} />
              </div>

              {/* Orb Auto-show */}
              <div className="flex items-center justify-between gap-2 p-3 bg-card border border-card-border rounded-xl shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary">Auto-show Orb on Command</p>
                  <p className="text-[10px] text-text-secondary">Bring FloatGPT to front when a voice command is processed</p>
                </div>
                <Toggle active={settings.desktopAgent?.orbAutoShow ?? true} onClick={() => updateSetting('desktopAgent', 'orbAutoShow', !settings.desktopAgent?.orbAutoShow)} />
              </div>
            </div>

            <SectionHeader title="Voice" description="Control Flow with your voice using a wake word or push-to-talk." />
            <div className="space-y-3">
              {/* Voice Mode */}
              <div className="p-3 bg-card border border-card-border rounded-xl shadow-sm">
                <p className="text-xs font-semibold text-text-primary mb-2">Voice Mode</p>
                <div className="flex gap-2">
                  {(['off', 'wake_word', 'push_to_talk'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => updateSetting('desktopAgent', 'voiceMode', mode)}
                      className={`flex-1 text-[10px] font-bold py-2 px-2 rounded-lg border transition-all ${
                        settings.desktopAgent?.voiceMode === mode
                          ? 'bg-accent text-white border-accent shadow-md'
                          : 'bg-bg-secondary border-card-border text-text-secondary hover:bg-card'
                      }`}
                    >
                      {mode === 'off' ? 'Off' : mode === 'wake_word' ? 'Wake Word' : 'Push-to-Talk'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wake Word */}
              {settings.desktopAgent?.voiceMode === 'wake_word' && (
                <div className="p-3 bg-card border border-card-border rounded-xl shadow-sm">
                  <p className="text-xs font-semibold text-text-primary mb-1">Wake Word</p>
                  <p className="text-[10px] text-text-secondary mb-2">Say this to activate Flow</p>
                  <input
                    type="text"
                    value={settings.desktopAgent?.wakeWord ?? 'hey flow'}
                    onChange={e => updateSetting('desktopAgent', 'wakeWord', e.target.value)}
                    className="w-full text-xs bg-bg-secondary border border-card-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              )}

              {/* Mic Sensitivity */}
              {settings.desktopAgent?.voiceMode !== 'off' && (
                <div className="p-3 bg-card border border-card-border rounded-xl shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-text-primary">Mic Sensitivity</p>
                    <span className="text-[10px] text-accent font-mono">{((settings.desktopAgent?.micSensitivity ?? 0.5) * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={settings.desktopAgent?.micSensitivity ?? 0.5}
                    onChange={e => updateSetting('desktopAgent', 'micSensitivity', parseFloat(e.target.value))}
                    className="w-full accent-accent"
                  />
                </div>
              )}
            </div>

            <SectionHeader title="Local AI (Ollama)" description="Use a local AI model for fast, offline command processing." />
            <div className="space-y-3">
              {/* AI Provider */}
              <div className="p-3 bg-card border border-card-border rounded-xl shadow-sm">
                <p className="text-xs font-semibold text-text-primary mb-2">AI Provider</p>
                <div className="flex gap-2">
                  {(['auto', 'local', 'cloud'] as const).map(provider => (
                    <button
                      key={provider}
                      onClick={() => updateSetting('desktopAgent', 'aiProvider', provider)}
                      className={`flex-1 text-[10px] font-bold py-2 px-2 rounded-lg border transition-all ${
                        settings.desktopAgent?.aiProvider === provider
                          ? 'bg-accent text-white border-accent shadow-md'
                          : 'bg-bg-secondary border-card-border text-text-secondary hover:bg-card'
                      }`}
                    >
                      {provider === 'auto' ? 'Auto' : provider === 'local' ? 'Local (Ollama)' : 'Cloud'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-text-secondary mt-2">
                  {settings.desktopAgent?.aiProvider === 'auto'
                    ? 'Uses local Ollama for simple commands, cloud for complex reasoning'
                    : settings.desktopAgent?.aiProvider === 'local'
                    ? 'All commands processed locally — requires Ollama running'
                    : 'All commands sent to cloud provider (uses API keys)'}
                </p>
              </div>



              {/* Cloud Fallback */}
              <div className="flex items-center justify-between gap-2 p-3 bg-card border border-card-border rounded-xl shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary">Cloud Fallback</p>
                  <p className="text-[10px] text-text-secondary">Fall back to cloud if Ollama is unavailable</p>
                </div>
                <Toggle active={settings.desktopAgent?.cloudFallback ?? true} onClick={() => updateSetting('desktopAgent', 'cloudFallback', !settings.desktopAgent?.cloudFallback)} />
              </div>
            </div>

            <SectionHeader title="Permissions" description="Control which OS actions Flow is allowed to perform." />
            <div className="space-y-2">
              {[
                { id: 'open_url', label: 'Open URLs', desc: 'Open websites in your browser' },
                { id: 'search_web', label: 'Search the Web', desc: 'Perform Google searches' },
                { id: 'open_app', label: 'Open Applications', desc: 'Launch installed apps' },
                { id: 'focus_window', label: 'Focus Windows', desc: 'Bring windows to front' },
              ].map(perm => {
                const permitted = settings.desktopAgent?.permittedActions ?? [];
                const isEnabled = permitted.includes(perm.id);
                return (
                  <div key={perm.id} className="flex items-center justify-between gap-2 p-3 bg-card border border-card-border rounded-xl shadow-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-text-primary">{perm.label}</p>
                      <p className="text-[10px] text-text-secondary">{perm.desc}</p>
                    </div>
                    <Toggle
                      active={isEnabled}
                      onClick={() => {
                        const next = isEnabled
                          ? permitted.filter((a: string) => a !== perm.id)
                          : [...permitted, perm.id];
                        updateSetting('desktopAgent', 'permittedActions', next as any);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 whitespace-nowrap"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

