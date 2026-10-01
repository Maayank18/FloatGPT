import assert from 'node:assert/strict';
import { chooseHeardSpeech } from './heardSpeech';

const question = 'who is the president of India currently';
assert.equal(chooseHeardSpeech(question, 'Float'), question);
assert.equal(chooseHeardSpeech(question, 'Hey Float, Hey Flow, zoom in, scroll down'), question);
assert.equal(chooseHeardSpeech('', 'hey float'), '');
assert.equal(chooseHeardSpeech('hey float who is the president of India currently', ''), question);
assert.equal(chooseHeardSpeech('', 'who is the president of India currently'), question);

console.log('heard speech tests passed');
