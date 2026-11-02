import assert from 'node:assert/strict';
import { breakDown } from './planBreakdown';

const now = new Date(2026, 10, 1, 12, 0, 0);
const hack = breakDown('if got selected i have a hackathon on the 3rd november so gotch prepare adn rehearse for it', now);

assert.equal(hack.title, 'Hackathon');
assert.equal(hack.steps[0].title, 'Confirm you are selected');
assert.ok(hack.steps.some((step) => step.title === 'Rehearse it once out loud'));
const event = hack.steps[hack.steps.length - 1];
assert.equal(event.title, 'Present at the hackathon');
assert.ok(event.deadlineAt);
const when = new Date(event.deadlineAt as number);
assert.equal(when.getFullYear(), 2026);
assert.equal(when.getMonth(), 10);
assert.equal(when.getDate(), 3);

const interview = breakDown('interview with Priya tomorrow', now);
assert.equal(interview.steps[0].title, 'Read what the interview is for');
assert.ok(interview.steps.length >= 3);

const plain = breakDown('clean the desk', now);
assert.ok(plain.steps.length >= 2);
assert.equal(plain.steps[0].title.includes('clean the desk') || plain.title.toLowerCase().includes('clean'), true);

console.log('plan breakdown tests passed');
