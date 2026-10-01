import { AppState, KnowledgeSource } from '../types';
import { detectGlanceIntent } from '../context/glanceIntent';
import { detectLocalOsIntent } from '../platform/osLaunch';
import { detectSystemDiagIntent } from '../platform/osDiagnostics';
import { detectMediaIntent } from '../platform/osMedia';
import { rankChunks } from './search';

const EXCERPT_CHARS = 1600;
const PACK_CHARS = 9000;

/**
 * Screen, RAM, open-app, and media requests must not be answered from a PDF.
 * Every other question can use a document the user kept.
 */
function readyPinned(state: AppState): KnowledgeSource[] {
  const dismissed = new Set(state.dismissedKnowledgeIds || []);
  return (state.knowledge || []).filter((source) => (
    source.status === 'ready'
    && source.pinned
    && !dismissed.has(source.id)
    && source.type !== 'image'
    && ((source.chunks && source.chunks.length > 0) || (source.content && !source.content.startsWith('data:')))
  ));
}

const FILE_QUESTION = /\b(pinned file|this (pdf|file|document)|my (pdf|resume|cv|file|document)|the (pdf|resume|document)|in the (file|pdf|document)|codeword|attached (file|pdf|document)|uploaded (file|pdf))\b/i;

/**
 * A question about a file, when nothing is pinned, stays a closed-file answer.
 * It must not turn into a search of the desktop.
 */
export function closedFileReply(query: string, state: AppState): string | null {
  const text = String(query || '').trim();
  if (!FILE_QUESTION.test(text)) return null;
  if (detectGlanceIntent(text).wantsGlance) return null;
  if (detectLocalOsIntent(text)) return null;
  if (detectSystemDiagIntent(text)) return null;
  if (detectMediaIntent(text)) return null;
  if (readyPinned(state).length > 0) return null;
  const hadFile = (state.knowledge || []).some((source) => source.status === 'ready') || (state.dismissedKnowledgeIds || []).length > 0;
  if (hadFile) {
    return 'That file is closed. Pin it again if you want an answer from it. A closed file is not treated as still open.';
  }
  return 'No file is open in this chat. Pin a PDF first, then ask again.';
}

export function shouldSearchDocuments(query: string, state: AppState): boolean {
  const ready = readyPinned(state).length > 0;
  if (!ready) return false;
  const text = String(query || '').trim();
  if (!text) return false;
  if (detectGlanceIntent(text).wantsGlance) return false;
  if (detectLocalOsIntent(text)) return false;
  if (detectSystemDiagIntent(text)) return false;
  if (detectMediaIntent(text)) return false;
  return true;
}

function earlierTurns(transcript: { role?: string; content?: string }[] | undefined, query: string): string {
  return (transcript || [])
    .filter((message) => message?.content && message.content !== query)
    .slice(-6)
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${String(message.content).slice(0, 280)}`)
    .join('\n');
}

function opening(source: KnowledgeSource): string {
  const body = String(source.content || '')
    .replace(/--- Page \d+ ---/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return body.slice(0, 700);
}

/**
 * Build the document pack for this question.
 * Follow-up questions also search using the recent turns of the same chat.
 */
export function documentContext(
  query: string,
  state: AppState,
  transcript?: { role?: string; content?: string }[]
): string {
  if (!shouldSearchDocuments(query, state)) return '';

  const sources = readyPinned(state);
  if (sources.length === 0) return '';

  const earlier = earlierTurns(transcript && transcript.length > 0 ? transcript : state.messages, query);
  const chunks = rankChunks(query, sources, 6, earlier);
  if (chunks.length === 0 && sources.every((source) => !source.content)) return '';

  const lines = [
    'LOADED DOCUMENTS',
    'Answer from these excerpts when the question is about a loaded file. Quote details that are actually written there, and name the page. If the excerpts do not contain the answer, say the file does not include it. Do not invent employers, dates, numbers, or quotes.',
  ];

  for (const source of sources) {
    const pages = new Set((source.chunks || []).map((chunk) => chunk.pageNumber).filter(Boolean));
    lines.push(`- ${source.filename}${pages.size ? ` (${pages.size} page section${pages.size === 1 ? '' : 's'} indexed)` : ''}`);
    const intro = opening(source);
    if (intro) lines.push(`Opening of ${source.filename}: ${intro}`);
  }

  let used = lines.join('\n').length;
  chunks.forEach((chunk, index) => {
    const source = sources.find((item) => item.id === chunk.sourceId);
    const name = source?.filename || 'Document';
    const page = chunk.pageNumber ? ` page ${chunk.pageNumber}` : '';
    let text = chunk.text;
    if (text.length > EXCERPT_CHARS) text = `${text.slice(0, EXCERPT_CHARS)}…`;
    const block = `\n[Excerpt ${index + 1} | ${name}${page}]\n${text}`;
    if (used + block.length > PACK_CHARS) return;
    used += block.length;
    lines.push(block);
  });

  return lines.join('\n');
}
