import React from 'react';

export const MainLayout = ({ sidebar, rightPanel, children }) => {
  return (
    <div className="flex h-screen bg-bg text-text-primary overflow-hidden selection:bg-accent/30 font-sans text-[13px]">
      {sidebar}
      {children}
      {rightPanel}
    </div>
  );
};
