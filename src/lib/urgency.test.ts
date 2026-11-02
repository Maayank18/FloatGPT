import assert from 'node:assert/strict';
import { urgencyPercent, shortDeadlineLabel } from './time';

const now = Date.parse('2026-10-26T21:41:00');

assert.equal(urgencyPercent(now + 19 * 60 * 1000, now), 68, '19 minutes left fills most of the hour');
assert.equal(urgencyPercent(now + 60 * 60 * 1000, now), 0, 'a full hour left is the start of the bar');
assert.equal(urgencyPercent(now - 60 * 1000, now), 100, 'overdue fills the bar');
assert.equal(shortDeadlineLabel(now + 19 * 60 * 1000, now), '19m left');
assert.equal(shortDeadlineLabel(now - 2 * 60 * 1000, now), '2m over');
assert.equal(shortDeadlineLabel(now + 10 * 1000, now), 'now');

console.log('urgency tests passed');
