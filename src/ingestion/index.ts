import { useAppStore } from '../state/store';
import { KnowledgeSource } from '../types';
import { NotificationBus } from '../services/notifications';
import { extractPdfText } from './pdf-extractor';
import { extractImageBase64 } from './image-extractor';
import { extractAudioTranscript } from './audio-extractor';
import { chunkText } from '../knowledge/chunker';
import { indexSource } from '../knowledge/search-index';
import { DocumentLibrary } from '../rag';

export const IngestionService = {
  /**
   * Processes an uploaded file (PDF, Doc, Text, Image, Audio), extracts its content, 
   * chunks it, indexes it, and saves it to the unified `knowledge` state.
   */
  async ingestFile(file: File): Promise<void> {
    const store = useAppStore.getState();
    const sourceId = store.generateId();
    
    try {
      let type: 'pdf' | 'image' | 'audio' | 'text' = 'text';
      let content = '';

      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const mime = (file.type || '').toLowerCase();

      // Determine type reliably via MIME or Extension
      if (mime === 'application/pdf' || ext === 'pdf') {
        type = 'pdf';
      } else if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) {
        type = 'image';
      } else if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
        type = 'audio';
      } else {
        type = 'text';
      }

      // Create optimistic source in store
      const newSource: KnowledgeSource = {
        id: sourceId,
        filename: file.name,
        type,
        status: 'processing',
        content: '',
        mimeType: file.type || `application/${ext}`,
        sizeBytes: file.size,
        createdAt: Date.now(),
        pinned: true
      };

      store.setState(prev => ({
        ...prev,
        knowledge: [newSource, ...(prev.knowledge || []).filter(k => k.filename !== file.name)]
      }));

      // Extract based on type
      if (type === 'pdf') {
        content = await extractPdfText(file);
      } else if (type === 'text') {
        content = await file.text();
      } else if (type === 'image') {
        content = await extractImageBase64(file);
      } else if (type === 'audio') {
        content = await extractAudioTranscript(file);
      }

      const plain = String(content || '').replace(/--- Page \d+ ---/g, '').replace(/\s+/g, ' ').trim();
      if (plain.length < 40) {
        store.setState(prev => ({
          ...prev,
          knowledge: prev.knowledge?.map(k => k.id === sourceId ? { ...k, status: 'error' as const, content: '' } : k)
        }));
        NotificationBus.notify('Could not read file', `${file.name} did not contain readable text.`, 'info');
        return;
      }

      // Chunk and Index if textual
      let chunks = undefined;
      if (type === 'pdf' || type === 'text' || type === 'audio') {
        chunks = chunkText(sourceId, content);
      }

      const updatedSource: KnowledgeSource = {
        ...newSource,
        content,
        chunks,
        status: 'ready' as const
      };

      // Update store
      store.setState(prev => ({
        ...prev,
        knowledge: prev.knowledge?.map(k => k.id === sourceId ? updatedSource : k)
      }));

      // Index chunks for fast local search
      if (chunks && chunks.length > 0) {
        indexSource(updatedSource);
      }

      NotificationBus.notify('File Ingested', `${file.name} ready for retrieval.`, 'success');
      
    } catch (err: any) {
      console.error('Ingestion Error:', err);
      NotificationBus.notify('Ingestion Notice', `Using fallback text parser for ${file.name}.`, 'info');
      
      // Fallback text extraction on any error
      try {
        const rawText = await file.text();
        const fallbackSource: KnowledgeSource = {
          id: sourceId,
          filename: file.name,
          type: 'text',
          status: 'ready',
          content: rawText || `Document: ${file.name}`,
          mimeType: file.type,
          sizeBytes: file.size,
          createdAt: Date.now(),
          pinned: true,
          chunks: chunkText(sourceId, rawText || file.name)
        };

        store.setState(prev => ({
          ...prev,
          knowledge: prev.knowledge?.map(k => k.id === sourceId ? fallbackSource : k)
        }));

        indexSource(fallbackSource);
      } catch {
        store.setState(prev => ({
          ...prev,
          knowledge: prev.knowledge?.map(k => k.id === sourceId ? { ...k, status: 'error' } : k)
        }));
      }
    }
  },

  /**
   * Removes a knowledge source from the active state.
   */
  removeSource(sourceId: string): void {
    DocumentLibrary.remove(sourceId);
  },

  /**
   * Clears all knowledge sources for the active session.
   */
  clearAll(): void {
    DocumentLibrary.clear();
  }
};
