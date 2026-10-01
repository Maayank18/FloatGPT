import assert from 'node:assert/strict';
import { routeCommand, isModelSlash } from './commandRouter';
import { missingSlashHelp, slashSubject } from './index';
import { buildCommandResponse } from './responseBuilders';

const summary = routeCommand('/tldr the launch plan');
assert.equal(summary.isCommand, true);
assert.equal(summary.command, 'summary');
assert.equal(summary.strippedPrompt, 'the launch plan');

assert.equal(isModelSlash('/rewrite open settings'), true);
assert.equal(isModelSlash('/note buy milk'), false);
assert.equal(isModelSlash('/pdf weekly update'), false);
assert.equal(isModelSlash('open settings'), false);

const subject = slashSubject('summary', '', [
  { role: 'user', content: 'We shipped the Windows build.' },
  { role: 'assistant', content: 'The Mac build stays on the previous version.' }
]);
assert.ok(subject?.includes('Mac build'));
assert.equal(slashSubject('diagram', '', []), null);

const diagram = buildCommandResponse('diagram', 'graph TD\n  A-->B');
assert.ok(diagram.startsWith('```mermaid'));
assert.equal(diagram.includes('```mermaid\n```mermaid'), false);

const line = buildCommandResponse('one-liner', '"First sentence."\nAnd a second paragraph that should not remain.');
assert.equal(line, 'First sentence.');

const table = buildCommandResponse('table', 'Here you go:\n| A | B |\n| --- | --- |\n| 1 | 2 |\nThanks');
assert.ok(table.startsWith('| A |'));
assert.equal(table.includes('Thanks'), false);

const translated = routeCommand('/tr hi the build is ready');
assert.equal(translated.command, 'translate');
assert.equal(translated.strippedPrompt, 'hi the build is ready');
assert.equal(isModelSlash('/translate hi kitni ram use ho rahi hai'), true);
assert.equal(isModelSlash('/email open settings'), true);

const hindi = slashSubject('translate', 'hi the build is ready', []);
assert.ok(hindi?.startsWith('Target language: Hindi'));
assert.ok(hindi?.includes('the build is ready'));
assert.equal(slashSubject('translate', 'the build is ready', []), null);

const fromLast = slashSubject('translate', 'to English', [
  { role: 'assistant', content: 'Build kal ready hai.' }
]);
assert.ok(fromLast?.includes('Target language: English'));
assert.ok(fromLast?.includes('Build kal ready hai.'));

const trailing = slashSubject('translate', 'ship it to Priya in hindi', []);
assert.ok(trailing?.startsWith('Target language: Hindi'));
assert.ok(trailing?.includes('ship it to Priya'));
assert.equal(trailing?.includes('in hindi'), false);

const mail = routeCommand('/draft tell Priya the Windows build is ready');
assert.equal(mail.command, 'email');
const emailAlone = slashSubject('email', '', [
  { role: 'user', content: 'tell Priya the build is ready tomorrow' }
]);
assert.ok(emailAlone?.includes('Priya'));
assert.equal(slashSubject('email', '', []), null);
assert.ok(missingSlashHelp('translate').includes('/translate hi'));
assert.ok(missingSlashHelp('email').includes('Nothing is sent'));

const cleanTranslation = buildCommandResponse('translate', "Here's the translation: Build is ready.\n\nNote: informal");
assert.equal(cleanTranslation, 'Build is ready.');

const cleanEmail = buildCommandResponse('email', "Here's your draft:\n**Subject:** Build is ready\n\nHello Priya,\n\nThe build is ready.\n\nBest regards");
assert.ok(cleanEmail.startsWith('Subject: Build is ready'));
assert.equal(cleanEmail.includes("Here's your draft"), false);

console.log('slash command tests passed');
