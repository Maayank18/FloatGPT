import React, { useState } from 'react';
import { Sparkles, Monitor, Cpu, HardDriveDownload, XCircle, DownloadCloud, Terminal, ShieldCheck, Settings, History, Clock } from 'lucide-react';

export const DownloadView = () => {
  const [downloadState, setDownloadState] = useState({ os: null, status: 'idle', error: null });

  const handleDownload = async (os) => {
    try {
      setDownloadState({ os, status: 'downloading', error: null });
      const githubRepo = 'Maayank18/FloatGPT';
      const version = 'v1.3.0';
      let downloadUrl = '';
      
      if (os === 'win') {
        downloadUrl = `https://github.com/${githubRepo}/releases/download/${version}/FloatGPT.Setup.1.3.0.exe`;
      } else {
        downloadUrl = `https://github.com/${githubRepo}/releases/download/${version}/FloatGPT-1.3.0.dmg`;
      }

      // Trigger download
      window.location.href = downloadUrl;
      
      // Reset state after a brief moment to show success
      setTimeout(() => {
        setDownloadState({ os: null, status: 'idle', error: null });
      }, 2000);
      
    } catch (err) {
      console.error("Download failed:", err);
      setDownloadState({ os, status: 'error', error: err.message || "Network error" });
      setTimeout(() => setDownloadState({ os: null, status: 'idle', error: null }), 5000);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg overflow-y-auto items-center p-8 hide-scrollbar relative">
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-accent/5 blur-[120px] rounded-full pointer-events-none"></div>
       
       <div className="max-w-4xl w-full relative z-10 flex flex-col items-center mt-10">
         
         {/* Hero Section */}
         <div className="text-center mb-16">
           <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[12px] font-medium tracking-wide uppercase mb-6">
             <Sparkles className="w-3.5 h-3.5" /> Latest Release
           </div>
           <div className="h-[60px] flex items-center justify-center mb-6 overflow-hidden">
              <img src="/logo.png" alt="FloatGPT Logo" className="h-[120px] w-auto max-w-none object-contain" />
           </div>
           <h1 className="text-4xl font-medium tracking-tight mb-4 text-text-primary">FloatGPT Desktop <span className="text-text-muted">v1.3.0</span></h1>
           <p className="text-[15px] text-text-secondary max-w-2xl leading-relaxed mx-auto">
             Bring context-aware AI directly to your operating system. FloatGPT monitors your habits, manages your schedule, and analyzes your screen in real-time.
           </p>
         </div>
         
         {/* Download Cards */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-20">
           
           {/* Windows Card */}
           <div className="bg-panel border border-card-border rounded-2xl p-8 flex flex-col items-center text-center group hover:border-accent/50 transition-colors">
              <div className="w-16 h-16 bg-bg border border-card-border rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                <Monitor className="w-8 h-8 text-text-primary" />
              </div>
              <h2 className="text-[18px] font-medium text-text-primary mb-2">Windows (x64)</h2>
              <div className="flex items-center gap-4 text-[13px] text-text-muted mb-8">
                <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4" /> x64 Architecture</span>
                <span>•</span>
                <span className="flex items-center gap-1.5"><HardDriveDownload className="w-4 h-4" /> ~100 MB</span>
              </div>
              {downloadState.error && downloadState.os === 'win' && (
                <div className="text-red-400 text-xs mb-3 font-medium bg-red-400/10 py-1.5 px-3 rounded-lg w-full">
                  {downloadState.error}
                </div>
              )}
              <button 
                onClick={() => downloadState.status !== 'downloading' && handleDownload('win')} 
                disabled={downloadState.status === 'downloading'}
                className={`w-full py-3.5 bg-accent text-bg font-medium rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-[14px] ${downloadState.status === 'downloading' && downloadState.os === 'win' ? 'opacity-80 cursor-wait' : 'hover:bg-accent-hover cursor-pointer'}`}>
                {downloadState.status === 'downloading' && downloadState.os === 'win' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin"></div>
                    Preparing download...
                  </>
                ) : downloadState.status === 'error' && downloadState.os === 'win' ? (
                  <>
                    <XCircle className="w-4 h-4" /> Try Again
                  </>
                ) : (
                  <>
                    <DownloadCloud className="w-4 h-4" /> Download .zip (Installer)
                  </>
                )}
              </button>
           </div>

           {/* macOS / Linux Card */}
           <div className="bg-panel border border-card-border rounded-2xl p-8 flex flex-col items-center text-center opacity-75">
              <div className="w-16 h-16 bg-bg border border-card-border rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <Terminal className="w-8 h-8 text-text-muted" />
              </div>
              <h2 className="text-[18px] font-medium text-text-secondary mb-2">macOS & Linux</h2>
              <div className="flex items-center gap-4 text-[13px] text-text-muted mb-8">
                <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4" /> ARM64 / x64</span>
                <span>•</span>
                <span className="flex items-center gap-1.5"><HardDriveDownload className="w-4 h-4" /> ~92 MB</span>
              </div>
              <button 
                disabled={true}
                className="w-full py-3.5 bg-transparent border border-card-border text-text-muted font-medium rounded-xl flex items-center justify-center gap-2 shadow-sm text-[14px] cursor-not-allowed">
                <Clock className="w-4 h-4" /> Coming Soon .....
              </button>
           </div>

         </div>

          {/* Security Trust Notice */}
          <div className="w-full mb-20 p-5 rounded-xl border border-card-border bg-panel/50 flex items-start gap-4">
            <div className="mt-0.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-[13px] font-medium text-text-primary mb-1.5">Security Note</h4>
              <p className="text-[12px] text-text-muted leading-relaxed">
                Because FloatGPT is a new indie application, Windows SmartScreen may show an "unrecognized app" warning during installation.
                This is expected for any unsigned software. To proceed safely: click <strong className="text-text-secondary">"More Info"</strong> → <strong className="text-text-secondary">"Run anyway"</strong>.
                The installer is open-source and verifiable on <a href="https://github.com/Maayank18/FloatGPT" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">GitHub</a>.
              </p>
            </div>
          </div>

          {/* Details Grid (Reqs & Changelog) */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 w-full text-left">
            
            {/* System Requirements */}
            <div className="col-span-1">
              <h3 className="text-[14px] font-medium text-text-primary uppercase tracking-wider mb-6 flex items-center gap-2">
                <Settings className="w-4 h-4 text-text-muted" /> System Requirements
              </h3>
              <div className="space-y-4 text-[13px]">
                <div className="border-b border-card-border pb-3">
                  <span className="block text-text-muted mb-1">Operating System</span>
                  <span className="text-text-primary font-medium">Windows 10/11, macOS 12+, Ubuntu 20.04+</span>
                </div>
                <div className="border-b border-card-border pb-3">
                  <span className="block text-text-muted mb-1">Processor</span>
                  <span className="text-text-primary font-medium">Intel Core i5 / Apple M1 or better</span>
                </div>
                <div className="border-b border-card-border pb-3">
                  <span className="block text-text-muted mb-1">Memory (RAM)</span>
                  <span className="text-text-primary font-medium">8 GB minimum (16 GB recommended)</span>
                </div>
                <div className="pb-3">
                  <span className="block text-text-muted mb-1">Storage</span>
                  <span className="text-text-primary font-medium">500 MB available space</span>
                </div>
              </div>
            </div>

            {/* Version History */}
            <div className="col-span-2">
              <h3 className="text-[14px] font-medium text-text-primary uppercase tracking-wider mb-6 flex items-center gap-2">
                <History className="w-4 h-4 text-text-muted" /> Version History
              </h3>
              
              <div className="relative border-l border-card-border ml-3 pl-8 space-y-8 py-2">
                {/* v1.3.0 - Latest */}
                <div className="relative">
                  <div className="absolute w-3 h-3 bg-accent rounded-full -left-[33.5px] top-1 ring-4 ring-bg"></div>
                  <div className="mb-1 flex items-center gap-3">
                    <h4 className="text-[16px] font-medium text-text-primary">v1.3.0 <span className="text-accent ml-2 text-[13px] bg-accent/10 px-2 py-0.5 rounded-md">Latest</span></h4>
                    <span className="text-[12px] text-text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> July 25, 2026</span>
                  </div>
                  <p className="text-[13px] text-text-secondary mb-4">The Playground Studio & Shared Memory Architecture.</p>
                  <ul className="space-y-2 text-[13px] text-text-primary">
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>The Playground Studio:</strong> A dedicated web environment to review habits, manage memories, and view API keys safely.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Shared Memory Layer:</strong> Transcripts are now strictly decoupled between the Orb and Playground, whilst intelligently syncing your context.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>New Visual Commands:</strong> Added <code>/diagram</code>, <code>/draw</code>, and <code>/table</code> powerful macros.</span>
                    </li>
                  </ul>
                </div>

                {/* v1.2.2 */}
                <div className="relative">
                  <div className="absolute w-3 h-3 bg-card-border rounded-full -left-[33.5px] top-1 ring-4 ring-bg"></div>
                  <div className="mb-1 flex items-center gap-3">
                    <h4 className="text-[16px] font-medium text-text-primary">v1.2.2</h4>
                    <span className="text-[12px] text-text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> July 16, 2026</span>
                  </div>
                  <p className="text-[13px] text-text-secondary mb-4">The Sleep & Wake Resilience Update — bulletproof sleep cycle handling and persistent visibility state.</p>
                  <ul className="space-y-2 text-[13px] text-text-primary">
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Bulletproof Sleep Cycles:</strong> The app now forcefully re-registers the Boss Key every time your laptop wakes from sleep, guaranteeing it never breaks.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Persistent Visibility:</strong> The app now explicitly tracks if you manually hid it. If you put your laptop to sleep while it's hidden, it politely stays hidden when you open it tomorrow.</span>
                    </li>
                  </ul>
                </div>

                {/* v1.2.1 */}
                <div className="relative">
                  <div className="absolute w-3 h-3 bg-card-border rounded-full -left-[33.5px] top-1 ring-4 ring-bg"></div>
                  <div className="mb-1 flex items-center gap-3">
                    <h4 className="text-[16px] font-medium text-text-primary">v1.2.1</h4>
                    <span className="text-[12px] text-text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> July 15, 2026</span>
                  </div>
                  <p className="text-[13px] text-text-secondary mb-4">The True Summon Update — converted the global hotkey into a true system toggle.</p>
                  <ul className="space-y-2 text-[13px] text-text-primary">
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Boss Key Functionality:</strong> The global hotkey (Ctrl+Shift+Space) now instantly hides the entire app when visible, and automatically summons the Chat Panel when hidden.</span>
                    </li>
                  </ul>
                </div>

                {/* v1.2.0 */}
                <div className="relative">
                  <div className="absolute w-3 h-3 bg-card-border rounded-full -left-[33.5px] top-1 ring-4 ring-bg"></div>
                  <div className="mb-1 flex items-center gap-3">
                    <h4 className="text-[16px] font-medium text-text-primary">v1.2.0</h4>
                    <span className="text-[12px] text-text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> July 15, 2026</span>
                  </div>
                  <p className="text-[13px] text-text-secondary mb-4">The Flawless Physics Update — overhauled window layout engine, eliminated ghost-blocking, and bulletproof multi-monitor logic.</p>
                  <ul className="space-y-2 text-[13px] text-text-primary">
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Overhauled Physics:</strong> The core dragging engine was rewritten. Drag the Orb seamlessly anywhere without the panel violently snapping back.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Ghost-Blocking Eliminated:</strong> The invisible background is now mathematically restricted and completely click-through.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Jumping Orb Resolved:</strong> Fixed a layout race-condition that caused the Orb to glitch or jump 400+ pixels across the screen when opening/closing.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Multi-Monitor Support:</strong> The Orb now safely snaps to correct bounds if a secondary monitor is unplugged or sleep-cycled.</span>
                    </li>
                  </ul>
                </div>

                {/* v1.1.1 */}
                <div className="relative">
                  <div className="absolute w-3 h-3 bg-card-border rounded-full -left-[33.5px] top-1 ring-4 ring-bg"></div>
                  <div className="mb-1 flex items-center gap-3">
                    <h4 className="text-[16px] font-medium text-text-primary">v1.1.1</h4>
                    <span className="text-[12px] text-text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> July 14, 2026</span>
                  </div>
                  <p className="text-[13px] text-text-secondary mb-4">The Stability Update — flawless multi-account data isolation, eradicated memory leaks, and enhanced Electron window physics.</p>
                  <ul className="space-y-2 text-[13px] text-text-primary">
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>State Isolation:</strong> API Keys and User State are now strictly wiped upon sign-out to guarantee security between multiple accounts.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Memory Optimization:</strong> Firebase snapshot listeners are now aggressively destroyed to completely prevent memory leaks.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Click-Through Physics:</strong> Transparent Orb padding now explicitly routes mouse clicks to background OS applications instead of ghost blocking.</span>
                    </li>
                  </ul>
                </div>

                {/* v1.1.0 */}
                <div className="relative">
                  <div className="absolute w-3 h-3 bg-card-border rounded-full -left-[33.5px] top-1 ring-4 ring-bg"></div>
                  <div className="mb-1 flex items-center gap-3">
                    <h4 className="text-[16px] font-medium text-text-primary">v1.1.0</h4>
                    <span className="text-[12px] text-text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> July 13, 2026</span>
                  </div>
                  <p className="text-[13px] text-text-secondary mb-4">The Analytics & Reliability Update — live dashboards, smart habit profiling, and bulletproof AI uptime.</p>
                  <ul className="space-y-2 text-[13px] text-text-primary">
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Live Analytics Engine:</strong> Completion Rate, Plan Accuracy, and Avg Delay now compute in real-time from your task data.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Dynamic Habit Profiles:</strong> Peak Focus Window, Active Hours, and Procrastination Hotspots auto-derive from your behavior.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>AI Multi-Key Fallback:</strong> 3-key Groq rotation system ensures 100% API uptime with zero interruptions.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-accent mt-0.5">•</span>
                      <span><strong>Playground Chat Insights:</strong> AI generates real analysis and guidance about your schedule and routines.</span>
                    </li>
                  </ul>
                </div>

                {/* v1.0.0 */}
                <div className="relative">
                  <div className="absolute w-3 h-3 bg-text-muted/40 rounded-full -left-[33.5px] top-1 ring-4 ring-bg"></div>
                  <div className="mb-1 flex items-center gap-3">
                    <h4 className="text-[16px] font-medium text-text-primary">v1.0.0 <span className="text-text-muted ml-2 text-[13px] bg-panel px-2 py-0.5 rounded-md">Stable</span></h4>
                    <span className="text-[12px] text-text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> July 2, 2026</span>
                  </div>
                  <p className="text-[13px] text-text-secondary mb-4">Initial major release featuring the core intelligence engine and local telemetry.</p>
                  <ul className="space-y-2 text-[13px] text-text-primary">
                    <li className="flex items-start gap-3">
                      <span className="text-text-muted mt-0.5">•</span>
                      <span><strong>Conversational Firewall:</strong> AI strictly rejects small talk and grounds answers in your local habit telemetry.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-text-muted mt-0.5">•</span>
                      <span><strong>Global Hotkeys:</strong> Press <code>Ctrl+Shift+Space</code> anywhere on your OS to instantly summon or hide the FloatGPT orb.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-text-muted mt-0.5">•</span>
                      <span><strong>Web Speech API:</strong> Dictate prompts directly using the built-in microphone integration.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

         </div>
         
         <div className="h-24"></div> {/* Bottom padding */}
       </div>
    </div>
  );
};
