import React from 'react';
import { useAppStore } from '../../state/store';
import { FileText, Image, FileAudio, File, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { IngestionService } from '../../ingestion';

export function UploadManager() {
  const knowledge = useAppStore(state => state.state.knowledge || []);
  
  if (knowledge.length === 0) return null;

  // Let's just show the 3 most recently active uploads to avoid cluttering UI
  const recentKnowledge = [...knowledge].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);

  const getIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-3.5 h-3.5" />;
      case 'image': return <Image className="w-3.5 h-3.5" />;
      case 'audio': return <FileAudio className="w-3.5 h-3.5" />;
      default: return <File className="w-3.5 h-3.5" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing': return <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />;
      case 'ready': return <CheckCircle2 className="w-3.5 h-3.5 text-accent" />;
      case 'error': return <AlertCircle className="w-3.5 h-3.5 text-danger" />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col gap-2 mt-2">
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1">Knowledge Sources</span>
      <div className="flex flex-wrap gap-2">
        {recentKnowledge.map(source => (
          <div key={source.id} className="flex items-center gap-2 bg-panel border border-card-border rounded-lg px-2.5 py-1.5 max-w-[200px] group shadow-sm transition-all hover:border-text-muted/30">
            <div className="text-text-muted shrink-0">
              {getIcon(source.type)}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[10px] font-medium text-text-primary truncate">
                {source.filename}
              </span>
              <span className="text-[8px] text-text-muted">
                {source.status === 'ready' && source.chunks ? `${source.chunks.length} chunks indexed` : source.status}
              </span>
            </div>
            <div className="shrink-0 ml-1">
              {getStatusIcon(source.status)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
