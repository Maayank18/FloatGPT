import assert from 'node:assert/strict';
import { isExactSlashCommand, slashMenuCommands } from './commandSchemas';

const typed = slashMenuCommands('/im');
assert.equal(typed[0], 'image');
assert.equal(typed.includes('rewrite'), true);
assert.equal(slashMenuCommands('/ima').join(','), 'image');
assert.equal(isExactSlashCommand('/im'), false);
assert.equal(isExactSlashCommand('/ima'), false);
assert.equal(isExactSlashCommand('/image'), true);
assert.equal(isExactSlashCommand('/img'), true);
assert.equal(isExactSlashCommand('/IMAGE'), true);
assert.equal(isExactSlashCommand('/image a tiger'), false);
assert.equal(slashMenuCommands('/').length > 1, true);
assert.equal(slashMenuCommands('/')[0], 'summary');
assert.equal(slashMenuCommands('/nope').length, 0);

console.log('slash menu tests passed');
