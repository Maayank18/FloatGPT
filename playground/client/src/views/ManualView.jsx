import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Copy, DownloadCloud, Key, MessageSquare, Mic, Monitor, Move, Search, ShieldAlert, Terminal } from 'lucide-react';
import { COMMAND_GROUPS, COMMAND_SCHEMAS } from '../../../../src/chat/commandSchemas';
import { SHOW_MACOS_ON_SITE } from '../config/publicRelease';
import { LOCAL_MODELS, ModelPick, setupCommands } from '../components/ModelPick';

const EVERY_TIME = 'npm run dev';
const MAC_FIX = 'xattr -cr /Applications/FloatGPT.app';

const Step = ({ n, children }) => (
  <li className="flex gap-3">
    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-card-border bg-card text-[12px] font-semibold text-text-primary">
      {n}
    </span>
    <p className="pt-0.5 text-[14px] leading-relaxed text-text-secondary">{children}</p>
  </li>
);

const CodeBlock = ({ label, text, copied, onCopy }) => (
  <div className="rounded-xl border border-card-border bg-bg">
    <div className="flex items-center justify-between gap-3 border-b border-card-border/60 px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</span>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex items-center gap-1.5 rounded-md border border-card-border bg-panel px-2 py-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
    <pre className="overflow-x-auto whitespace-pre-wrap break-all px-3 py-3 font-mono text-[13px] leading-relaxed text-text-primary">{text}</pre>
  </div>
);

export const ManualView = ({ onOpenDownload, onOpenKeys }) => {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState('install');
  const [copiedId, setCopiedId] = useState('');
  const [modelIndex, setModelIndex] = useState(0);
  const model = LOCAL_MODELS[modelIndex] || LOCAL_MODELS[0];
  const once = setupCommands(model);
  const scrollRef = useRef(null);
  const clickLock = useRef(0);

  const copy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((current) => (current === id ? '' : current)), 1600);
  };

  const sections = useMemo(() => {
    const items = [
      {
        id: 'install',
        group: 'Get it running',
        nav: 'Windows app',
        title: 'Install the Windows app',
        answer: 'Version 2.3.0 is the Windows installer for Windows 10 or 11, 64-bit. Download it, run it, and the orb opens.',
        keywords: 'download exe setup installer windows version 2.3.0 floatgpt.setup',
        body: (
          <ol className="space-y-3">
            <Step n="1">
              Open <button type="button" onClick={onOpenDownload} className="font-semibold text-text-primary underline decoration-card-border underline-offset-2 hover:text-accent">Get your Float now</button> and choose the Windows app.
            </Step>
            <Step n="2">Download <code className="text-text-primary">FloatGPT.Setup.2.3.0.exe</code>. It is about 100 MB.</Step>
            <Step n="3">Run the installer. If Windows asks for confirmation, choose More info, then Run anyway.</Step>
            <Step n="4">The orb opens when the installer finishes. Have an API key ready if you want cloud chat.</Step>
          </ol>
        ),
      },
      {
        id: 'warning',
        group: 'Get it running',
        nav: 'Windows warning',
        title: 'If Windows shows a blue warning',
        answer: 'Choose More info, then Run anyway. The installer is a direct build, so SmartScreen asks the first time.',
        keywords: 'smartscreen more info run anyway blue popup blocked',
        body: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <figure className="overflow-hidden rounded-xl border border-card-border bg-card">
                <figcaption className="border-b border-card-border/60 px-3 py-2 text-center text-[12px] font-semibold text-text-secondary">1. More info</figcaption>
                <img src="/docs/warning_1.png" alt="Windows SmartScreen with More info" className="w-full object-cover" />
              </figure>
              <figure className="overflow-hidden rounded-xl border border-card-border bg-card">
                <figcaption className="border-b border-card-border/60 px-3 py-2 text-center text-[12px] font-semibold text-text-secondary">2. Run anyway</figcaption>
                <img src="/docs/warning_2.png" alt="Windows SmartScreen with Run anyway" className="w-full object-cover" />
              </figure>
            </div>
          </div>
        ),
      },
      {
        id: 'own-pc',
        group: 'Get it running',
        nav: 'Open source',
        title: 'Run it on your own PC',
        answer: 'No installer. Pick Qwen, DeepSeek, GPT-OSS, or Kimi, then the same orb opens.',
        keywords: 'ollama qwen deepseek gpt-oss kimi npm run dev git clone node local model open source ram memory',
        body: (
          <div className="space-y-3">
            <p className="text-[14px] leading-relaxed text-text-secondary">
              Install <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="font-semibold text-text-primary underline decoration-card-border underline-offset-2 hover:text-accent">Node.js 20+</a>, <a href="https://git-scm.com" target="_blank" rel="noreferrer" className="font-semibold text-text-primary underline decoration-card-border underline-offset-2 hover:text-accent">Git</a>, and <a href="https://ollama.com" target="_blank" rel="noreferrer" className="font-semibold text-text-primary underline decoration-card-border underline-offset-2 hover:text-accent">Ollama</a> once. Qwen, DeepSeek, and GPT-OSS need no Ollama account. <code className="text-text-primary">npm install</code> does not install the model. Pick the model this PC can hold. The command below follows that choice.
            </p>
            <ModelPick index={modelIndex} onChange={(next) => { setModelIndex(next); setCopiedId(''); }} />
            {model.id === 'kimi-k2.6:cloud' && (
              <p className="text-[13px] leading-relaxed text-text-secondary">Sign in to Ollama before the pull. Kimi is not downloaded. Ollama runs it in the cloud.</p>
            )}
            <CodeBlock label="Once" text={once} copied={copiedId === 'once'} onCopy={() => copy('once', once)} />
            <CodeBlock label="Every later start" text={EVERY_TIME} copied={copiedId === 'dev'} onCopy={() => copy('dev', EVERY_TIME)} />
            <p className="text-[14px] leading-relaxed text-text-secondary">Leave Ollama running. <code className="text-text-primary">npm run dev</code> opens the orb and this Playground. Stop it with Ctrl+C. The next start is the same command.</p>
            <p className="text-[13px] leading-relaxed text-text-secondary">In the orb, open the key menu, choose On this PC, and pick the same model.</p>
            <a href="https://github.com/Maayank18/FloatGPT" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-primary hover:text-accent">
              Star the repo <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        ),
      },
      {
        id: 'orb',
        group: 'Use it',
        nav: 'The orb',
        title: 'Open, hide, and move the orb',
        answer: 'The orb stays on the desktop until you call it.',
        keywords: 'shortcut ctrl shift space drag hide summon window',
        body: (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-card-border bg-card p-4">
              <p className="font-mono text-[13px] font-semibold text-text-primary">Ctrl + Shift + Space</p>
              <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">From anywhere on the PC, show or hide the orb.</p>
            </div>
            <div className="rounded-xl border border-card-border bg-card p-4">
              <p className="text-[13px] font-semibold text-text-primary">Drag the circle</p>
              <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">Move it on the screen. Click it to open the chat.</p>
            </div>
          </div>
        ),
      },
      {
        id: 'chat',
        group: 'Use it',
        nav: 'Chat and Plan',
        title: 'Chat, Plan, and Context',
        answer: 'Chat is the default. Plan is a choice. Context is only for Chat.',
        keywords: 'plan chat context mode toggle goals tasks steps deadline',
        body: (
          <ol className="space-y-3">
            <Step n="1">The switch sits in the middle. <strong className="font-semibold text-text-primary">Plan</strong> is on the left. <strong className="font-semibold text-text-primary">Chat</strong> is on the right.</Step>
            <Step n="2">Chat answers the question. Plan turns one sentence into steps, with a deadline on the last step.</Step>
            <Step n="3">In Chat, press <strong className="font-semibold text-text-primary">Context</strong>, write how you want it to answer, then Save. The box closes.</Step>
          </ol>
        ),
      },
      {
        id: 'home',
        group: 'Use it',
        nav: 'Home',
        title: 'Home, WhatsApp, prices, and Flowtion',
        answer: 'Home opens its own page. These tools stay the same with Qwen or a cloud key.',
        keywords: 'home whatsapp schedule message price compare flowtion pdf notes mute bell notification',
        body: (
          <ol className="space-y-3">
            <Step n="1">Open the orb, then Home. Schedule a WhatsApp message with a date, a clock time, and a +91 number. The waiting list stays on that page.</Step>
            <Step n="2">Compare prices takes a product name and shows the lowest prices it can read. A shop that hides its price is left off the list.</Step>
            <Step n="3">Flowtion keeps images, PDFs, Word files, and notes on this PC. They open in the panel. Chat does not search them.</Step>
            <Step n="4">The bell can be switched off. While it is off, message cards and the number on the orb stay hidden.</Step>
          </ol>
        ),
      },
      {
        id: 'voice',
        group: 'Use it',
        nav: 'Voice',
        title: 'Ask by voice',
        answer: 'Hold to talk. Release to send. The answer is spoken back.',
        keywords: 'microphone mic voice speak push to talk right click',
        body: (
          <ol className="space-y-3">
            <Step n="1">In chat, hold the mic, speak, then release.</Step>
            <Step n="2">On the orb, right-click and hold, speak, then release.</Step>
            <Step n="3">The microphone is off until you hold it.</Step>
          </ol>
        ),
      },
      {
        id: 'commands',
        group: 'Use it',
        nav: 'Commands',
        title: 'Slash commands',
        answer: 'Type / in the message box. Pick a command. It fills the box.',
        keywords: 'slash command explain summarize translate diagram table plan',
        body: (
          <div className="space-y-4">
            {COMMAND_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{group.label}</p>
                <ul className="divide-y divide-card-border/50 rounded-xl border border-card-border bg-card">
                  {group.commands.map((command) => (
                    <li key={command} className="flex items-baseline gap-3 px-3 py-2.5">
                      <code className="w-28 shrink-0 text-[13px] font-semibold text-text-primary">/{command}</code>
                      <span className="text-[13px] text-text-secondary">{COMMAND_SCHEMAS[command].description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: 'account',
        group: 'Account',
        nav: 'Account',
        title: 'Same account, two surfaces',
        answer: 'Continue with Google, or use the same email, on the Playground and on the orb.',
        keywords: 'login signup google sync playground orb plans settings chat memory',
        body: (
          <ol className="space-y-3">
            <Step n="1">Continue with Google, or sign in with email. Goals, tasks, projects, settings, and workspace memory load with the account.</Step>
            <Step n="2">The Playground keeps its own chat. The orb keeps its own chat.</Step>
            <Step n="3">Sign in on each one. A login on this site does not open the desktop app by itself.</Step>
          </ol>
        ),
      },
      {
        id: 'keys',
        group: 'Account',
        nav: 'API keys',
        title: 'Add an AI key',
        answer: 'Optional. A key stays on the device where you save it. Cloud chat needs one. The local model does not.',
        keywords: 'api key groq gemini openai ollama qwen deepseek gpt-oss kimi sync secret',
        body: (
          <div className="space-y-4">
            <p className="text-[14px] leading-relaxed text-text-secondary">
              Save it in <button type="button" onClick={onOpenKeys} className="font-semibold text-text-primary underline decoration-card-border underline-offset-2 hover:text-accent">API_KEYS</button> on this site, and save it again in the orb if you use the desktop app. The account does not carry keys. With no key, open the orb’s key menu, choose On this PC, and pick the model you pulled.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-2 text-[13px] font-medium text-text-primary hover:border-accent/40">
                Groq <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-2 text-[13px] font-medium text-text-primary hover:border-accent/40">
                Google AI Studio <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-2 text-[13px] font-medium text-text-primary hover:border-accent/40">
                OpenAI <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ),
      },
    ];

    if (SHOW_MACOS_ON_SITE) {
      items.splice(3, 0, {
        id: 'macos',
        group: 'Get it running',
        nav: 'Mac',
        title: 'Install on a Mac',
        answer: 'The current Mac build is v2.1.2. v2.3.0 is Windows.',
        keywords: 'macos mac dmg gatekeeper damaged xattr',
        body: (
          <div className="space-y-4">
            <ol className="space-y-3">
              <Step n="1">Open Get your Float now and download <code className="text-text-primary">FloatGPT-2.1.2-arm64.dmg</code>.</Step>
              <Step n="2">Open the disk image and drag FloatGPT into Applications.</Step>
            </ol>
            <div className="rounded-xl border border-card-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-text-primary">
                <ShieldAlert className="h-4 w-4" />
                If macOS says the app is damaged
              </div>
              <p className="mb-3 text-[13px] leading-relaxed text-text-secondary">Open Terminal, paste this, and press Enter. Or open System Settings, Privacy & Security, and choose Open Anyway.</p>
              <CodeBlock label="Terminal" text={MAC_FIX} copied={copiedId === 'mac'} onCopy={() => copy('mac', MAC_FIX)} />
              <img src="/docs/warning_mac.png" alt="macOS Gatekeeper dialog" className="mt-3 w-full rounded-lg border border-card-border object-cover" />
            </div>
            <div className="rounded-xl border border-card-border bg-card p-4">
              <p className="font-mono text-[13px] font-semibold text-text-primary">Cmd + Shift + Space</p>
              <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">Show or hide the orb. It also sits in the menu bar.</p>
            </div>
          </div>
        ),
      });
    }

    return items;
  }, [copiedId, modelIndex, once, onOpenDownload, onOpenKeys]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sections;
    return sections.filter((section) => `${section.title} ${section.answer} ${section.keywords}`.toLowerCase().includes(needle));
  }, [query, sections]);

  const groups = useMemo(() => {
    const order = [];
    visible.forEach((section) => {
      if (!order.includes(section.group)) order.push(section.group);
    });
    return order.map((label) => ({ label, items: visible.filter((section) => section.group === label) }));
  }, [visible]);

  useEffect(() => {
    if (visible.length && !visible.some((section) => section.id === activeId)) {
      setActiveId(visible[0].id);
    }
  }, [visible, activeId]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return undefined;
    const nodes = visible.map((section) => document.getElementById(section.id)).filter(Boolean);
    if (!nodes.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (Date.now() < clickLock.current) return;
      const hit = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (hit?.target?.id) setActiveId(hit.target.id);
    }, { root, rootMargin: '-10% 0px -60% 0px', threshold: [0.15, 0.4, 0.7] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [visible]);

  const jump = (id) => {
    clickLock.current = Date.now() + 700;
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const starts = [
    { id: 'install', icon: DownloadCloud, title: 'Windows app', detail: 'Version 2.3.0 installer' },
    { id: 'own-pc', icon: Terminal, title: 'Open source', detail: 'Same orb, from the repo' },
    { id: 'chat', icon: MessageSquare, title: 'Use it', detail: 'Chat, Plan, voice, commands' },
  ];

  return (
    <div ref={scrollRef} className="custom-scrollbar flex-1 overflow-x-hidden overflow-y-auto bg-bg text-text-primary">
      <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-8 px-5 py-8 md:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-10">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <p className="mb-3 hidden text-[11px] font-semibold uppercase tracking-wider text-text-muted lg:block">On this page</p>
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-4 lg:overflow-visible lg:pb-0">
            {groups.map((group) => (
              <div key={group.label} className="flex shrink-0 gap-2 lg:block">
                <p className="mb-1 hidden text-[11px] font-semibold uppercase tracking-wider text-text-muted lg:block">{group.label}</p>
                {group.items.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => jump(section.id)}
                    className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] transition-colors lg:block lg:w-full lg:whitespace-normal ${
                      activeId === section.id
                        ? 'bg-panel font-semibold text-text-primary'
                        : 'text-text-secondary hover:bg-panel/60 hover:text-text-primary'
                    }`}
                  >
                    {section.nav || section.title}
                  </button>
                ))}
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-[13px] text-text-muted">No matches</p>
            )}
          </div>
        </aside>

        <div className="w-full min-w-0 space-y-6">
          <header className="space-y-3">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-text-muted">Version 2.3.0</p>
            <h1 className="text-3xl font-semibold tracking-tight">Guide</h1>
            <p className="max-w-2xl text-[15px] leading-relaxed text-text-secondary">
              Two ways to get the orb: install Version 2.3.0 for Windows, or run the open-source copy on this PC. Home, WhatsApp, prices, and Flowtion work the same with Qwen or a cloud key. Use the list to jump, or search for one step.
            </p>
            <label className="flex items-center gap-2 rounded-xl border border-card-border bg-panel px-3 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search. Try install, shortcut, plan, or API key"
                className="w-full bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-muted"
              />
            </label>
          </header>

          {!query.trim() && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {starts.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => jump(item.id)}
                    className="rounded-xl border border-card-border bg-panel p-4 text-left transition-colors hover:border-accent/40"
                  >
                    <Icon className="mb-3 h-4 w-4 text-text-secondary" />
                    <p className="text-[14px] font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-1 text-[12px] text-text-muted">{item.detail}</p>
                  </button>
                );
              })}
            </div>
          )}

          {visible.length === 0 ? (
            <div className="rounded-xl border border-card-border bg-panel px-4 py-8 text-center">
              <p className="text-[14px] text-text-secondary">Nothing matches “{query.trim()}”.</p>
              <button type="button" onClick={() => setQuery('')} className="mt-3 text-[13px] font-semibold text-text-primary hover:text-accent">
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {visible.map((section) => (
                <section id={section.id} key={section.id} className="scroll-mt-6 rounded-2xl border border-card-border bg-panel p-5">
                  <div className="mb-4 flex items-start gap-3">
                    <SectionIcon id={section.id} />
                    <div>
                      <h2 className="text-[18px] font-semibold text-text-primary">{section.title}</h2>
                      <p className="mt-1 text-[14px] leading-relaxed text-text-secondary">{section.answer}</p>
                    </div>
                  </div>
                  {section.body}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ICONS = {
  install: DownloadCloud,
  warning: ShieldAlert,
  'own-pc': Terminal,
  macos: Monitor,
  orb: Move,
  chat: MessageSquare,
  voice: Mic,
  commands: Search,
  account: Monitor,
  keys: Key,
};

const SectionIcon = ({ id }) => {
  const Icon = ICONS[id] || MessageSquare;
  return (
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-card text-text-secondary">
      <Icon className="h-4 w-4" />
    </span>
  );
};
