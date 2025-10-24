'use client';

import React from 'react';

interface ScrollArrowProps {
  targetSelector: string;
  delay?: string;
  className?: string;
}

const ScrollArrow: React.FC<ScrollArrowProps> = ({ 
  targetSelector, 
  delay = '0s',
  className = ''
}) => {
  const handleScrollClick = () => {
    const targetSection = document.querySelector(targetSelector);
    if (targetSection) {
      targetSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  return (
    <div className={`flex justify-center mt-8 animate-fade-in-up ${className}`} style={{ animationDelay: delay }}>
      <button 
        onClick={handleScrollClick}
        className="group text-neutral-400 hover:text-accent-400 transition-colors duration-300"
        aria-label="Scroll to next section"
      >
        <svg 
          className="w-5 h-5 animate-bounce" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M19 14l-7 7m0 0l-7-7m7 7V3" 
          />
        </svg>
      </button>
    </div>
  );
};

export default ScrollArrow;
