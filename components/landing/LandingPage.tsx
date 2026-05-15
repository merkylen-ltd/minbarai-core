'use client';

import React from 'react';
import Header from './Header';
import Hero from './Hero';
import LivingSermonStream from './LivingSermonStream';
import CorePillars from './CorePillars';
import VideoDemo from './VideoDemo';
import SocialProof from './SocialProof';
import Footer from './Footer';

/**
 * Landing page component
 * Main landing page with all sections in original order
 */
export const LandingPage: React.FC = () => {
  return (
    <>
      <Header />
      <Hero />
      <LivingSermonStream />
      <VideoDemo />
      <CorePillars />
      <SocialProof />
      <Footer />
    </>
  );
};

export default LandingPage;
