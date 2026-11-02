export type DocBlock = { heading: boolean; text: string };

const LOCAL = 0x04034b50;

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function blocksFromXml(xml: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  const paragraphs = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
  for (const paragraph of paragraphs) {
    const style = (paragraph.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/) || [])[1] || '';
    const bits = paragraph.match(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/g) || [];
    const text = decodeXml(bits.map((bit) => bit.replace(/<[^>]+>/g, '')).join('')).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    blocks.push({ heading: /^heading/i.test(style), text: text.slice(0, 2000) });
  }
  return blocks;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const stream = new DecompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    await writer.write(bytes);
    await writer.close();
    const out = await new Response(stream.readable).arrayBuffer();
    return new Uint8Array(out);
  } catch {
    return null;
  }
}

const CENTRAL = 0x02014b50;
const END = 0x06054b50;

async function unpack(data: Uint8Array, method: number, start: number, size: number): Promise<Uint8Array | null> {
  if (start < 0 || start + size > data.length) return null;
  const slice = data.subarray(start, start + size);
  if (method === 0) return slice;
  if (method === 8) return inflateRaw(slice);
  return null;
}

async function fromCentralDirectory(data: Uint8Array, view: DataView, wanted: string): Promise<Uint8Array | null | undefined> {
  const floor = Math.max(0, data.length - 22 - 0xffff);
  let end = -1;
  for (let at = data.length - 22; at >= floor; at -= 1) {
    if (view.getUint32(at, true) === END) { end = at; break; }
  }
  if (end < 0) return undefined;
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  for (let index = 0; index < count && at + 46 <= data.length; index += 1) {
    if (view.getUint32(at, true) !== CENTRAL) return undefined;
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(data.subarray(at + 46, at + 46 + nameLen));
    if (name === wanted) {
      if (local + 30 > data.length || view.getUint32(local, true) !== LOCAL) return null;
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      return unpack(data, method, start, size);
    }
    at += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

export async function zipEntry(data: Uint8Array, wanted: string): Promise<Uint8Array | null> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length >= 22) {
    const found = await fromCentralDirectory(data, view, wanted);
    if (found !== undefined) return found;
  }
  let offset = 0;
  while (offset + 30 <= data.length) {
    if (view.getUint32(offset, true) !== LOCAL) return null;
    const method = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    if (nameStart + nameLen + extraLen > data.length) return null;
    const name = new TextDecoder().decode(data.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + size;
    if (dataEnd > data.length) return null;
    if (name === wanted) return unpack(data, method, dataStart, size);
    offset = dataEnd;
  }
  return null;
}

export async function readDocx(bytes: Uint8Array): Promise<DocBlock[]> {
  const xmlBytes = await zipEntry(bytes, 'word/document.xml');
  if (!xmlBytes) return [];
  return blocksFromXml(new TextDecoder().decode(xmlBytes));
}
