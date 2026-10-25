export type PdfTextItem = {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
};

/**
 * True when extracted PDF text is prose.
 * A raw PDF byte scrape is long enough to be chunked and still unreadable.
 */
export function isReadableProse(text: string): boolean {
  const body = String(text || '')
    .replace(/--- Page \d+ ---/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (body.length < 40) return false;
  const sample = body.slice(0, 4000);
  if (/%PDF-|endobj|endstream|\/FlateDecode|\/Filter\b|stream\r?\n/.test(sample)) return false;
  let letters = 0;
  let marks = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 32) continue;
    marks++;
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) letters++;
  }
  return marks >= 30 && letters / marks >= 0.55;
}

/** Rebuild lines from PDF coordinates so headings and bullets stay readable. */
export function itemsToPageText(items: PdfTextItem[]): string {
  const rows: { y: number; parts: { x: number; text: string }[] }[] = [];

  for (const item of items) {
    const text = item.str || '';
    if (!text) continue;
    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2.5);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x, text });
  }

  rows.sort((a, b) => b.y - a.y);

  return rows.map((row) => {
    row.parts.sort((a, b) => a.x - b.x);
    return row.parts
      .map((part) => part.text)
      .join(' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }).filter(Boolean).join('\n');
}
