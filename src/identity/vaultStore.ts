import { get, set } from 'idb-keyval';
import { EMPTY_VAULT, IdentityVault, normalizeVault } from './vault.types';

const KEY = 'floatgpt_identity_vault';

export async function loadIdentityVault(): Promise<IdentityVault> {
  try {
    if (typeof indexedDB === 'undefined') return { ...EMPTY_VAULT };
    const raw = await get(KEY);
    return normalizeVault(raw);
  } catch {
    return { ...EMPTY_VAULT };
  }
}

export async function saveIdentityVault(vault: IdentityVault): Promise<void> {
  const next = normalizeVault(vault);
  if (typeof indexedDB === 'undefined') return;
  await set(KEY, next);
}
