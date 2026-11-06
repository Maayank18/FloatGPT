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

async function readRawIndex(): Promise<FlowItem[]> {
  const stored = await get(INDEX_KEY);
  return Array.isArray(stored) ? stored.filter((item) => item && item.id && item.name) : [];
}

async function readIndex(): Promise<FlowItem[]> {
  const items = await readRawIndex();
  // Strictly filter out any PreBrief text notes so Flowtion ONLY ever holds the PDF Dossier
  return items.filter(
    (item) => !(item.kind === 'note' && (item.name.toLowerCase().includes('prebrief') || item.title?.toLowerCase().includes('prebrief')))
  );
}

async function writeIndex(items: FlowItem[]): Promise<void> {
  await set(INDEX_KEY, items);
}

export async function cleanupPreBriefTextNotes(): Promise<number> {
  const items = await readRawIndex();
  const textNotes = items.filter(
    (item) => item.kind === 'note' && (item.name.toLowerCase().includes('prebrief') || item.title?.toLowerCase().includes('prebrief'))
  );
  if (textNotes.length === 0) return 0;
  for (const n of textNotes) {
    await del(fileKey(n.id)).catch(() => {});
  }
  const remaining = items.filter((item) => !textNotes.some((tn) => tn.id === item.id));
  await writeIndex(remaining);
  return textNotes.length;
}

export async function listShelf(): Promise<FlowItem[]> {
  await cleanupPreBriefTextNotes().catch(() => {});
  const items = await readIndex();
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function shelfCount(): Promise<number> {
  await cleanupPreBriefTextNotes().catch(() => {});
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

export async function addPdfDocument(filename: string, blob: Blob): Promise<{ ok: true; item: FlowItem } | { ok: false; error: string }> {
  const safeName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  const items = await readIndex();

  // If a PDF with the exact same name already exists, update it rather than duplicating
  const existing = items.find((item) => item.kind === 'pdf' && item.name.toLowerCase() === safeName.toLowerCase());
  if (existing) {
    const updated: FlowItem = {
      ...existing,
      bytes: blob.size,
      createdAt: Date.now(),
    };
    await set(fileKey(existing.id), blob);
    await writeIndex(items.map((it) => (it.id === existing.id ? updated : it)));
    return { ok: true, item: updated };
  }

  const total = items.reduce((sum, item) => sum + (item.bytes || 0), 0);
  const refused = admitFile(items.length, total, blob.size);
  if (refused) return { ok: false, error: refused };
  const id = crypto.randomUUID();
  const item: FlowItem = {
    id,
    name: safeName.slice(0, 120),
    kind: 'pdf',
    mime: 'application/pdf',
    bytes: blob.size,
    createdAt: Date.now(),
  };
  await set(fileKey(id), blob);
  await writeIndex([item, ...items]);
  return { ok: true, item };
}

export async function addNote(title: string, body: string): Promise<{ ok: true; item: FlowItem } | { ok: false; error: string }> {
  const name = title.replace(/\s+/g, ' ').trim().slice(0, 80);
  const text = body.replace(/\s+$/g, '').slice(0, 8000);
  if (!name && !text.trim()) return { ok: false, error: 'Write a title or a line.' };
  if (name.toLowerCase().includes('prebrief')) {
    return { ok: false, error: 'PreBrief briefings are strictly saved as PDF dossiers in Flowtion.' };
  }
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
