import React, { useState } from 'react';
import { DownloadCloud, ShieldAlert, Key, RefreshCw, Move, CheckCircle2, ArrowRight, Zap, Copy, Check, Terminal, Apple, Monitor } from 'lucide-react';

export const ManualView = () => {
  const [activePlatform, setActivePlatform] = useState('windows');
  const [copiedCmd, setCopiedCmd] = useState(false);

  const macTerminalCommand = 'xattr -cr /Applications/FloatGPT.app';

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-bg custom-scrollbar text-text-primary p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div>
          <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 mb-6 flex items-center justify-center gap-3 w-full text-center shadow-sm">
             <Zap className="w-5 h-5 text-accent shrink-0 animate-pulse" />
             <p className="text-[15px] text-accent font-bold tracking-wide">
               Cross-Platform Desktop AI Companion — Available for Windows & macOS!
             </p>
          </div>
          <h1 className="text-3xl font-bold mb-3">Quick Start & Installation Guide</h1>
          <p className="text-text-secondary text-[16px] leading-relaxed">
            Follow the platform-specific steps below to install and run FloatGPT. FloatGPT is an always-on, floating AI companion designed to keep you focused and accelerate execution with zero distractions.
          </p>
        </div>

        {/* Platform Switcher Tabs — Centered */}
        <div className="flex justify-center w-full my-4">
          <div className="flex items-center gap-2 bg-panel p-1.5 rounded-2xl border border-card-border shadow-md w-full max-w-md">
            <button
              onClick={() => setActivePlatform('windows')}
              className={`flex-1 py-3 px-4 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                activePlatform === 'windows'
                  ? 'bg-accent text-white shadow-md'
                  : 'text-text-muted hover:text-text-primary hover:bg-card'
              }`}
            >
              <Monitor className="w-4 h-4" />
              Windows Setup
            </button>
            <button
              onClick={() => setActivePlatform('macos')}
              className={`flex-1 py-3 px-4 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                activePlatform === 'macos'
                  ? 'bg-accent text-white shadow-md'
                  : 'text-text-muted hover:text-text-primary hover:bg-card'
              }`}
            >
              <Apple className="w-4 h-4" />
              macOS Setup
            </button>
          </div>
        </div>

        <hr className="border-card-border/50" />

        {/* ────────────────────────────────────────────────────────── */}
        {/* WINDOWS GUIDE                                             */}
        {/* ────────────────────────────────────────────────────────── */}
        {activePlatform === 'windows' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Step 1: Download & Install */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-accent font-semibold text-xl">
                <div className="bg-accent/10 p-2 rounded-lg"><DownloadCloud className="w-5 h-5" /></div>
                <h2>Step 1: Download & Install (Windows)</h2>
              </div>
              <ol className="list-decimal list-inside text-[15px] text-text-secondary space-y-3 pl-2">
                <li>Go to the <strong>Download App</strong> section in the top bar.</li>
                <li>Download the Windows Installer (<code>FloatGPT.Setup.2.1.2.exe</code>).</li>
                <li>Double-click the installer. FloatGPT will launch automatically upon completion.</li>
              </ol>
              
              {/* Windows SmartScreen Warning Box */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 mt-4 flex gap-4 items-start">
                <ShieldAlert className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-[14px] font-bold text-blue-300 mb-2">Did you see a blue Windows SmartScreen popup?</h3>
                  <p className="text-[14px] text-blue-100/90 leading-relaxed mb-4">
                    Since FloatGPT is a direct developer build, Windows SmartScreen flags it on first launch. This is completely standard and safe:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-black/20 rounded-lg overflow-hidden border border-card-border/50">
                       <div className="p-2 text-[12px] font-semibold text-text-muted text-center border-b border-card-border/50">1. Click "More info"</div>
                       <img src="/docs/warning_1.png" alt="Step 1" className="w-full object-cover" />
                    </div>
                    <div className="bg-black/20 rounded-lg overflow-hidden border border-card-border/50">
                       <div className="p-2 text-[12px] font-semibold text-text-muted text-center border-b border-card-border/50">2. Click "Run anyway"</div>
                       <img src="/docs/warning_2.png" alt="Step 2" className="w-full object-cover" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Controls */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-accent font-semibold text-xl">
                <div className="bg-accent/10 p-2 rounded-lg"><Move className="w-5 h-5" /></div>
                <h2>Step 2: Master the Windows Orb</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="bg-panel border border-card-border p-5 rounded-xl flex flex-col gap-3 hover:border-accent/30 transition-colors">
                  <div className="bg-card self-start px-3 py-1.5 rounded-lg text-[13px] font-mono font-bold border border-card-border shadow-sm text-accent">Ctrl + Shift + Space</div>
                  <div>
                    <h4 className="text-[14px] font-bold text-text-primary mb-1">Global Summon Shortcut</h4>
                    <p className="text-[13px] text-text-secondary leading-relaxed">Press from anywhere on your PC to instantly show or hide the floating orb.</p>
                  </div>
                </div>
                <div className="bg-panel border border-card-border p-5 rounded-xl flex flex-col gap-3 hover:border-accent/30 transition-colors">
                  <div className="bg-card self-start px-3 py-1.5 rounded-lg border border-card-border shadow-sm">
                     <Move className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <h4 className="text-[14px] font-bold text-text-primary mb-1">Smooth Drag & Drop</h4>
                    <p className="text-[13px] text-text-secondary leading-relaxed">Drag the circular orb anywhere across your monitors. Click to open the execution studio.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* MACOS GUIDE                                               */}
        {/* ────────────────────────────────────────────────────────── */}
        {activePlatform === 'macos' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Step 1: Download & Install */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-accent font-semibold text-xl">
                <div className="bg-accent/10 p-2 rounded-lg"><DownloadCloud className="w-5 h-5" /></div>
                <h2>Step 1: Download & Install (macOS)</h2>
              </div>
              <ol className="list-decimal list-inside text-[15px] text-text-secondary space-y-3 pl-2">
                <li>Go to the <strong>Download App</strong> section in the top bar.</li>
                <li>Download the macOS Disk Image (<code>FloatGPT-2.1.2-arm64.dmg</code>).</li>
                <li>Double-click the <code>.dmg</code> file and drag the <strong>FloatGPT</strong> icon into your <strong>/Applications</strong> folder.</li>
              </ol>

              {/* macOS Gatekeeper Warning Resolution Card */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 mt-4">
                <div className="flex items-start gap-4">
                  <ShieldAlert className="w-7 h-7 text-amber-400 shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-[16px] font-bold text-amber-300 mb-2">
                      Did macOS say: <i>"FloatGPT is damaged and can't be opened"</i>?
                    </h3>
                    <p className="text-[14px] text-amber-100/90 leading-relaxed mb-4">
                      Don't worry! This is Apple's standard Gatekeeper quarantine flag for open-source apps downloaded from Chrome or Safari. The app is completely safe and intact.
                    </p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                      {/* Screenshot */}
                      <div className="rounded-xl overflow-hidden border border-amber-500/30 bg-black/40 shadow-lg">
                        <div className="p-2 text-[11px] font-mono text-amber-300/80 text-center border-b border-amber-500/20 bg-amber-500/10 font-bold">
                          macOS Gatekeeper Dialog
                        </div>
                        <img src="/docs/warning_mac.png" alt="macOS Warning" className="w-full object-cover" />
                      </div>

                      {/* 1-Click Fix */}
                      <div className="space-y-4">
                        <div className="bg-panel border border-card-border p-4 rounded-xl shadow-inner">
                          <p className="text-[12px] font-bold text-accent uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Terminal className="w-4 h-4" /> 1-Click Terminal Solution (Permanent):
                          </p>
                          <p className="text-[13px] text-text-muted mb-3">
                            1. Open <strong>Terminal</strong> (<kbd className="bg-bg px-1.5 py-0.5 rounded text-[11px] border border-card-border">Cmd + Space</kbd> → type <code>Terminal</code>).
                            <br />
                            2. Paste this command and press <strong>Enter</strong>:
                          </p>
                          
                          <div className="flex items-center justify-between bg-bg border border-card-border rounded-lg p-2.5 font-mono text-[13px] text-accent">
                            <span className="truncate mr-2">{macTerminalCommand}</span>
                            <button
                              onClick={() => copyToClipboard(macTerminalCommand)}
                              className="px-3 py-1 bg-accent/20 hover:bg-accent text-white rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                            >
                              {copiedCmd ? <><Check className="w-3.5 h-3.5 text-green-400" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                            </button>
                          </div>
                        </div>

                        <div className="bg-black/20 p-3 rounded-lg border border-card-border/50 text-[12px] text-text-muted">
                          <strong>Alternative without Terminal:</strong> Open <i>System Settings → Privacy & Security</i> → scroll to Security → click <strong>"Open Anyway"</strong>.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Controls */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-accent font-semibold text-xl">
                <div className="bg-accent/10 p-2 rounded-lg"><Move className="w-5 h-5" /></div>
                <h2>Step 2: Master the macOS Orb</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="bg-panel border border-card-border p-5 rounded-xl flex flex-col gap-3 hover:border-accent/30 transition-colors">
                  <div className="bg-card self-start px-3 py-1.5 rounded-lg text-[13px] font-mono font-bold border border-card-border shadow-sm text-accent">Cmd + Shift + Space</div>
                  <div>
                    <h4 className="text-[14px] font-bold text-text-primary mb-1">Mac Summon Shortcut</h4>
                    <p className="text-[13px] text-text-secondary leading-relaxed">Instantly toggle the floating orb anywhere across macOS desktop spaces.</p>
                  </div>
                </div>
                <div className="bg-panel border border-card-border p-5 rounded-xl flex flex-col gap-3 hover:border-accent/30 transition-colors">
                  <div className="bg-card self-start px-3 py-1.5 rounded-lg border border-card-border shadow-sm">
                     <Apple className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <h4 className="text-[14px] font-bold text-text-primary mb-1">Native Menu Bar Integration</h4>
                    <p className="text-[13px] text-text-secondary leading-relaxed">FloatGPT sits quietly in your top menu bar tray with quick summon and quit controls.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* STEP 3: UNIVERSAL API KEY SYNC (SHARED)                   */}
        {/* ────────────────────────────────────────────────────────── */}
        <div className="space-y-4 pt-6 border-t border-card-border/50">
          <div className="flex items-center gap-3 text-accent font-semibold text-xl">
            <div className="bg-accent/10 p-2 rounded-lg"><Key className="w-5 h-5" /></div>
            <h2>Step 3: Add Your AI API Key (Universal Sync)</h2>
          </div>
          <p className="text-text-secondary text-[15px]">
            FloatGPT connects directly to high-speed AI providers. Add your API key once, and it will <strong>automatically sync between this Web Playground and your Desktop Orb</strong>!
          </p>
          
          <div className="bg-panel border border-card-border p-6 rounded-2xl space-y-4">
             <h3 className="text-[14px] font-bold text-text-primary">Get a free, high-speed API Key:</h3>
             <div className="flex flex-wrap gap-3">
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-[13px] px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-accent/20 hover:text-accent hover:border-accent/30 transition-all flex items-center gap-2 font-medium">
                   ⚡ Groq Console (Fastest & Free) <ArrowRight className="w-3.5 h-3.5" />
                </a>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[13px] px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 font-medium">
                   💎 Google AI Studio (Gemini 2.5) <ArrowRight className="w-3.5 h-3.5" />
                </a>
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-[13px] px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 font-medium">
                   🧠 OpenAI Platform (GPT-4o) <ArrowRight className="w-3.5 h-3.5" />
                </a>
             </div>
             
             <div className="mt-4 pt-4 border-t border-card-border/50 flex items-center gap-3 bg-accent/5 p-4 rounded-xl border border-accent/20">
                <RefreshCw className="w-5 h-5 text-accent shrink-0" />
                <p className="text-[13px] text-text-primary">
                  <strong>Automatic Cloud Sync:</strong> Save your API key in the <strong>API_KEYS</strong> tab above or inside the Desktop Orb (click the 🔑 key icon). Your settings and keys sync across both surfaces immediately!
                </p>
             </div>
          </div>
        </div>

        <div className="h-12"></div>
      </div>
    </div>
  );
};
