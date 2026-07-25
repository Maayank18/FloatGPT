import { useAppStore } from '../state/store';
import { KnowledgeSource } from '../types';
import { NotificationBus } from '../services/notifications';
import { extractPdfText } from './pdf-extractor';
import { extractImageBase64 } from './image-extractor';
import { extractAudioTranscript } from './audio-extractor';
import { chunkText } from '../knowledge/chunker';
import { indexSource } from '../knowledge/search-index';

export const IngestionService = {
  /**
   * Processes an uploaded file (Image, Text, PDF), extracts its content, 
   * chunks it, indexes it, and saves it to the unified `knowledge` state.
   */
  async ingestFile(file: File): Promise<void> {
    try {
      const store = useAppStore.getState();
      const sourceId = store.generateId();
      
      let type: 'pdf' | 'image' | 'audio' | 'text' = 'text';
      let content = '';

      // Determine type
      if (file.type === 'application/pdf') type = 'pdf';
      else if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('audio/')) type = 'audio';
      else type = 'text';

      // Create optimistic source in store
      const newSource: KnowledgeSource = {
        id: sourceId,
        filename: file.name,
        type,
        status: 'processing',
        content: '',
        mimeType: file.type,
        sizeBytes: file.size,
        createdAt: Date.now()
      };

      store.setState(prev => ({
        ...prev,
        knowledge: [newSource, ...(prev.knowledge || [])]
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
      } else {
        throw new Error(`Unsupported file type: ${file.type}`);
      }

      // Chunk and Index if textual
      let chunks = undefined;
      if (type === 'pdf' || type === 'text' || type === 'audio') {
        chunks = chunkText(sourceId, content);
      }

      const updatedSource = {
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

      // Index chunks for search
      if (chunks && chunks.length > 0) {
        indexSource(updatedSource);
      }

      NotificationBus.notify('File Ingested', `${file.name} added to knowledge base and indexed.`, 'success');
      
    } catch (err: any) {
      console.error('Ingestion Error:', err);
      NotificationBus.notify('Ingestion Failed', err.message || 'Could not process file.', 'error');
      
      // Update store to error state
      const store = useAppStore.getState();
      store.setState(prev => ({
        ...prev,
        knowledge: prev.knowledge?.map(k => k.filename === file.name && k.status === 'processing' ? { ...k, status: 'error' } : k)
      }));
    }
  }
};
