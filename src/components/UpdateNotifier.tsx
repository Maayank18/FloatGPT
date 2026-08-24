import React, { useEffect, useState } from 'react';
import { Sparkles, Download, X, ArrowRight } from 'lucide-react';
import { checkFloatGPTUpdate, UpdateInfo, CURRENT_VERSION } from '../lib/updateService';

interface UpdateNotifierProps {
  onUpdateClick?: (url: string) => void;
  className?: string;
}

export const UpdateNotifier: React.FC<UpdateNotifierProps> = ({ onUpdateClick, className = '' }) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check on initial load
    let timer: any;
    let autoDismissTimer: any;

    checkFloatGPTUpdate().then((info) => {
      if (info && info.hasUpdate) {
        setUpdateInfo(info);
        setIsVisible(true);

        // Auto-vanish strictly after 5 seconds to prevent disturbance
        autoDismissTimer = setTimeout(() => {
          setIsVisible(false);
        }, 5000);
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      if (autoDismissTimer) clearTimeout(autoDismissTimer);
    };
  }, []);

  if (!isVisible || !updateInfo) return null;

  const handleUpdate = () => {
    if (onUpdateClick) {
      onUpdateClick(updateInfo.releaseUrl);
    } else if (typeof window !== 'undefined' && (window as any).electronAPI?.openExternal) {
      (window as any).electronAPI.openExternal(updateInfo.releaseUrl);
    } else {
      window.open(updateInfo.releaseUrl, '_blank');
    }
    setIsVisible(false);
  };

  return (
    <div 
      className={`fixed top-4 right-4 z-[10000] max-w-[360px] w-[90%] bg-panel/95 backdrop-blur-2xl border border-accent/40 rounded-2xl shadow-2xl p-3.5 animate-in fade-in slide-in-from-top-3 duration-300 font-sans select-none overflow-hidden ${className}`}
      style={{ pointerEvents: 'auto' }}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-accent animate-pulse" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-text-primary truncate">
              {updateInfo.title}
            </h4>
            <button 
              onClick={() => setIsVisible(false)}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-card-border/40 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-text-muted mt-0.5 leading-snug">
            {updateInfo.message}
          </p>

          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={handleUpdate}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-accent hover:bg-accent-hover active:bg-accent-active text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Update Now</span>
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="py-1.5 px-2.5 text-[11px] text-text-muted hover:text-text-primary hover:bg-card-border/30 rounded-lg transition-colors cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>
      </div>

      {/* 5-second disappearing progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent/20 overflow-hidden">
        <div 
          className="h-full bg-accent transition-all linear"
          style={{
            width: '100%',
            animation: 'update-vanish 5s linear forwards'
          }}
        />
      </div>

      <style>{`
        @keyframes update-vanish {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};
