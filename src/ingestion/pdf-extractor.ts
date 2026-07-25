import * as pdfjsLib from 'pdfjs-dist';

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Extracts text from a PDF securely in the browser.
 */
export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  // Limit to first 20 pages to avoid blowing up memory/tokens
  const maxPages = Math.min(pdf.numPages, 20);
  
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
  }
  
  if (pdf.numPages > 20) {
     fullText += `\n... (Truncated. Only first 20 pages processed for efficiency) ...`;
  }

  return fullText;
}
