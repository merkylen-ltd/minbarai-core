'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { User, CreditCard, Mic, ArrowLeft } from 'lucide-react';
import SignOutButton from '@/components/dashboard/SignOutButton';
import { createClient } from '@/lib/supabase/client';

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

interface UnifiedHeaderProps {
  variant?: 'landing' | 'dashboard' | 'billing';
  userEmail?: string;
  showBackButton?: boolean;
  backButtonHref?: string;
  backButtonText?: string;
}

const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({
  variant = 'landing',
  userEmail,
  showBackButton = false,
  backButtonHref = '/dashboard',
  backButtonText = 'Back to Dashboard'
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  useEffect(() => {
    const checkAuthStatus = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setIsAuthenticated(true);
        setCurrentUserEmail(user.email || '');
      } else {
        setIsAuthenticated(false);
        setCurrentUserEmail('');
      }
    };

    checkAuthStatus();
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const getPageTitle = () => {
    switch (variant) {
      case 'dashboard':
        return 'Dashboard';
      case 'billing':
        return 'Billing';
      default:
        return null;
    }
  };

  const getPageIcon = () => {
    switch (variant) {
      case 'dashboard':
        return <Mic className="h-4 w-4" />;
      case 'billing':
        return <CreditCard className="h-4 w-4" />;
      default:
        return null;
    }
  };

  // Use passed userEmail if available (for dashboard pages), otherwise use detected auth status
  const displayUserEmail = userEmail || currentUserEmail;
  const showAuthenticatedMenu = variant !== 'landing' || isAuthenticated;

  return (
    <nav className={`fixed left-0 right-0 z-50 bg-primary-800 border-b border-accent-500/20 shadow-lg transition-all duration-300 safe-area-inset-top top-0`}>
      <div className="container-custom flex justify-between items-center py-4">
        {/* Logo and Brand */}
        <Link 
          href="/" 
          className="flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary-900 focus:ring-accent-400 rounded-md p-1 -ml-1" 
          aria-label="MinbarAI Home"
        >
          <LogoIcon className="h-10 w-10 text-neutral-0" />
          <span className="ml-3 text-fluid-xl font-heading text-neutral-0">MinbarAI</span>
          {showAuthenticatedMenu && getPageTitle() && (
            <>
              <div className="ml-4 pl-4 border-l border-accent-500/20">
                <div className="flex items-center space-x-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-500/20 text-accent-400 border border-accent-500/30">
                    {getPageIcon()}
                  </div>
                  <span className="text-neutral-50 text-sm font-body">{getPageTitle()}</span>
                </div>
              </div>
            </>
          )}
        </Link>
        
        {/* Desktop Menu */}
        <div className="hidden md:flex items-center space-x-8">
          {showAuthenticatedMenu ? (
            // Authenticated user menu
            <div className="flex items-center space-x-6">
              {showBackButton && (
                <Link
                  href={backButtonHref}
                  className="flex items-center space-x-2 text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>{backButtonText}</span>
                </Link>
              )}
              
              <div className="flex items-center space-x-2 text-neutral-400 text-sm">
                <User className="h-4 w-4" />
                <span>{displayUserEmail}</span>
              </div>
              
              {/* Dashboard link for authenticated users */}
              <Link
                href="/dashboard"
                className="flex items-center space-x-2 text-neutral-400 hover:text-white transition-colors text-sm"
              >
                <Mic className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
              
              {variant === 'dashboard' && (
                <Link
                  href="/dashboard/billing"
                  className="flex items-center space-x-2 text-neutral-400 hover:text-white transition-colors text-sm"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Billing</span>
                </Link>
              )}
              
              <SignOutButton />
            </div>
          ) : (
            // Landing page menu
            <div className="flex items-center space-x-4 ml-8 pl-8 border-l border-accent-500/20">
              <Link
                href="/auth/signin"
                className="text-neutral-50 hover:text-accent-400 transition-colors duration-300 text-fluid-sm font-body focus:outline-none focus:text-accent-400 focus:underline"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="hidden bg-accent-500 hover:bg-accent-400 text-neutral-0 px-4 py-2 rounded-button text-fluid-sm font-heading transition-all duration-200 shadow-glow hover:shadow-glow-lg focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-2 focus:ring-offset-primary-900 min-h-[44px] md:min-h-0 flex items-center"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button 
            onClick={toggleMobileMenu}
            className="text-neutral-50 hover:text-accent-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-400 p-2 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open menu"
            aria-expanded={isMobileMenuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-primary-700 shadow-card py-2 z-40 border-b border-accent-500/10">
          <div className="container-custom flex flex-col space-y-1">
            {showAuthenticatedMenu ? (
              // Authenticated mobile menu
              <>
                {showBackButton && (
                  <Link
                    href={backButtonHref}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-neutral-50 hover:text-accent-400 hover:bg-primary-600/50 block px-3 py-3 rounded-button text-fluid-sm font-body transition-all duration-300 min-h-[44px] flex items-center"
                  >
                    <ArrowLeft className="h-4 w-4 inline mr-2" />
                    {backButtonText}
                  </Link>
                )}
                
                <div className="border-t border-accent-500/20 pt-2 mt-2">
                  <div className="px-3 py-2 text-neutral-400 text-sm">
                    <User className="h-4 w-4 inline mr-2" />
                    {displayUserEmail}
                  </div>
                  
                  {/* Dashboard link for authenticated users */}
                  <Link
                    href="/dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-neutral-50 hover:text-accent-400 hover:bg-primary-600/50 block px-3 py-3 rounded-button text-fluid-sm font-body transition-all duration-300 min-h-[44px] flex items-center"
                  >
                    <Mic className="h-4 w-4 inline mr-2" />
                    Dashboard
                  </Link>
                  
                  {variant === 'dashboard' && (
                    <Link
                      href="/dashboard/billing"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="text-neutral-50 hover:text-accent-400 hover:bg-primary-600/50 block px-3 py-3 rounded-button text-fluid-sm font-body transition-all duration-300 min-h-[44px] flex items-center"
                    >
                      <CreditCard className="h-4 w-4 inline mr-2" />
                      Billing
                    </Link>
                  )}
                  
                  <div className="px-3 py-2">
                    <SignOutButton />
                  </div>
                </div>
              </>
            ) : (
              // Landing page mobile menu
              <div className="border-t border-accent-500/20 pt-2 mt-2">
                <Link
                  href="/auth/signin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-neutral-50 hover:text-accent-400 hover:bg-primary-600/50 block px-3 py-3 rounded-button text-fluid-sm font-body transition-all duration-300 min-h-[44px] flex items-center"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="hidden bg-accent-500 hover:bg-accent-400 text-neutral-0 block px-3 py-3 rounded-button text-fluid-sm font-body transition-all duration-300 mx-3 mt-2 text-center min-h-[44px] flex items-center justify-center"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default UnifiedHeader;
