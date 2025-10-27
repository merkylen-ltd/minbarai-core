'use client';

import React from 'react';
import Link from 'next/link';
import ScrollArrow from '../ui/scroll-arrow';

const SocialProof: React.FC = () => {
  return (
    <section className="social-proof section-min-height flex flex-col justify-center section-spacing gradient-section">
      <div className="container-custom">
        <div className="text-center mb-fluid-xl">
          <h2 className="font-display text-fluid-2xl text-neutral-0 text-center mb-fluid-lg">
            Testimonials
          </h2>
          
          {/* Main Testimonial Card */}
          <div className="max-w-6xl mx-auto">
            <div className="gradient-card p-8 lg:p-12 relative overflow-hidden">
              {/* Quote Icon */}
              <div className="absolute top-6 left-6 text-accent-400/30">
                <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z"/>
                </svg>
              </div>
              
              {/* Testimonial Content */}
              <div className="relative z-10">
                <blockquote className="mb-8">
                  <p className="font-display text-fluid-2xl lg:text-fluid-3xl italic leading-relaxed text-neutral-0 mb-6">
                    &ldquo;For years, our German-speaking brothers felt lost in the khutba. With MinbarAI, the words now reach their hearts and guide them as they should.&rdquo;
                  </p>
                  <cite className="block font-inter text-fluid-base text-accent-300 not-italic font-medium">
                    — Leading Masjid in Wels, Austria
                  </cite>
                </blockquote>
                
                {/* Trust Indicators */}
                <div className="flex flex-wrap justify-center items-center gap-6 text-neutral-300 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>Verified Customer</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-accent-400 rounded-full"></div>
                    <span>Active Since 2024</span>
                  </div>
                </div>
              </div>
              
              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 w-8 h-8 bg-accent-500/20 rounded-full animate-pulse-slow"></div>
              <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-primary-400/30 rounded-full animate-float"></div>
            </div>
          </div>
        </div>
        
        {/* Call to Action */}
        <div className="text-center">
          <div className="mb-6">
            <p className="text-fluid-base text-neutral-50 max-w-readable mx-auto leading-relaxed">
              Join Muslims worldwide who are breaking language barriers with MinbarAI.
            </p>
          </div>
          <Link 
            href="/auth/signup"
            className="hidden btn-primary"
          >
            Get Started Today
          </Link>
          
          <p className="text-neutral-400 text-xs mt-4">
            By signing up, you agree to our{' '}
            <Link 
              href="/terms" 
              target="_blank"
              className="text-accent-400 hover:text-accent-300 transition-colors underline"
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link 
              href="/privacy" 
              target="_blank"
              className="text-accent-400 hover:text-accent-300 transition-colors underline"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
};

export default SocialProof;
