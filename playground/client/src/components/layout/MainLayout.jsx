import React from 'react';

export const MainLayout = ({ rightPanel, children }) => {
  return (
    <div className="flex flex-col h-screen bg-[#05050A] text-text-primary overflow-hidden selection:bg-accent/30 font-sans text-[13px] relative">
      {/* Haoqi-inspired Grid Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#ffffff1a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff1a_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      
      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col h-full w-full">
        {children}
      </div>
      
      {/* Persistent Settings Panel */}
      <div className="relative z-50">
        {rightPanel}
      </div>
    </div>
  );
};
