import React, { useState, useEffect, useRef } from 'react';
import { DownloadCloud, BookOpen, LogOut, RefreshCw, Settings, User } from 'lucide-react';
import { ModeToggle } from '../../site/ModeToggle';
import { useSiteMode } from '../../site/siteMode';

export const TopBar = ({ 
  activeMenu, 
  setActiveMenu, 
  user,
  onSignOut
}) => {
  const { creative } = useSiteMode();
  
  const navItems = [
    { id: 'manual', label: 'GUIDE', icon: BookOpen },
    { id: 'download', label: 'GET ORB', icon: DownloadCloud },
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
    <header className={creative ? "h-[76px] px-8 flex items-center justify-between shrink-0 border-b-2 border-[#141414] bg-[#f3eee2] relative z-40 transition-colors" : "h-[76px] px-8 flex items-center justify-between shrink-0 border-b border-white/10 bg-[#05050A]/80 backdrop-blur-md relative z-40 transition-colors"}>
      
      {/* Brand & Left Navigation */}
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="flex items-center cursor-pointer h-full" onClick={() => setActiveMenu('download')}>
          <img src="/logo.png" alt="FloatGPT Logo" className={`h-[48px] md:h-[56px] object-contain object-left transition-transform hover:scale-105 ${creative ? 'brightness-90 contrast-125' : 'opacity-90 hover:opacity-100'}`} />
        </div>
        
        {/* Navigation Links: GUIDE and GET THE ORB side-by-side */}
        <nav className="hidden md:flex items-center gap-2.5 ml-4 min-w-0">
          <button
            onClick={() => setActiveMenu('manual')}
            className={creative
              ? `flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-mono font-bold tracking-widest transition-all cursor-pointer ${
                  activeMenu === 'manual' 
                    ? 'text-[#141414] bg-[#ffe85c] border-2 border-[#141414] shadow-[2px_2px_0_#141414]' 
                    : 'text-[#3c3a36] hover:text-[#141414] hover:bg-black/5 border border-transparent'
                }`
              : `flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-mono font-bold tracking-widest transition-all cursor-pointer ${
                  activeMenu === 'manual' 
                    ? 'text-accent bg-accent/10 border border-accent/20 shadow-[0_0_15px_rgba(var(--accent-rgb),0.15)]' 
                    : 'text-text-muted hover:text-white hover:bg-white/5 border border-transparent'
                }`
            }
          >
            {activeMenu === 'manual' && <span className={creative ? "text-[#141414]" : "text-accent opacity-50"}>{'['}</span>}
            <BookOpen className="w-3.5 h-3.5" />
            GUIDE
            {activeMenu === 'manual' && <span className={creative ? "text-[#141414]" : "text-accent opacity-50"}>{']'}</span>}
          </button>

          {/* Get the Orb Button beside Guide */}
          <button
            type="button"
            onClick={() => setActiveMenu('download')}
            className={creative 
              ? `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[13px] font-display font-bold whitespace-nowrap shrink-0 bg-[#ffe85c] text-[#141414] border-2 border-[#141414] shadow-[3px_3px_0_#141414] hover:shadow-[4px_4px_0_#141414] hover:-translate-y-0.5 transition-all cursor-pointer`
              : `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-mono font-extrabold tracking-widest transition-all uppercase whitespace-nowrap shrink-0 cursor-pointer ${
                  activeMenu === 'download' 
                    ? 'text-white bg-accent border border-accent shadow-[0_0_25px_rgba(var(--accent-rgb),0.6)]' 
                    : 'text-white bg-accent/20 border border-accent/60 hover:bg-accent/40 hover:border-accent shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)] hover:shadow-[0_0_25px_rgba(var(--accent-rgb),0.5)]'
                }`
            }
          >
            {creative ? 'get the orb' : (
              <>
                <DownloadCloud className="w-4 h-4" />
                GET ORB
              </>
            )}
          </button>
        </nav>
      </div>

      {/* Right Actions: ONLY the Toggler and Avatar on the right */}
      <div className="flex items-center gap-3 relative shrink-0" ref={dropdownRef}>
         <ModeToggle />
         <div 
           className="flex items-center gap-3 cursor-pointer group" 
           title="Profile Settings"
           onClick={() => setIsDropdownOpen(!isDropdownOpen)}
         >
            <span className={creative 
              ? "hidden xl:inline max-w-[140px] truncate text-[11px] font-mono font-bold text-[#141414] select-none" 
              : "hidden xl:inline max-w-[140px] truncate text-[11px] font-mono font-bold text-text-muted group-hover:text-white transition-colors select-none"
            }>
              {generateFunnyName(profileSeed)}
            </span>
            <div className={creative 
              ? `w-8 h-8 rounded-full overflow-hidden bg-white border-2 border-[#141414] shadow-[2px_2px_0_#141414] flex items-center justify-center animate-[spin_10s_linear_infinite] group-hover:animate-[spin_3s_linear_infinite]` 
              : `w-8 h-8 rounded-full overflow-hidden bg-accent/20 border transition-colors flex items-center justify-center animate-[spin_10s_linear_infinite] group-hover:animate-[spin_3s_linear_infinite] ${isDropdownOpen ? 'border-accent' : 'border-accent/30 group-hover:border-accent'}`
            }>
              <img 
                 src={`https://api.dicebear.com/7.x/bottts/svg?seed=${profileSeed}`}
                 alt="Avatar"
                 className="w-full h-full object-cover scale-[1.2]"
              />
            </div>
         </div>

         {/* Dropdown Menu */}
         {isDropdownOpen && (
           <div className={creative 
             ? "absolute top-[120%] right-0 w-[240px] bg-[#fffdf6] border-2 border-[#141414] shadow-[6px_6px_0_#141414] rounded-xl p-2 flex flex-col gap-1 z-50 animate-in slide-in-from-top-2 fade-in duration-200 text-[#141414]"
             : "absolute top-[120%] right-0 w-[240px] bg-panel border border-white/10 rounded-xl shadow-2xl p-2 flex flex-col gap-1 z-50 animate-in slide-in-from-top-2 fade-in duration-200"
           }>
             
             {/* Info */}
             <div className={creative ? "px-3 py-3 border-b-2 border-[#141414]/15 mb-1 flex items-center gap-3" : "px-3 py-3 border-b border-white/5 mb-1 flex items-center gap-3"}>
               <div className={creative ? "w-8 h-8 rounded-full overflow-hidden bg-white border-2 border-[#141414] flex shrink-0" : "w-8 h-8 rounded-full overflow-hidden bg-accent/20 border border-accent flex shrink-0"}>
                 <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${profileSeed}`} className="w-full h-full object-cover scale-[1.2]" />
               </div>
               <div className="flex flex-col overflow-hidden">
                 <span className={`text-[12px] font-bold truncate ${creative ? 'text-[#141414]' : 'text-white'}`}>{generateFunnyName(profileSeed)}</span>
                 <span className={`text-[10px] truncate ${creative ? 'text-[#6b6860]' : 'text-text-muted'}`}>{user?.email}</span>
               </div>
             </div>


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
