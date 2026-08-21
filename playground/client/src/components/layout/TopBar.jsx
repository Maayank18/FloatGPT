import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, History, DownloadCloud, Key, BookOpen, LogOut, RefreshCw, Settings, User } from 'lucide-react';

export const TopBar = ({ 
  activeMenu, 
  setActiveMenu, 
  user,
  onSignOut
}) => {
  
  const navItems = [
    { id: 'playground', label: 'PLAYGROUND', icon: Sparkles },
    { id: 'history', label: 'HISTORY', icon: History },
    { id: 'keys', label: 'API_KEYS', icon: Key },
    { id: 'manual', label: 'GUIDE', icon: BookOpen },
    { id: 'download', label: 'GET YOUR FLOAT NOW', icon: DownloadCloud },
  ];

  const [profileSeed, setProfileSeed] = useState(user?.email || 'default');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  useEffect(() => {
    if (user?.email && profileSeed === 'default') {
       setProfileSeed(user.email);
    }
  }, [user]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRandomizeProfile = () => {
    setProfileSeed(Math.random().toString(36).substring(7));
  };

  const generateFunnyName = (email) => {
    if (!email) return 'Mystery Hacker';
    const adjectives = ['Cosmic', 'Quantum', 'Neon', 'Cyber', 'Stealth', 'Hyper', 'Astro', 'Nano', 'Mecha', 'Synth'];
    const nouns = ['Ninja', 'Pilot', 'Nomad', 'Cyborg', 'Samurai', 'Rogue', 'Wizard', 'Phantom', 'Ghost', 'Architect'];
    
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const absHash = Math.abs(hash);
    const adj = adjectives[absHash % adjectives.length];
    const noun = nouns[Math.floor(absHash / 2) % nouns.length];
    return `${adj} ${noun}`;
  };

  return (
    <header className="h-[76px] px-8 flex items-center justify-between shrink-0 border-b border-white/10 bg-[#05050A]/80 backdrop-blur-md relative z-40">
      
      {/* Brand */}
      <div className="flex items-center gap-6">
        <div className="flex items-center cursor-pointer h-full" onClick={() => setActiveMenu('playground')}>
          <img src="/logo.png" alt="FloatGPT Logo" className="h-[48px] md:h-[56px] object-contain object-left opacity-90 hover:opacity-100 transition-transform hover:scale-105" />
        </div>
        
        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-2 ml-4">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            if (item.id === 'download') {
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveMenu(item.id)}
                  className={`flex items-center gap-2 px-5 py-2 ml-4 rounded-lg text-[12px] font-mono font-extrabold tracking-widest transition-all uppercase ${
                    isActive 
                      ? 'text-white bg-accent border border-accent shadow-[0_0_25px_rgba(var(--accent-rgb),0.6)]' 
                      : 'text-white bg-accent/20 border border-accent/60 hover:bg-accent/40 hover:border-accent shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)] hover:shadow-[0_0_25px_rgba(var(--accent-rgb),0.5)] animate-[pulse_2s_infinite]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              )
            }
            return (
              <button
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-mono font-bold tracking-widest transition-all ${
                  isActive 
                    ? 'text-accent bg-accent/10 border border-accent/20 shadow-[0_0_15px_rgba(var(--accent-rgb),0.15)]' 
                    : 'text-text-muted hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {isActive && <span className="text-accent opacity-50">[</span>}
                <Icon className="w-3.5 h-3.5" />
                {item.label}
                {isActive && <span className="text-accent opacity-50">]</span>}
              </button>
            )
          })}
        </nav>
      </div>

      {/* User Actions */}
      {/* User Actions */}
      <div className="flex items-center gap-4 relative" ref={dropdownRef}>
         <div 
           className="flex items-center gap-3 cursor-pointer group" 
           title="Profile Settings"
           onClick={() => setIsDropdownOpen(!isDropdownOpen)}
         >
            <span className="text-[11px] font-mono font-bold text-text-muted group-hover:text-white transition-colors select-none">
              {generateFunnyName(profileSeed)}
            </span>
            <div className={`w-8 h-8 rounded-full overflow-hidden bg-accent/20 border transition-colors flex items-center justify-center animate-[spin_10s_linear_infinite] group-hover:animate-[spin_3s_linear_infinite] ${isDropdownOpen ? 'border-accent' : 'border-accent/30 group-hover:border-accent'}`}>
              <img 
                 src={`https://api.dicebear.com/7.x/bottts/svg?seed=${profileSeed}`}
                 alt="Avatar"
                 className="w-full h-full object-cover scale-[1.2]"
              />
            </div>
         </div>

         {/* Dropdown Menu */}
         {isDropdownOpen && (
           <div className="absolute top-[120%] right-0 w-[240px] bg-panel border border-white/10 rounded-xl shadow-2xl p-2 flex flex-col gap-1 z-50 animate-in slide-in-from-top-2 fade-in duration-200">
             
             {/* Info */}
             <div className="px-3 py-3 border-b border-white/5 mb-1 flex items-center gap-3">
               <div className="w-8 h-8 rounded-full overflow-hidden bg-accent/20 border border-accent flex shrink-0">
                 <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${profileSeed}`} className="w-full h-full object-cover scale-[1.2]" />
               </div>
               <div className="flex flex-col overflow-hidden">
                 <span className="text-[12px] font-bold text-white truncate">{generateFunnyName(profileSeed)}</span>
                 <span className="text-[10px] text-text-muted truncate">{user?.email}</span>
               </div>
             </div>

             {/* Actions */}
             <button 
               onClick={handleRandomizeProfile}
               className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[12px] font-medium text-text-secondary hover:text-white hover:bg-white/5 transition-colors text-left"
             >
               <RefreshCw className="w-4 h-4 text-accent" />
               Randomize Persona
             </button>
             
             <button 
               onClick={() => {
                 // Trigger Settings Panel (RightPanel uses a global toggle, we can just change active menu or rely on the right panel toggle which isn't passed here currently. 
                 // Let's just alert for now or you can pass toggleRightPanel if needed)
                 alert("Settings Panel will open here!");
                 setIsDropdownOpen(false);
               }}
               className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[12px] font-medium text-text-secondary hover:text-white hover:bg-white/5 transition-colors text-left"
             >
               <Settings className="w-4 h-4 text-text-muted" />
               System Settings
             </button>

             <div className="w-full h-px bg-white/5 my-1"></div>

             <button 
               onClick={() => {
                 setIsDropdownOpen(false);
                 onSignOut();
               }}
               className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[12px] font-medium text-danger hover:bg-danger/10 transition-colors text-left"
             >
               <LogOut className="w-4 h-4" />
               Disconnect Engine
             </button>
           </div>
         )}
      </div>
    </header>
  );
};
