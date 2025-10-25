'use client'

import React from 'react'

const LogoIcon: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id="faceFront" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1"/>
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.8"/>
        </linearGradient>
        <linearGradient id="faceSide" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.5"/>
        </linearGradient>
        <linearGradient id="faceTop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.4"/>
        </linearGradient>
      </defs>

      {/* Front face */}
      <polygon points="128,160 128,384 256,448 256,224" fill="url(#faceFront)"/>
      
      {/* Side face */}
      <polygon points="256,224 256,448 384,384 384,160" fill="url(#faceSide)"/>
      
      {/* Top face */}
      <polygon points="128,160 256,224 384,160 256,96" fill="url(#faceTop)"/>
    </svg>
  );
};

interface LogoBrandProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'subtle' | 'minimal';
  className?: string;
}

const LogoBrand: React.FC<LogoBrandProps> = ({ 
  size = 'md', 
  variant = 'default',
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8', 
    lg: 'h-10 w-10'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const variantClasses = {
    default: 'text-accent-400',
    subtle: 'text-neutral-200',
    minimal: 'text-neutral-400'
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <LogoIcon className={`${sizeClasses[size]} ${variantClasses[variant]} drop-shadow-sm`} />
      <span className={`${textSizeClasses[size]} font-heading ${variantClasses[variant]} drop-shadow-sm hidden md:inline`}>
        MinbarAI.com
      </span>
    </div>
  );
};

export default LogoBrand;
