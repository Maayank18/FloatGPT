import assert from 'node:assert/strict';
import { INITIAL_STATE } from '../types';
import { ReflectionService, learnedInsights } from './reflection';
import { applyPulseSensitivity } from './guardian';
import { autoPlanIntent } from '../ai/router';

function freshState() {
  return structuredClone(INITIAL_STATE);
}

const now = Date.now();
const task = {
  id: 't1',
  projectId: 'p1',
  title: 'Write the notes',
  status: 'Completed' as const,
  createdAt: now - 25 * 60 * 1000,
  deadlineAt: now + 60 * 60 * 1000,
};

const empty = learnedInsights(freshState());
assert.equal(empty.focusWindow, 'Unknown');
assert.equal(empty.delayRisk, 'Unknown');
assert.equal(empty.preferredSession, 'Unknown');

const done = ReflectionService.onTaskCompleted(freshState(), task);
const insights = learnedInsights(done);
assert.notEqual(insights.focusWindow, 'Unknown');
assert.equal(insights.preferredSession, '25 min');
assert.equal(insights.delayRisk, 'Low');
assert.equal(done.recommendations.length, 0);

const late = ReflectionService.onTaskCompleted(freshState(), {
  ...task,
  deadlineAt: now - 5 * 60 * 1000,
});
assert.equal(late.recommendations.length, 1);
assert.match(late.recommendations[0].message, /finished after its time/);
assert.equal(late.habitProfile.delayRisk, 'High');

const quiet = freshState();
quiet.settings.features.habitMemory = false;
quiet.settings.features.personalizedRecommendations = false;
const hidden = ReflectionService.onTaskCompleted(quiet, { ...task, deadlineAt: now - 5 * 60 * 1000 });
assert.equal(hidden.habitProfile.focusWindow, 'Unknown');
assert.equal(hidden.recommendations.length, 0);

assert.equal(applyPulseSensitivity('EMERGENCY', 'Low'), 'EMERGENCY');
assert.equal(applyPulseSensitivity('WARNING', 'Low'), 'WATCH');
assert.equal(applyPulseSensitivity('WATCH', 'High'), 'WARNING');
assert.equal(applyPulseSensitivity('WARNING', 'High'), 'CRITICAL');
assert.equal(applyPulseSensitivity('EMERGENCY', 'Muted'), 'SAFE');
assert.equal(applyPulseSensitivity('CRITICAL', 'Normal'), 'CRITICAL');

assert.equal(autoPlanIntent('schedule a meeting with Wispr tomorrow at 5'), 'plan_create');
assert.equal(autoPlanIntent('add a task to buy milk'), 'plan_update');
assert.equal(autoPlanIntent('what is a schedule'), null);
assert.equal(autoPlanIntent('send a scheduled message to Sarah'), null);

console.log('settings behavior checks passed');
