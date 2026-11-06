import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Monitor, XCircle, DownloadCloud, Terminal, Copy, Check, Star, ChevronDown } from 'lucide-react';
import { SHOW_MACOS_ON_SITE } from '../config/publicRelease';
import { LOCAL_MODELS, ModelPick, setupCommands } from '../components/ModelPick';
import { OrbStage } from '../components/OrbStage';

const WINDOWS_RELEASE = { tag: 'v2.3.1', version: '2.3.1', asset: 'FloatGPT.Setup.2.3.1.exe' };
const MAC_RELEASE = { tag: 'v2.1.2', version: '2.1.2', asset: 'FloatGPT-2.1.2-arm64.dmg' };
const USE_COMMAND = 'npm run dev';

const EARLIER_RELEASES = [
  { version: '2.3.0', date: 'Nov 6, 2026', note: 'Shipped Home utilities: WhatsApp messaging, shop price comparison, Flowtion local files and notes, and live feed tools.' },
  { version: '2.2.1', date: 'Oct 25, 2026', note: 'With no API key, chat runs Qwen 2.5 Coder 7B on this PC. A request can paste into the code editor without submitting, close the current browser tab, or explain the problem on the screen.' },
  { version: '2.2.0', date: 'Sep 30, 2026', note: 'Open an app, a Settings page, or a desktop file from chat. A question about the screen names the window behind the orb.' },
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
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium text-text-muted">{label}</div>
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

function DownloadButton({ os, label, count, downloadState, onClick }) {
  const busy = downloadState.status === 'downloading' && downloadState.os === os;
  const failed = downloadState.status === 'error' && downloadState.os === os;
  return (
    <button
      type="button"
      onClick={() => downloadState.status !== 'downloading' && onClick(os)}
      disabled={downloadState.status === 'downloading'}
      className={`inline-flex h-11 items-center justify-center gap-2.5 rounded-xl bg-accent px-4 text-[14px] font-medium text-bg transition-colors ${busy ? 'cursor-wait opacity-80' : 'cursor-pointer hover:bg-accent-hover'}`}
    >
      {busy ? (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-bg/30 border-t-bg" />
          Preparing download
        </>
      ) : failed ? (
        <>
          <XCircle className="h-4 w-4" /> Try again
        </>
      ) : (
        <>
          {count != null && (
            <>
              <span className="font-semibold">{count.toLocaleString()} downloads</span>
              <span className="h-4 w-px bg-bg/25" aria-hidden="true" />
            </>
          )}
          <DownloadCloud className="h-4 w-4" /> {label}
        </>
      )}
    </button>
  );
}

export const DownloadView = ({ onOpenGuide, onOpenKeys }) => {
  const [downloadState, setDownloadState] = useState({ os: null, status: 'idle', error: null });
  const [copiedBlock, setCopiedBlock] = useState(null);
  const [modelIndex, setModelIndex] = useState(0);
  const model = LOCAL_MODELS[modelIndex] || LOCAL_MODELS[0];
  const onceCommands = setupCommands(model);
  const [downloadCounts, setDownloadCounts] = useState({
    win: 29,
    mac: 4,
    total: 33,
    previousWin: 29,
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
        setDownloadCounts((prev) => ({
          win: Math.max(prev.win, stats.win),
          mac: Math.max(prev.mac, stats.mac),
          total: Math.max(prev.total, typeof stats.total === 'number' ? stats.total : stats.win + stats.mac),
          previousWin: typeof stats.previousWin === 'number' ? stats.previousWin : 29,
          recordedWin: Math.max(prev.recordedWin, typeof stats.recordedWin === 'number' ? stats.recordedWin : Math.max(0, stats.win - 29)),
          loaded: true,
        }));
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

  const copyCommands = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedBlock(id);
    setTimeout(() => setCopiedBlock((current) => (current === id ? null : current)), 1600);
  };

  const applyCounts = (stats) => {
    if (typeof stats?.win !== 'number' || typeof stats?.mac !== 'number') return;
    setDownloadCounts((prev) => ({
      win: Math.max(prev.win, stats.win),
      mac: Math.max(prev.mac, stats.mac),
      total: Math.max(prev.total, typeof stats.total === 'number' ? stats.total : stats.win + stats.mac),
      previousWin: typeof stats.previousWin === 'number' ? stats.previousWin : 29,
      recordedWin: Math.max(prev.recordedWin, typeof stats.recordedWin === 'number' ? stats.recordedWin : Math.max(0, stats.win - 29)),
      loaded: true,
    }));
  };

  const handleDownload = (os) => {
    const release = os === 'win' ? WINDOWS_RELEASE : MAC_RELEASE;
    const downloadUrl = `https://github.com/Maayank18/FloatGPT/releases/download/${release.tag}/${release.asset}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();

    setDownloadState({ os, status: 'downloading', error: null });
    setDownloadCounts((prev) => ({
      ...prev,
      win: prev.win + (os === 'win' ? 1 : 0),
      mac: prev.mac + (os === 'mac' ? 1 : 0),
      total: prev.total + 1,
      recordedWin: prev.recordedWin + (os === 'win' ? 1 : 0),
    }));

    const save = async () => {
      try {
        const logged = await fetch('/api/stats/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ downloadId: window.crypto.randomUUID(), platform: os, version: release.version }),
        });
        if (logged.ok) applyCounts(await logged.json());
      } catch {
        // The number on screen already moved. A missed save is corrected on the next successful count.
      } finally {
        setTimeout(() => setDownloadState({ os: null, status: 'idle', error: null }), 1200);
      }
    };
    void save();
  };

  const steps = [
    {
      num: '01',
      content: (
        <span>
          Click <strong className="font-medium text-text-primary">Download for Windows</strong> to get <code className="rounded bg-card-border/30 px-1 py-0.5 font-mono text-[11px] text-text-primary">FloatGPT.Setup.{WINDOWS_RELEASE.version}.exe</code> (~100 MB).
        </span>
      ),
    },
    {
      num: '02',
      content: (
        <span>
          If your browser prompts about the download, choose <strong className="font-medium text-text-primary">Keep</strong> (or <em>Keep anyway</em>) to allow the installer file.
        </span>
      ),
    },
    {
      num: '03',
      content: (
        <span>
          When Windows SmartScreen asks for confirmation, select <strong className="font-medium text-text-primary">More info</strong>, then choose <strong className="font-medium text-text-primary">Run anyway</strong>.
        </span>
      ),
    },
    {
      num: '04',
      content: (
        <span>
          Let the installer complete — the floating desktop <strong className="font-medium text-text-primary">Orb</strong> will launch automatically on your screen.
        </span>
      ),
    },
    {
      num: '05',
      content: (
        <span>
          Press <kbd className="rounded border border-card-border bg-bg px-1.5 py-0.5 font-mono text-[11px] font-semibold text-text-primary shadow-xs">Ctrl + Shift + Space</kbd> anywhere across Windows to summon or hide the Orb at any time.
        </span>
      ),
    },
    {
      num: '06',
      content: (
        <span>
          Follow the{' '}
          <button
            type="button"
            onClick={onOpenGuide}
            className="cursor-pointer font-medium text-text-primary underline decoration-card-border underline-offset-2 hover:text-accent"
          >
            Installation Guide
          </button>
          {' '}to configure offline local models, or have an{' '}
          <button
            type="button"
            onClick={onOpenKeys}
            className="cursor-pointer font-medium text-text-primary underline decoration-card-border underline-offset-2 hover:text-accent"
          >
            API key
          </button>
          {' '}ready for cloud chat.
        </span>
      ),
    },
  ];

  return (
    <div className="hide-scrollbar relative flex min-w-0 flex-1 flex-col overflow-y-auto bg-bg">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="mx-auto w-full max-w-5xl px-6 pt-3 pb-10 md:px-8 md:pt-4 md:pb-14"
      >
        <div className="mb-3 flex justify-center">
          <OrbStage version={WINDOWS_RELEASE.version} />
        </div>

        <header className="border-b border-card-border pb-6">
          <h1 className="text-[32px] font-medium tracking-tight text-text-primary">Two ways to use FloatGPT</h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-text-secondary">Install the Windows app, or run the open-source copy on this PC. Both open the same orb.</p>
        </header>

        <div className="mt-8 grid items-start gap-4 lg:grid-cols-2">
        <section className="flex h-full flex-col rounded-2xl border border-card-border bg-panel p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-card-border bg-bg">
              <Monitor className="h-5 w-5 text-text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Windows app</p>
              <h2 className="mt-1 text-[18px] font-medium text-text-primary">Version {WINDOWS_RELEASE.version}</h2>
              <p className="mt-1 text-[13px] text-text-muted">64-bit · about 100 MB · Windows 10 or 11</p>
            </div>
          </div>

          <div className="mt-5">
            <DownloadButton os="win" label="Download for Windows" count={downloadCounts.win} downloadState={downloadState} onClick={handleDownload} />
          </div>

          {downloadState.error && downloadState.os === 'win' && (
            <p className="mt-4 rounded-lg bg-red-400/10 px-3 py-2 text-[12px] text-red-400">{downloadState.error}</p>
          )}

          <ol className="mt-6 space-y-3.5 border-t border-card-border pt-5">
            {steps.map((step) => (
              <li key={step.num} className="flex gap-3 text-[13px] leading-relaxed text-text-secondary">
                <span className="font-mono text-[11px] font-semibold text-text-muted select-none">{step.num}</span>
                <span>{step.content}</span>
              </li>
            ))}
          </ol>
          <p className="mt-auto pt-5 text-[12px] text-text-muted">The number on the button goes up by one on each click.</p>
        </section>

        <section className="flex h-full flex-col rounded-2xl border border-card-border bg-panel p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-card-border bg-bg">
              <Terminal className="h-5 w-5 text-text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Open source</p>
              <h2 className="mt-1 text-[18px] font-medium text-text-primary">Run it from the repo</h2>
              <p className="mt-1 text-[13px] text-text-muted">No installer. The command follows the model you pick.</p>
            </div>
          </div>

          <p className="mt-5 text-[13px] leading-relaxed text-text-secondary">
            Install <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="text-text-primary underline decoration-card-border underline-offset-2 hover:text-accent">Node.js 20+</a>, <a href="https://git-scm.com" target="_blank" rel="noopener noreferrer" className="text-text-primary underline decoration-card-border underline-offset-2 hover:text-accent">Git</a>, and <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-text-primary underline decoration-card-border underline-offset-2 hover:text-accent">Ollama</a> once. Qwen, DeepSeek, and GPT-OSS need no Ollama account. Pick the model this PC can hold. The command below follows that choice.
          </p>
          <ModelPick index={modelIndex} onChange={(next) => { setModelIndex(next); setCopiedBlock(null); }} />
          {model.id === 'kimi-k2.6:cloud' && (
            <p className="mt-3 text-[12px] leading-relaxed text-text-muted">Sign in to Ollama before the pull. Kimi is not downloaded. Ollama runs it in the cloud.</p>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-text-muted">In the orb, open the key menu, choose On this PC, and pick the same model.</p>
          <CommandBlock label="One-time setup" text={onceCommands} copied={copiedBlock === 'once'} onCopy={() => copyCommands('once', onceCommands)} />
          <CommandBlock label="Open the orb" text={USE_COMMAND} copied={copiedBlock === 'use'} onCopy={() => copyCommands('use', USE_COMMAND)} />
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-[12px] leading-relaxed text-text-muted">Stop it with Ctrl+C. Next time, run npm run dev again.</p>
            <a
              href="https://github.com/Maayank18/FloatGPT"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-text-primary hover:text-accent"
            >
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              Star the repo
            </a>
          </div>
        </section>
        </div>

        {SHOW_MACOS_ON_SITE && (
          <section className="mt-4 rounded-2xl border border-card-border bg-panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-[16px] font-medium text-text-primary">macOS {MAC_RELEASE.version}</h2>
                <p className="mt-1 text-[13px] text-text-muted">Apple Silicon and Intel · about 105 MB · {downloadCounts.loaded ? downloadCounts.mac.toLocaleString() : '…'} downloads</p>
              </div>
              <DownloadButton os="mac" label="Download for Mac" downloadState={downloadState} onClick={handleDownload} />
            </div>
            {downloadState.error && downloadState.os === 'mac' && (
              <p className="mt-4 rounded-lg bg-red-400/10 px-3 py-2 text-[12px] text-red-400">{downloadState.error}</p>
            )}
          </section>
        )}

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ['System', SHOW_MACOS_ON_SITE ? 'Windows 10 or 11, or macOS 12+' : 'Windows 10 or 11, 64-bit'],
            ['Internet', 'Only when chat uses a cloud key'],
            ['Voice', 'Needs a microphone. The rest of the app does not.'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-card-border bg-panel px-4 py-3">
              <p className="text-[11px] font-medium text-text-muted">{label}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-text-primary">{value}</p>
            </div>
          ))}
        </section>

        <details className="group mt-8 rounded-2xl border border-card-border bg-panel">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[14px] font-medium text-text-primary [&::-webkit-details-marker]:hidden">
            <span>What is in Version {WINDOWS_RELEASE.version}</span>
            <ChevronDown className="h-4 w-4 text-text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-card-border px-5 pb-4 pt-4">
            <p className="text-[13px] leading-relaxed text-text-secondary">
              PreBrief executive briefing agent powered by Tavily 30-day temporal research streams, anti-crawler debris firewall, Flowtion multi-block PDF dossier engine with native dark-mode canvas rendering, Plan Panel 1-click execution, and FlowPing WhatsApp scheduling.
            </p>
            {SHOW_MACOS_ON_SITE && (
              <p className="mt-3 text-[13px] leading-relaxed text-text-secondary">The Mac installer stays on {MAC_RELEASE.version}.</p>
            )}
            <ol className="mt-4">
              {EARLIER_RELEASES.map((release) => (
                <li key={release.version} className="grid grid-cols-1 gap-0.5 border-t border-card-border/70 py-2.5 text-[13px] sm:grid-cols-[4.2rem_6.2rem_minmax(0,1fr)] sm:items-baseline sm:gap-3">
                  <span className="font-medium text-text-primary">v{release.version}</span>
                  <span className="text-[12px] text-text-muted">{release.date}</span>
                  <span className="leading-relaxed text-text-secondary">{release.note}</span>
                </li>
              ))}
            </ol>
          </div>
        </details>
      </motion.div>
    </div>
  );
};
