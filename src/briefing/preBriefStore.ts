import { get, set, del } from 'idb-keyval';
import { PreBriefItem } from './types';

const STORE_KEY = 'floatgpt_prebrief_items';
const ACTIVE_KEY = 'floatgpt_prebrief_active_id';
const TAVILY_KEY_STORAGE = 'floatgpt_tavily_key';

export async function listBriefings(): Promise<PreBriefItem[]> {
  try {
    const raw = await get<PreBriefItem[]>(STORE_KEY);
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn('[PreBriefStore] list failed', err);
    return [];
  }
}

export async function getBriefing(id: string): Promise<PreBriefItem | null> {
  const all = await listBriefings();
  return all.find((b) => b.id === id) || null;
}

export async function saveBriefing(item: PreBriefItem): Promise<void> {
  const all = await listBriefings();
  const index = all.findIndex((b) => b.id === item.id);
  if (index >= 0) {
    all[index] = item;
  } else {
    all.unshift(item);
  }
  await set(STORE_KEY, all);
  await setActiveBriefingId(item.id);
}

export async function deleteBriefing(id: string): Promise<void> {
  const all = await listBriefings();
  const next = all.filter((b) => b.id !== id);
  await set(STORE_KEY, next);
  const active = await getActiveBriefingId();
  if (active === id) {
    await setActiveBriefingId(next.length > 0 ? next[0].id : null);
  }
}

export async function getActiveBriefingId(): Promise<string | null> {
  try {
    const active = await get<string>(ACTIVE_KEY);
    return active || null;
  } catch {
    return null;
  }
}

export async function setActiveBriefingId(id: string | null): Promise<void> {
  try {
    if (id) {
      await set(ACTIVE_KEY, id);
    } else {
      await del(ACTIVE_KEY);
    }
  } catch {}
}

export function getTavilyApiKey(): string {
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(TAVILY_KEY_STORAGE)?.trim();
    if (local) return local;
  }
  const envKey = (import.meta as any)?.env?.VITE_TAVILY_API_KEY || (import.meta as any)?.env?.TAVILY_API_KEY;
  if (typeof envKey === 'string' && envKey.trim()) {
    return envKey.trim();
  }
  if (typeof process !== 'undefined' && process.env) {
    const procKey = process.env.VITE_TAVILY_API_KEY || process.env.TAVILY_API_KEY;
    if (typeof procKey === 'string' && procKey.trim()) return procKey.trim();
  }
  return '';
}

export function saveTavilyApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key.trim()) {
      localStorage.setItem(TAVILY_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(TAVILY_KEY_STORAGE);
    }
  }
}

