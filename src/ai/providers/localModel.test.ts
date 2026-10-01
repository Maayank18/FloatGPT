import assert from 'node:assert/strict';
import { LOCAL_MODEL_ID, localFailureMessage, localModelSetupMessage, resolveChatRoute } from './localModel';

const local = resolveChatRoute({
  requestedProvider: 'groq',
  poolProviderId: 'groq',
  primaryKey: ''
});
assert.equal(local.local, true);
assert.equal(local.providerId, 'ollama');
assert.equal(local.model, LOCAL_MODEL_ID);

const chosen = resolveChatRoute({
  requestedProvider: 'ollama',
  poolProviderId: 'groq',
  primaryKey: 'gsk_real_key'
});
assert.equal(chosen.local, true);
assert.equal(chosen.model, 'qwen3.5:9b');

const cloud = resolveChatRoute({
  requestedProvider: 'groq',
  poolProviderId: 'groq',
  primaryKey: 'gsk_real_key'
});
assert.equal(cloud.local, false);
assert.equal(cloud.providerId, 'groq');
assert.equal(cloud.apiKey, 'gsk_real_key');

const playground = resolveChatRoute({
  requestedProvider: 'groq',
  overrideProviderId: 'groq',
  overrideApiKey: 'gsk_playground',
  poolProviderId: 'groq',
  primaryKey: ''
});
assert.equal(playground.local, false);
assert.equal(playground.apiKey, 'gsk_playground');

assert.ok(localModelSetupMessage().includes('ollama pull qwen3.5:9b'));
assert.ok(localModelSetupMessage().includes('npm run dev'));
assert.ok(localFailureMessage('AI Service Error\nThe local model took too long to answer.').includes('did not answer in time'));
assert.ok(localFailureMessage('fetch failed').includes('ollama pull qwen3.5:9b'));

console.log('local model route tests passed');
