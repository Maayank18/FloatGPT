import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bug,
  Check,
  ChevronLeft,
  Copy,
  ExternalLink,
  FolderGit2,
  GitBranch,
  GitCommit,
  Github,
  GitMerge,
  GitPullRequest,
  Key,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  Terminal,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { AppState } from '../../types';
import {
  chooseProjectDirectory,
  fetchLiveRepoDiff,
  fetchLiveRepoRemote,
  fetchLiveRepoStatus,
  parseGitPorcelain,
} from '../../devdesk/gitService';
import {
  fetchGitHubPR,
  getStoredGitHubToken,
  getStoredProjectDir,
  GitHubPRDetails,
  GitHubUserAuth,
  setStoredGitHubToken,
  setStoredProjectDir,
  verifyGitHubToken,
} from '../../devdesk/githubService';
import {
  synthesizeBugHealer,
  synthesizeGitDiagnosis,
  synthesizePRReview,
} from '../../devdesk/devDeskSynthesizer';
import {
  deleteDevDeskItem,
  listDevDeskItems,
  saveDevDeskItem,
} from '../../devdesk/devDeskStore';
import { BugDiagnosisResult, DevDeskItem, GitRepoStatus, PRReviewResult } from '../../devdesk/types';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { addNote } from '../../flowtion/shelf';

export function DevDeskPanel({
  onBack,
  state,
}: {
  onBack: () => void;
  state: AppState;
}) {
  const [mode, setMode] = useState<'git' | 'pr' | 'bug'>('git');

  // Grounded Project Directory Context
  const [projectDir, setProjectDir] = useState<string>(() => getStoredProjectDir());
  const [remoteRepo, setRemoteRepo] = useState<{ owner?: string; repo?: string; rawUrl?: string } | null>(null);

  // GitHub Auth Context
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [githubToken, setGithubToken] = useState(() => getStoredGitHubToken());
  const [authStatus, setAuthStatus] = useState<GitHubUserAuth | null>(null);
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [tokenMsg, setTokenMsg] = useState('');

  // Local Git State
  const [gitStatus, setGitStatus] = useState<GitRepoStatus | null>(null);
  const [loadingGit, setLoadingGit] = useState(false);
  const [gitDiagnosis, setGitDiagnosis] = useState('');

  // PR State
  const [prUrlOrDiff, setPrUrlOrDiff] = useState('');
  const [fetchedPRMeta, setFetchedPRMeta] = useState<GitHubPRDetails | null>(null);
  const [prResult, setPrResult] = useState<PRReviewResult | null>(null);
  const [reviewingPR, setReviewingPR] = useState(false);
  const [prError, setPrError] = useState('');

  // Bug State
  const [stackInput, setStackInput] = useState('');
  const [bugResult, setBugResult] = useState<BugDiagnosisResult | null>(null);
  const [debugging, setDebugging] = useState(false);

  // General Feedback
  const [copied, setCopied] = useState(false);
  const [flowtionToast, setFlowtionToast] = useState('');
  const [history, setHistory] = useState<DevDeskItem[]>([]);

  // Initial token verification
  useEffect(() => {
    const existingToken = getStoredGitHubToken();
    if (existingToken) {
      verifyGitHubToken(existingToken).then((auth) => {
        setAuthStatus(auth);
      });
    }
  }, []);

  const loadLocalRepo = async (dirOverride?: string) => {
    const target = dirOverride !== undefined ? dirOverride : projectDir;
    setLoadingGit(true);
    try {
      const [s, remote] = await Promise.all([
        fetchLiveRepoStatus(target || undefined),
        fetchLiveRepoRemote(target || undefined),
      ]);
      setGitStatus(s);
      setRemoteRepo(remote);
      const diag = synthesizeGitDiagnosis(s);
      setGitDiagnosis(diag);
    } finally {
      setLoadingGit(false);
    }
  };

  const loadHistory = async () => {
    const list = await listDevDeskItems();
    setHistory(list);
  };

  useEffect(() => {
    loadLocalRepo();
    loadHistory();
  }, [projectDir]);

  const handleBrowseFolder = async () => {
    const chosen = await chooseProjectDirectory();
    if (chosen) {
      setProjectDir(chosen);
      setStoredProjectDir(chosen);
      loadLocalRepo(chosen);
    }
  };

  const handleSaveToken = async () => {
    const clean = githubToken.trim();
    if (!clean) {
      setStoredGitHubToken('');
      setAuthStatus(null);
      setTokenMsg('Cleared GitHub token.');
      setTimeout(() => setTokenMsg(''), 2000);
      return;
    }

    setVerifyingToken(true);
    setTokenMsg('');
    try {
      const auth = await verifyGitHubToken(clean);
      setAuthStatus(auth);
      if (auth.valid) {
        setStoredGitHubToken(clean);
        setTokenMsg(`Verified as @${auth.user}!`);
        setTimeout(() => {
          setShowKeyModal(false);
          setTokenMsg('');
        }, 1200);
      } else {
        setTokenMsg(auth.error || 'Token verification failed.');
      }
    } finally {
      setVerifyingToken(false);
    }
  };

  const handleScanPR = async () => {
    setReviewingPR(true);
    setPrError('');
    setFetchedPRMeta(null);
    try {
      const input = prUrlOrDiff.trim();

      // Check if input is a GitHub PR URL or slug (e.g. facebook/react#123 or https://github.com/...)
      const isGitHubPR = /github\.com\/.*\/pull\/\d+/i.test(input) || /^[a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.]+#\d+$/.test(input);

      let diffToReview = '';
      let prTitle = 'PR Review';

      if (isGitHubPR) {
        const prData = await fetchGitHubPR(input, githubToken);
        if (!prData.ok) {
          setPrError(prData.error || 'Failed to fetch Pull Request from GitHub.');
          return;
        }
        setFetchedPRMeta(prData);
        diffToReview = prData.diff || `PR: ${prData.title}\nDescription: ${prData.body}`;
        prTitle = `${prData.owner}/${prData.repo} #${prData.pullNumber}: ${prData.title}`;
      } else if (input) {
        // Custom pasted diff
        diffToReview = input;
      } else {
        // Fallback: fetch local git diff from the current project directory
        const localDiff = await fetchLiveRepoDiff(undefined, projectDir || undefined);
        if (!localDiff) {
          setPrError('No local diff detected in the active workspace. Enter a GitHub PR URL (e.g. https://github.com/owner/repo/pull/123) or paste a git diff.');
          return;
        }
        diffToReview = localDiff;
        prTitle = `Local Diff Review (${gitStatus?.branch || 'HEAD~1'})`;
      }

      const res = await synthesizePRReview(diffToReview, state);
      if (prTitle) res.title = prTitle;
      setPrResult(res);

      const newItem: DevDeskItem = {
        id: `pr_${Date.now()}`,
        mode: 'pr',
        title: res.title,
        input: diffToReview.slice(0, 500),
        summary: res.executiveSummary,
        createdAt: Date.now(),
        prReview: res,
      };
      await saveDevDeskItem(newItem);
      loadHistory();
    } finally {
      setReviewingPR(false);
    }
  };

  const handleDiagnoseBug = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trace = stackInput.trim();
    if (!trace) return;
    setDebugging(true);
    try {
      const res = await synthesizeBugHealer(trace, state);
      setBugResult(res);

      const newItem: DevDeskItem = {
        id: `bug_${Date.now()}`,
        mode: 'bug',
        title: `${res.errorType}: ${res.rootCause.slice(0, 50)}`,
        input: trace.slice(0, 500),
        summary: res.explanation,
        createdAt: Date.now(),
        bugDiagnosis: res,
      };
      await saveDevDeskItem(newItem);
      loadHistory();
    } finally {
      setDebugging(false);
    }
  };

  const handleSaveToFlowtion = async (title: string, content: string) => {
    const res = await addNote(`DevDesk: ${title}`, content);
    if (res.ok) {
      setFlowtionToast('Saved to Flowtion shelf!');
    } else {
      setFlowtionToast(res.error || 'Failed to save to Flowtion.');
    }
    setTimeout(() => setFlowtionToast(''), 2200);
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-bg">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-card-border bg-bg-secondary shrink-0">
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
            <GitPullRequest className="w-4 h-4 text-accent shrink-0" />
            <span className="text-xs font-semibold text-text-primary truncate">DevDesk</span>
            <span className="text-[10px] font-medium text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded shrink-0">
              Copilot
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* GitHub Connection Key Button */}
          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            title={authStatus?.valid ? `Connected to GitHub as @${authStatus.user}` : 'Configure GitHub Personal Access Token'}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg border transition-colors shadow-sm ${
              authStatus?.valid
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-card border-card-border text-text-muted hover:text-text-primary'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            <span>{authStatus?.valid ? `@${authStatus.user}` : 'Connect'}</span>
          </button>

          {mode === 'git' && (
            <button
              type="button"
              onClick={() => loadLocalRepo()}
              disabled={loadingGit}
              title="Refresh local git status"
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-card border border-card-border hover:border-accent text-text-primary transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingGit ? 'animate-spin text-accent' : 'text-text-muted'}`} />
              <span>Scan</span>
            </button>
          )}
        </div>
      </div>

      {/* Target Project Directory Bar */}
      <div className="px-3 py-1.5 bg-card/60 border-b border-card-border/60 flex items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <FolderGit2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-[11px] text-text-secondary truncate font-mono" title={projectDir || 'Default FloatGPT Workspace'}>
            {projectDir ? projectDir.split(/[\\/]/).slice(-2).join('/') : 'Default Workspace'}
          </span>
          {remoteRepo?.owner && remoteRepo?.repo && (
            <span className="text-[10px] text-text-muted bg-panel border border-card-border px-1.5 py-0.2 rounded truncate">
              {remoteRepo.owner}/{remoteRepo.repo}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleBrowseFolder}
          className="text-[10px] font-semibold text-accent hover:underline shrink-0"
        >
          Change Folder
        </button>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-1.5 px-3.5 pt-2 pb-1 shrink-0 overflow-x-auto">
        <button
          type="button"
          onClick={() => setMode('git')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            mode === 'git'
              ? 'bg-accent text-white shadow-sm'
              : 'bg-card border border-card-border text-text-muted hover:text-text-primary'
          }`}
        >
          <GitMerge className="w-3.5 h-3.5" />
          <span>Git Doctor</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('pr')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            mode === 'pr'
              ? 'bg-accent text-white shadow-sm'
              : 'bg-card border border-card-border text-text-muted hover:text-text-primary'
          }`}
        >
          <GitPullRequest className="w-3.5 h-3.5" />
          <span>PR Copilot</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('bug')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            mode === 'bug'
              ? 'bg-accent text-white shadow-sm'
              : 'bg-card border border-card-border text-text-muted hover:text-text-primary'
          }`}
        >
          <Bug className="w-3.5 h-3.5" />
          <span>Bug Healer</span>
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3">
        {/* MODE 1: GIT DOCTOR */}
        {mode === 'git' && (
          <div className="space-y-3">
            {gitStatus && (
              <div className="rounded-xl border border-card-border bg-card p-3 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <GitBranch className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-xs font-bold text-text-primary truncate">
                      Branch: {gitStatus.branch}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      gitStatus.hasConflicts
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : gitStatus.clean
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {gitStatus.hasConflicts ? 'CONFLICTS' : gitStatus.clean ? 'CLEAN' : 'MODIFIED'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-bg-secondary p-1.5 border border-card-border">
                    <p className="text-[10px] text-text-muted">Staged</p>
                    <p className="font-semibold text-text-primary">{gitStatus.stagedCount}</p>
                  </div>
                  <div className="rounded-lg bg-bg-secondary p-1.5 border border-card-border">
                    <p className="text-[10px] text-text-muted">Modified</p>
                    <p className="font-semibold text-text-primary">{gitStatus.modifiedCount}</p>
                  </div>
                  <div className="rounded-lg bg-bg-secondary p-1.5 border border-card-border">
                    <p className="text-[10px] text-text-muted">Sync</p>
                    <p className="font-semibold text-text-primary">
                      {gitStatus.ahead > 0 ? `+${gitStatus.ahead}` : ''}
                      {gitStatus.behind > 0 ? ` -${gitStatus.behind}` : ''}
                      {gitStatus.ahead === 0 && gitStatus.behind === 0 ? 'Synced' : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Git Diagnosis & Prescribed Actions */}
            <div className="rounded-xl border border-card-border bg-card p-3.5 space-y-2.5 shadow-sm">
              <div className="text-xs text-text-primary leading-relaxed">
                <MarkdownRenderer content={gitDiagnosis || 'Scanning repository...'} />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-card-border/60">
                <button
                  type="button"
                  onClick={() => handleCopyText(gitDiagnosis)}
                  className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-card border border-card-border hover:bg-bg-secondary text-text-primary transition-colors flex items-center justify-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Commands'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveToFlowtion(`Git Status: ${gitStatus?.branch || 'Repo'}`, gitDiagnosis)}
                  className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-card border border-card-border hover:bg-bg-secondary text-text-primary transition-colors flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-accent" />
                  <span>Save to Flowtion</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODE 2: PR COPILOT */}
        {mode === 'pr' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-card-border bg-card p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary">Review Pull Request or Diff</span>
                <button
                  type="button"
                  onClick={async () => {
                    const diff = await fetchLiveRepoDiff(undefined, projectDir || undefined);
                    if (diff) {
                      setPrUrlOrDiff(diff);
                      setPrError('');
                    } else {
                      setPrError('No uncommitted local git diff found in the active workspace.');
                    }
                  }}
                  className="text-[10px] text-accent hover:underline flex items-center gap-1"
                >
                  <Terminal className="w-3 h-3" /> Load Local Diff (HEAD~1)
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={prUrlOrDiff}
                  onChange={(e) => {
                    setPrUrlOrDiff(e.target.value);
                    if (prError) setPrError('');
                  }}
                  placeholder="Paste GitHub PR URL (e.g. github.com/owner/repo/pull/123) or git diff..."
                  className="w-full bg-bg-secondary border border-card-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted"
                />
              </div>

              <button
                type="button"
                onClick={handleScanPR}
                disabled={reviewingPR}
                className="w-full py-2 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                {reviewingPR ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Fetching PR & Synthesizing Review...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Review Pull Request</span>
                  </>
                )}
              </button>

              {prError && (
                <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{prError}</span>
                </p>
              )}
            </div>

            {/* Fetched GitHub PR Metadata Pill */}
            {fetchedPRMeta && (
              <div className="rounded-xl border border-card-border bg-card p-3 space-y-2 shadow-sm animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-accent uppercase tracking-wider flex items-center gap-1">
                    <Github className="w-3 h-3" /> Grounded GitHub PR #{fetchedPRMeta.pullNumber}
                  </span>
                  <a
                    href={fetchedPRMeta.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-text-muted hover:text-text-primary flex items-center gap-1"
                  >
                    View on GitHub <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <h4 className="text-xs font-bold text-text-primary leading-tight">
                  {fetchedPRMeta.title}
                </h4>
                <div className="flex items-center gap-2 text-[10px] text-text-secondary flex-wrap">
                  <span>Author: <strong>@{fetchedPRMeta.author}</strong></span>
                  <span>•</span>
                  <span>Branch: <code>{fetchedPRMeta.baseBranch}</code> ← <code>{fetchedPRMeta.headBranch}</code></span>
                  <span>•</span>
                  <span className="text-emerald-400">+{fetchedPRMeta.additions}</span>
                  <span className="text-red-400">-{fetchedPRMeta.deletions}</span>
                  <span>({fetchedPRMeta.changedFiles} files)</span>
                </div>
              </div>
            )}

            {/* Generated PR Review Card */}
            {prResult && (
              <div className="rounded-xl border border-card-border bg-card p-3.5 space-y-3 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-start justify-between gap-2 border-b border-card-border/60 pb-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                      Executive PR Analysis
                    </span>
                    <h3 className="text-xs font-bold text-text-primary leading-tight">
                      {prResult.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(`${prResult.title}\n\n${prResult.executiveSummary}`)}
                    title="Copy PR Title & Summary"
                    className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-panel shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed">
                  {prResult.executiveSummary}
                </p>

                {/* What Changed */}
                <div className="rounded-lg border border-card-border bg-bg-secondary/60 p-2.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                    Key Modifications
                  </span>
                  {prResult.whatChanged.map((c, i) => (
                    <p key={i} className="text-xs text-text-primary flex items-start gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                      <span>{c}</span>
                    </p>
                  ))}
                </div>

                {/* Risks & Edge Cases */}
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Regressions & Edge Cases to Verify
                  </span>
                  {prResult.risksAndGotchas.map((r, i) => (
                    <p key={i} className="text-xs text-amber-200/90 leading-tight">
                      • {r}
                    </p>
                  ))}
                </div>

                {/* Verification Checklist */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                    Verification Checklist
                  </span>
                  {prResult.verificationChecklist.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-text-primary">
                      <span className="w-3.5 h-3.5 rounded border border-card-border flex items-center justify-center text-[10px] text-text-muted">
                        ☐
                      </span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-card-border/60">
                  <button
                    type="button"
                    onClick={() => {
                      const full = `# ${prResult.title}\n\n## Overview\n${prResult.executiveSummary}\n\n## Changes\n${prResult.whatChanged.map((c) => `- ${c}`).join('\n')}\n\n## Risks\n${prResult.risksAndGotchas.map((r) => `- ${r}`).join('\n')}\n\n## Checklist\n${prResult.verificationChecklist.map((v) => `- [ ] ${v}`).join('\n')}`;
                      handleCopyText(full);
                    }}
                    className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-card border border-card-border hover:bg-bg-secondary text-text-primary transition-colors flex items-center justify-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy PR Markdown'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveToFlowtion(prResult.title, prResult.executiveSummary)}
                    className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-card border border-card-border hover:bg-bg-secondary text-text-primary transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5 text-accent" />
                    <span>Save to Flowtion</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODE 3: BUG HEALER */}
        {mode === 'bug' && (
          <div className="space-y-3">
            <form onSubmit={handleDiagnoseBug} className="rounded-xl border border-card-border bg-card p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary">Paste Error Trace or Log</span>
                <span className="text-[10px] text-text-muted">TypeScript, Node, Python, C++</span>
              </div>
              <textarea
                rows={4}
                value={stackInput}
                onChange={(e) => setStackInput(e.target.value)}
                placeholder="Paste stack trace or build error (e.g. 'TypeError: Cannot read properties of undefined', 'EADDRINUSE 3000')..."
                className="w-full bg-bg-secondary border border-card-border rounded-lg p-2.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted resize-none"
              />
              <button
                type="submit"
                disabled={debugging || !stackInput.trim()}
                className="w-full py-2 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                {debugging ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Diagnosing Root Cause & Generating Patch...</span>
                  </>
                ) : (
                  <>
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Diagnose Bug & Fix</span>
                  </>
                )}
              </button>
            </form>

            {/* Generated Bug Fix Result Card */}
            {bugResult && (
              <div className="rounded-xl border border-card-border bg-card p-3.5 space-y-3 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-card-border/60 pb-2">
                  <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                    <Bug className="w-4 h-4" />
                    {bugResult.errorType}
                  </span>
                  {bugResult.fileLocation && (
                    <span className="text-[10px] text-text-muted font-mono">
                      {bugResult.fileLocation}{bugResult.lineLocation ? `:${bugResult.lineLocation}` : ''}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                    Root Cause
                  </span>
                  <p className="text-xs text-text-primary font-medium">
                    {bugResult.rootCause}
                  </p>
                </div>

                <div className="text-xs text-text-secondary leading-relaxed">
                  <MarkdownRenderer content={bugResult.explanation} />
                </div>

                {/* Suggested Code Patch */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      Prescribed Patch
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(bugResult.suggestedPatch)}
                      className="text-[10px] text-text-muted hover:text-text-primary flex items-center gap-1"
                    >
                      <Copy className="w-2.5 h-2.5" /> Copy Code
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-lg bg-bg-secondary border border-card-border text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre">
                    {bugResult.suggestedPatch}
                  </pre>
                </div>

                {/* Defensive Recommendations */}
                {bugResult.defensiveRecommendations.length > 0 && (
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 space-y-1 text-xs text-blue-300/90 leading-tight">
                    <strong>Preventive Guard:</strong>
                    {bugResult.defensiveRecommendations.map((rec, i) => (
                      <p key={i}>• {rec}</p>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-card-border/60">
                  <button
                    type="button"
                    onClick={() => handleCopyText(`${bugResult.rootCause}\n\nPatch:\n${bugResult.suggestedPatch}`)}
                    className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-card border border-card-border hover:bg-bg-secondary text-text-primary transition-colors flex items-center justify-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Diagnosis'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveToFlowtion(`Bug: ${bugResult.errorType}`, `${bugResult.rootCause}\n\n${bugResult.suggestedPatch}`)}
                    className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-card border border-card-border hover:bg-bg-secondary text-text-primary transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5 text-accent" />
                    <span>Save to Flowtion</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Global Toast for Flowtion */}
        {flowtionToast && (
          <div className="fixed bottom-3 right-3 bg-card border border-accent/40 text-text-primary text-xs px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-3.5 h-3.5 text-accent" />
            <span>{flowtionToast}</span>
          </div>
        )}
      </div>

      {/* GitHub Personal Access Token (PAT) Drawer / Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-xs bg-bg border border-card-border rounded-xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-card-border/60 pb-2">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Github className="w-4 h-4 text-accent" />
                GitHub Connection
              </span>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-text-secondary leading-relaxed">
              Enter a GitHub Personal Access Token (Classic or Fine-grained) to inspect private repositories and Pull Requests with high rate limits.
            </p>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-text-muted uppercase">
                GitHub Personal Access Token (PAT)
              </label>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_... or github_pat_..."
                className="w-full bg-bg-secondary border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-accent"
              />
            </div>

            {authStatus?.valid && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 flex items-center gap-2">
                {authStatus.avatarUrl && (
                  <img src={authStatus.avatarUrl} alt="Avatar" className="w-5 h-5 rounded-full" />
                )}
                <div className="text-[11px] text-emerald-300">
                  <span>Connected as <strong>@{authStatus.user}</strong></span>
                </div>
              </div>
            )}

            {tokenMsg && (
              <p className={`text-[11px] text-center font-medium ${tokenMsg.includes('Verified') ? 'text-emerald-400' : 'text-amber-400'}`}>
                {tokenMsg}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveToken}
                disabled={verifyingToken}
                className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {verifyingToken ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Save Token</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setGithubToken('');
                  handleSaveToken();
                }}
                className="py-1.5 px-3 text-xs font-semibold rounded-lg border border-card-border text-text-muted hover:text-red-400 hover:border-red-400/40 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
