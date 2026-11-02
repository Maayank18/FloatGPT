import assert from 'node:assert/strict';
import { imageKeysFromState, renderDrawnImage } from './imagePainter';
import type { ReferenceHit } from './referenceImage';

assert.deepEqual(imageKeysFromState({ settings: { aiConfig: { selectedProvider: 'openai', apiKeys: { openai: 'sk-test' } } } }), {});

let lookups = 0;
const house = await renderDrawnImage('a house', undefined, async () => {
  lookups += 1;
  return null;
});
assert.equal(lookups, 0);
assert.ok(house.includes('image.pollinations.ai'));
assert.match(decodeURIComponent(house), /No people/);

const missed = await renderDrawnImage('lord rama', undefined, async () => null);
assert.ok(missed.includes('image.pollinations.ai'));
assert.equal(/no people/i.test(decodeURIComponent(missed)), false);

const hit: ReferenceHit = {
  thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/rama.jpg',
  pageUrl: 'https://commons.wikimedia.org/wiki/File:Rama_painting.jpg',
  artist: 'Unknown',
  license: 'Public domain'
};
const found = await renderDrawnImage('lord rama', undefined, async () => hit);
assert.ok(found.includes('https://upload.wikimedia.org/wikipedia/commons/thumb/rama.jpg'));
assert.match(found, /Wikimedia Commons/);
assert.equal(found.includes('pollinations'), false);
assert.equal(found.includes('api.openai.com'), false);

console.log('image painter tests passed');
