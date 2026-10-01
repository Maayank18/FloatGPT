import assert from 'node:assert/strict';
import { normalizeAppState } from '../state/schema';
import { INITIAL_STATE, type KnowledgeSource } from '../types';
import { shouldSearchDocuments, documentContext, closedFileReply } from './retrieve';
import { chunkText } from './chunk';
import { rankChunks } from './search';
import { itemsToPageText } from './pdfLines';
import { buildConversationContext } from '../ai/memory/context';

const oldResume: KnowledgeSource = {
  id: 'old-resume',
  filename: 'Mayank Garg Resume Ved.pdf',
  type: 'pdf',
  status: 'ready',
  content: 'experience',
  mimeType: 'application/pdf',
  createdAt: 1,
  sizeBytes: 10,
};

const kept = { ...oldResume, id: 'kept-notes', filename: 'notes.pdf', pinned: true };

const restored = normalizeAppState({
  ...INITIAL_STATE,
  messages: [{ id: 'm1', role: 'user', content: 'hi', timestamp: 1 }],
  knowledge: [oldResume, kept],
  dismissedKnowledgeIds: [],
});

assert.equal(restored.knowledge.length, 1, 'old unpinned resume must not reload');
assert.equal(restored.knowledge[0].id, 'kept-notes');

const dismissed = normalizeAppState({
  ...INITIAL_STATE,
  messages: [{ id: 'm1', role: 'user', content: 'hi', timestamp: 1 }],
  knowledge: [kept],
  dismissedKnowledgeIds: ['kept-notes'],
});
assert.equal(dismissed.knowledge.length, 0, 'a removed file must stay removed');

const withDoc = {
  ...INITIAL_STATE,
  knowledge: [kept],
};
assert.equal(shouldSearchDocuments('what jobs are listed in my resume', withDoc), true);
assert.equal(shouldSearchDocuments('open settings', withDoc), false);
assert.equal(shouldSearchDocuments('how much ram is used', withDoc), false);

const page = itemsToPageText([
  { str: 'Mayank', transform: [1, 0, 0, 1, 10, 100] },
  { str: 'Garg', transform: [1, 0, 0, 1, 70, 100] },
  { str: 'Engineer', transform: [1, 0, 0, 1, 10, 80] },
]);
assert.equal(page.split('\n')[0], 'Mayank Garg');
assert.ok(page.indexOf('Engineer') > page.indexOf('Mayank'));

const resumeText = [
  '--- Page 1 ---',
  'Mayank Garg. Product designer based in Delhi.',
  '--- Page 2 ---',
  'Experience. Worked at Contoso as a product engineer from 2021 to 2024.',
  '--- Page 3 ---',
  'Skills. TypeScript, React, and Electron.',
].join('\n');
const chunks = chunkText('doc', resumeText);
assert.ok(chunks.some((chunk) => chunk.pageNumber === 2 && chunk.text.includes('Contoso')));
const ranked = rankChunks('which company did he work at', [{
  id: 'doc',
  filename: 'resume.pdf',
  type: 'pdf',
  status: 'ready',
  content: resumeText,
  chunks,
  mimeType: 'application/pdf',
  createdAt: 1,
  sizeBytes: 10,
  pinned: true,
}], 3);
assert.ok(ranked.some((chunk) => chunk.text.includes('Contoso')), 'company question hits the experience section');

const packed = documentContext('which company did he work at', {
  ...withDoc,
  knowledge: [{
    ...kept,
    id: 'doc',
    filename: 'resume.pdf',
    content: resumeText,
    chunks,
  }],
});
assert.ok(packed.includes('Contoso'));
assert.ok(packed.includes('page 2'));

const closed = closedFileReply('What secret codeword is written in the pinned file?', {
  ...INITIAL_STATE,
  knowledge: [{ ...kept, pinned: false, content: 'The secret codeword is LIGHTHOUSE-77.' }],
  dismissedKnowledgeIds: ['kept-notes'],
});
assert.ok(closed && closed.includes('closed'));
assert.equal(closed.includes('LIGHTHOUSE-77'), false);
assert.equal(closedFileReply('open settings', INITIAL_STATE), null);

const now = Date.now();
const thread = Array.from({ length: 20 }, (_, index) => ({
  role: (index % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
  content: index === 0 ? 'My project is called Northstar' : `turn ${index}`,
  timestamp: now,
}));
const remembered = buildConversationContext(thread, 7, 8);
assert.ok(remembered[0].content.includes('Northstar'), 'early facts stay attached to later questions');
assert.ok(remembered[0].content.includes('Earlier in this same chat'));

console.log('rag library tests passed');
