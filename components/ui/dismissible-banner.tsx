'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface DismissibleBannerProps {
  variant?: 'beta' | 'info' | 'warning' | 'success';
  title?: string;
  message?: string;
  storageKey?: string;
  className?: string;
  onDismiss?: () => void;
}

const DismissibleBanner: React.FC<DismissibleBannerProps> = ({
  variant = 'beta',
  title,
  message,
  storageKey = 'beta-banner-dismissed',
  className = '',
  onDismiss
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if banner was previously dismissed
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) {
      setIsVisible(true);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(storageKey, 'true');
    onDismiss?.();
  };

  if (!isVisible) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'beta':
        return {
          container: 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 backdrop-blur-sm border border-orange-400/30',
          text: 'text-orange-300',
          icon: 'text-orange-400',
          button: 'text-orange-300 hover:text-orange-200 hover:bg-orange-500/20'
        };
      case 'info':
        return {
          container: 'bg-blue-500/20 backdrop-blur-sm border border-blue-400/30',
          text: 'text-blue-300',
          icon: 'text-blue-400',
          button: 'text-blue-300 hover:text-blue-200 hover:bg-blue-500/20'
        };
      case 'warning':
        return {
          container: 'bg-yellow-500/20 backdrop-blur-sm border border-yellow-400/30',
          text: 'text-yellow-300',
          icon: 'text-yellow-400',
          button: 'text-yellow-300 hover:text-yellow-200 hover:bg-yellow-500/20'
        };
      case 'success':
        return {
          container: 'bg-green-500/20 backdrop-blur-sm border border-green-400/30',
          text: 'text-green-300',
          icon: 'text-green-400',
          button: 'text-green-300 hover:text-green-200 hover:bg-green-500/20'
        };
      default:
        return {
          container: 'bg-orange-500/20 backdrop-blur-sm border border-orange-400/30',
          text: 'text-orange-300',
          icon: 'text-orange-400',
          button: 'text-orange-300 hover:text-orange-200 hover:bg-orange-500/20'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className={`relative rounded-lg shadow-lg animate-fade-in ${styles.container} ${className}`}>
      <div className="flex items-center justify-between p-3 md:p-4">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {/* Animated indicator */}
          <div className="relative flex-shrink-0">
            <div className="w-2 h-2 bg-current rounded-full"></div>
            <div className="absolute inset-0 w-2 h-2 bg-current rounded-full animate-ping opacity-60"></div>
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className={`font-heading text-sm md:text-base font-medium ${styles.text}`}>
                {title}
              </h3>
            )}
            {message && (
              <p className={`text-xs md:text-sm mt-1 ${styles.text}`}>
                {message}
              </p>
            )}
            {variant === 'beta' && !title && !message && (
              <div className="flex items-center space-x-2">
                <span className={`font-heading text-sm md:text-base font-medium ${styles.text}`}>
                  Early Access
                </span>
                <span className={`text-xs ${styles.text} opacity-80`}>
                  Limited features during development
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className={`ml-3 p-1 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center ${styles.button}`}
          aria-label="Dismiss banner"
          title="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default DismissibleBanner;
