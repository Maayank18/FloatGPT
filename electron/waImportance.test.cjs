const assert = require('node:assert/strict');
const { assessNotice } = require('./waImportance.cjs');

const direct = assessNotice({
  jid: '919800000000@s.whatsapp.net',
  text: 'The payment is due today',
  pushName: 'Priya',
  id: '1'
});
assert.equal(direct.important, true);
assert.equal(direct.from, 'Priya');

const namedGroup = assessNotice({ jid: '120363425713599557@g.us', text: 'urgent', pushName: 'Launch jobs' });
assert.equal(namedGroup.from, 'Launch jobs');
const unnamedChannel = assessNotice({ jid: '120363425713599557@newsletter', text: 'A new role', pushName: '120363425713599557' });
assert.equal(unnamedChannel.from, 'WhatsApp channel');
assert.equal(assessNotice({ jid: '120363425713599557@lid', text: 'hello', pushName: '120363425713599557' }).from, 'WhatsApp group');
assert.equal(assessNotice({ jid: 'status@broadcast', text: 'hello' }), null);
assert.equal(assessNotice({ jid: '9198@s.whatsapp.net', fromMe: true, text: 'urgent' }), null);
assert.equal(assessNotice({ jid: '9198@s.whatsapp.net', text: '   ' }), null);

const plain = assessNotice({ jid: '9198@s.whatsapp.net', text: 'See you at 5' });
assert.equal(plain.important, false);

console.log('whatsapp importance tests passed');
