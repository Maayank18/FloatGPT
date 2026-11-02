const TOKEN_KEY = 'floatgpt_account_token';
const USER_KEY = 'floatgpt_account_user';
const ACCOUNT_EVENT = 'floatgpt-account';

export type AccountSessionUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

type AccountListener = (user: AccountSessionUser | null) => void;

const listeners = new Set<AccountListener>();
let profileRevision = 0;

const DROPPED_FIELDS = ['messages', 'playgroundMessages', 'history', 'pastSessions', 'knowledge'] as const;

function toSessionUser(user: { id: string; email?: string; name?: string } | null | undefined): AccountSessionUser | null {
  if (!user?.id) return null;
  return {
    uid: user.id,
    email: user.email || null,
    displayName: user.name || null,
  };
}

export function getStoredAccount(): AccountSessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return toSessionUser(parsed?.uid ? { id: parsed.uid, email: parsed.email, name: parsed.displayName } : parsed);
  } catch {
    return null;
  }
}

function token(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function remember(nextToken: string, user: AccountSessionUser) {
  localStorage.setItem(TOKEN_KEY, nextToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  listeners.forEach((listener) => listener(user));
  window.dispatchEvent(new Event(ACCOUNT_EVENT));
}

export function subscribeAccountSession(listener: AccountListener): () => void {
  listeners.add(listener);
  const onStorage = () => listener(getStoredAccount());
  window.addEventListener(ACCOUNT_EVENT, onStorage);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener(ACCOUNT_EVENT, onStorage);
    window.removeEventListener('storage', onStorage);
  };
}

class AccountRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function accountRequest(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const current = token();
  if (current) headers.set('Authorization', `Bearer ${current}`);
  let response: Response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch {
    throw new AccountRequestError('The account service is not reachable.', 0);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AccountRequestError(body?.error || 'Sign-in did not finish. Try again.', response.status);
  }
  return body;
}

export async function signUpWithEmail(email: string, password: string, name: string): Promise<AccountSessionUser> {
  const body = await accountRequest('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  const user = toSessionUser(body.user);
  if (!user || !body.token) throw new Error('Could not create the account. Try again.');
  remember(body.token, user);
  return user;
}

export async function signInWithGoogleAccount(): Promise<AccountSessionUser> {
  const { signInWithGoogle } = await import('./googleSignIn');
  const { auth, signOut } = await import('./firebase');
  const stayed = await signInWithGoogle();
  if (!stayed) throw new Error('Finish sign-in in the Google window.');
  const current = auth.currentUser;
  if (!current) throw new Error('Google sign-in did not finish. Try again.');
  const idToken = await current.getIdToken();
  try {
    const body = await accountRequest('/api/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    const user = toSessionUser(body.user);
    if (!user || !body.token) throw new Error('Could not sign in with Google. Try again.');
    remember(body.token, user);
    return user;
  } finally {
    await signOut(auth).catch(() => {});
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AccountSessionUser> {
  const body = await accountRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const user = toSessionUser(body.user);
  if (!user || !body.token) throw new Error('Could not sign in. Try again.');
  remember(body.token, user);
  return user;
}

export async function restoreAccountSession(): Promise<AccountSessionUser | null> {
  const cached = getStoredAccount();
  if (!token()) return null;
  try {
    const body = await accountRequest('/api/auth/me');
    const user = toSessionUser(body.user);
    if (!user) {
      await logoutAccount();
      return null;
    }
    if (typeof body.token === 'string' && body.token) localStorage.setItem(TOKEN_KEY, body.token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch (err) {
    const status = err instanceof AccountRequestError ? err.status : 0;
    // A closed laptop or a server that is still starting is not a logout.
    // Only a rejected token ends the session.
    if (status === 401 || status === 403) {
      await logoutAccount();
      return null;
    }
    return cached;
  }
}

export async function logoutAccount(): Promise<void> {
  profileRevision = 0;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('floatgpt_auth_dismissed');
  listeners.forEach((listener) => listener(null));
  window.dispatchEvent(new Event(ACCOUNT_EVENT));
  try {
    const { auth, signOut } = await import('./firebase');
    await signOut(auth);
  } catch {
    // Firebase may already be signed out. The device session is still cleared.
  }
}

export function stripAccountProfile<T extends Record<string, unknown>>(state: T): T {
  const copy = JSON.parse(JSON.stringify(state)) as T;
  for (const field of DROPPED_FIELDS) delete (copy as Record<string, unknown>)[field];
  const settings = (copy as { settings?: { aiConfig?: { apiKeys?: unknown } } }).settings;
  if (settings?.aiConfig) settings.aiConfig.apiKeys = {};
  return copy;
}

export async function loadAccountProfile(): Promise<{ profile: Record<string, unknown> | null; workspace: Record<string, unknown> | null }> {
  const body = await accountRequest('/api/account/profile');
  profileRevision = Number(body.revision) || 0;
  return {
    profile: body.profile || null,
    workspace: body.workspace || null,
  };
}

export async function saveAccountProfile(profile: Record<string, unknown>, workspace?: Record<string, unknown> | null): Promise<void> {
  const body = await accountRequest('/api/account/profile', {
    method: 'PUT',
    body: JSON.stringify({
      profile: stripAccountProfile(profile),
      workspace: workspace || undefined,
      revision: profileRevision,
    }),
  });
  if (typeof body.revision === 'number') profileRevision = body.revision;
}
