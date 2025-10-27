'use client';

import React, { useState } from 'react';
import ScrollArrow from '../ui/scroll-arrow';
import TypingText from '../ui/TypingText';

const Hero: React.FC = () => {
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showScrollArrow, setShowScrollArrow] = useState(false);

  const handleMainTextComplete = React.useCallback(() => {
    setShowSubtitle(true);
  }, []);

  const handleSubtitleComplete = React.useCallback(() => {
    setShowScrollArrow(true);
  }, []);

  return (
    <section className="section-min-height flex flex-col justify-center items-center text-center relative z-10 px-4 gradient-hero pt-16">
      <div className="container-custom hero-text-container">
        
        <h1 className="font-display text-fluid-4xl text-neutral-0 mb-6 leading-relaxed overflow-visible">
          <TypingText
            key="main-text"
            text="From the Minbar ٱلْـمِنْبَـرُ to the World."
            speed={30}
            delay={200}
            className="inline-block align-baseline"
            highlightArabic={true}
            onComplete={handleMainTextComplete}
          />
        </h1>
        
        {showSubtitle && (
          <p className="font-body text-fluid-lg text-neutral-50 max-w-readable mx-auto mb-10">
            <TypingText
              key="subtitle-text"
              text="Breaking language barriers for 1.8 billion Muslims instantly, contextually, everywhere."
              speed={25}
              delay={100}
              className="inline-block"
              onComplete={handleSubtitleComplete}
            />
            <span className="block text-accent-300 font-light mt-3 text-sm animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              Currently in development • Limited features during early access
            </span>
          </p>
        )}
        
        {showScrollArrow && (
          <ScrollArrow targetSelector=".living-sermon-stream" delay="200" />
        )}
      </div>
    </section>
  );
};

export default Hero;
