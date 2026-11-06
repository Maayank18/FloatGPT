import React from 'react';
import { useSiteMode } from './siteMode';

const MODES = [
  ['boring', 'boring'],
  ['creative', 'creative'],
];

export const ModeToggle = ({ className = '' }) => {
  const { mode, setMode } = useSiteMode();
  return (
    <div className={`mode-toggle ${className}`} role="group" aria-label="Site style">
      {MODES.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}>
          {label}
        </button>
      ))}
    </div>
  );
};
