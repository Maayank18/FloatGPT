import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  Cpu,
  ExternalLink,
  HardDrive,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  checkPort,
  diagnoseUserIssue,
  DiagnosisResult,
  flushDnsCache,
  getCrashLogs,
  killProcessSafe,
  launchOSUtility,
  PCQuickPulse,
  runPCPulse,
} from '../../platform/pcDoctorService';
import { MarkdownRenderer } from '../MarkdownRenderer';

export function PCDoctorPanel({ onBack }: { onBack: () => void }) {
  const [pulse, setPulse] = useState<PCQuickPulse | null>(null);
  const [loadingPulse, setLoadingPulse] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  // Quick Action Sub-States
  const [activeTab, setActiveTab] = useState<'overview' | 'ports' | 'crashes' | 'ram'>('overview');
  const [targetPort, setTargetPort] = useState('3000');
  const [portStatus, setPortStatus] = useState<any>(null);
  const [checkingPort, setCheckingPort] = useState(false);

  const [crashes, setCrashes] = useState<any[]>([]);
  const [loadingCrashes, setLoadingCrashes] = useState(false);

  // Feedback states
  const [actionBusy, setActionBusy] = useState(false);
  const [actionDoneMsg, setActionDoneMsg] = useState('');

  const refreshPulse = async () => {
    setLoadingPulse(true);
    try {
      const p = await runPCPulse();
      setPulse(p);
    } finally {
      setLoadingPulse(false);
    }
  };

  useEffect(() => {
    refreshPulse();
  }, []);

  const handleDiagnose = async (e?: React.FormEvent, customQuery?: string) => {
    e?.preventDefault();
    const text = customQuery || queryInput.trim();
    if (!text) return;
    setDiagnosing(true);
    setActionDoneMsg('');
    try {
      const res = await diagnoseUserIssue(text);
      setDiagnosis(res);
      setActiveTab('overview');
    } finally {
      setDiagnosing(false);
    }
  };

  const handleCheckPort = async (pNum?: string) => {
    const p = parseInt(pNum || targetPort, 10);
    if (!p) return;
    setCheckingPort(true);
    setPortStatus(null);
    setActionDoneMsg('');
    try {
      const rep = await checkPort(p);
      setPortStatus(rep);
    } finally {
      setCheckingPort(false);
    }
  };

  const handleLoadCrashes = async () => {
    setLoadingCrashes(true);
    try {
      const logs = await getCrashLogs(5);
      setCrashes(logs);
    } finally {
      setLoadingCrashes(false);
    }
  };

  const handleExecuteAction = async () => {
    if (!diagnosis?.actionType) return;
    setActionBusy(true);
    setActionDoneMsg('');
    try {
      if (diagnosis.actionType === 'kill_process' || diagnosis.actionType === 'release_port') {
        const pid = diagnosis.actionPayload;
        if (pid) {
          const res = await killProcessSafe(pid);
          if (res.ok) {
            setActionDoneMsg(`Terminated PID ${pid}. Port released successfully.`);
            refreshPulse();
            if (portStatus) handleCheckPort();
          } else {
            setActionDoneMsg(res.error || 'Failed to terminate process.');
          }
        }
      } else if (diagnosis.actionType === 'flush_dns') {
        const res = await flushDnsCache();
        setActionDoneMsg(res.message || res.error || 'DNS flushed.');
        refreshPulse();
      } else if (diagnosis.actionType === 'open_taskmgr') {
        const res = await launchOSUtility('taskmgr');
        setActionDoneMsg(res.ok ? 'Opened Windows Task Manager.' : (res.error || 'Failed to open Task Manager.'));
      } else if (diagnosis.actionType === 'open_startup_apps') {
        const res = await launchOSUtility('startupapps');
        setActionDoneMsg(res.ok ? 'Opened Windows Startup Apps Settings.' : (res.error || 'Failed to open Startup Apps.'));
      } else if (diagnosis.actionType === 'open_installed_apps') {
        const res = await launchOSUtility('appsfeatures');
        setActionDoneMsg(res.ok ? 'Opened Windows Installed Apps Settings.' : (res.error || 'Failed to open Installed Apps.'));
      } else if (diagnosis.actionType === 'open_cleanmgr') {
        const res = await launchOSUtility('cleanmgr');
        setActionDoneMsg(res.ok ? 'Opened Windows Disk Cleanup.' : (res.error || 'Failed to open Disk Cleanup.'));
      }
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-bg">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-card-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-panel-hover"
            aria-label="Back to Home"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 min-w-0">
            <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-text-primary truncate">PCDoc</span>
            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded shrink-0">
              Healer
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={refreshPulse}
          disabled={loadingPulse}
          title="Scan PC Health"
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-card border border-card-border hover:border-emerald-500/40 text-text-primary transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingPulse ? 'animate-spin text-emerald-400' : 'text-text-muted'}`} />
          <span>Pulse</span>
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3">
        {/* Live Hardware Meter Card */}
        {pulse && (
          <div className="rounded-xl border border-card-border bg-card p-3 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    pulse.status === 'OPTIMAL'
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                      : pulse.status === 'FAIR'
                      ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                      : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]'
                  }`}
                />
                <span className="text-xs font-bold text-text-primary">
                  System Health: {pulse.healthScore}/100 ({pulse.status})
                </span>
              </div>
              <span className="text-[10px] font-medium text-text-muted">Kernel Verified</span>
            </div>

            {/* 4 Telemetry Metrics */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-card-border bg-bg-secondary p-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-semibold text-text-muted">
                  <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-blue-400" /> CPU Load</span>
                  <span className={pulse.cpuPercent > 80 ? 'text-red-400' : 'text-text-primary'}>{pulse.cpuPercent}%</span>
                </div>
                <div className="w-full bg-card rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all ${pulse.cpuPercent > 80 ? 'bg-red-400' : 'bg-blue-400'}`}
                    style={{ width: `${Math.min(100, pulse.cpuPercent)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-card-border bg-bg-secondary p-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-semibold text-text-muted">
                  <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-emerald-400" /> RAM Load</span>
                  <span className={pulse.ramPercent > 85 ? 'text-red-400' : 'text-text-primary'}>{pulse.ramPercent}%</span>
                </div>
                <div className="w-full bg-card rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all ${pulse.ramPercent > 85 ? 'bg-red-400' : 'bg-emerald-400'}`}
                    style={{ width: `${Math.min(100, pulse.ramPercent)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-card-border bg-bg-secondary p-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-text-muted flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-amber-400" /> Drive C:
                </span>
                <span className="text-xs font-semibold text-text-primary">{pulse.diskFreeGb} GB free</span>
              </div>

              <div className="rounded-lg border border-card-border bg-bg-secondary p-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-text-muted flex items-center gap-1">
                  <Network className="w-3 h-3 text-violet-400" /> Network
                </span>
                <span className="text-xs font-semibold text-text-primary">
                  {pulse.networkOnline ? `${pulse.latencyMs >= 0 ? pulse.latencyMs + 'ms' : 'Active'}` : 'Offline'}
                </span>
              </div>
            </div>

            {pulse.issues.length > 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 space-y-1">
                {pulse.issues.map((iss, i) => (
                  <p key={i} className="text-[11px] text-amber-300/90 leading-tight flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 shrink-0 text-amber-400 mt-0.5" />
                    <span>{iss}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Diagnostic Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 transition-colors ${
              activeTab === 'overview'
                ? 'bg-accent text-white'
                : 'bg-card border border-card-border text-text-muted hover:text-text-primary'
            }`}
          >
            Symptom Solver
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('ports');
              handleCheckPort();
            }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 transition-colors ${
              activeTab === 'ports'
                ? 'bg-accent text-white'
                : 'bg-card border border-card-border text-text-muted hover:text-text-primary'
            }`}
          >
            Port Doctor
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('crashes');
              handleLoadCrashes();
            }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 transition-colors ${
              activeTab === 'crashes'
                ? 'bg-accent text-white'
                : 'bg-card border border-card-border text-text-muted hover:text-text-primary'
            }`}
          >
            Crash Logs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ram')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 transition-colors ${
              activeTab === 'ram'
                ? 'bg-accent text-white'
                : 'bg-card border border-card-border text-text-muted hover:text-text-primary'
            }`}
          >
            Memory Hogs
          </button>
        </div>

        {/* TAB 1: SYMPTOM SOLVER (Problem Input Box) */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            <form onSubmit={(e) => handleDiagnose(e)} className="space-y-2">
              <div className="relative">
                <input
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Describe problem (e.g. 'port 3000 in use', 'laptop lagging', 'wifi down')"
                  className="w-full bg-bg-secondary border border-card-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent pr-16 placeholder:text-text-muted"
                />
                <button
                  type="submit"
                  disabled={diagnosing || !queryInput.trim()}
                  className="absolute right-1.5 top-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                  {diagnosing ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Check'}
                </button>
              </div>

              {/* Quick Prompt Suggestions */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Port 3000 is blocked',
                  'Port 5173 in use',
                  'Laptop fan is loud',
                  'Why did app crash?',
                  'Flush DNS',
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setQueryInput(s);
                      handleDiagnose(undefined, s);
                    }}
                    className="text-[10px] text-text-secondary bg-panel hover:bg-panel-hover border border-card-border px-2 py-0.5 rounded-full transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </form>

            {/* Predefined Instant Health & Triage Grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setQueryInput('Why is PC slow?');
                  handleDiagnose(undefined, 'Why is PC slow?');
                }}
                className="p-2.5 rounded-xl border border-card-border bg-card hover:border-accent/40 text-left transition-colors group space-y-1"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary group-hover:text-accent">
                  <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Why is PC slow?</span>
                </div>
                <p className="text-[10px] text-text-muted leading-tight">
                  Instant bottleneck root-cause (CPU, RAM, or Disk swap).
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQueryInput('Which app is taking most of the memory?');
                  handleDiagnose(undefined, 'Which app is taking most of the memory?');
                }}
                className="p-2.5 rounded-xl border border-card-border bg-card hover:border-accent/40 text-left transition-colors group space-y-1"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary group-hover:text-accent">
                  <Cpu className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Memory Hogs</span>
                </div>
                <p className="text-[10px] text-text-muted leading-tight">
                  Top memory consumers with 1-click task termination.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQueryInput('How to resolve slowness?');
                  handleDiagnose(undefined, 'How to resolve slowness?');
                }}
                className="p-2.5 rounded-xl border border-card-border bg-card hover:border-accent/40 text-left transition-colors group space-y-1"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary group-hover:text-accent">
                  <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Speed Up Guide</span>
                </div>
                <p className="text-[10px] text-text-muted leading-tight">
                  4-step playbook: flush DNS, socket pool & cache.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQueryInput('Unnecessary apps and startup bloat');
                  handleDiagnose(undefined, 'Unnecessary apps and startup bloat');
                }}
                className="p-2.5 rounded-xl border border-card-border bg-card hover:border-accent/40 text-left transition-colors group space-y-1"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary group-hover:text-accent">
                  <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>Startup Bloat</span>
                </div>
                <p className="text-[10px] text-text-muted leading-tight">
                  Disable background boot apps and clean bloat.
                </p>
              </button>
            </div>

            {/* Quick OS Launchers */}
            <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider shrink-0">Native:</span>
              <button
                type="button"
                onClick={() => launchOSUtility('startupapps')}
                className="px-2 py-0.5 text-[10px] font-medium text-text-secondary bg-panel hover:bg-panel-hover border border-card-border rounded-md transition-colors shrink-0"
                title="Open Windows Startup Apps"
              >
                Startup Apps ↗
              </button>
              <button
                type="button"
                onClick={() => launchOSUtility('appsfeatures')}
                className="px-2 py-0.5 text-[10px] font-medium text-text-secondary bg-panel hover:bg-panel-hover border border-card-border rounded-md transition-colors shrink-0"
                title="Open Windows Installed Apps"
              >
                Uninstall Bloat ↗
              </button>
              <button
                type="button"
                onClick={() => launchOSUtility('cleanmgr')}
                className="px-2 py-0.5 text-[10px] font-medium text-text-secondary bg-panel hover:bg-panel-hover border border-card-border rounded-md transition-colors shrink-0"
                title="Open Windows Disk Cleanup"
              >
                Disk Cleanup ↗
              </button>
              <button
                type="button"
                onClick={() => launchOSUtility('taskmgr')}
                className="px-2 py-0.5 text-[10px] font-medium text-text-secondary bg-panel hover:bg-panel-hover border border-card-border rounded-md transition-colors shrink-0"
                title="Open Windows Task Manager"
              >
                Task Manager ↗
              </button>
            </div>

            {/* Diagnosis Result Card */}
            {diagnosis && (
              <div className="rounded-xl border border-card-border bg-card p-3.5 space-y-3 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-card-border/60 pb-2">
                  <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    {diagnosis.headline}
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-panel border border-card-border text-text-muted">
                    {diagnosis.category}
                  </span>
                </div>

                {/* Verified Evidence */}
                {diagnosis.evidence.length > 0 && (
                  <div className="rounded-lg border border-card-border bg-bg-secondary/60 p-2.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                      Kernel & WMI Evidence
                    </span>
                    {diagnosis.evidence.map((ev, i) => (
                      <p key={i} className="text-xs text-text-primary leading-tight flex items-start gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                        <span>{ev}</span>
                      </p>
                    ))}
                  </div>
                )}

                {/* Explanation */}
                <div className="text-xs text-text-secondary leading-relaxed">
                  <MarkdownRenderer content={diagnosis.explanation} />
                </div>

                {/* Recommended Steps */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                    Verified Resolution Steps
                  </span>
                  {diagnosis.recommendedSteps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-text-primary">
                      <span className="w-4 h-4 rounded-full bg-panel border border-card-border text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 text-text-muted">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>

                {/* 1-Click Action Button */}
                {diagnosis.actionLabel && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleExecuteAction}
                      disabled={actionBusy}
                      className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {actionBusy ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Executing...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{diagnosis.actionLabel}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {actionDoneMsg && (
                  <p className="text-[11px] font-medium text-emerald-400 text-center animate-in fade-in flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {actionDoneMsg}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PORT DOCTOR */}
        {activeTab === 'ports' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-card-border bg-card p-3 space-y-2.5">
              <span className="text-xs font-semibold text-text-primary block">Scan TCP Port for Conflicts</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={targetPort}
                  onChange={(e) => setTargetPort(e.target.value)}
                  placeholder="e.g. 3000, 5173, 8080"
                  className="flex-1 bg-bg-secondary border border-card-border rounded-lg px-3 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => handleCheckPort()}
                  disabled={checkingPort}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover shrink-0 disabled:opacity-50"
                >
                  {checkingPort ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Inspect Port'}
                </button>
              </div>

              {/* Fast preset buttons */}
              <div className="flex gap-1.5 pt-0.5">
                {['3000', '5173', '8080', '8000', '4000'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setTargetPort(p);
                      handleCheckPort(p);
                    }}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg-secondary hover:bg-panel border border-card-border text-text-muted hover:text-text-primary"
                  >
                    :{p}
                  </button>
                ))}
              </div>
            </div>

            {portStatus && (
              <div className="rounded-xl border border-card-border bg-card p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary">
                    Port {portStatus.port} Status
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      portStatus.open
                        ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                        : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    }`}
                  >
                    {portStatus.open ? 'OCCUPIED' : 'FREE'}
                  </span>
                </div>

                {portStatus.open ? (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-card-border bg-bg-secondary p-2.5 space-y-1 text-xs">
                      <p className="text-text-primary">
                        <span className="text-text-muted">Process: </span>
                        <strong>{portStatus.processName}</strong>
                      </p>
                      <p className="text-text-primary">
                        <span className="text-text-muted">Process ID (PID): </span>
                        <code className="font-mono bg-panel px-1 py-0.5 rounded">{portStatus.pid}</code>
                      </p>
                      {portStatus.memoryMb && (
                        <p className="text-text-primary">
                          <span className="text-text-muted">Memory: </span>
                          {portStatus.memoryMb} MB RAM
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!portStatus.pid) return;
                        setActionBusy(true);
                        const res = await killProcessSafe(portStatus.pid);
                        setActionBusy(false);
                        if (res.ok) {
                          setActionDoneMsg(`Terminated PID ${portStatus.pid}. Port ${portStatus.port} is now free!`);
                          handleCheckPort();
                        } else {
                          setActionDoneMsg(res.error || 'Failed to kill process.');
                        }
                      }}
                      disabled={actionBusy}
                      className="w-full py-2 text-xs font-semibold rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span>Terminate Process (Free Port {portStatus.port})</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-emerald-400">
                    No active listening process found on port {portStatus.port}. This port is ready for your app to bind!
                  </p>
                )}

                {actionDoneMsg && (
                  <p className="text-[11px] font-medium text-emerald-400 text-center animate-in fade-in flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {actionDoneMsg}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CRASH LOGS */}
        {activeTab === 'crashes' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">Windows Event Log Crashes</span>
              <button
                type="button"
                onClick={handleLoadCrashes}
                disabled={loadingCrashes}
                className="text-[10px] text-accent hover:underline flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingCrashes ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            {crashes.length === 0 ? (
              <div className="rounded-xl border border-card-border bg-card p-4 text-center space-y-1">
                <Check className="w-5 h-5 text-emerald-400 mx-auto" />
                <p className="text-xs font-semibold text-text-primary">Zero Recent Hard Crashes</p>
                <p className="text-[11px] text-text-muted">Windows Application log has no unhandled fault events in the review window.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {crashes.map((c, i) => (
                  <div key={i} className="rounded-xl border border-card-border bg-card p-3 space-y-1 hover:border-red-500/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-red-400 truncate">{c.app}</span>
                      <span className="text-[10px] text-text-muted shrink-0">{c.time}</span>
                    </div>
                    {c.module && (
                      <p className="text-[11px] text-text-secondary">
                        Faulting Module: <code className="font-mono bg-panel px-1 py-0.5 rounded">{c.module}</code>
                      </p>
                    )}
                    {c.code && (
                      <p className="text-[11px] text-text-muted">
                        Exception: <code className="font-mono">{c.code}</code>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MEMORY HOGS */}
        {activeTab === 'ram' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">Top Process RAM Consumers</span>
              <button
                type="button"
                onClick={async () => {
                  const win = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
                  await win?.electronAPI?.os?.snapshot?.('open_taskmgr_and_ram');
                }}
                className="text-[10px] text-accent hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> Task Manager
              </button>
            </div>

            {pulse?.topHogs && pulse.topHogs.length > 0 ? (
              <div className="space-y-2">
                {pulse.topHogs.map((h, i) => (
                  <div key={i} className="rounded-xl border border-card-border bg-card p-2.5 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text-primary truncate">{h.displayName}</p>
                      <p className="text-[10px] text-text-muted">{h.instances} instance{h.instances > 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-text-primary bg-panel border border-card-border px-2 py-0.5 rounded">
                      {h.mb} MB
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">No process data available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

