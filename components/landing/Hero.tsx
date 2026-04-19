'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import ScrollArrow from '../ui/scroll-arrow';
import TypingText from '../ui/TypingText';
import BookADemoButton from './BookADemoButton';

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
        
        <h1 className="font-hero text-fluid-4xl text-neutral-0 mb-6 leading-relaxed overflow-visible">
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
          <>
            <p className="font-body text-fluid-lg text-neutral-50 max-w-readable mx-auto mb-10">
              <TypingText
                key="subtitle-text"
                text="Breaking language barriers for 1.8 billion Muslims instantly, contextually, everywhere."
                speed={25}
                delay={100}
                className="inline-block"
                onComplete={handleSubtitleComplete}
              />
            </p>

            {showScrollArrow && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-8 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <BookADemoButton className="bg-accent-500 hover:bg-accent-400 text-neutral-0 px-8 py-3 rounded-lg font-heading transition-all duration-200 shadow-glow hover:shadow-glow-lg min-h-[44px] sm:min-h-0" />
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center px-8 py-3 rounded-lg border-2 border-accent-500 text-accent-400 hover:bg-accent-500/10 font-heading transition-all duration-200 min-h-[44px] sm:min-h-0"
                >
                  Sign In
                </Link>
              </div>
            )}
          </>
        )}

        {showScrollArrow && (
          <div className="mt-12">
            <ScrollArrow targetSelector=".living-sermon-stream" delay="200" />
          </div>
        )}
      </div>
    </section>
  );
};

export default Hero;
