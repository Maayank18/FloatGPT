import { randomUUID } from 'crypto';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const USERS = 'users';
const PROFILES = 'profiles';
const TOKEN_SECONDS = 60 * 60 * 24 * 30;
const DROPPED_FIELDS = ['messages', 'playgroundMessages', 'history', 'pastSessions', 'knowledge'];
const SHARED_LISTS = ['goals', 'projects', 'tasks', 'risks', 'resources', 'recommendations', 'notifications'];

function mongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is missing');
  return uri;
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is missing');
  return secret;
}

export async function db() {
  const cached = globalThis.__floatgptMongo;
  if (!cached) {
    const client = new MongoClient(mongoUri());
    globalThis.__floatgptMongo = client.connect();
  }
  const client = await globalThis.__floatgptMongo;
  return client.db('floatgpt');
}

export function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function publicUser(doc) {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    name: doc.name || '',
  };
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, jwtSecret(), { expiresIn: TOKEN_SECONDS });
}

export function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function stripProfile(input) {
  const source = input && typeof input === 'object' ? { ...input } : {};
  for (const field of DROPPED_FIELDS) delete source[field];
  const settings = source.settings;
  if (settings && typeof settings === 'object') {
    const nextSettings = { ...settings };
    const aiConfig = nextSettings.aiConfig;
    if (aiConfig && typeof aiConfig === 'object') {
      nextSettings.aiConfig = { ...aiConfig, apiKeys: {} };
    }
    source.settings = nextSettings;
  }
  return source;
}

function statusRank(status) {
  if (status === 'Archived') return 2;
  if (status === 'Completed') return 1;
  return 0;
}

function mergeById(existing, incoming) {
  const map = new Map();
  const take = (list) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const id = String(item.id || '');
      if (!id) continue;
      const prev = map.get(id);
      if (!prev) {
        map.set(id, { ...item });
        continue;
      }
      const next = { ...prev, ...item };
      next.status = statusRank(prev.status) >= statusRank(item.status) ? prev.status : item.status;
      if (typeof prev.progress === 'number' || typeof item.progress === 'number') {
        next.progress = Math.max(Number(prev.progress) || 0, Number(item.progress) || 0);
      }
      map.set(id, next);
    }
  };
  take(existing);
  take(incoming);
  return [...map.values()];
}

function mergeProfiles(existing, incoming) {
  const merged = { ...(existing || {}), ...incoming };
  for (const field of SHARED_LISTS) {
    merged[field] = mergeById(existing?.[field], incoming[field]);
  }
  return stripProfile(merged);
}

export function readAccount(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret());
    if (!payload?.sub || !ObjectId.isValid(payload.sub)) return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export async function signup(body) {
  const email = cleanEmail(body?.email);
  const password = String(body?.password || '');
  const name = String(body?.name || '').trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 400, error: 'Enter a valid email address.' };
  }
  if (password.length < 6) {
    return { status: 400, error: 'Use a password of at least 6 characters.' };
  }
  const database = await db();
  const users = database.collection(USERS);
  await users.createIndex({ email: 1 }, { unique: true });
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const inserted = await users.insertOne({
      email,
      name,
      passwordHash,
      createdAt: new Date(),
    });
    const user = publicUser({ _id: inserted.insertedId, email, name });
    return { status: 201, token: signToken(user), user };
  } catch (err) {
    if (err && err.code === 11000) {
      return { status: 409, error: 'This email already has an account. Sign in instead.' };
    }
    throw err;
  }
}

export async function loginWithFirebase(body) {
  const idToken = String(body?.idToken || '');
  if (idToken.length < 20) return { status: 400, error: 'Google sign-in did not finish. Try again.' };
  const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
  if (!apiKey) return { status: 500, error: 'Google sign-in is not configured on this server.' };
  const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const payload = await lookup.json().catch(() => ({}));
  const record = payload.users?.[0];
  const email = cleanEmail(record?.email);
  if (!lookup.ok || !email) return { status: 401, error: 'Google sign-in did not finish. Try again.' };
  const name = String(record?.displayName || '').trim().slice(0, 80);
  const database = await db();
  const users = database.collection(USERS);
  await users.createIndex({ email: 1 }, { unique: true });
  const existing = await users.findOne({ email });
  if (existing) {
    if (name && !existing.name) await users.updateOne({ _id: existing._id }, { $set: { name, provider: 'google' } });
    const user = publicUser({ ...existing, name: existing.name || name });
    return { status: 200, token: signToken(user), user };
  }
  const passwordHash = await bcrypt.hash(randomUUID(), 12);
  const inserted = await users.insertOne({ email, name, passwordHash, provider: 'google', createdAt: new Date() });
  const user = publicUser({ _id: inserted.insertedId, email, name });
  return { status: 201, token: signToken(user), user };
}

export async function login(body) {
  const email = cleanEmail(body?.email);
  const password = String(body?.password || '');
  if (!email || !password) {
    return { status: 400, error: 'Enter the email and password.' };
  }
  const database = await db();
  const doc = await database.collection(USERS).findOne({ email });
  const matches = doc ? await bcrypt.compare(password, doc.passwordHash) : false;
  if (!doc || !matches) {
    return { status: 401, error: 'That email and password did not match.' };
  }
  const user = publicUser(doc);
  return { status: 200, token: signToken(user), user };
}

export async function currentUser(account) {
  const database = await db();
  const doc = await database.collection(USERS).findOne({ _id: new ObjectId(account.id) });
  if (!doc) return { status: 401, error: 'Sign in again to continue.' };
  return { status: 200, user: publicUser(doc) };
}

export async function readProfile(account) {
  const database = await db();
  const doc = await database.collection(PROFILES).findOne({ userId: account.id });
  return {
    status: 200,
    profile: doc?.profile ? stripProfile(doc.profile) : null,
    workspace: doc?.workspace || null,
    revision: Number(doc?.revision) || 0,
  };
}

export async function saveProfile(account, body) {
  const incoming = stripProfile(body?.profile);
  const workspace = body?.workspace && typeof body.workspace === 'object' ? body.workspace : undefined;
  const database = await db();
  const profiles = database.collection(PROFILES);
  const current = await profiles.findOne({ userId: account.id });
  const storedRevision = Number(current?.revision) || 0;
  const clientRevision = Number(body?.revision) || 0;
  const stale = !!current?.profile && clientRevision < storedRevision;
  const profile = stale ? mergeProfiles(current?.profile, incoming) : incoming;
  const nextWorkspace = workspace
    ? (stale && current?.workspace ? { ...current.workspace, ...workspace } : workspace)
    : current?.workspace;
  const encoded = JSON.stringify({ profile, workspace: nextWorkspace });
  if (encoded.length > 1_500_000) {
    return { status: 413, error: 'That account data is too large to save.' };
  }
  const revision = storedRevision + 1;
  const update = { profile, revision, updatedAt: new Date() };
  if (nextWorkspace) update.workspace = nextWorkspace;
  await profiles.updateOne(
    { userId: account.id },
    { $set: update, $setOnInsert: { userId: account.id, createdAt: new Date() } },
    { upsert: true }
  );
  return { status: 200, ok: true, revision };
}
