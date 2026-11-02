import assert from 'node:assert/strict';
import { chatReplyBudget, wantsLongAnswer, wantsSpokenAnswer } from './answerShape';

const spoken = [
  'speak the answer',
  'can you dictate the answer please',
  'say it out loud',
  'read the answer aloud',
  'bol do',
];
const quiet = [
  'what is a closure',
  'is this true or false',
  'what is the meaning of latency',
  "don't speak the answer",
  'do not dictate the answer',
];

for (const line of spoken) assert.equal(wantsSpokenAnswer(line), true, line);
for (const line of quiet) assert.equal(wantsSpokenAnswer(line), false, line);

assert.equal(wantsLongAnswer('what does mutex mean'), false);
assert.equal(wantsLongAnswer('what is a function'), false);
assert.equal(wantsLongAnswer('explain this in detail'), true);
assert.equal(wantsLongAnswer('how does TCP work'), true);
assert.equal(wantsLongAnswer('why is this slow'), true);
assert.equal(wantsLongAnswer('what is TCP'), false);
assert.equal(wantsLongAnswer('write the code for closed islands'), true);
assert.equal(chatReplyBudget('is recursion true or false here').maxTokens, 280);
assert.equal(chatReplyBudget('implement the function').maxTokens, 1200);

console.log('answer shape tests passed');
