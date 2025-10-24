'use client';

import React from 'react';
import Link from 'next/link';

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

const Footer: React.FC = () => {
  return (
    <footer className="bg-primary-900 border-t border-primary-700/20 py-12">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo and Description */}
          <div className="md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <LogoIcon className="h-10 w-10 text-neutral-0" />
              <span className="text-xl font-display text-neutral-0 font-display">MinbarAI</span>
            </div>
            <p className="text-neutral-300 text-sm leading-relaxed max-w-md">
              Breaking language barriers for 1.8 billion Muslims instantly, contextually, everywhere. 
              From the Minbar to the World.
            </p>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-neutral-0 font-heading mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy" className="text-neutral-300 hover:text-neutral-0 transition-colors text-sm min-h-[44px] md:min-h-0 flex items-center">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-neutral-300 hover:text-neutral-0 transition-colors text-sm min-h-[44px] md:min-h-0 flex items-center">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/support" className="text-neutral-300 hover:text-neutral-0 transition-colors text-sm min-h-[44px] md:min-h-0 flex items-center">
                  Support
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-primary-700/30 mt-8 pt-8 flex flex-col md:flex-row items-center justify-between">
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4">
            <p className="text-neutral-400 text-sm">
              &copy; 2025 MinbarAI. All rights reserved.
            </p>
            <div className="flex items-center space-x-2 px-2 py-1 rounded-full bg-accent-500/10 border border-accent-400/20">
              <div className="relative">
                <div className="w-1.5 h-1.5 bg-accent-400 rounded-full"></div>
                <div className="absolute inset-0 w-1.5 h-1.5 bg-accent-400 rounded-full animate-ping opacity-60"></div>
              </div>
              <span className="text-accent-300 text-xs font-heading tracking-wide">BETA</span>
            </div>
          </div>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <Link
              href="/auth/signin"
              className="text-neutral-300 hover:text-neutral-0 transition-colors text-sm min-h-[44px] md:min-h-0 flex items-center"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="text-accent-400 hover:text-accent-300 transition-colors text-sm font-heading min-h-[44px] md:min-h-0 flex items-center"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
