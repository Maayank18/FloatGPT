import React from 'react';
import '../site/orbStage.css';

const TURN = 46;
const WORDS = ['omnipresent', 'always there', 'chat', 'plan', 'image', 'text'];

export const OrbStage = ({ version = '2.3.1' }) => {
  const step = TURN / WORDS.length;

  return (
  <figure className="orb-stage" aria-label={`FloatGPT version ${version || '2.3.1'}`}>
    <div className="orb-deck">
      <div className="orb-spot" />
      <img className="orb-plate orb-plate-dark" src={`/stage-dark.png?v=${version || '2.3.1'}`} alt="" />
      <img className="orb-plate orb-plate-light" src={`/stage-light.png?v=${version || '2.3.1'}`} alt="" />
      <img className="orb-dial orb-dial-dark" src="/dial-dark.png" alt="" />
      <div className="orb-dial orb-dial-light">
        <img src="/dial-light.png" alt="" />
      </div>
      {WORDS.map((word, index) => (
        <span key={word} className="orb-mark" style={{ animationDelay: `${index * -step}s` }}>
          {word}
        </span>
      ))}
      <div className="orb-hover">
        <div className="orb-yaw">
          <img className="orb-face" src="/logo-2-chat-circular.png" alt="" />
          <img className="orb-face orb-face-back" src="/logo-2-chat-circular.png" alt="" />
        </div>
      </div>
    </div>
    <figcaption>Version {version || '2.3.1'}</figcaption>
  </figure>
  );
};
