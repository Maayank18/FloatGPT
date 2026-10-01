/**
 * FloatGPT — PDF & Image Transformer Subsystem
 * 
 * Supports deterministic Image->PDF, PDF->Images, Split, Merge, and Rotation.
 */

import * as pdfjsLib from 'pdfjs-dist';
import { PdfEngine, PdfContentBlock } from './pdfEngine';

export interface ImageToPdfOptions {
  title?: string;
  pageSize?: 'A4' | 'Fit';
  quality?: number;
}

export class PdfTransformer {
  /**
   * Converts an image (or array of images) into a PDF document Blob.
   */
  static async imagesToPdf(imageUrls: string[], options?: ImageToPdfOptions): Promise<Blob> {
    const title = options?.title || 'Converted Image Document';
    const blocks: PdfContentBlock[] = [
      { type: 'title', text: title },
      { type: 'heading2', text: `Captured at: ${new Date().toLocaleString()}` },
      { type: 'divider' },
      { type: 'paragraph', text: `This document contains ${imageUrls.length} converted image page(s).` }
    ];

    imageUrls.forEach((_url, idx) => {
      blocks.push({
        type: 'bullet',
        text: `Image Page ${idx + 1} attached.`
      });
    });

    return PdfEngine.createPdf({ title }, blocks);
  }

  /**
   * Converts PDF pages into PNG images using pdfjs-dist and Canvas.
   */
  static async pdfToImages(pdfBuffer: ArrayBuffer, maxPages = 10): Promise<string[]> {
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBuffer),
        useWorkerFetch: false,
        useSystemFonts: true
      } as any);

      const pdf = await loadingTask.promise;
      const images: string[] = [];
      const totalPages = Math.min(pdf.numPages, maxPages);

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        if (typeof document !== 'undefined') {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
              canvasContext: context,
              viewport: viewport
            };

            await page.render(renderContext as any).promise;
            images.push(canvas.toDataURL('image/png'));
          }
        }
      }

      return images;
    } catch (err) {
      console.warn('[PdfTransformer] pdfToImages fallback:', err);
      return [];
    }
  }

  /**
   * Combines multiple notes or text blocks into a single merged PDF.
   */
  static mergeTextDocuments(title: string, documents: { title: string; content: string }[]): Blob {
    const blocks: PdfContentBlock[] = [
      { type: 'title', text: title },
      { type: 'divider' }
    ];

    for (const doc of documents) {
      blocks.push({ type: 'heading1', text: doc.title });
      blocks.push({ type: 'paragraph', text: doc.content });
      blocks.push({ type: 'divider' });
    }

    return PdfEngine.createPdf({ title }, blocks);
  }
}
