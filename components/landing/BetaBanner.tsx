'use client';

import React from 'react';

const BetaBanner: React.FC = () => {
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-orange-500/95 backdrop-blur-sm border-b border-orange-400/30">
      <div className="container-custom py-1">
        <div className="flex items-center justify-center space-x-4">
          {/* Beta Badge */}
          <div className="flex items-center space-x-2 px-3 py-1 bg-white/20 rounded-full">
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <span className="text-white text-sm font-heading tracking-wide font-semibold">BETA</span>
          </div>
          
          {/* Separator */}
          <div className="w-px h-4 bg-white/30"></div>
          
          {/* Message */}
          <div className="flex items-center space-x-2">
            <span className="text-white text-base font-heading font-bold">Early Access:</span>
            <span className="text-white text-base font-body font-bold">
              Be part of a mission to make every khutba understood.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BetaBanner;
