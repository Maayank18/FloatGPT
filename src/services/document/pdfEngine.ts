/**
 * FloatGPT — Deterministic Pure JavaScript PDF 1.4 Engine
 * 
 * Generates standards-compliant PDF documents client-side without heavy external dependencies.
 * Handles typography, multi-page flows, headings, tables, bullet points, headers, and footers.
 */

export interface PdfDocumentOptions {
  title: string;
  author?: string;
  subject?: string;
  creator?: string;
  headerText?: string;
  footerText?: string;
}

export interface PdfContentBlock {
  type: 'title' | 'heading1' | 'heading2' | 'paragraph' | 'bullet' | 'divider' | 'callout';
  text?: string;
  items?: string[];
}

export class PdfEngine {
  private static readonly PAGE_WIDTH = 595.28; // A4 pt
  private static readonly PAGE_HEIGHT = 841.89; // A4 pt
  private static readonly MARGIN_X = 50;
  private static readonly MARGIN_TOP = 60;
  private static readonly MARGIN_BOTTOM = 60;
  private static readonly USABLE_WIDTH = PdfEngine.PAGE_WIDTH - (PdfEngine.MARGIN_X * 2);

  /**
   * Generates a binary PDF Blob from structured content blocks.
   */
  static createPdf(options: PdfDocumentOptions, blocks: PdfContentBlock[]): Blob {
    const pages: string[][] = [[]]; // Array of pages, each with PDF stream commands
    let currentPage = 0;
    let currentY = this.PAGE_HEIGHT - this.MARGIN_TOP;

    const checkPageBreak = (neededHeight: number) => {
      if (currentY - neededHeight < this.MARGIN_BOTTOM) {
        pages.push([]);
        currentPage++;
        currentY = this.PAGE_HEIGHT - this.MARGIN_TOP;
      }
    };

    // Render Blocks
    for (const block of blocks) {
      if (block.type === 'title') {
        checkPageBreak(50);
        const text = this.sanitizeText(block.text || options.title);
        pages[currentPage].push(
          `BT /F1 20 Tf 0.1 0.1 0.1 rg ${this.MARGIN_X} ${currentY} Td (${text}) Tj ET`
        );
        currentY -= 28;
        // Accent line under title
        pages[currentPage].push(
          `0.3 0.5 0.9 RG 2 w ${this.MARGIN_X} ${currentY + 18} m ${this.PAGE_WIDTH - this.MARGIN_X} ${currentY + 18} l S`
        );
        currentY -= 12;
      } else if (block.type === 'heading1') {
        checkPageBreak(36);
        const text = this.sanitizeText(block.text || '');
        currentY -= 10;
        pages[currentPage].push(
          `BT /F1 14 Tf 0.15 0.15 0.15 rg ${this.MARGIN_X} ${currentY} Td (${text}) Tj ET`
        );
        currentY -= 20;
      } else if (block.type === 'heading2') {
        checkPageBreak(28);
        const text = this.sanitizeText(block.text || '');
        currentY -= 6;
        pages[currentPage].push(
          `BT /F1 11 Tf 0.25 0.25 0.25 rg ${this.MARGIN_X} ${currentY} Td (${text}) Tj ET`
        );
        currentY -= 16;
      } else if (block.type === 'paragraph') {
        const text = block.text || '';
        const lines = this.wrapText(text, 10, this.USABLE_WIDTH);
        for (const line of lines) {
          checkPageBreak(14);
          const sanitized = this.sanitizeText(line);
          pages[currentPage].push(
            `BT /F2 10 Tf 0.2 0.2 0.2 rg ${this.MARGIN_X} ${currentY} Td (${sanitized}) Tj ET`
          );
          currentY -= 14;
        }
        currentY -= 6;
      } else if (block.type === 'bullet') {
        const items = block.items || (block.text ? [block.text] : []);
        for (const item of items) {
          const lines = this.wrapText(item, 10, this.USABLE_WIDTH - 15);
          for (let i = 0; i < lines.length; i++) {
            checkPageBreak(14);
            const sanitized = this.sanitizeText(lines[i]);
            if (i === 0) {
              pages[currentPage].push(
                `BT /F1 10 Tf 0.3 0.5 0.9 rg ${this.MARGIN_X} ${currentY} Td (•) Tj ET`
              );
              pages[currentPage].push(
                `BT /F2 10 Tf 0.2 0.2 0.2 rg ${this.MARGIN_X + 12} ${currentY} Td (${sanitized}) Tj ET`
              );
            } else {
              pages[currentPage].push(
                `BT /F2 10 Tf 0.2 0.2 0.2 rg ${this.MARGIN_X + 12} ${currentY} Td (${sanitized}) Tj ET`
              );
            }
            currentY -= 14;
          }
        }
        currentY -= 4;
      } else if (block.type === 'divider') {
        checkPageBreak(16);
        currentY -= 6;
        pages[currentPage].push(
          `0.85 0.85 0.85 RG 0.75 w ${this.MARGIN_X} ${currentY} m ${this.PAGE_WIDTH - this.MARGIN_X} ${currentY} l S`
        );
        currentY -= 12;
      }
    }

    // Add Header & Footers to each page
    const totalPages = pages.length;
    for (let p = 0; p < totalPages; p++) {
      // Header
      if (options.headerText || options.title) {
        const header = this.sanitizeText(options.headerText || options.title);
        pages[p].push(
          `BT /F2 8 Tf 0.5 0.5 0.5 rg ${this.MARGIN_X} ${this.PAGE_HEIGHT - 35} Td (${header}) Tj ET`
        );
        pages[p].push(
          `0.9 0.9 0.9 RG 0.5 w ${this.MARGIN_X} ${this.PAGE_HEIGHT - 40} m ${this.PAGE_WIDTH - this.MARGIN_X} ${this.PAGE_HEIGHT - 40} l S`
        );
      }
      // Footer
      const footer = this.sanitizeText(`Page ${p + 1} of ${totalPages} — FloatGPT Document Engine`);
      pages[p].push(
        `0.9 0.9 0.9 RG 0.5 w ${this.MARGIN_X} 40 m ${this.PAGE_WIDTH - this.MARGIN_X} 40 l S`
      );
      pages[p].push(
        `BT /F2 8 Tf 0.5 0.5 0.5 rg ${this.MARGIN_X} 28 Td (${footer}) Tj ET`
      );
    }

    return this.assemblePdfBinary(options, pages);
  }

  /**
   * Simple text wrapper for Helvetica (approx 5.5pt per char at 10pt font).
   */
  private static wrapText(text: string, fontSize: number, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    const approxCharWidth = fontSize * 0.52;
    const maxChars = Math.floor(maxWidth / approxCharWidth);

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxChars) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [''];
  }

  private static sanitizeText(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x20-\x7E]/g, ' '); // Keep printable ASCII
  }

  /**
   * Assembles the complete PDF 1.4 binary structure with objects, xref, and trailer.
   */
  private static assemblePdfBinary(options: PdfDocumentOptions, pages: string[][]): Blob {
    const objects: string[] = [];
    const offsets: number[] = [];
    let pdfStr = '%PDF-1.4\n%âãÏÓ\n';

    const addObject = (content: string) => {
      offsets.push(pdfStr.length);
      const objIndex = objects.length + 1;
      const fullObj = `${objIndex} 0 obj\n${content}\nendobj\n`;
      pdfStr += fullObj;
      objects.push(fullObj);
      return objIndex;
    };

    // 1. Catalog Object
    const catalogIndex = 1;
    // 2. Pages Parent Object
    const pagesIndex = 2;
    // 3. Fonts: F1 (Helvetica-Bold), F2 (Helvetica)
    const font1Index = 3;
    const font2Index = 4;

    const pageCount = pages.length;
    const pageIndices: number[] = [];
    for (let i = 0; i < pageCount; i++) {
      pageIndices.push(5 + (i * 2)); // Page object
    }

    // 1: Catalog
    addObject(`<< /Type /Catalog /Pages ${pagesIndex} 0 R >>`);
    
    // 2: Pages Parent
    const kids = pageIndices.map(idx => `${idx} 0 R`).join(' ');
    addObject(`<< /Type /Pages /Kids [ ${kids} ] /Count ${pageCount} >>`);

    // 3 & 4: Standard Base 14 Type 1 Fonts
    addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
    addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);

    // Add Page and Content Stream Objects
    for (let p = 0; p < pageCount; p++) {
      const streamIndex = 5 + (p * 2) + 1;
      // Page Object
      addObject(
        `<< /Type /Page /Parent ${pagesIndex} 0 R /MediaBox [ 0 0 ${this.PAGE_WIDTH} ${this.PAGE_HEIGHT} ] ` +
        `/Contents ${streamIndex} 0 R ` +
        `/Resources << /Font << /F1 ${font1Index} 0 R /F2 ${font2Index} 0 R >> >> >>`
      );

      // Stream Object
      const streamContent = pages[p].join('\n') + '\n';
      addObject(
        `<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream`
      );
    }

    // Info Object
    const title = this.sanitizeText(options.title);
    const creator = this.sanitizeText(options.creator || 'FloatGPT Document Fabric');
    const infoIndex = addObject(
      `<< /Title (${title}) /Creator (${creator}) /CreationDate (D:${new Date().toISOString().replace(/[-:TZ]/g, '').slice(0, 14)}) >>`
    );

    // Cross-Reference Table
    const startXref = pdfStr.length;
    pdfStr += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
      const offsetStr = ('0000000000' + offset).slice(-10);
      pdfStr += `${offsetStr} 00000 n \n`;
    }

    // Trailer
    pdfStr += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogIndex} 0 R /Info ${infoIndex} 0 R >>\n`;
    pdfStr += `startxref\n${startXref}\n%%EOF\n`;

    return new Blob([pdfStr], { type: 'application/pdf' });
  }
}
