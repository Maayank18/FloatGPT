import assert from 'node:assert/strict';
import { buildImageUrl, composeImagePrompt, finalizeImagePrompt, imageReply, imageSubject } from './imagePrompt';

assert.equal(imageSubject('/image a house'), 'a house');
assert.equal(imageSubject('/img a red house'), 'a red house');
assert.equal(imageSubject('draw a house'), 'a house');
assert.equal(imageSubject('create an image of a house'), 'a house');
assert.equal(imageSubject('open settings'), null);
assert.equal(imageSubject('draw a conclusion about the plan'), null);

const house = composeImagePrompt('a house');
assert.ok(house.startsWith('a house.'));
assert.match(house, /No people/);
assert.equal(/\b(woman|man|portrait of)\b/i.test(house.split('.')[0]), false);

const person = composeImagePrompt('a portrait of a woman in a red coat');
assert.equal(person.includes('No people'), false);
assert.ok(person.startsWith('a portrait of a woman in a red coat.'));

const url = buildImageUrl('a house', 42);
assert.ok(url.includes('enhance=false'));
assert.equal(url.includes('enhance=true'), false);
assert.ok(decodeURIComponent(url).includes('a house'));
assert.ok(decodeURIComponent(url).includes('No people'));

const houseScene = finalizeImagePrompt('house', 'a white house with a red roof and a front garden, daylight');
assert.ok(houseScene.toLowerCase().includes('red roof'));
assert.match(houseScene, /No people/);
assert.equal(/\bwoman\b/i.test(houseScene), false);

const drifted = finalizeImagePrompt('house', 'a smiling woman standing in a garden');
assert.ok(drifted.toLowerCase().startsWith('house'));
assert.match(drifted, /No people/);
assert.equal(/\bwoman\b/i.test(drifted), false);
assert.equal(/\bgarden\b/i.test(drifted), false);

const bird = finalizeImagePrompt('bird', 'a small bird with bright feathers perched on a branch');
assert.ok(bird.toLowerCase().includes('feathers'));
assert.equal(/\bwoman\b/i.test(bird), false);

const portrait = finalizeImagePrompt('a portrait of a woman', 'a portrait of a woman in a red coat');
assert.equal(portrait.includes('No people'), false);

const rama = composeImagePrompt('lord rama');
assert.ok(rama.toLowerCase().startsWith('lord rama.'));
assert.equal(rama.includes('No people'), false);

const ramaScene = finalizeImagePrompt('lord rama', 'lord rama standing in a green forest, bow in hand, rich color');
assert.ok(ramaScene.toLowerCase().includes('bow'));
assert.equal(ramaScene.includes('No people'), false);

assert.equal(imageReply('/image a house'), null);
assert.equal(imageReply('what time is it'), null);
assert.ok(imageReply('/image')?.includes('/image a red house'));
const spoken = imageReply('draw a house');
assert.ok(spoken?.includes('enhance=false'));
assert.ok(spoken?.startsWith('![a house]'));

console.log('image prompt tests passed');
