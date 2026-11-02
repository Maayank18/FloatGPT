import { isReadableProse, itemsToPageText, type PdfTextItem } from './pdfLines';

export { itemsToPageText, isReadableProse } from './pdfLines';

async function loadPdfjs() {
  // The legacy build runs inside Electron. The current build's worker does not.
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (typeof window !== 'undefined' && window.location?.origin) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdfjs/pdf.worker.min.mjs`;
  }
  return pdfjsLib;
}

export type PdfRead = { text: string; note: string };

const MAX_PAGES = 120;
const MAX_CHARS = 400_000;

function pdfjsAsset(folder: string): string | undefined {
  if (typeof window === 'undefined' || !window.location?.origin) return undefined;
  return `${window.location.origin}/pdfjs/${folder}/`;
}

export async function extractPdfText(file: File): Promise<string> {
  const read = await readPdf(file);
  return read.text;
}

/** Read the words from a PDF. `note` explains an empty result. */
export async function readPdf(file: File): Promise<PdfRead> {
  if (!file || file.size < 5) {
    return { text: '', note: 'That file was empty. Remove it and add the PDF again.' };
  }
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    return { text: '', note: 'The PDF could not be opened. Remove it and add it again.' };
  }

  try {
    const pdfjsLib = await loadPdfjs();
    const cMapUrl = pdfjsAsset('cmaps');
    const standardFontDataUrl = pdfjsAsset('standard_fonts');
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer.slice(0)),
      useWorkerFetch: false,
      cMapUrl,
      cMapPacked: true,
      standardFontDataUrl,
    });

    const pdf = await loadingTask.promise;
    const pageCount = Math.min(pdf.numPages, MAX_PAGES);
    let fullText = '';
    let itemCount = 0;

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      itemCount += textContent.items.length;
      const pageText = itemsToPageText(textContent.items as PdfTextItem[]);
      if (pageText) fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      if (fullText.length >= MAX_CHARS) break;
    }

    if (pdf.numPages > pageCount) {
      fullText += `\n[Stopped after ${pageCount} of ${pdf.numPages} pages.]\n`;
    }

    const cleaned = fullText.trim().slice(0, MAX_CHARS);
    if (isReadableProse(cleaned)) return { text: cleaned, note: '' };
    if (itemCount === 0) {
      return { text: '', note: 'This PDF has no selectable text. A scan cannot be searched.' };
    }
    return { text: '', note: 'The words in this PDF could not be read. Remove it and add it again.' };
  } catch (err) {
    console.warn('[RAG] PDF text extraction failed:', err instanceof Error ? err.message : err);
    return { text: '', note: 'The PDF could not be opened. Remove it and add it again.' };
  }
}
