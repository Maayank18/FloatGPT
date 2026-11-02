import assert from 'node:assert/strict';
import { wantsScreenPdf } from './screenPdf';
import { tryFastRoute } from '../ai/fastRouter';

assert.equal(wantsScreenPdf('please can you create pdf of current screen that is present'), true);
assert.equal(wantsScreenPdf('make a pdf of the current screen'), true);
assert.equal(wantsScreenPdf('save this screen as a pdf'), true);
assert.equal(wantsScreenPdf('screen ka pdf bana do'), true);
assert.equal(wantsScreenPdf('/pdf weekly update'), false);
assert.equal(wantsScreenPdf('open the pdf on the desktop'), false);
assert.equal(wantsScreenPdf('what is a pdf'), false);
assert.equal(wantsScreenPdf('create a pdf of my notes'), false);

tryFastRoute('please can you create pdf of current screen that is present', { settings: {} } as any).then((res) => {
  assert.equal(res.handled, true);
  assert.match(res.message || '', /Windows app/);
  assert.equal(res.actionExecuted, 'screen_pdf_unavailable');
  console.log('screen pdf intent checks passed');
});
