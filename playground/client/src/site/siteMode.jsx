import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ModeCut } from './ModeCut';

const KEY = 'floatgpt_site_mode';
const MODES = ['boring', 'creative'];
const SiteModeContext = createContext(null);

const readMode = () => {
  try {
    const saved = localStorage.getItem(KEY);
    return MODES.includes(saved) ? saved : 'boring';
  } catch {
    return 'boring';
  }
};

const applyMode = (mode) => {
  document.documentElement.dataset.site = mode;
};

const COVER_MS = 460;
const HOLD_MS = 340;
const REVEAL_MS = 520;

const motionReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const SiteModeProvider = ({ children }) => {
  const [mode, setModeState] = useState(() => {
    const next = readMode();
    applyMode(next);
    return next;
  });
  const [cut, setCut] = useState(null);
  const modeRef = useRef(mode);
  const cutRef = useRef(null);
  const timers = useRef([]);

  useEffect(() => {
    if (!MODES.includes(mode)) {
      setModeState('boring');
      return;
    }
    modeRef.current = mode;
    applyMode(mode);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      // The choice still applies for this visit.
    }
  }, [mode]);

  useEffect(() => () => {
    timers.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const later = (fn, ms) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  };

  const setMode = (next) => {
    const target = MODES.includes(next) ? next : 'boring';
    if (target === modeRef.current || cutRef.current) return;
    if (motionReduced()) {
      modeRef.current = target;
      setModeState(target);
      return;
    }
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    cutRef.current = target;
    setCut({ target, phase: 'in' });
    later(() => {
      modeRef.current = target;
      setModeState(target);
      setCut({ target, phase: 'hold' });
    }, COVER_MS);
    later(() => {
      setCut({ target, phase: 'out' });
    }, COVER_MS + HOLD_MS);
    later(() => {
      cutRef.current = null;
      setCut(null);
    }, COVER_MS + HOLD_MS + REVEAL_MS);
  };

  return (
    <SiteModeContext.Provider value={{ mode, creative: mode === 'creative', setMode }}>
      {children}
      <ModeCut cut={cut} />
    </SiteModeContext.Provider>
  );
};

export const useSiteMode = () => {
  const value = useContext(SiteModeContext);
  if (!value) throw new Error('useSiteMode must be used inside SiteModeProvider');
  return value;
};
