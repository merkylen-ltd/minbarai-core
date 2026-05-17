import { useState, useEffect, useRef, useCallback } from 'react'

export interface UseTypingAnimationReturn {
  completedTranslations: string
  typingText: string
  isTyping: boolean
  pendingTranslation: string
  setPendingTranslation: (translation: string) => void
  queueTranslation: (translation: string) => void
  clearAll: () => void
  clearPendingQueue: () => void
  typingQueueRef: React.MutableRefObject<string[]>
  scrollToBottom: (ref: React.RefObject<HTMLDivElement>) => void
}

export const useTypingAnimation = (
  targetScrollRef: React.RefObject<HTMLDivElement>,
  typingSpeed: number = 40
): UseTypingAnimationReturn => {
  const [completedTranslations, setCompletedTranslations] = useState('')
  const [typingText, setTypingText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [pendingTranslation, setPendingTranslation] = useState('')
  
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const typingQueueRef = useRef<string[]>([])
  const isTypingRef = useRef<boolean>(false) // Ref to track typing state reliably

  const scrollToBottom = useCallback((ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [])

  // Adaptive typing speed based on text length for optimal viewing experience
  const calculateTypingSpeed = useCallback((textLength: number): number => {
    if (textLength < 50) {
      // Very short text: Slower typing for readability (45ms per char)
      return 45
    } else if (textLength < 100) {
      // Short text: Normal slow typing (35ms per char)
      return 35
    } else if (textLength < 200) {
      // Medium text: Moderate speed (25ms per char)
      return 25
    } else if (textLength < 400) {
      // Long text: Faster typing (15ms per char)
      return 15
    } else if (textLength < 600) {
      // Very long text: Fast typing (16ms per char — one frame)
      return 16
    } else {
      // Extremely long text: Very fast typing (16ms per char — one frame minimum)
      return 16
    }
  }, [])

  // Typing animation effect
  useEffect(() => {
    if (pendingTranslation && !isTyping) {
      setIsTyping(true)
      isTypingRef.current = true // Update ref immediately
      setTypingText('')
      
      let currentIndex = 0
      const fullText = pendingTranslation
      
      // Calculate adaptive speed based on text length
      const adaptiveSpeed = calculateTypingSpeed(fullText.length)
      
      typingIntervalRef.current = setInterval(() => {
        if (currentIndex < fullText.length) {
          setTypingText(fullText.slice(0, currentIndex + 1))
          currentIndex++
          
          // Scroll continuously during typing (every 5 characters for performance)
          if (currentIndex % 5 === 0 || currentIndex === fullText.length - 1) {
            scrollToBottom(targetScrollRef)
          }
        } else {
          // Typing complete
          if (typingIntervalRef.current) {
            clearInterval(typingIntervalRef.current)
            typingIntervalRef.current = null
          }
          
          // Move completed text to completed translations
          setCompletedTranslations(prev => prev + (prev ? '\n' : '') + fullText)
          setTypingText('')
          setIsTyping(false)
          isTypingRef.current = false // Update ref immediately
          setPendingTranslation('')
          
          // Check for queued translations
          if (typingQueueRef.current.length > 0) {
            const nextTranslation = typingQueueRef.current.shift()
            if (nextTranslation) {
              isTypingRef.current = true // Lock before async state update to prevent race
              setPendingTranslation(nextTranslation)
            }
          }
          
          // Final scroll after typing completes
          scrollToBottom(targetScrollRef)
        }
      }, adaptiveSpeed) // Use adaptive speed instead of fixed typingSpeed
    }
  }, [pendingTranslation, isTyping, calculateTypingSpeed, scrollToBottom, targetScrollRef])

  // Cleanup typing interval on unmount
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current)
      }
    }
  }, [])

  // CRITICAL FIX: Use ref instead of state to avoid race condition
  // When translations arrive rapidly, state may not have updated yet,
  // causing new translations to overwrite instead of queue
  const queueTranslation = useCallback((translation: string) => {
    if (isTypingRef.current) {
      // Currently typing - add to queue
      typingQueueRef.current.push(translation)
    } else {
      // Not typing - start immediately
      setPendingTranslation(translation)
    }
  }, []) // No dependencies - uses ref which is always current

  const clearAll = useCallback(() => {
    setCompletedTranslations('')
    setTypingText('')
    setIsTyping(false)
    isTypingRef.current = false // Reset ref too
    setPendingTranslation('')
    typingQueueRef.current = []
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current)
      typingIntervalRef.current = null
    }
  }, [])

  // Clear only the pending queue and stop current typing, keep completed translations
  const clearPendingQueue = useCallback(() => {
    setTypingText('')
    setIsTyping(false)
    isTypingRef.current = false
    setPendingTranslation('')
    typingQueueRef.current = []
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current)
      typingIntervalRef.current = null
    }
  }, [])

  return {
    completedTranslations,
    typingText,
    isTyping,
    pendingTranslation,
    setPendingTranslation,
    queueTranslation,
    clearAll,
    clearPendingQueue,
    typingQueueRef,
    scrollToBottom
  }
}

