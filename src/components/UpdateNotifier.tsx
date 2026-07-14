import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

const CURRENT_VERSION = 'v1.0.0'; // Hardcoded for this template
const REPO_OWNER = 'mayankgarg'; // Replace with actual GitHub username
const REPO_NAME = 'FloatGPT'; // Replace with actual Repo name

export const UpdateNotifier: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [releaseUrl, setReleaseUrl] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check for updates every 12 hours
    const checkForUpdates = async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`);
        if (!response.ok) return;
        
        const data = await response.json();
        const latestTag = data.tag_name;
        
        if (latestTag && latestTag !== CURRENT_VERSION) {
          setLatestVersion(latestTag);
          setReleaseUrl(data.html_url);
          setHasUpdate(true);
        }
      } catch (err) {
        console.error('Failed to check for updates:', err);
      }
    };

    checkForUpdates();
    const interval = setInterval(checkForUpdates, 12 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!hasUpdate || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-panel border border-accent/30 rounded-xl p-4 shadow-2xl shadow-accent/20 animate-in slide-in-from-bottom-5 fade-in duration-500 max-w-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 shrink-0">
          <Download className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 pt-1">
          <h4 className="text-sm font-bold text-text-primary mb-1">Update Available!</h4>
          <p className="text-xs text-text-muted mb-3 leading-relaxed">
            Version <span className="font-mono text-accent">{latestVersion}</span> of FloatGPT is now available. You are currently on <span className="font-mono">{CURRENT_VERSION}</span>.
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                 if (window.electronAPI) {
                    // Open in default browser
                    window.electronAPI.openExternal(releaseUrl);
                 } else {
                    window.open(releaseUrl, '_blank');
                 }
                 setDismissed(true);
              }}
              className="flex-1 bg-accent hover:bg-accent-hover text-white text-xs font-medium py-2 rounded-lg transition-colors text-center"
            >
              Download Update
            </button>
            <button 
              onClick={() => setDismissed(true)}
              className="px-3 py-2 bg-bg hover:bg-card-border text-text-muted hover:text-text-primary text-xs font-medium rounded-lg transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
        <button 
          onClick={() => setDismissed(true)}
          className="text-text-muted hover:text-text-primary transition-colors p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
