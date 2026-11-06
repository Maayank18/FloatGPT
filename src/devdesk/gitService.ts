/**
 * DevDesk Git Service
 * Inspects Git repositories, parses porcelain status, detects merge conflicts,
 * and formats diffs for review.
 */

import { GitConflictFile, GitRepoStatus } from './types';

function getElectronGit() {
  const win = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
  return win?.electronAPI?.git;
}

export function parseGitPorcelain(raw: string): GitRepoStatus {
  const text = (raw || '').trim();
  if (!text) {
    return {
      isRepo: true,
      branch: 'main',
      ahead: 0,
      behind: 0,
      hasConflicts: false,
      conflictedFiles: [],
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      clean: true,
      rawOutput: '',
    };
  }

  const lines = text.split('\n');
  let branch = 'unknown';
  let tracking: string | undefined;
  let ahead = 0;
  let behind = 0;
  const conflictedFiles: GitConflictFile[] = [];
  let stagedCount = 0;
  let modifiedCount = 0;
  let untrackedCount = 0;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // Branch header: ## main...origin/main [ahead 1, behind 2]
      const branchPart = line.slice(3).trim();
      const match = branchPart.match(/^([^\s\.]+)(?:\.\.\.([^\s\[]+))?(?:\s*\[([^\]]+)\])?/);
      if (match) {
        branch = match[1];
        tracking = match[2];
        const statusMeta = match[3] || '';
        const aheadMatch = statusMeta.match(/ahead\s+(\d+)/);
        const behindMatch = statusMeta.match(/behind\s+(\d+)/);
        if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
        if (behindMatch) behind = parseInt(behindMatch[1], 10);
      } else {
        branch = branchPart;
      }
      continue;
    }

    if (line.length < 3) continue;

    const x = line[0];
    const y = line[1];
    const filePath = line.slice(3).trim();

    // Conflict codes: UU, AA, DD, AU, UA, UD, DU
    if ((x === 'U' || y === 'U') || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) {
      conflictedFiles.push({
        path: filePath,
        conflictType: x === 'U' && y === 'U' ? 'both_modified' : x === 'A' && y === 'A' ? 'both_added' : 'other',
      });
      continue;
    }

    if (x === '?' && y === '?') {
      untrackedCount++;
      continue;
    }

    if (['M', 'A', 'D', 'R', 'C'].includes(x)) {
      stagedCount++;
    }

    if (['M', 'D'].includes(y)) {
      modifiedCount++;
    }
  }

  const hasConflicts = conflictedFiles.length > 0;
  const clean = !hasConflicts && stagedCount === 0 && modifiedCount === 0 && untrackedCount === 0;

  return {
    isRepo: true,
    branch,
    tracking,
    ahead,
    behind,
    hasConflicts,
    conflictedFiles,
    stagedCount,
    modifiedCount,
    untrackedCount,
    clean,
    rawOutput: text,
  };
}

export async function fetchLiveRepoStatus(targetDir?: string): Promise<GitRepoStatus> {
  const git = getElectronGit();
  if (git?.status) {
    try {
      const res = await git.status(targetDir);
      if (res?.isRepo && typeof res.output === 'string') {
        return parseGitPorcelain(res.output);
      }
      if (res?.isRepo === false) {
        return {
          isRepo: false,
          branch: 'none',
          ahead: 0,
          behind: 0,
          hasConflicts: false,
          conflictedFiles: [],
          stagedCount: 0,
          modifiedCount: 0,
          untrackedCount: 0,
          clean: true,
          rawOutput: 'Not a git repository.',
        };
      }
    } catch (err: any) {
      console.warn('[DevDesk] Git status IPC error:', err);
    }
  }

  // Fallback: report need for FloatGPT Desktop or manual paste
  return {
    isRepo: false,
    branch: 'paste_mode',
    ahead: 0,
    behind: 0,
    hasConflicts: false,
    conflictedFiles: [],
    stagedCount: 0,
    modifiedCount: 0,
    untrackedCount: 0,
    clean: true,
    rawOutput: 'Browser mode: paste your git status, diff, or error message below.',
  };
}

export async function fetchLiveRepoDiff(ref?: string, targetDir?: string): Promise<string> {
  const git = getElectronGit();
  if (git?.diff) {
    try {
      const res = await git.diff(targetDir, ref);
      if (res?.ok && typeof res.diff === 'string') {
        return res.diff;
      }
    } catch {}
  }
  return '';
}

export async function fetchLiveRepoLog(count = 5, targetDir?: string): Promise<string> {
  const git = getElectronGit();
  if (git?.log) {
    try {
      const res = await git.log(targetDir, count);
      if (res?.ok && typeof res.log === 'string') {
        return res.log;
      }
    } catch {}
  }
  return '';
}

export async function fetchLiveRepoRemote(targetDir?: string): Promise<{ owner?: string; repo?: string; rawUrl?: string } | null> {
  const git = getElectronGit();
  if (git?.remote) {
    try {
      const res = await git.remote(targetDir);
      if (res?.ok && typeof res.remote === 'string') {
        const raw = res.remote.trim();
        // git@github.com:owner/repo.git OR https://github.com/owner/repo.git
        const match = raw.match(/github\.com[:\/]([^\/\s]+)\/([^\/\s\.]+)(?:\.git)?/i);
        if (match) {
          return { owner: match[1], repo: match[2], rawUrl: raw };
        }
        return { rawUrl: raw };
      }
    } catch {}
  }
  return null;
}

export async function chooseProjectDirectory(): Promise<string | null> {
  const win = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
  if (win?.electronAPI?.dialog?.openDirectory) {
    try {
      return await win.electronAPI.dialog.openDirectory();
    } catch (err) {
      console.warn('[DevDesk] chooseProjectDirectory error:', err);
    }
  }
  return null;
}


