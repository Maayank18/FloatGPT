import type { Express, NextFunction, Request, Response } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const USERS = 'users';
const PROFILES = 'profiles';
const TOKEN_SECONDS = 60 * 60 * 24 * 30;
const DROPPED_FIELDS = ['messages', 'playgroundMessages', 'history', 'pastSessions', 'knowledge'];

type AccountToken = { sub: string; email: string };

type AccountRequest = Request & { account?: { id: string; email: string } };

let clientPromise: Promise<MongoClient> | null = null;

function mongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is missing');
  return uri;
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is missing');
  return secret;
}

async function db() {
  if (!clientPromise) {
    const client = new MongoClient(mongoUri());
    clientPromise = client.connect();
  }
  const client = await clientPromise;
  return client.db('floatgpt');
}

function cleanEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function publicUser(doc: { _id: ObjectId; email: string; name?: string }) {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    name: doc.name || '',
  };
}

function signToken(user: { id: string; email: string }) {
  return jwt.sign({ sub: user.id, email: user.email }, jwtSecret(), { expiresIn: TOKEN_SECONDS });
}

function stripProfile(input: unknown): Record<string, unknown> {
  const source = input && typeof input === 'object' ? { ...(input as Record<string, unknown>) } : {};
  for (const field of DROPPED_FIELDS) delete source[field];
  const settings = source.settings;
  if (settings && typeof settings === 'object') {
    const nextSettings = { ...(settings as Record<string, unknown>) };
    const aiConfig = nextSettings.aiConfig;
    if (aiConfig && typeof aiConfig === 'object') {
      nextSettings.aiConfig = { ...(aiConfig as Record<string, unknown>), apiKeys: {} };
    }
    source.settings = nextSettings;
  }
  return source;
}

const SHARED_LISTS = ['goals', 'projects', 'tasks', 'risks', 'resources', 'recommendations', 'notifications'] as const;

function statusRank(status: unknown): number {
  if (status === 'Archived') return 2;
  if (status === 'Completed') return 1;
  return 0;
}

function mergeById(existing: unknown, incoming: unknown): unknown[] {
  const map = new Map<string, Record<string, unknown>>();
  const take = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const id = String(row.id || '');
      if (!id) continue;
      const prev = map.get(id);
      if (!prev) {
        map.set(id, { ...row });
        continue;
      }
      const next = { ...prev, ...row };
      next.status = statusRank(prev.status) >= statusRank(row.status) ? prev.status : row.status;
      if (typeof prev.progress === 'number' || typeof row.progress === 'number') {
        next.progress = Math.max(Number(prev.progress) || 0, Number(row.progress) || 0);
      }
      map.set(id, next);
    }
  };
  take(existing);
  take(incoming);
  return [...map.values()];
}

function mergeProfiles(existing: Record<string, unknown> | undefined, incoming: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(existing || {}), ...incoming };
  for (const field of SHARED_LISTS) {
    merged[field] = mergeById(existing?.[field], incoming[field]);
  }
  return stripProfile(merged);
}

async function requireAccount(req: AccountRequest, res: Response, next: NextFunction) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Sign in again to continue.' });
    return;
  }
  try {
    const payload = jwt.verify(token, jwtSecret()) as AccountToken;
    if (!payload?.sub || !ObjectId.isValid(payload.sub)) {
      res.status(401).json({ error: 'Sign in again to continue.' });
      return;
    }
    req.account = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: 'Sign in again to continue.' });
  }
}

export function mountAccountRoutes(app: Express) {
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const email = cleanEmail(req.body?.email);
      const password = String(req.body?.password || '');
      const name = String(req.body?.name || '').trim().slice(0, 80);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Enter a valid email address.' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'Use a password of at least 6 characters.' });
        return;
      }
      const database = await db();
      const users = database.collection(USERS);
      await users.createIndex({ email: 1 }, { unique: true });
      const passwordHash = await bcrypt.hash(password, 12);
      const inserted = await users.insertOne({
        email,
        name,
        passwordHash,
        createdAt: new Date(),
      });
      const user = publicUser({ _id: inserted.insertedId, email, name });
      res.status(201).json({ token: signToken(user), user });
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: number }).code : 0;
      if (code === 11000) {
        res.status(409).json({ error: 'This email already has an account. Sign in instead.' });
        return;
      }
      console.error('[Account signup]', err instanceof Error ? err.message : 'failed');
      res.status(500).json({ error: 'Could not create the account. Try again.' });
    }
  });

  app.post('/api/auth/firebase', async (req, res) => {
    try {
      const idToken = String(req.body?.idToken || '');
      if (idToken.length < 20) {
        res.status(400).json({ error: 'Google sign-in did not finish. Try again.' });
        return;
      }
      const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'Google sign-in is not configured on this server.' });
        return;
      }
      const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const payload = await lookup.json().catch(() => ({})) as { users?: Array<{ email?: string; displayName?: string }> };
      const record = payload.users?.[0];
      const email = cleanEmail(record?.email);
      if (!lookup.ok || !email) {
        res.status(401).json({ error: 'Google sign-in did not finish. Try again.' });
        return;
      }
      const name = String(record?.displayName || '').trim().slice(0, 80);
      const database = await db();
      const users = database.collection(USERS);
      await users.createIndex({ email: 1 }, { unique: true });
      const existing = await users.findOne<{ _id: ObjectId; email: string; name?: string }>({ email });
      if (existing) {
        if (name && !existing.name) {
          await users.updateOne({ _id: existing._id }, { $set: { name, provider: 'google' } });
        }
        const user = publicUser({ ...existing, name: existing.name || name });
        res.json({ token: signToken(user), user });
        return;
      }
      const passwordHash = await bcrypt.hash(randomUUID(), 12);
      const inserted = await users.insertOne({
        email,
        name,
        passwordHash,
        provider: 'google',
        createdAt: new Date(),
      });
      const user = publicUser({ _id: inserted.insertedId, email, name });
      res.status(201).json({ token: signToken(user), user });
    } catch (err: unknown) {
      console.error('[Account google]', err instanceof Error ? err.message : 'failed');
      res.status(500).json({ error: 'Could not sign in with Google. Try again.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const email = cleanEmail(req.body?.email);
      const password = String(req.body?.password || '');
      if (!email || !password) {
        res.status(400).json({ error: 'Enter the email and password.' });
        return;
      }
      const database = await db();
      const doc = await database.collection(USERS).findOne<{ _id: ObjectId; email: string; name?: string; passwordHash: string }>({ email });
      const matches = doc ? await bcrypt.compare(password, doc.passwordHash) : false;
      if (!doc || !matches) {
        res.status(401).json({ error: 'That email and password did not match.' });
        return;
      }
      const user = publicUser(doc);
      res.json({ token: signToken(user), user });
    } catch (err: unknown) {
      console.error('[Account login]', err instanceof Error ? err.message : 'failed');
      res.status(500).json({ error: 'Could not sign in. Try again.' });
    }
  });

  app.get('/api/auth/me', requireAccount, async (req: AccountRequest, res) => {
    try {
      const database = await db();
      const doc = await database.collection(USERS).findOne<{ _id: ObjectId; email: string; name?: string }>({
        _id: new ObjectId(req.account!.id),
      });
      if (!doc) {
        res.status(401).json({ error: 'Sign in again to continue.' });
        return;
      }
      res.json({ user: publicUser(doc) });
    } catch (err: unknown) {
      console.error('[Account me]', err instanceof Error ? err.message : 'failed');
      res.status(500).json({ error: 'Could not load the account.' });
    }
  });

  app.get('/api/account/profile', requireAccount, async (req: AccountRequest, res) => {
    try {
      const database = await db();
      const doc = await database.collection(PROFILES).findOne<{ profile?: Record<string, unknown>; workspace?: Record<string, unknown>; revision?: number }>({
        userId: req.account!.id,
      });
      res.json({
        profile: doc?.profile ? stripProfile(doc.profile) : null,
        workspace: doc?.workspace || null,
        revision: Number(doc?.revision) || 0,
      });
    } catch (err: unknown) {
      console.error('[Account profile read]', err instanceof Error ? err.message : 'failed');
      res.status(500).json({ error: 'Could not load your saved data.' });
    }
  });

  app.put('/api/account/profile', requireAccount, async (req: AccountRequest, res) => {
    try {
      const incoming = stripProfile(req.body?.profile);
      const workspace = req.body?.workspace && typeof req.body.workspace === 'object'
        ? req.body.workspace as Record<string, unknown>
        : undefined;
      const database = await db();
      const profiles = database.collection(PROFILES);
      const current = await profiles.findOne<{ profile?: Record<string, unknown>; workspace?: Record<string, unknown>; revision?: number }>({
        userId: req.account!.id,
      });
      const storedRevision = Number(current?.revision) || 0;
      const clientRevision = Number(req.body?.revision) || 0;
      const stale = !!current?.profile && clientRevision < storedRevision;
      const profile = stale ? mergeProfiles(current?.profile, incoming) : incoming;
      const nextWorkspace = workspace
        ? (stale && current?.workspace ? { ...current.workspace, ...workspace } : workspace)
        : current?.workspace;
      const encoded = JSON.stringify({ profile, workspace: nextWorkspace });
      if (encoded.length > 1_500_000) {
        res.status(413).json({ error: 'That account data is too large to save.' });
        return;
      }
      const revision = storedRevision + 1;
      const update: Record<string, unknown> = { profile, revision, updatedAt: new Date() };
      if (nextWorkspace) update.workspace = nextWorkspace;
      await profiles.updateOne(
        { userId: req.account!.id },
        { $set: update, $setOnInsert: { userId: req.account!.id, createdAt: new Date() } },
        { upsert: true }
      );
      res.json({ ok: true, revision });
    } catch (err: unknown) {
      console.error('[Account profile save]', err instanceof Error ? err.message : 'failed');
      res.status(500).json({ error: 'Could not save your account data.' });
    }
  });
}
