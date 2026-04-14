/**
 * Regression guard for RC-P1:
 * checkPromptValid() must verify translationVariant, not just source+target.
 *
 * Bug: isPromptValid() in useSpeechRecognition.ts only compared source and
 * target language. If the user switched variant (e.g. quran → hadith) and
 * clicked Start before the background preloadPrompt completed, isPromptValid()
 * returned true against a stale prompt — the wrong system prompt was sent to
 * Gemini for the entire session.
 *
 * Fix: add promptLanguages.variant field and check it in checkPromptValid().
 */

import { checkPromptValid } from '@/components/dashboard/live-captioning/hooks/useSpeechRecognition'

describe('checkPromptValid — variant awareness (RC-P1)', () => {
  const cachedPrompt = 'You are an expert translator...'
  const promptLanguages = { source: 'ar', target: 'en', variant: 'quran' }

  it('returns true when source, target, and variant all match', () => {
    expect(checkPromptValid(cachedPrompt, promptLanguages, 'ar', 'en', 'quran')).toBe(true)
  })

  it('returns false when variant differs — the RC-P1 bug case', () => {
    // promptLanguages cached for quran; user switched to hadith before re-fetch
    expect(checkPromptValid(cachedPrompt, promptLanguages, 'ar', 'en', 'hadith')).toBe(false)
  })

  it('returns false when source language differs', () => {
    expect(checkPromptValid(cachedPrompt, promptLanguages, 'en', 'en', 'quran')).toBe(false)
  })

  it('returns false when target language differs', () => {
    expect(checkPromptValid(cachedPrompt, promptLanguages, 'ar', 'de', 'quran')).toBe(false)
  })

  it('returns false when promptLanguages is null', () => {
    expect(checkPromptValid(cachedPrompt, null, 'ar', 'en', 'quran')).toBe(false)
  })

  it('returns false when cachedPrompt is empty', () => {
    expect(checkPromptValid('', promptLanguages, 'ar', 'en', 'quran')).toBe(false)
  })
})
