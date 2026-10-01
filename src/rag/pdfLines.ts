export type PdfTextItem = {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
};

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
