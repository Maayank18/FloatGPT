import { itemsToPageText, type PdfTextItem } from './pdfLines';

export { itemsToPageText } from './pdfLines';

async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    // Main-thread parsing still works when the worker URL cannot be resolved.
  }
  return pdfjsLib;
}

const MAX_PAGES = 60;
const MAX_CHARS = 120_000;

function extractRawPdfText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let rawStr = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    rawStr += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }

  const textSegments: string[] = [];
  const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
  let match: RegExpExecArray | null;
  while ((match = tjRegex.exec(rawStr)) !== null) {
    const clean = match[1]
      .replace(/\\([()\\])/g, '$1')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ')
      .trim();
    if (clean.length > 0) textSegments.push(clean);
  }

  if (textSegments.length > 0) {
    return textSegments.join(' ');
  }
  return '';
}

export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const pdfjsLib = await loadPdfjs();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer.slice(0)),
      useWorkerFetch: false,
      useSystemFonts: true,
    } as any);

    const pdf = await loadingTask.promise;
    const pageCount = Math.min(pdf.numPages, MAX_PAGES);
    let fullText = '';

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = itemsToPageText(textContent.items as PdfTextItem[]);
      if (pageText) fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      if (fullText.length >= MAX_CHARS) break;
    }

    if (pdf.numPages > pageCount) {
      fullText += `\n[Stopped after ${pageCount} of ${pdf.numPages} pages.]\n`;
    }

    const cleaned = fullText.trim().slice(0, MAX_CHARS);
    if (cleaned.replace(/--- Page \d+ ---/g, '').trim().length > 30) {
      return cleaned;
    }
  } catch (err) {
    console.warn('[RAG] PDF text extraction failed, trying a raw read:', err);
  }

  const raw = extractRawPdfText(arrayBuffer).trim();
  return raw ? `--- Page 1 ---\n${raw.slice(0, MAX_CHARS)}` : '';
}
