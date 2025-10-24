'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ScrollArrow from '../ui/scroll-arrow';

interface Phrase {
  text: string;
  language: string;
  fontFamily: string;
  direction: "ltr" | "rtl";
}

interface PhrasePair {
  arabic: Phrase;
  translations: Phrase[];
}

const phrasePairs: PhrasePair[] = [
  {
    arabic: {
      text: "أَشْهَدُ أَنْ لاَ إِلَهَ إِلاَّ اللهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ",
      language: "Arabic",
      fontFamily: "Noto Naskh Arabic, Amiri, Scheherazade, serif",
      direction: "rtl"
    },
    translations: [
      {
        text: "I bear witness that there is no god but Allah, and I bear witness that Muhammad is His servant and messenger",
        language: "English",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "我作证除真主外绝无应受崇拜的，我作证穆罕默德是真主的仆人和使者",
        language: "Mandarin Chinese",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "मैं गवाही देता हूं कि अल्लाह के अलावा कोई पूज्य नहीं है, और मैं गवाही देता हूं कि मुहम्मद उनके बंदे और रसूल हैं",
        language: "Hindi",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "Atestiguo que no hay más dios que Alá, y atestiguo que Muhammad es Su siervo y mensajero",
        language: "Spanish",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      }
    ]
  },
  {
    arabic: {
      text: "السَّلاَمُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ",
      language: "Arabic",
      fontFamily: "Noto Naskh Arabic, Amiri, Scheherazade, serif",
      direction: "rtl"
    },
    translations: [
      {
        text: "Peace be upon you and Allah's mercy and blessings",
        language: "English",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "愿真主的平安、怜悯和祝福降临于你",
        language: "Mandarin Chinese",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "आप पर अल्लाह की शांति, दया और आशीर्वाद हो",
        language: "Hindi",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "Que la paz, la misericordia y las bendiciones de Alá estén contigo",
        language: "Spanish",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      }
    ]
  },
  {
    arabic: {
      text: "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيمِ",
      language: "Arabic",
      fontFamily: "Noto Naskh Arabic, Amiri, Scheherazade, serif",
      direction: "rtl"
    },
    translations: [
      {
        text: "In the name of Allah, the Most Gracious, the Most Merciful",
        language: "English",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "奉至仁至慈的真主之名",
        language: "Mandarin Chinese",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "अल्लाह के नाम से, जो अत्यंत दयालु और कृपाशील है",
        language: "Hindi",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "En el nombre de Alá, el Clemente, el Misericordioso",
        language: "Spanish",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      }
    ]
  },
  {
    arabic: {
      text: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
      language: "Arabic",
      fontFamily: "Noto Naskh Arabic, Amiri, Scheherazade, serif",
      direction: "rtl"
    },
    translations: [
      {
        text: "All praise is due to Allah, Lord of the worlds",
        language: "English",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "一切赞颂全归真主——众世界的主",
        language: "Mandarin Chinese",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "सारी प्रशंसा अल्लाह के लिए है, जो सभी लोकों का पालनहार है",
        language: "Hindi",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "Toda alabanza pertenece a Alá, Señor de los mundos",
        language: "Spanish",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      }
    ]
  },
  {
    arabic: {
      text: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ",
      language: "Arabic",
      fontFamily: "Noto Naskh Arabic, Amiri, Scheherazade, serif",
      direction: "rtl"
    },
    translations: [
      {
        text: "O Allah, send blessings upon Muhammad and the family of Muhammad",
        language: "English",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "真主啊，求你祝福穆罕默德和穆罕默德的家属",
        language: "Mandarin Chinese",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "हे अल्लाह, मुहम्मद और मुहम्मद के परिवार पर दया भेजें",
        language: "Hindi",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "Oh Alá, envía bendiciones sobre Muhammad y la familia de Muhammad",
        language: "Spanish",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      }
    ]
  },
  {
    arabic: {
      text: "سُبْحَانَ اللهِ وَبِحَمْدِهِ سُبْحَانَ اللهِ الْعَظِيمِ",
      language: "Arabic",
      fontFamily: "Noto Naskh Arabic, Amiri, Scheherazade, serif",
      direction: "rtl"
    },
    translations: [
      {
        text: "Glory be to Allah and praise be to Him, glory be to Allah the Magnificent",
        language: "English",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "赞美真主，赞颂真主，赞美伟大的真主",
        language: "Mandarin Chinese",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "अल्लाह की महिमा और उसकी प्रशंसा हो, महान अल्लाह की महिमा हो",
        language: "Hindi",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "Gloria a Alá y alabanza sea para Él, gloria a Alá el Magnífico",
        language: "Spanish",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      }
    ]
  },
  {
    arabic: {
      text: "لاَ إِلَهَ إِلاَّ اللهُ مُحَمَّدٌ رَسُولُ اللهِ",
      language: "Arabic",
      fontFamily: "Noto Naskh Arabic, Amiri, Scheherazade, serif",
      direction: "rtl"
    },
    translations: [
      {
        text: "There is no god but Allah, Muhammad is the messenger of Allah",
        language: "English",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "除真主外绝无应受崇拜的，穆罕默德是真主的使者",
        language: "Mandarin Chinese",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "अल्लाह के अलावा कोई पूज्य नहीं है, मुहम्मद अल्लाह के रसूल हैं",
        language: "Hindi",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "No hay más dios que Alá, Muhammad es el mensajero de Alá",
        language: "Spanish",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      }
    ]
  },
  {
    arabic: {
      text: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
      language: "Arabic",
      fontFamily: "Noto Naskh Arabic, Amiri, Scheherazade, serif",
      direction: "rtl"
    },
    translations: [
      {
        text: "Our Lord, give us good in this world and good in the hereafter, and save us from the punishment of the Fire",
        language: "English",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "我们的主啊，求你在今世赐予我们美好，在后世也赐予我们美好，求你使我们免遭火狱的刑罚",
        language: "Mandarin Chinese",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "हे हमारे रब, हमें इस दुनिया में भलाई दे और परलोक में भी भलाई दे, और हमें नरक की सज़ा से बचा",
        language: "Hindi",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      },
      {
        text: "Señor nuestro, concédenos el bien en esta vida y el bien en la otra vida, y líbranos del castigo del Fuego",
        language: "Spanish",
        fontFamily: "Inter, Neue Montreal, sans-serif",
        direction: "ltr"
      }
    ]
  }
];

// Animation constants
const ANIMATION_CONFIG = {
  TYPING_SPEED: 100, // ms per character
  HOLD_DURATION: 2000, // ms to hold after typing
  TRANSITION_DURATION: 500, // ms for fade out/in
  INITIAL_DELAY: 500, // ms before starting
  BACKGROUND_DURATION: 20, // seconds for background animation
  SCROLL_ROTATION_FACTOR: -0.02 // scroll rotation multiplier
} as const;

// Custom hook for managing phrase cycling with randomization
function usePhraseManager(phrasePairs: PhrasePair[]) {
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const [currentTranslationIndex, setCurrentTranslationIndex] = useState(0);

  const currentPair = useMemo(() => phrasePairs[currentPairIndex], [phrasePairs, currentPairIndex]);
  const arabicPhrase = currentPair.arabic;
  const latinPhrase = currentPair.translations[currentTranslationIndex];

  const moveToNextPhrase = useCallback(() => {
    const isLastTranslation = currentTranslationIndex >= currentPair.translations.length - 1;
    
    if (isLastTranslation) {
      setCurrentTranslationIndex(0);
      // Randomly select next phrase pair, ensuring it's different from current
      const availableIndices = Array.from({ length: phrasePairs.length }, (_, i) => i)
        .filter(i => i !== currentPairIndex);
      const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      setCurrentPairIndex(randomIndex);
    } else {
      setCurrentTranslationIndex((prevIndex) => prevIndex + 1);
    }
  }, [currentTranslationIndex, currentPair.translations.length, phrasePairs.length, currentPairIndex]);

  return {
    arabicPhrase,
    latinPhrase,
    moveToNextPhrase
  };
}

// Custom hook for synchronized typing animation
function useSynchronizedTyping(arabicText: string, latinText: string, onComplete: () => void) {
  const [arabicDisplayed, setArabicDisplayed] = useState("");
  const [latinDisplayed, setLatinDisplayed] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timer on cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Reset animation when text changes
  useEffect(() => {
    setArabicDisplayed("");
    setLatinDisplayed("");
    setIsTyping(true);
  }, [arabicText, latinText]);

  // Initial visibility delay
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, ANIMATION_CONFIG.INITIAL_DELAY);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Main animation loop
  useEffect(() => {
    if (!isVisible) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (isTyping) {
      const arabicComplete = arabicDisplayed.length >= arabicText.length;
      const latinComplete = latinDisplayed.length >= latinText.length;

      if (!arabicComplete || !latinComplete) {
        // Continue typing
        timerRef.current = setTimeout(() => {
          if (!arabicComplete) {
            setArabicDisplayed(arabicText.slice(0, arabicDisplayed.length + 1));
          }
          if (!latinComplete) {
            setLatinDisplayed(latinText.slice(0, latinDisplayed.length + 1));
          }
        }, ANIMATION_CONFIG.TYPING_SPEED);
      } else {
        // Hold before transitioning
        timerRef.current = setTimeout(() => {
          setIsTyping(false);
        }, ANIMATION_CONFIG.HOLD_DURATION);
      }
    } else {
      // Transition to next phrase
      timerRef.current = setTimeout(() => {
        setArabicDisplayed("");
        setLatinDisplayed("");
        setIsTyping(true);
        onComplete();
      }, ANIMATION_CONFIG.TRANSITION_DURATION);
    }
  }, [arabicDisplayed, latinDisplayed, isTyping, isVisible, arabicText, latinText, onComplete]);

  return {
    arabicDisplayed,
    latinDisplayed,
    isTyping,
    isVisible
  };
}

const LivingSermonStream: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Manage phrase cycling
  const { arabicPhrase, latinPhrase, moveToNextPhrase } = usePhraseManager(phrasePairs);

  // Synchronized typing animation
  const { arabicDisplayed, latinDisplayed, isTyping, isVisible } = useSynchronizedTyping(
    arabicPhrase.text,
    latinPhrase.text,
    moveToNextPhrase
  );

  return (
    <section className="living-sermon-stream section-min-height flex flex-col justify-center section-spacing relative gradient-section" ref={containerRef}>
      <div className="container-custom relative z-10">
        <div className="text-center mb-fluid-xl">
          <h2 className="font-display text-fluid-2xl text-neutral-0 text-center mb-fluid-lg">
            Sacred Words, Universal Understanding
          </h2>
          <p className="text-fluid-base text-neutral-50 max-w-readable mx-auto leading-relaxed">
            Watch Islamic teachings transcend language barriers in real-time, maintaining their spiritual essence across cultures.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Arabic Card */}
          <div className={`glass-panel living-card living-card-arabic ${isVisible ? 'visible' : 'hidden'}`}>
            <div className="text-container p-8">
              <div
                className={`living-text typing-effect${isTyping ? " typing" : ""} text-2xl`}
                style={{
                  fontFamily: arabicPhrase.fontFamily,
                  direction: arabicPhrase.direction,
                  fontWeight: 600
                }}
                aria-live="polite"
                role="text"
              >
                {arabicDisplayed}
                <span className="typing-cursor" aria-hidden="true">|</span>
              </div>
              <div className="language-indicator mt-4 text-sm text-accent-400 font-body">
                {arabicPhrase.language}
              </div>
            </div>
          </div>
          
          {/* Latin Card */}
          <div className={`glass-panel living-card living-card-latin ${isVisible ? 'visible' : 'hidden'}`}>
            <div className="text-container p-8">
              <div
                className={`living-text typing-effect${isTyping ? " typing" : ""} text-xl`}
                style={{
                  fontFamily: latinPhrase.fontFamily,
                  direction: latinPhrase.direction,
                  fontWeight: 700
                }}
                aria-live="polite"
                role="text"
              >
                {latinDisplayed}
                <span className="typing-cursor" aria-hidden="true">|</span>
              </div>
              <div className="language-indicator mt-4 text-sm text-accent-400 font-body">
                {latinPhrase.language}
              </div>
            </div>
          </div>
        </div>
        <ScrollArrow targetSelector=".video-demo" delay="1s" />
      </div>
      
    </section>
  );
};

export default LivingSermonStream;
