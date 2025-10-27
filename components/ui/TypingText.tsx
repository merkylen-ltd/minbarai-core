import React, { useMemo } from 'react';
import { useTypingEffect } from '../../lib/hooks/useTypingEffect';

interface TypingTextProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  isArabic?: boolean;
  onComplete?: () => void;
  showCursor?: boolean;
  highlightArabic?: boolean;
}

const TypingText: React.FC<TypingTextProps> = ({
  text,
  speed = 50,
  delay = 0,
  className = '',
  isArabic = false,
  onComplete,
  showCursor = true,
  highlightArabic = false
}) => {
  const { displayedText, isTyping, isComplete } = useTypingEffect({
    text,
    speed,
    delay,
    onComplete
  });

  // Function to render text with Arabic highlighting
  const renderTextWithHighlighting = useMemo(() => {
    if (!highlightArabic) {
      return displayedText;
    }

    // Split text and identify Arabic parts
    const parts = displayedText.split(/(ٱلْـمِنْبَـرُ)/);
    
    return parts.map((part, index) => {
      if (part === 'ٱلْـمِنْبَـرُ') {
        return (
          <span 
            key={index}
            className="text-accent-400 typing-arabic-text"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  }, [displayedText, highlightArabic]);

  return (
    <span className={`typing-container ${className}`}>
      <span 
        className={`typing-text ${isArabic ? 'arabic' : ''} ${isComplete ? 'typing-complete' : ''}`}
      >
        {highlightArabic ? renderTextWithHighlighting : displayedText}
      </span>
      {showCursor && isTyping && (
        <span className="typing-cursor" />
      )}
    </span>
  );
};

export default TypingText;
