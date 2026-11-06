/**
 * DevDesk Local Persistence Store (idb-keyval)
 * Persists Git diagnoses, PR reviews, and bug resolution sessions locally.
 */

import { get, set, del } from 'idb-keyval';
import { DevDeskItem } from './types';

const STORE_KEY = 'floatgpt_devdesk_items';
const ACTIVE_KEY = 'floatgpt_devdesk_active_id';

export async function listDevDeskItems(): Promise<DevDeskItem[]> {
  try {
    const raw = await get<DevDeskItem[]>(STORE_KEY);
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn('[DevDeskStore] list failed:', err);
    return [];
  }
}

export async function getDevDeskItem(id: string): Promise<DevDeskItem | null> {
  const all = await listDevDeskItems();
  return all.find((item) => item.id === id) || null;
}

export async function saveDevDeskItem(item: DevDeskItem): Promise<void> {
  const all = await listDevDeskItems();
  const index = all.findIndex((i) => i.id === item.id);
  if (index >= 0) {
    all[index] = item;
  } else {
    all.unshift(item);
  }
  await set(STORE_KEY, all);
  await setActiveDevDeskId(item.id);
}

export async function deleteDevDeskItem(id: string): Promise<void> {
  const all = await listDevDeskItems();
  const next = all.filter((i) => i.id !== id);
  await set(STORE_KEY, next);
  const active = await getActiveDevDeskId();
  if (active === id) {
    await setActiveDevDeskId(next.length > 0 ? next[0].id : null);
  }
}

export async function getActiveDevDeskId(): Promise<string | null> {
  try {
    const active = await get<string>(ACTIVE_KEY);
    return active || null;
  } catch {
    return null;
  }
}

export async function setActiveDevDeskId(id: string | null): Promise<void> {
  try {
    if (id) {
      await set(ACTIVE_KEY, id);
    } else {
      await del(ACTIVE_KEY);
    }
  } catch {}
}

