'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  BOOK_A_DEMO_CALENDAR_URL,
  BOOK_A_DEMO_BUTTON_LABEL,
  BOOK_A_DEMO_BUTTON_COLOR,
} from '@/lib/constants';

declare global {
  interface Window {
    calendar?: {
      schedulingButton?: {
        load: (opts: {
          url: string;
          color: string;
          label: string;
          target: HTMLElement | null;
        }) => void;
      };
    };
  }
}

interface BookADemoButtonProps {
  /** Optional class for the wrapper (e.g. for inline vs block). Fallback link uses btn-primary when no variant class given. */
  className?: string;
  /** Use fallback link only (no Google widget). Useful for header/footer where a simple link is preferred. */
  linkOnly?: boolean;
}

/**
 * Renders a "Book a demo now" CTA that opens Google Calendar scheduling.
 * Uses Google's scheduling button script when available; otherwise a styled link.
 */
const BookADemoButton: React.FC<BookADemoButtonProps> = ({
  className = '',
  linkOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [useFallback, setUseFallback] = useState(linkOnly);

  // Ensure Google Calendar scheduling button CSS is in the document
  useEffect(() => {
    if (linkOnly) return;
    const href = 'https://calendar.google.com/calendar/scheduling-button-script.css';
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }, [linkOnly]);

  useEffect(() => {
    if (linkOnly) return;

    const container = containerRef.current;
    if (!container) return;

    const tryLoad = () => {
      if (typeof window === 'undefined' || !window.calendar?.schedulingButton?.load) {
        return false;
      }
      try {
        window.calendar.schedulingButton.load({
          url: BOOK_A_DEMO_CALENDAR_URL,
          color: BOOK_A_DEMO_BUTTON_COLOR,
          label: BOOK_A_DEMO_BUTTON_LABEL,
          target: container,
        });
        return true;
      } catch {
        return false;
      }
    };

    if (tryLoad()) return;

    const id = setInterval(() => {
      if (tryLoad()) {
        clearInterval(id);
      }
    }, 200);

    const timeout = setTimeout(() => {
      clearInterval(id);
      setUseFallback(true);
    }, 2000);

    return () => {
      clearInterval(id);
      clearTimeout(timeout);
    };
  }, [linkOnly]);

  if (useFallback || linkOnly) {
    return (
      <a
        href={BOOK_A_DEMO_CALENDAR_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={className || 'btn-primary'}
        aria-label={BOOK_A_DEMO_BUTTON_LABEL}
      >
        {BOOK_A_DEMO_BUTTON_LABEL}
      </a>
    );
  }

  return <div ref={containerRef} className={className} aria-label={BOOK_A_DEMO_BUTTON_LABEL} />;
};

export default BookADemoButton;
