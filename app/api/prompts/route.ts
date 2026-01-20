import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

// Valid translation variants
const VALID_VARIANTS = ['normal', 'quran', 'hadith', 'quran_hadith'] as const
type TranslationVariant = typeof VALID_VARIANTS[number]

// Arabic language variations that should use ar_source_to prompts
const ARABIC_VARIANTS = ['arabic', 'ar', 'عربي', 'العربية']

// In-memory prompt cache with timestamps for cache busting in development
interface CachedPrompt {
  content: string
  timestamp: number
}
const promptCache = new Map<string, CachedPrompt>()

// Cache TTL in milliseconds (5 minutes in production, 10 seconds in development)
const CACHE_TTL = process.env.NODE_ENV === 'production' ? 5 * 60 * 1000 : 10 * 1000

// Map language codes to folder names
function getPromptFolderName(languageCode: string): string {
  const normalized = languageCode.toLowerCase().trim()
  const mapping: Record<string, string> = {
    'english': 'english',
    'en': 'english',
    'turkish': 'turkish',
    'tr': 'turkish',
    'türkçe': 'turkish',
    'german': 'german',
    'de': 'german',
    'deutsch': 'german',
    'bosnian': 'bosnian',
    'bs': 'bosnian',
    'bosanski': 'bosnian'
  }
  return mapping[normalized] || 'otherlang'
}

// Check if source language is Arabic
function isArabicSource(sourceLanguage: string): boolean {
  const normalized = sourceLanguage.toLowerCase().trim()
  return ARABIC_VARIANTS.includes(normalized)
}

// Map variant to file suffix
function getVariantSuffix(variant: TranslationVariant): string {
  const suffixMap: Record<TranslationVariant, string> = {
    'normal': '',
    'quran': '_ayat',
    'hadith': '_hadith',
    'quran_hadith': '_ayat_hadith'
  }
  return suffixMap[variant] || ''
}

// Validate variant parameter
function isValidVariant(variant: string): variant is TranslationVariant {
  return VALID_VARIANTS.includes(variant as TranslationVariant)
}

// Sanitize language name for template replacement
function sanitizeLanguageName(lang: string): string {
  // Capitalize first letter and trim
  const trimmed = lang.trim()
  if (!trimmed) return 'English'
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

// Apply template replacements
function applyTemplateReplacements(template: string, targetLanguage: string, sourceLanguage: string): string {
  return template
    // Replace standard placeholders
    .replace(/{targetLanguage}/g, targetLanguage)
    .replace(/{sourceLanguage}/g, sourceLanguage)
    // Also replace variations that might appear in examples
    .replace(/{Target Language}/g, targetLanguage)
    .replace(/{Source Language}/g, sourceLanguage)
    // Replace the text placeholder with transcript for client compatibility
    .replace(/{text}/g, '{transcript}')
}

// Generate a fallback prompt when files cannot be loaded
function generateFallbackPrompt(targetLanguage: string, sourceLanguage: string): string {
  return `You are a professional translator. Translate the following ${sourceLanguage} text to ${targetLanguage} accurately and naturally.

Your response must contain ONLY the translated text.
Do not include any explanations, acknowledgments, or additional content.

Translate the following ${sourceLanguage} text to ${targetLanguage}: {transcript}

End your response immediately after the translation.`
}

function loadPrompt(targetLanguage: string, sourceLanguage: string, variant: TranslationVariant = 'normal'): string {
  // Sanitize inputs
  const sanitizedTarget = sanitizeLanguageName(targetLanguage)
  const sanitizedSource = sanitizeLanguageName(sourceLanguage)
  
  try {
    // Create cache key
    const cacheKey = `${sanitizedSource}-${sanitizedTarget}-${variant}`
    
    // Check cache first with TTL
    const cached = promptCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`[Prompts API] Cache hit for: ${cacheKey}`)
      return cached.content
    }
    
    console.log(`[Prompts API] Cache miss for: ${cacheKey}`)
    
    const baseDir = join(process.cwd(), 'app', 'api', 'ai', 'translate', 'prompts')
    const targetLower = sanitizedTarget.toLowerCase()
    const sourceLower = sanitizedSource.toLowerCase()
    const suffix = getVariantSuffix(variant)
    
    let folderPath: string
    let fileName: string
    
    // Determine folder path based on source language
    if (isArabicSource(sourceLower)) {
      // Arabic source - use ar_source_to folder
      const targetFolder = getPromptFolderName(targetLower)
      folderPath = join(baseDir, 'ar_source_to', targetFolder)
      fileName = `${targetFolder}${suffix}.txt`
    } else {
      // Non-Arabic source or any-to-any - use any_source_to_any folder
      folderPath = join(baseDir, 'any_source_to_any')
      fileName = `any_source_to_any${suffix}.txt`
    }
    
    const filePath = join(folderPath, fileName)
    
    console.log(`[Prompts API] Loading prompt: ${filePath}`)
    
    // Try to load the specific variant
    if (existsSync(filePath)) {
      const rawTemplate = readFileSync(filePath, 'utf-8')
      const template = applyTemplateReplacements(rawTemplate, sanitizedTarget, sanitizedSource)
      
      // Store in cache with timestamp
      promptCache.set(cacheKey, { content: template, timestamp: Date.now() })
      console.log(`[Prompts API] Successfully loaded and cached: ${fileName}`)
      return template
    }
    
    // Fallback: try base variant (normal) if specific variant doesn't exist
    if (variant !== 'normal') {
      const baseFolderPath = isArabicSource(sourceLower)
        ? join(baseDir, 'ar_source_to', getPromptFolderName(targetLower))
        : join(baseDir, 'any_source_to_any')
      
      const baseFileName = isArabicSource(sourceLower)
        ? `${getPromptFolderName(targetLower)}.txt`
        : 'any_source_to_any.txt'
      
      const baseFilePath = join(baseFolderPath, baseFileName)
      
      console.log(`[Prompts API] Variant ${variant} not found, falling back to: ${baseFilePath}`)
      
      if (existsSync(baseFilePath)) {
        const rawTemplate = readFileSync(baseFilePath, 'utf-8')
        const template = applyTemplateReplacements(rawTemplate, sanitizedTarget, sanitizedSource)
        
        // Store fallback in cache with original cache key
        promptCache.set(cacheKey, { content: template, timestamp: Date.now() })
        console.log(`[Prompts API] Successfully loaded and cached fallback: ${baseFileName}`)
        return template
      }
    }
    
    // Final fallback to any_source_to_any/any_source_to_any.txt
    const ultimateFallbackPath = join(baseDir, 'any_source_to_any', 'any_source_to_any.txt')
    console.log(`[Prompts API] Trying ultimate fallback: ${ultimateFallbackPath}`)
    
    if (existsSync(ultimateFallbackPath)) {
      const rawTemplate = readFileSync(ultimateFallbackPath, 'utf-8')
      const template = applyTemplateReplacements(rawTemplate, sanitizedTarget, sanitizedSource)
      
      promptCache.set(cacheKey, { content: template, timestamp: Date.now() })
      console.log(`[Prompts API] Successfully loaded ultimate fallback`)
      return template
    }
    
    throw new Error(`No prompt files found for ${sanitizedSource} -> ${sanitizedTarget}`)
  } catch (e) {
    console.error('[Prompts API] Error loading prompt:', e)
    // Return a properly formatted fallback prompt
    return generateFallbackPrompt(sanitizedTarget, sanitizedSource)
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const target = searchParams.get('target') || 'English'
    const source = searchParams.get('source') || 'Auto'
    const variantParam = searchParams.get('variant') || 'normal'
    
    // Validate variant parameter
    const variant: TranslationVariant = isValidVariant(variantParam) ? variantParam : 'normal'
    
    if (variantParam && !isValidVariant(variantParam)) {
      console.warn(`[Prompts API] Invalid variant '${variantParam}', defaulting to 'normal'`)
    }
    
    console.log(`[Prompts API] Request: source=${source}, target=${target}, variant=${variant}`)
    
    const prompt = loadPrompt(target, source, variant)
    
    // Validate prompt is not empty
    if (!prompt || prompt.trim().length === 0) {
      console.error('[Prompts API] Empty prompt returned')
      return NextResponse.json(
        { error: 'Failed to load prompt', prompt: generateFallbackPrompt(target, source) },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ prompt })
  } catch (error) {
    console.error('[Prompts API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', prompt: generateFallbackPrompt('English', 'Auto') },
      { status: 500 }
    )
  }
}


