import React, { useState } from 'react';
import { Sparkles, Monitor, Cpu, HardDriveDownload, XCircle, DownloadCloud, Terminal, ShieldCheck, Settings, History, Clock, Users, Copy, Check, Star } from 'lucide-react';
import { SHOW_MACOS_ON_SITE } from '../config/publicRelease';

const WINDOWS_RELEASE = { tag: 'v2.2.0', version: '2.2.0', asset: 'FloatGPT.Setup.2.2.0.exe' };
const MAC_RELEASE = { tag: 'v2.1.2', version: '2.1.2', asset: 'FloatGPT-2.1.2-arm64.dmg' };
const ONCE_COMMANDS = `git clone https://github.com/Maayank18/FloatGPT.git
cd FloatGPT
ollama pull qwen3.5:9b
npm install`;
const USE_COMMAND = 'npm run dev';

const EARLIER_RELEASES = [
  { version: '2.1.1', date: 'Aug 25, 2026', note: 'The Windows core this release builds on.' },
  { version: '2.1.0', date: 'Aug 24, 2026', note: 'A model picker in the panel, document reading, and a backup key when one fails.' },
  { version: '2.0.0', date: 'Aug 21, 2026', note: 'Desktop actions from chat. Ctrl+Shift+Space opens the conversation.' },
  { version: '1.3.0', date: 'Jul 25, 2026', note: 'The Playground. Its chats stay separate from the orb.' },
  { version: '1.2.2', date: 'Jul 16, 2026', note: 'The hotkey still works after sleep. A hidden orb stays hidden.' },
  { version: '1.2.1', date: 'Jul 15, 2026', note: 'Ctrl+Shift+Space hides the app, or opens chat when it is hidden.' },
  { version: '1.2.0', date: 'Jul 15, 2026', note: 'Dragging, clicks through the clear edge, and more than one monitor.' },
  { version: '1.1.1', date: 'Jul 14, 2026', note: 'Sign-out clears keys. Clicks pass through the clear edge of the orb.' },
  { version: '1.1.0', date: 'Jul 13, 2026', note: 'Task stats and habit notes in the Playground.' },
  { version: '1.0.0', date: 'Jul 2, 2026', note: 'First Windows release. The orb and the global hotkey.' },
];

function CommandBlock({ label, text, copied, onCopy }) {
  return (
    <div className="mt-2">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</div>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-md border border-card-border bg-bg px-2 py-1 text-[10px] font-semibold text-text-muted hover:text-text-primary cursor-pointer"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-all rounded-lg border border-card-border bg-bg px-3 py-2.5 font-mono text-[12px] leading-relaxed text-text-primary">{text}</pre>
    </div>
  );
}

export const DownloadView = () => {
  const [downloadState, setDownloadState] = useState({ os: null, status: 'idle', error: null });
  const [copiedBlock, setCopiedBlock] = useState(null);
  const [downloadCounts, setDownloadCounts] = useState({
    win: 27,
    mac: 4,
    total: 31,
    previousWin: 27,
    recordedWin: 0,
    loaded: true,
  });

  React.useEffect(() => {
    let live = true;
    async function loadInstalls() {
      try {
        const apiRes = await fetch('/api/stats/installs', { cache: 'no-store' });
        if (!apiRes.ok) return;
        const stats = await apiRes.json();
        if (!live || typeof stats.win !== 'number' || typeof stats.mac !== 'number') return;
        setDownloadCounts({
          win: stats.win,
          mac: stats.mac,
          total: typeof stats.total === 'number' ? stats.total : stats.win + stats.mac,
          previousWin: typeof stats.previousWin === 'number' ? stats.previousWin : 27,
          recordedWin: typeof stats.recordedWin === 'number' ? stats.recordedWin : Math.max(0, stats.win - 27),
          loaded: true,
        });
      } catch {
        // Keep the last number. A failed refresh must not invent a count.
      }
    }
    loadInstalls();
    const timer = window.setInterval(loadInstalls, 5000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadInstalls();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const totalInstalls = SHOW_MACOS_ON_SITE ? downloadCounts.total : downloadCounts.win;
  const previousWin = downloadCounts.previousWin || 27;

  const copyCommands = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedBlock(id);
    setTimeout(() => setCopiedBlock((current) => (current === id ? null : current)), 1600);
  };

  const applyCounts = (stats) => {
    if (typeof stats?.win !== 'number' || typeof stats?.mac !== 'number') return;
    setDownloadCounts({
      win: stats.win,
      mac: stats.mac,
      total: typeof stats.total === 'number' ? stats.total : stats.win + stats.mac,
      previousWin: typeof stats.previousWin === 'number' ? stats.previousWin : 27,
      recordedWin: typeof stats.recordedWin === 'number' ? stats.recordedWin : Math.max(0, stats.win - 27),
      loaded: true,
    });
  };

  const handleDownload = async (os) => {
    try {
      setDownloadState({ os, status: 'downloading', error: null });
      const githubRepo = 'Maayank18/FloatGPT';
      let downloadUrl = '';
      const release = os === 'win' ? WINDOWS_RELEASE : MAC_RELEASE;
      downloadUrl = `https://github.com/${githubRepo}/releases/download/${release.tag}/${release.asset}`;
      try {
        const storedKey = 'floatgpt_download_id';
        let downloadId = window.localStorage.getItem(storedKey);
        if (!downloadId) {
          downloadId = window.crypto.randomUUID();
          window.localStorage.setItem(storedKey, downloadId);
        }
        const logged = await fetch('/api/stats/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ downloadId: `${downloadId}-${os}-${release.version.replaceAll('.', '')}`, platform: os, version: release.version }),
        });
        if (logged.ok) applyCounts(await logged.json());
      } catch {
        // The installer still downloads if the log cannot be saved.
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
         <div className="text-center mb-14">
           <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[12px] font-medium tracking-wide uppercase mb-6">
             <Sparkles className="w-3.5 h-3.5" /> Latest Release
           </div>
           
           {/* Fixed Logo: No clipping or overflow-hidden */}
           <div className="flex items-center justify-center mb-6">
              <img src="/logo.png" alt="FloatGPT Logo" className="h-16 md:h-20 w-auto object-contain drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]" />
           </div>

           <h1 className="text-4xl font-medium tracking-tight mb-4 text-text-primary">Get your own FloatGPT</h1>
           {SHOW_MACOS_ON_SITE ? (
           <p className="text-[15px] text-text-secondary max-w-2xl leading-relaxed mx-auto">
             Windows <span className="text-text-primary font-medium">v{WINDOWS_RELEASE.version}</span> is the newest build. macOS stays on <span className="text-text-primary font-medium">v{MAC_RELEASE.version}</span> until the next Mac release.
           </p>
           ) : (
           <p className="text-[15px] text-text-secondary max-w-2xl leading-relaxed mx-auto">
             Download the Windows app <span className="text-text-primary font-medium">v{WINDOWS_RELEASE.version}</span>, or run the open-source copy on your own PC. No API key is required for the local path.
           </p>
           )}

           {/* TOTAL VERIFIED INSTALLATIONS BANNER */}
           <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
             <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-panel border border-card-border shadow-sm">
               <span className="relative flex h-2.5 w-2.5">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
               </span>
               <Users className="w-4 h-4 text-accent" />
               <span className="text-xs text-text-muted font-medium">Downloads and installs:</span>
               <span className="text-base font-bold text-text-primary font-mono tracking-tight">
                 {totalInstalls === null ? '…' : totalInstalls.toLocaleString()}
               </span>
             </div>

             <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-panel/60 border border-card-border/60 text-[11px] text-text-muted">
               <span>Windows: <strong className="text-text-primary font-mono">{downloadCounts.win.toLocaleString()}</strong></span>
               {SHOW_MACOS_ON_SITE && (
               <>
               <span>•</span>
               <span>macOS: <strong className="text-text-primary font-mono">{downloadCounts.mac.toLocaleString()}</strong></span>
               </>
               )}
               <span>•</span>
               <span>{previousWin.toLocaleString()} earlier Windows downloads are included. A download from this browser is logged once. Opening the installed app is logged once.</span>
             </div>
           </div>
         </div>
         
         {/* Download Cards */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-20 items-start">
           
           {/* Windows Card */}
           <div className="bg-panel border border-card-border rounded-2xl p-8 flex flex-col items-center text-center group hover:border-accent/50 transition-colors relative overflow-hidden">
              <div className="w-16 h-16 bg-bg border border-card-border rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                <Monitor className="w-8 h-8 text-text-primary" />
              </div>
              <h2 className="text-[18px] font-medium text-text-primary mb-2">Windows (x64)</h2>
              <p className="text-[12px] font-semibold text-accent mb-2">v{WINDOWS_RELEASE.version} · this release</p>
              <div className="flex items-center gap-4 text-[13px] text-text-muted mb-4">
                <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4" /> x64 Architecture</span>
                <span>•</span>
                <span className="flex items-center gap-1.5"><HardDriveDownload className="w-4 h-4" /> ~100 MB</span>
              </div>

              {/* Real Download Count Metric Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] font-mono mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{downloadCounts.win.toLocaleString()} on Windows</span>
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
                    <DownloadCloud className="w-4 h-4" /> Download .exe (Installer)
                  </>
                )}
              </button>
           </div>

           {/* macOS / Linux Card */}
           {SHOW_MACOS_ON_SITE && (
           <div className="bg-panel border border-card-border rounded-2xl p-8 flex flex-col items-center text-center group hover:border-accent/50 transition-colors relative overflow-hidden">
              <div className="w-16 h-16 bg-bg border border-card-border rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                <Terminal className="w-8 h-8 text-text-primary" />
              </div>
              <h2 className="text-[18px] font-medium text-text-primary mb-2">macOS (Apple Silicon / Intel)</h2>
              <p className="text-[12px] font-semibold text-text-muted mb-2">v{MAC_RELEASE.version} · latest Mac build</p>
              <div className="flex items-center gap-4 text-[13px] text-text-muted mb-4">
                <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4" /> ARM64 / x64</span>
                <span>•</span>
                <span className="flex items-center gap-1.5"><HardDriveDownload className="w-4 h-4" /> ~105 MB</span>
              </div>

              {/* Real Download Count Metric Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] font-mono mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{downloadCounts.loaded ? downloadCounts.mac.toLocaleString() : '…'} macOS installs</span>
              </div>

              {downloadState.error && downloadState.os === 'mac' && (
                <div className="text-red-400 text-xs mb-3 font-medium bg-red-400/10 py-1.5 px-3 rounded-lg w-full">
                  {downloadState.error}
                </div>
              )}
              <button 
                onClick={() => downloadState.status !== 'downloading' && handleDownload('mac')} 
                disabled={downloadState.status === 'downloading'}
                className={`w-full py-3.5 bg-accent text-bg font-medium rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-[14px] ${downloadState.status === 'downloading' && downloadState.os === 'mac' ? 'opacity-80 cursor-wait' : 'hover:bg-accent-hover cursor-pointer'}`}>
                {downloadState.status === 'downloading' && downloadState.os === 'mac' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin"></div>
                    Preparing download...
                  </>
                ) : downloadState.status === 'error' && downloadState.os === 'mac' ? (
                  <>
                    <XCircle className="w-4 h-4" /> Try Again
                  </>
                ) : (
                  <>
                    <DownloadCloud className="w-4 h-4" /> Download .dmg (Installer)
                  </>
                )}
              </button>
           </div>
           )}

           <div className="bg-panel border border-card-border rounded-2xl p-8 flex flex-col text-left hover:border-accent/50 transition-colors">
              <div className="mb-5 flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-card-border bg-bg">
                  <Terminal className="h-7 w-7 text-text-primary" />
                </div>
                <div>
                  <h2 className="text-[18px] font-medium text-text-primary">Run it on your own PC</h2>
                  <p className="mt-1 text-[13px] text-text-muted">Open source. The model stays on your machine.</p>
                </div>
              </div>
              <a
                href="https://github.com/Maayank18/FloatGPT"
                target="_blank"
                rel="noopener noreferrer"
                className="mb-4 inline-flex items-center gap-2 self-start rounded-lg border border-card-border bg-bg px-3 py-2 text-[12px] font-medium text-text-primary hover:border-accent/40 hover:text-accent transition-colors"
              >
                <span className="font-semibold text-accent underline underline-offset-2">Repo link</span>
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                If this is useful, please star the repo
              </a>

              <p className="text-[13px] leading-relaxed text-text-secondary">
                <span className="font-semibold text-text-primary">Once.</span> Install <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Node.js 20+</a> and <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Ollama</a>. Ollama does not need an account. <span className="font-mono text-text-primary">npm install</span> does not install Ollama or the model.
              </p>
              <CommandBlock label="One-time setup" text={ONCE_COMMANDS} copied={copiedBlock === 'once'} onCopy={() => copyCommands('once', ONCE_COMMANDS)} />
              <p className="mt-2 text-[12px] leading-relaxed text-text-muted">Qwen 3.5 9B is about 6.6 GB and stays on disk after this.</p>

              <CommandBlock label="Use it" text={USE_COMMAND} copied={copiedBlock === 'use'} onCopy={() => copyCommands('use', USE_COMMAND)} />
              <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                Run that from the FloatGPT folder. The orb opens. With no API key, chat uses Qwen on this PC. If a cloud key is already saved, choose <span className="font-medium text-text-primary">On this PC</span> in the key menu.
              </p>

              <p className="mt-4 text-[13px] leading-relaxed text-text-secondary">
                <span className="font-semibold text-text-primary">Stop it.</span> Press <span className="font-mono text-text-primary">Ctrl+C</span> in that terminal, or close the terminal. The model stays installed.
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                <span className="font-semibold text-text-primary">Next time.</span> Open a terminal in the FloatGPT folder and run <span className="font-mono text-text-primary">npm run dev</span> again. Skip the clone, the model pull, and <span className="font-mono text-text-primary">npm install</span>.
              </p>
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

          <div className="grid w-full grid-cols-1 items-start gap-6 text-left lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
            
            <section className="rounded-2xl border border-card-border bg-panel p-5">
              <h3 className="mb-4 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-text-primary">
                <Settings className="h-4 w-4 text-text-muted" /> System requirements
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Windows app</p>
                  <dl className="mt-2 space-y-2 text-[13px]">
                    <div className="flex items-baseline justify-between gap-4 border-b border-card-border/70 pb-2">
                      <dt className="text-text-muted">System</dt>
                      <dd className="text-right font-medium text-text-primary">{SHOW_MACOS_ON_SITE ? 'Windows 10 or 11, 64-bit. macOS 12 or newer for the Mac build.' : 'Windows 10 or 11, 64-bit'}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4 border-b border-card-border/70 pb-2">
                      <dt className="text-text-muted">Download</dt>
                      <dd className="text-right font-medium text-text-primary">About 100 MB</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-text-muted">Internet</dt>
                      <dd className="text-right font-medium text-text-primary">Only when chat uses a cloud key</dd>
                    </div>
                  </dl>
                </div>
                <div className="rounded-xl border border-card-border bg-bg px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Local chat, with no API key</p>
                  <dl className="mt-2 space-y-2 text-[13px]">
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-text-muted">To run the repo</dt>
                      <dd className="text-right font-medium text-text-primary">Node.js 20 or newer</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-text-muted">Model</dt>
                      <dd className="text-right font-medium text-text-primary">Ollama, Qwen 3.5 9B, about 6.6 GB</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-text-muted">Memory</dt>
                      <dd className="text-right font-medium text-text-primary">8 GB to run that model. 16 GB is easier.</dd>
                    </div>
                  </dl>
                </div>
                <p className="text-[12px] leading-relaxed text-text-muted">Opening apps and reading this PC does not need a model. Voice needs a microphone. The rest of the app does not.</p>
              </div>
            </section>

            <section className="rounded-2xl border border-card-border bg-panel p-5">
              <h3 className="mb-4 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-text-primary">
                <History className="h-4 w-4 text-text-muted" /> Version history
              </h3>
              <article className="rounded-xl border border-accent/35 bg-bg px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-[16px] font-semibold text-text-primary">v2.2.0</h4>
                  <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">Latest Windows</span>
                  <span className="flex items-center gap-1 text-[12px] text-text-muted sm:ml-auto"><Clock className="h-3 w-3" /> Sep 30, 2026</span>
                </div>
                <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">FloatGPT 2.2.0 is the Windows release. Ask in English or Hinglish to open an app, a Settings page, or a file on the desktop, or to read the memory in use, and the result stays in the chat. A question about the screen names the real window behind the orb. Hold to talk, and the answer is spoken back. A PDF you keep can be asked about later. A file you close stays closed, and each chat keeps its own thread.</p>
              </article>
              {SHOW_MACOS_ON_SITE && (
                <article className="mt-3 rounded-xl border border-card-border bg-bg px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-[15px] font-semibold text-text-primary">v2.1.2</h4>
                    <span className="rounded-md border border-card-border bg-card px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Latest macOS</span>
                    <span className="text-[12px] text-text-muted sm:ml-auto">Aug 26, 2026</span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">The Mac installer stays on this build. Windows moved on to 2.2.0.</p>
                </article>
              )}
              <div className="mt-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Earlier</p>
                <ol>
                  {EARLIER_RELEASES.map((release) => (
                    <li key={release.version} className="grid grid-cols-1 gap-0.5 border-t border-card-border/70 py-2.5 text-[13px] sm:grid-cols-[4.6rem_6.2rem_minmax(0,1fr)] sm:items-baseline sm:gap-3">
                      <span className="font-semibold text-text-primary">v{release.version}</span>
                      <span className="text-[12px] text-text-muted">{release.date}</span>
                      <span className="leading-relaxed text-text-secondary">{release.note}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          </div>

         <div className="h-24"></div> {/* Bottom padding */}
       </div>
    </div>
  );
};
