const assert = require('node:assert/strict');
const { jpegToPdf, screenPdfName } = require('./screenPdf.cjs');

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const pdf = jpegToPdf(jpeg, 320, 180);
const text = pdf.toString('latin1');

assert.ok(text.startsWith('%PDF-1.4'));
assert.ok(text.includes('/Filter /DCTDecode'));
assert.ok(text.includes('/Width 320'));
assert.ok(text.includes('/Height 180'));
assert.ok(text.includes('startxref'));
assert.ok(text.endsWith('%%EOF\n'));
assert.ok(pdf.includes(jpeg));

const xrefAt = Number(text.match(/startxref\n(\d+)/)[1]);
assert.equal(text.slice(xrefAt, xrefAt + 4), 'xref');

const name = screenPdfName(new Date(2026, 9, 28, 19, 53, 4));
assert.equal(name, 'FloatGPT-Screen-2026-10-28-195304.pdf');

console.log('screen pdf checks passed');
