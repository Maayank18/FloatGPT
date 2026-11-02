import assert from 'node:assert/strict';
import { combineCounts } from '../playground/client/api/_installStore.mjs';

const base = combineCounts();
assert.equal(base.win, 29, 'two button downloads sit on top of the earlier 27');
assert.equal(base.previousWin, 29, 'the included total is 29');
assert.equal(base.recordedWin, 0, 'no new click is stored yet');

const afterClick = combineCounts({}, { win: 1 });
assert.equal(afterClick.win, 30, 'one Download click adds one');
assert.equal(combineCounts({ win: 5 }, {}).win, 29, 'opening the app does not change the download number');

console.log('download count tests passed');
