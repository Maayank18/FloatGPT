import assert from 'node:assert/strict';
import { CREATOR_ANSWER, creatorAnswer } from './creatorAnswer';

for (const question of [
  'who is the founder of floatgpt',
  'who is the owner?',
  'whose vision is behind FloatGPT',
  'who created you',
  'who built this app',
  'what is the vision behind floatgpt',
  'who is Mayank Garg',
  'floatgpt kisne banaya',
]) {
  assert.equal(creatorAnswer(question), CREATOR_ANSWER, question);
}

for (const question of [
  'who created the indian flag',
  'who owns this file',
  'who founded google',
  'open edge',
]) {
  assert.equal(creatorAnswer(question), null, question);
}

console.log('creator answer tests passed');
