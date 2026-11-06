import React from 'react';

const CUTS = {
  boring: { tone: 'to-boring', kicker: 'FC · 01 · STUDIO', line: 'back to the studio' },
  creative: { tone: 'to-creative', kicker: 'FC · 02 · PAPER', line: 'the page turns' },
};

export const ModeCut = ({ cut }) => {
  if (!cut) return null;
  const card = CUTS[cut.target] || CUTS.boring;
  return (
    <div
      className={`mode-cut mode-cut--${cut.phase} ${card.tone}`}
      role="status"
      aria-live="polite"
    >
      <div className="mode-cut-panel">
        <div className="mode-cut-grain" aria-hidden="true" />
        <div className="mode-cut-scan" aria-hidden="true" />
        <span className="mode-cut-bar mode-cut-bar-top" aria-hidden="true" />
        <span className="mode-cut-bar mode-cut-bar-bottom" aria-hidden="true" />
        <div className="mode-cut-copy">
          <p className="mode-cut-kicker">{card.kicker}</p>
          <p className="mode-cut-word">{cut.target}</p>
          <p className="mode-cut-line">{card.line}</p>
        </div>
      </div>
    </div>
  );
};
