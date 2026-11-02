import { del, get, set } from 'idb-keyval';

export const FLOWTION_MAX_ITEMS = 15;
export const FLOWTION_MAX_FILE = 8 * 1024 * 1024;
export const FLOWTION_MAX_TOTAL = 40 * 1024 * 1024;

const INDEX_KEY = 'floatgpt_flowtion_index';

export type FlowKind = 'image' | 'pdf' | 'docx' | 'note';

export type FlowItem = {
  id: string;
  name: string;
  kind: FlowKind;
  mime: string;
  bytes: number;
  createdAt: number;
  title?: string;
  body?: string;
};

function fileKey(id: string): string {
  return `floatgpt_flowtion_file_${id}`;
}

export function admitFile(count: number, total: number, size: number): string | null {
  if (size <= 0) return 'That file was empty.';
  if (size > FLOWTION_MAX_FILE) return 'That file is over 8 MB. Keep a smaller copy.';
  if (count >= FLOWTION_MAX_ITEMS) return 'Flowtion holds 15 items. Remove one to add another.';
  if (total + size > FLOWTION_MAX_TOTAL) return 'Flowtion is full at 40 MB. Remove something first.';
  return null;
}

export function kindForFile(file: File): FlowKind | 'doc' | 'other' {
  const name = file.name.toLowerCase();
  const mime = (file.type || '').toLowerCase();
  if (name.endsWith('.docx') || mime.includes('wordprocessingml')) return 'docx';
  if (name.endsWith('.doc') || mime === 'application/msword') return 'doc';
  if (name.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(name)) return 'image';
  return 'other';
}

async function readIndex(): Promise<FlowItem[]> {
  const stored = await get(INDEX_KEY);
  return Array.isArray(stored) ? stored.filter((item) => item && item.id && item.name) : [];
}

async function writeIndex(items: FlowItem[]): Promise<void> {
  await set(INDEX_KEY, items);
}

export async function listShelf(): Promise<FlowItem[]> {
  const items = await readIndex();
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function shelfCount(): Promise<number> {
  return (await readIndex()).length;
}

export async function addFile(file: File): Promise<{ ok: true; item: FlowItem } | { ok: false; error: string }> {
  const kind = kindForFile(file);
  if (kind === 'doc') return { ok: false, error: 'An older Word file cannot be opened here. Save it as .docx and add that.' };
  if (kind === 'other') return { ok: false, error: 'Choose an image, a PDF, or a Word file.' };
  const items = await readIndex();
  const total = items.reduce((sum, item) => sum + (item.bytes || 0), 0);
  const refused = admitFile(items.length, total, file.size);
  if (refused) return { ok: false, error: refused };
  const id = crypto.randomUUID();
  const item: FlowItem = {
    id,
    name: file.name.slice(0, 120) || 'Untitled',
    kind,
    mime: file.type || (kind === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
    bytes: file.size,
    createdAt: Date.now(),
  };
  await set(fileKey(id), file);
  await writeIndex([item, ...items]);
  return { ok: true, item };
}

export async function addNote(title: string, body: string): Promise<{ ok: true; item: FlowItem } | { ok: false; error: string }> {
  const name = title.replace(/\s+/g, ' ').trim().slice(0, 80);
  const text = body.replace(/\s+$/g, '').slice(0, 8000);
  if (!name && !text.trim()) return { ok: false, error: 'Write a title or a line.' };
  const items = await readIndex();
  const size = new TextEncoder().encode(`${name}\n${text}`).length;
  const total = items.reduce((sum, item) => sum + (item.bytes || 0), 0);
  const refused = admitFile(items.length, total, size);
  if (refused) return { ok: false, error: refused };
  const item: FlowItem = {
    id: crypto.randomUUID(),
    name: name || 'Note',
    kind: 'note',
    mime: 'text/plain',
    bytes: size,
    createdAt: Date.now(),
    title: name || 'Note',
    body: text,
  };
  await writeIndex([item, ...items]);
  return { ok: true, item };
}

export async function saveNote(id: string, title: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const items = await readIndex();
  const current = items.find((item) => item.id === id && item.kind === 'note');
  if (!current) return { ok: false, error: 'That note is no longer on the shelf.' };
  const name = title.replace(/\s+/g, ' ').trim().slice(0, 80);
  const text = body.replace(/\s+$/g, '').slice(0, 8000);
  if (!name && !text.trim()) return { ok: false, error: 'Write a title or a line.' };
  const size = new TextEncoder().encode(`${name}\n${text}`).length;
  const total = items.reduce((sum, item) => sum + (item.id === id ? 0 : (item.bytes || 0)), 0);
  if (size > FLOWTION_MAX_FILE || total + size > FLOWTION_MAX_TOTAL) {
    return { ok: false, error: 'That note is too long for the shelf.' };
  }
  await writeIndex(items.map((item) => item.id === id ? {
    ...item,
    name: name || 'Note',
    title: name || 'Note',
    body: text,
    bytes: size,
  } : item));
  return { ok: true };
}

export async function readFile(id: string): Promise<Blob | null> {
  const stored = await get(fileKey(id));
  if (stored instanceof Blob) return stored;
  return null;
}

export async function removeItem(id: string): Promise<void> {
  await del(fileKey(id));
  const items = await readIndex();
  await writeIndex(items.filter((item) => item.id !== id));
}
