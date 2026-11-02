import assert from 'node:assert/strict';
import { admitFile, kindForFile } from './shelf';
import { blocksFromXml, readDocx } from './docx';

assert.equal(admitFile(15, 0, 10), 'Flowtion holds 15 items. Remove one to add another.');
assert.equal(admitFile(1, 0, 9 * 1024 * 1024), 'That file is over 8 MB. Keep a smaller copy.');
assert.equal(admitFile(1, 39 * 1024 * 1024, 2 * 1024 * 1024), 'Flowtion is full at 40 MB. Remove something first.');
assert.equal(admitFile(1, 100, 200), null);

assert.equal(kindForFile(new File(['x'], 'photo.png', { type: 'image/png' })), 'image');
assert.equal(kindForFile(new File(['x'], 'old.doc', { type: 'application/msword' })), 'doc');
assert.equal(kindForFile(new File(['x'], 'note.docx', { type: '' })), 'docx');

const xml = `<?xml version="1.0"?><w:document><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Launch notes</w:t></w:r></w:p>
<w:p><w:r><w:t>Ship the </w:t></w:r><w:r><w:t>demo.</w:t></w:r></w:p>
</w:body></w:document>`;
const blocks = blocksFromXml(xml);
assert.equal(blocks[0].heading, true);
assert.equal(blocks[0].text, 'Launch notes');
assert.equal(blocks[1].text, 'Ship the demo.');

function storedZip(name: string, content: Uint8Array): Uint8Array {
  const nameBytes = new TextEncoder().encode(name);
  const out = new Uint8Array(30 + nameBytes.length + content.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(8, 0, true);
  view.setUint32(18, content.length, true);
  view.setUint32(22, content.length, true);
  view.setUint16(26, nameBytes.length, true);
  out.set(nameBytes, 30);
  out.set(content, 30 + nameBytes.length);
  return out;
}

function streamedZip(name: string, packed: Uint8Array, method: number): Uint8Array {
  const nameBytes = new TextEncoder().encode(name);
  const localLen = 30 + nameBytes.length;
  const descLen = 16;
  const centralAt = localLen + packed.length + descLen;
  const centralLen = 46 + nameBytes.length;
  const out = new Uint8Array(centralAt + centralLen + 22);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(6, 0x0008, true);
  view.setUint16(8, method, true);
  view.setUint16(26, nameBytes.length, true);
  out.set(nameBytes, 30);
  out.set(packed, localLen);
  view.setUint32(localLen + packed.length, 0x08074b50, true);
  view.setUint32(localLen + packed.length + 8, packed.length, true);
  view.setUint32(centralAt, 0x02014b50, true);
  view.setUint16(centralAt + 10, method, true);
  view.setUint32(centralAt + 20, packed.length, true);
  view.setUint16(centralAt + 28, nameBytes.length, true);
  view.setUint32(centralAt + 42, 0, true);
  out.set(nameBytes, centralAt + 46);
  const end = centralAt + centralLen;
  view.setUint32(end, 0x06054b50, true);
  view.setUint16(end + 8, 1, true);
  view.setUint16(end + 10, 1, true);
  view.setUint32(end + 12, centralLen, true);
  view.setUint32(end + 16, centralAt, true);
  return out;
}

async function run() {
  const stored = await readDocx(storedZip('word/document.xml', new TextEncoder().encode(xml)));
  assert.equal(stored[1].text, 'Ship the demo.');

  const { deflateRawSync } = await import('node:zlib');
  const packed = new Uint8Array(deflateRawSync(Buffer.from(xml)));
  const streamed = await readDocx(streamedZip('word/document.xml', packed, 8));
  assert.equal(streamed[0].text, 'Launch notes');
  assert.equal(streamed[1].text, 'Ship the demo.');

  assert.deepEqual(await readDocx(new Uint8Array([1, 2, 3])), []);
  console.log('flowtion tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
