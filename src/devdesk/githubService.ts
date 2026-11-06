/**
 * DevDesk GitHub Cloud Service
 * Grounded integration with GitHub REST API for Pull Requests,
 * commit diffs, and authenticated token validation.
 */

const STORAGE_KEY_GITHUB_TOKEN = 'floatgpt_devdesk_github_pat';
const STORAGE_KEY_LAST_PROJECT_DIR = 'floatgpt_devdesk_project_dir';

export function getStoredGitHubToken(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_GITHUB_TOKEN) || '';
  } catch {
    return '';
  }
}

export function setStoredGitHubToken(token: string): void {
  try {
    if (!token.trim()) {
      localStorage.removeItem(STORAGE_KEY_GITHUB_TOKEN);
    } else {
      localStorage.setItem(STORAGE_KEY_GITHUB_TOKEN, token.trim());
    }
  } catch {}
}

export function getStoredProjectDir(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_LAST_PROJECT_DIR) || '';
  } catch {
    return '';
  }
}

export function setStoredProjectDir(dir: string): void {
  try {
    if (!dir.trim()) {
      localStorage.removeItem(STORAGE_KEY_LAST_PROJECT_DIR);
    } else {
      localStorage.setItem(STORAGE_KEY_LAST_PROJECT_DIR, dir.trim());
    }
  } catch {}
}

export interface GitHubUserAuth {
  valid: boolean;
  user?: string;
  avatarUrl?: string;
  name?: string;
  error?: string;
  scopes?: string;
}

export async function verifyGitHubToken(token: string): Promise<GitHubUserAuth> {
  const clean = (token || '').trim();
  if (!clean) {
    return { valid: false, error: 'No token provided' };
  }

  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${clean}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'FloatGPT-DevDesk',
      },
    });

    if (res.status === 401) {
      return { valid: false, error: 'Bad credentials (Invalid GitHub Token)' };
    }
    if (res.status === 403) {
      return { valid: false, error: 'Rate limited or access forbidden by GitHub' };
    }
    if (!res.ok) {
      return { valid: false, error: `GitHub API error (${res.status}): ${res.statusText}` };
    }

    const data = await res.json();
    const scopes = res.headers.get('x-oauth-scopes') || '';
    return {
      valid: true,
      user: data.login,
      name: data.name || data.login,
      avatarUrl: data.avatar_url,
      scopes,
    };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Network request failed' };
  }
}

export interface ParsedPRQuery {
  owner: string;
  repo: string;
  pullNumber: number;
}

export function parseGitHubPRUrl(raw: string): ParsedPRQuery | null {
  const input = (raw || '').trim();
  if (!input) return null;

  // 1. https://github.com/owner/repo/pull/123 or http://...
  const urlMatch = input.match(/github\.com\/([^\/\s]+)\/([^\/\s#]+)\/pull\/(\d+)/i);
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      pullNumber: parseInt(urlMatch[3], 10),
    };
  }

  // 2. owner/repo#123
  const slugMatch = input.match(/^([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)#(\d+)$/);
  if (slugMatch) {
    return {
      owner: slugMatch[1],
      repo: slugMatch[2],
      pullNumber: parseInt(slugMatch[3], 10),
    };
  }

  // 3. owner/repo/pulls/123
  const apiMatch = input.match(/^([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)\/pulls\/(\d+)$/);
  if (apiMatch) {
    return {
      owner: apiMatch[1],
      repo: apiMatch[2],
      pullNumber: parseInt(apiMatch[3], 10),
    };
  }

  return null;
}

export interface GitHubPRDetails {
  ok: boolean;
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  body: string;
  author: string;
  authorAvatar?: string;
  state: string;
  htmlUrl: string;
  baseBranch: string;
  headBranch: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  diff: string;
  error?: string;
}

export async function fetchGitHubPR(
  target: string | ParsedPRQuery,
  explicitToken?: string
): Promise<GitHubPRDetails> {
  const parsed = typeof target === 'string' ? parseGitHubPRUrl(target) : target;
  if (!parsed) {
    return {
      ok: false,
      owner: '',
      repo: '',
      pullNumber: 0,
      title: '',
      body: '',
      author: '',
      state: 'unknown',
      htmlUrl: '',
      baseBranch: '',
      headBranch: '',
      additions: 0,
      deletions: 0,
      changedFiles: 0,
      diff: '',
      error: 'Invalid GitHub PR URL or format. Use https://github.com/owner/repo/pull/123 or owner/repo#123',
    };
  }

  const { owner, repo, pullNumber } = parsed;
  const token = explicitToken || getStoredGitHubToken();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'FloatGPT-DevDesk',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    // 1. Fetch PR metadata
    const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`, {
      headers,
    });

    if (metaRes.status === 404) {
      return {
        ok: false,
        owner,
        repo,
        pullNumber,
        title: '',
        body: '',
        author: '',
        state: '404',
        htmlUrl: '',
        baseBranch: '',
        headBranch: '',
        additions: 0,
        deletions: 0,
        changedFiles: 0,
        diff: '',
        error: `Pull Request #${pullNumber} not found in ${owner}/${repo}. If the repository is private, please add your GitHub Personal Access Token.`,
      };
    }

    if (metaRes.status === 401 || metaRes.status === 403) {
      const errJson = await metaRes.json().catch(() => ({}));
      const msg = errJson.message || metaRes.statusText;
      return {
        ok: false,
        owner,
        repo,
        pullNumber,
        title: '',
        body: '',
        author: '',
        state: 'unauthorized',
        htmlUrl: '',
        baseBranch: '',
        headBranch: '',
        additions: 0,
        deletions: 0,
        changedFiles: 0,
        diff: '',
        error: `GitHub access denied (${metaRes.status}): ${msg}. Add a valid GitHub Token with 'repo' scope.`,
      };
    }

    if (!metaRes.ok) {
      return {
        ok: false,
        owner,
        repo,
        pullNumber,
        title: '',
        body: '',
        author: '',
        state: 'error',
        htmlUrl: '',
        baseBranch: '',
        headBranch: '',
        additions: 0,
        deletions: 0,
        changedFiles: 0,
        diff: '',
        error: `GitHub returned status ${metaRes.status}: ${metaRes.statusText}`,
      };
    }

    const prMeta = await metaRes.json();

    // 2. Fetch unified git diff
    const diffHeaders = {
      ...headers,
      Accept: 'application/vnd.github.v3.diff',
    };
    const diffRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`, {
      headers: diffHeaders,
    });

    let diffText = '';
    if (diffRes.ok) {
      diffText = await diffRes.text();
    }

    return {
      ok: true,
      owner,
      repo,
      pullNumber,
      title: prMeta.title || `PR #${pullNumber}`,
      body: prMeta.body || '',
      author: prMeta.user?.login || 'unknown',
      authorAvatar: prMeta.user?.avatar_url,
      state: prMeta.state || 'open',
      htmlUrl: prMeta.html_url || `https://github.com/${owner}/${repo}/pull/${pullNumber}`,
      baseBranch: prMeta.base?.ref || 'main',
      headBranch: prMeta.head?.ref || 'feature',
      additions: prMeta.additions || 0,
      deletions: prMeta.deletions || 0,
      changedFiles: prMeta.changed_files || 0,
      diff: diffText,
    };
  } catch (err: any) {
    return {
      ok: false,
      owner,
      repo,
      pullNumber,
      title: '',
      body: '',
      author: '',
      state: 'error',
      htmlUrl: '',
      baseBranch: '',
      headBranch: '',
      additions: 0,
      deletions: 0,
      changedFiles: 0,
      diff: '',
      error: err.message || 'Failed to fetch PR from GitHub',
    };
  }
}

