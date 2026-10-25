import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import type { ScreenSharePrivacyState } from '../../electron.d';

const EMPTY: ScreenSharePrivacyState = {
  excludeFromCapture: false,
  manuallyHidden: false,
  supported: false,
  windowsBuild: null,
  status: 'off',
  externalCaptureVerified: false,
  restoreShortcut: 'Ctrl+Shift+H',
  summonShortcut: 'Ctrl+Shift+Space',
  detail: 'Off.',
};

function description(state: ScreenSharePrivacyState): string {
  if (!state.supported) {
    return 'This PC cannot hide FloatGPT from screen share. It needs Windows 10 version 2004 or later. FloatGPT stays on your screen either way.';
  }
  if (state.status === 'unsupported') {
    return 'Screen-share protection could not be applied. FloatGPT is still on your screen and still usable.';
  }
  if (state.excludeFromCapture && state.status === 'enabling') {
    return 'Turning on. FloatGPT stays on your screen and keeps working.';
  }
  if (state.excludeFromCapture) {
    return 'On. You still see and use FloatGPT. Windows screen shares and recordings should leave it out. Some capture tools can still include it.';
  }
  return 'Off. You still see FloatGPT, and a screen share can show it too.';
}

export function ScreenSharePrivacyControls() {
  const api = typeof window !== 'undefined' ? window.electronAPI?.screenSharePrivacy : undefined;
  const [state, setState] = useState<ScreenSharePrivacyState>(EMPTY);

  useEffect(() => {
    if (!api) return;
    let alive = true;
    api.getState().then((next) => {
      if (alive && next) setState(next);
    }).catch(() => {});
    const unsubscribe = api.onState((next) => {
      if (next) setState(next);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [api]);

  if (!api) {
    return (
      <div className="flex items-center justify-between p-4 bg-card">
        <div className="flex gap-3">
          <div className="mt-0.5 w-6 h-6 rounded bg-accent/10 flex items-center justify-center shrink-0">
            <Shield className="w-3.5 h-3.5 text-accent" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-primary">Hide from screen share</p>
            <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed pr-4">
              Available in the Windows app. Turn it on there and FloatGPT stays on your screen while screen shares leave it out.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const active = state.excludeFromCapture && state.status !== 'unsupported';
  const disabled = !state.supported;

  const toggle = () => {
    if (disabled) return;
    api.setExcludeFromCapture(!state.excludeFromCapture).then(setState).catch(() => {});
  };

  return (
    <div className="flex items-center justify-between p-4 bg-card hover:bg-bg-secondary/50 transition-colors">
      <div className="flex gap-3">
        <div className="mt-0.5 w-6 h-6 rounded bg-accent/10 flex items-center justify-center shrink-0">
          <Shield className="w-3.5 h-3.5 text-accent" />
        </div>
        <div>
          <p className="text-xs font-bold text-text-primary" id="screen-share-privacy-label">Hide from screen share</p>
          <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed pr-4" aria-live="polite">
            {description(state)}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-pressed={active}
        aria-labelledby="screen-share-privacy-label"
        className={`w-9 h-5 rounded-full relative transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0 ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${active ? 'bg-accent' : 'bg-card-border hover:bg-text-muted/30'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
