import assert from 'node:assert/strict';
import { combineDateAndClock, parseIndianMobile, resolveHomeSchedule, resolveScheduleTarget } from './scheduleDraft';

assert.equal(parseIndianMobile('+919876543210'), '+919876543210');
assert.equal(parseIndianMobile('9876543210'), '+919876543210');
assert.equal(parseIndianMobile('+1 415 555 2671'), 'foreign');
assert.equal(parseIndianMobile('+91123'), 'bad');
assert.equal(parseIndianMobile('Mummy'), null);

const saved = [
  { name: 'Mummy', phone: '+919876543210' },
  { name: 'Adam Sharma', phone: '+919812345678' },
  { name: 'Adam Sharma', phone: '+919800000000' },
  { name: 'Sarah', phone: '+14155552671' }
];

const mummy = resolveScheduleTarget('mummy', saved);
assert.equal(mummy.ok && mummy.phone, '+919876543210');

const clash = resolveScheduleTarget('Adam Sharma', saved);
assert.equal(clash.ok, false);

const foreignName = resolveScheduleTarget('Sarah', saved);
assert.equal(foreignName.ok, false);
assert.match(foreignName.ok ? '' : foreignName.error, /Indian/);

const missing = resolveScheduleTarget('Kanchan', saved);
assert.equal(missing.ok, false);

const direct = resolveScheduleTarget('+91 98765 43210', saved);
assert.equal(direct.ok && direct.phone, '+919876543210');

const digitsOnly = resolveHomeSchedule({ name: '', national: '98765abc43210', saved });
assert.equal(digitsOnly.ok && digitsOnly.phone, '+919876543210');

const shortNumber = resolveHomeSchedule({ name: '', national: '98765', saved });
assert.equal(shortNumber.ok, false);

const threePm = combineDateAndClock('2026-11-01', '3', '05', 'PM');
assert.equal(threePm?.getHours(), 15);
assert.equal(threePm?.getMinutes(), 5);
const threeAm = combineDateAndClock('2026-11-01', '12', '00', 'AM');
assert.equal(threeAm?.getHours(), 0);
assert.equal(combineDateAndClock('2026-11-01', '3', '', 'AM'), null);

console.log('whatsapp schedule draft tests passed');
