'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import ScrollArrow from '../ui/scroll-arrow';

interface PillarProps {
  title: string;
  description: string;
}

const PillarCard: React.FC<PillarProps> = ({ title, description }) => (
  <div className="card h-full flex flex-col min-h-[200px]">
    <h3 className="font-display text-fluid-xl text-neutral-0 mb-4 leading-tight">{title}</h3>
    <p className="text-fluid-sm text-neutral-50 leading-relaxed flex-grow">{description}</p>
  </div>
);

const CorePillars: React.FC = () => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const pillars: PillarProps[] = [
    {
      title: 'AI-Native Intelligence',
      description: 'Our AI aren\'t "bolted on" translators they\'re built for Muslims and Islamic content, preserving meaning in real time.',
    },
    {
      title: 'Effortless Deployment',
      description: 'One admin login per masjed. Zero IT headaches. Live captions anywhere local network or across continents.',
    },
    {
      title: 'Seamless Sharing',
      description: 'Unique session links & QR codes let any device join. No app download, no log-in friction.',
    },
    {
      title: 'Enterprise-Level Security',
      description: 'Link-based access, optional PIN lock, bank-grade encryption. You control who sees what and when.',
    },
  ];

  return (
    <section className="core-pillars section-min-height flex flex-col justify-center section-spacing relative gradient-section">
      <div className="container-custom relative z-10">
        <h2 className="font-display text-fluid-2xl text-neutral-0 text-center mb-fluid-lg">
          Core Pillars
        </h2>
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Pillars in 2x2 Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {pillars.map((pillar) => (
              <PillarCard key={pillar.title} {...pillar} />
            ))}
          </div>
          
          {/* Right Column - Featured Image */}
          <div className="relative flex items-center justify-center lg:justify-end order-first lg:order-last">
            <div className="relative rounded-2xl overflow-hidden gradient-primary gradient-smooth gradient-optimized backdrop-blur-sm border border-primary-600/30 shadow-2xl hover:shadow-glow-lg transition-all duration-500 max-w-md w-full">
              {!imageError ? (
                <>
                  <Image 
                    src="/images/screenshots/MinbarAI_Demo_Live.webp" 
                    alt="MinbarAI Live Demo Interface" 
                    width={500}
                    height={350}
                    className="w-full h-auto rounded-2xl object-contain"
                    priority
                    quality={90}
                    placeholder="blur"
                    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                    onLoad={() => setImageLoading(false)}
                    onError={(e) => {
                      console.error('Image loading error:', e);
                      setImageError(true);
                      setImageLoading(false);
                    }}
                  />
                  {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary-800/50 backdrop-blur-sm rounded-2xl">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-neutral-0 font-body">Loading image...</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-[350px] bg-primary-800/50 rounded-2xl">
                  <div className="text-center p-6">
                    <div className="w-12 h-12 mx-auto mb-4 text-accent-500">
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                      </svg>
                    </div>
                    <p className="text-neutral-0 font-body mb-4">Demo image unavailable</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button
                        onClick={() => {
                          setImageError(false);
                          setImageLoading(true);
                        }}
                        className="bg-accent-500 hover:bg-accent-400 text-neutral-0 px-4 py-2 rounded-lg transition-colors duration-200"
                      >
                        Retry
                      </button>
                      <button
                        onClick={() => {
                          // Open image in new tab as fallback
                          window.open('/images/screenshots/MinbarAI_Demo_Live.webp', '_blank');
                        }}
                        className="bg-primary-600 hover:bg-primary-500 text-neutral-0 px-4 py-2 rounded-lg transition-colors duration-200"
                      >
                        View Image
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Overlay with Live Demo Badge */}
              {!imageError && (
                <div className="absolute top-4 right-4 bg-accent-500/90 backdrop-blur-sm text-neutral-0 text-xs font-heading px-3 py-1 rounded-full flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>LIVE AT MASJID</span>
                </div>
              )}
              
              {/* Floating Elements */}
              <div className="absolute -top-2 -left-2 w-6 h-6 bg-accent-500/30 rounded-full animate-pulse-slow"></div>
              <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-primary-400/40 rounded-full animate-float"></div>
            </div>
          </div>
        </div>
        <ScrollArrow targetSelector=".why-choose-us" delay="1s" />
      </div>
    </section>
  );
};

export default CorePillars;
