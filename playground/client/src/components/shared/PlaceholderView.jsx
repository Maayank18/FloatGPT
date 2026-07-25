import React from 'react';

// Placeholder View for unfinished pages
export const PlaceholderView = ({ title, icon: Icon }) => (
  <div className="flex-1 flex flex-col items-center justify-center bg-bg">
    <div className="w-12 h-12 rounded-2xl bg-panel border border-card-border flex items-center justify-center mb-6">
      <Icon className="w-6 h-6 text-text-muted" />
    </div>
    <h2 className="text-lg font-medium mb-2">{title}</h2>
    <p className="text-text-muted text-[13px]">This module is under construction.</p>
  </div>
);
