import * as pdfjsLib from 'pdfjs-dist';

// Configure worker with safe local Vite asset resolution
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  // Worker will fall back to main thread fake worker if unsupported
}

/**
 * Fallback binary text extractor that extracts readable text strings directly
 * from PDF streams if pdfjsLib worker fails (e.g. strict CSP / CORS / offline).
 */
function extractRawPdfText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let rawStr = '';
  
  // Convert bytes to string
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    rawStr += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }

  const textSegments: string[] = [];

  // Extract text within PDF text operators: (Text) Tj, (Text) ' , [(Text)-(Text)] TJ
  const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
  let match;
  while ((match = tjRegex.exec(rawStr)) !== null) {
    const clean = match[1]
      .replace(/\\([()\\])/g, '$1')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ')
      .trim();
    if (clean.length > 0) {
      textSegments.push(clean);
    }
  }

  // Extract text in TJ array blocks [(text) -20 (more text)]
  const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
  while ((match = arrayTjRegex.exec(rawStr)) !== null) {
    const inner = match[1];
    const innerRegex = /\(([^)]+)\)/g;
    let innerMatch;
    const arrayParts: string[] = [];
    while ((innerMatch = innerRegex.exec(inner)) !== null) {
      const part = innerMatch[1].replace(/\\([()\\])/g, '$1').trim();
      if (part) arrayParts.push(part);
    }
    if (arrayParts.length > 0) {
      textSegments.push(arrayParts.join(' '));
    }
  }

  if (textSegments.length > 0) {
    return `--- Document Content ---\n${textSegments.join(' ')}`;
  }

  // Last-ditch ASCII word extraction
  const asciiMatches = rawStr.match(/[a-zA-Z0-9.,;:?!@#$%^&*()_+\-=\/\\'"\s]{4,}/g);
  if (asciiMatches && asciiMatches.length > 0) {
    const filtered = asciiMatches
      .filter(w => !w.includes('stream') && !w.includes('endstream') && !w.includes('obj') && !w.includes('endobj') && !w.includes('xref'))
      .map(w => w.trim())
      .filter(w => w.length > 2);
    return `--- Document Content (Extracted) ---\n${filtered.join(' ')}`;
  }

  return 'Could not extract readable text from this PDF.';
}

/**
 * Extracts text from a PDF securely with dual-layer fallback.
 */
export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      useSystemFonts: true
    } as any);

    const pdf = await loadingTask.promise;
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 20);

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ')
        .replace(/\s+/g, ' ');
      fullText += `--- Page ${i} ---\n${pageText.trim()}\n\n`;
    }

    if (fullText.trim().length > 0) {
      return fullText.trim();
    }
  } catch (err) {
    console.warn('[PDF Extractor] Primary PDF worker extraction failed, activating binary stream extractor:', err);
  }

  // Fallback to binary stream parsing
  return extractRawPdfText(arrayBuffer);
}
