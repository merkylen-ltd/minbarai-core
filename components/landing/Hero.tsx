'use client';

import React from 'react';
import ScrollArrow from '../ui/scroll-arrow';

const Hero: React.FC = () => {

  return (
    <section className="section-min-height flex flex-col justify-center items-center text-center relative z-10 px-4 gradient-hero pt-16">
      <div className="container-custom">
        
        <h1 className="font-display text-fluid-4xl text-neutral-0 mb-6">
          <span className="animate-text-reveal inline-block" style={{ animationDelay: '0.2s' }}>
            From the Minbar{' '}
          </span>
          <span 
            className="text-accent-400 animate-arabic-float animate-shimmer animate-pulse-glow inline-block"
            style={{ 
              fontFamily: 'Amiri, Noto Naskh Arabic, Arial',
              direction: 'rtl',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              animationDelay: '0.8s'
            }}
          >
             ٱلْـمِنْبَـرُ
          </span>
          <span className="animate-text-reveal inline-block" style={{ animationDelay: '1.4s' }}>
            {' '}to the World.
          </span>
        </h1>
        
        <p className="font-body text-fluid-lg text-neutral-50 max-w-readable mx-auto mb-10">
          <span className="animate-fade-in-up inline-block" style={{ animationDelay: '2.0s' }}>
            Breaking language barriers for 1.8 billion Muslims instantly, contextually, everywhere.
          </span>
          <span className="block text-accent-300 font-light mt-3 text-sm animate-fade-in-up" style={{ animationDelay: '2.4s' }}>
            Currently in development • Limited features during early access
          </span>
        </p>
        <ScrollArrow targetSelector=".living-sermon-stream" delay="2.8s" />
      </div>
    </section>
  );
};

export default Hero;
