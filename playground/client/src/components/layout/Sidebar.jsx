import React from 'react';
import { Sparkles, History, Fingerprint, DownloadCloud, Key, SquareTerminal, XCircle, Settings, Moon, Sun, Search, BookOpen } from 'lucide-react';

export const Sidebar = ({ 
  isLeftPanelOpen, 
  activeMenu, 
  setActiveMenu, 
  globalState, 
  user, 
  onSignOut,
  theme,
  toggleTheme
}) => {
  return (
    <aside className={`bg-bg border-r border-card-border/30 flex flex-col shrink-0 transition-all duration-300 relative z-20 ${isLeftPanelOpen ? 'w-[260px]' : 'w-0 overflow-hidden opacity-0'}`}>
      
      <div className="h-[72px] flex items-center px-5 shrink-0 mt-2">
        <div className="flex items-center w-full min-w-0">
          <div className="h-[48px] w-full min-w-0 flex items-center">
            <img
              src="/logo-sidebar.png"
              alt="FloatGPT Logo"
              className="block w-[140px] h-full object-contain object-left opacity-90 hover:opacity-100 transition-opacity"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-8 hide-scrollbar">
        
        {/* Explore */}
        <div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.15em] mb-3 px-3">Workspace</p>
          <nav className="space-y-1">
            <button onClick={() => setActiveMenu('playground')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all relative ${activeMenu === 'playground' ? 'bg-panel/80 text-white font-medium shadow-sm' : 'text-text-secondary hover:text-white hover:bg-white/5 font-normal'}`}>
              {activeMenu === 'playground' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-accent rounded-r-full"></div>}
              <Sparkles className={`w-[16px] h-[16px] ${activeMenu === 'playground' ? 'text-accent' : 'text-text-muted'}`} /> 
              <span>Playground</span>
            </button>
            <button onClick={() => setActiveMenu('history')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all relative ${activeMenu === 'history' ? 'bg-panel/80 text-white font-medium shadow-sm' : 'text-text-secondary hover:text-white hover:bg-white/5 font-normal'}`}>
              {activeMenu === 'history' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-accent rounded-r-full"></div>}
              <History className={`w-[16px] h-[16px] ${activeMenu === 'history' ? 'text-accent' : 'text-text-muted'}`} /> 
              <span>History & Analytics</span>
            </button>
          </nav>
        </div>

        {/* Manage */}
        <div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.15em] mb-3 px-3">Manage</p>
          <nav className="space-y-1">

            <button onClick={() => setActiveMenu('download')} className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-[13px] font-bold transition-all group border relative overflow-hidden ${activeMenu === 'download' ? 'bg-blue-500/20 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] border-blue-500/50' : 'bg-blue-500/5 border-blue-500/20 text-blue-100 hover:bg-blue-500/10 hover:border-blue-500/30 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]'}`}>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 opacity-0 group-hover:opacity-100 animate-[shimmer_2s_infinite]"></div>
              <div className="flex items-center gap-3 relative z-10">
                <DownloadCloud className={`w-[18px] h-[18px] transition-transform ${activeMenu === 'download' ? 'text-blue-400' : 'text-blue-400 group-hover:scale-110 group-hover:text-blue-300'}`} /> 
                <span className={`${activeMenu === 'download' ? 'text-white drop-shadow-md' : 'drop-shadow-sm'} tracking-wide`}>Download App</span>
              </div>
              <span className="bg-blue-500 text-white border border-blue-400 text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse hidden md:block relative z-10">EXPLORE</span>
            </button>
            <button onClick={() => setActiveMenu('keys')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all relative ${activeMenu === 'keys' ? 'bg-panel/80 text-white font-medium shadow-sm' : 'text-text-secondary hover:text-white hover:bg-white/5 font-normal'}`}>
              {activeMenu === 'keys' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-accent rounded-r-full"></div>}
              <Key className={`w-[16px] h-[16px] ${activeMenu === 'keys' ? 'text-accent' : 'text-text-muted'}`} /> 
              <span>API Keys</span>
            </button>
            <button onClick={() => setActiveMenu('manual')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all relative ${activeMenu === 'manual' ? 'bg-panel/80 text-white font-medium shadow-sm' : 'text-text-secondary hover:text-white hover:bg-white/5 font-normal'}`}>
              {activeMenu === 'manual' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-accent rounded-r-full"></div>}
              <BookOpen className={`w-[16px] h-[16px] ${activeMenu === 'manual' ? 'text-accent' : 'text-text-muted'}`} /> 
              <span>Installation Guide</span>
            </button>
            <button onClick={() => setActiveMenu('docs')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all relative ${activeMenu === 'docs' ? 'bg-panel/80 text-white font-medium shadow-sm' : 'text-text-secondary hover:text-white hover:bg-white/5 font-normal'}`}>
              {activeMenu === 'docs' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-accent rounded-r-full"></div>}
              <BookOpen className={`w-[16px] h-[16px] ${activeMenu === 'docs' ? 'text-accent' : 'text-text-muted'}`} /> 
              <span>Docs</span>
            </button>
          </nav>
        </div>
      </div>



      {/* Footer Area (Account & Actions) */}
      <div className="p-4 shrink-0 border-t border-card-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
             <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-accent/20 to-accent/5 flex items-center justify-center shrink-0 border border-white/5">
               <span className="text-[11px] font-bold text-accent">{user?.email?.charAt(0).toUpperCase() || 'U'}</span>
             </div>
             <div className="flex flex-col overflow-hidden">
               <span className="text-[12px] font-medium text-text-primary truncate">{user?.email || 'User'}</span>
             </div>
          </div>
          <button 
            onClick={onSignOut}
            className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors group cursor-pointer shrink-0"
            title="Sign Out"
          >
            <SquareTerminal className="w-[14px] h-[14px] group-hover:hidden" />
            <XCircle className="w-[14px] h-[14px] hidden group-hover:block" />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-4 text-text-muted/70 px-1">
          <Settings onClick={() => setActiveMenu('keys')} className="w-[14px] h-[14px] cursor-pointer hover:text-text-primary transition-colors" title="Configuration Settings" />
          {theme === 'dark' ? (
            <Sun onClick={toggleTheme} className="w-[14px] h-[14px] cursor-pointer hover:text-text-primary transition-colors" title="Switch to Light Theme" />
          ) : (
            <Moon onClick={toggleTheme} className="w-[14px] h-[14px] cursor-pointer hover:text-text-primary transition-colors" title="Switch to Dark Theme" />
          )}
          <Search onClick={() => alert('Search is globally available via Ctrl+F / Cmd+F')} className="w-[14px] h-[14px] cursor-pointer hover:text-text-primary transition-colors ml-auto" />
        </div>
      </div>
    </aside>
  );
};
