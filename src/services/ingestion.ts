import { useAppStore } from '../lib/store';
import { KnowledgeSource } from '../types';
import { NotificationBus } from './notifications';
import * as pdfjsLib from 'pdfjs-dist';

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export const IngestionService = {
  /**
   * Processes an uploaded file (Image, Text, PDF), extracts its content, 
   * and saves it to the unified `knowledge` state.
   */
  async ingestFile(file: File): Promise<void> {
    try {
      let content = '';

      if (file.type === 'application/pdf') {
        content = await this.extractPdfText(file);
      } else if (file.type.startsWith('text/')) {
        content = await file.text();
      } else if (file.type.startsWith('image/')) {
        // We store the base64 URL directly as content for vision models
        content = await this.fileToBase64(file);
      } else {
        throw new Error(`Unsupported file type: ${file.type}`);
      }

      const store = useAppStore.getState();
      const newSource: KnowledgeSource = {
        id: store.generateId(),
        filename: file.name,
        content: content,
        mimeType: file.type,
        sizeBytes: file.size,
        createdAt: Date.now()
      };

      store.setState(prev => ({
        ...prev,
        knowledge: [newSource, ...(prev.knowledge || [])]
      }));

      NotificationBus.notify('File Ingested', `${file.name} added to FloatGPT knowledge base.`, 'success');
      
    } catch (err: any) {
      console.error('Ingestion Error:', err);
      NotificationBus.notify('Ingestion Failed', err.message || 'Could not process file.', 'error');
    }
  },

  /**
   * Reads a file and returns its Data URL (base64 string).
   */
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Extracts text from a PDF securely in the browser.
   */
  async extractPdfText(file: File): Promise<string> {
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
};
