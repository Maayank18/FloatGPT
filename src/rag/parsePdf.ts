import { isReadableProse, itemsToPageText, type PdfTextItem } from './pdfLines';

export { itemsToPageText, isReadableProse } from './pdfLines';

async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }
  return pdfjsLib;
}

const MAX_PAGES = 120;
const MAX_CHARS = 400_000;

function pdfjsAsset(folder: string): string | undefined {
  if (typeof window === 'undefined' || !window.location?.origin) return undefined;
  return `${window.location.origin}/pdfjs/${folder}/`;
}

export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

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
    if (isReadableProse(cleaned)) return cleaned;
    console.warn('[RAG] PDF text was not readable prose.');
  } catch (err) {
    console.warn('[RAG] PDF text extraction failed:', err instanceof Error ? err.message : err);
  }

  return '';
}
