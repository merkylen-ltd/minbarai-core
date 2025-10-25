import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

type TranslationVariant = 'normal' | 'quran' | 'hadith' | 'quran_hadith'

// In-memory prompt cache
const promptCache = new Map<string, string>()

// Map language codes to folder names
function getPromptFolderName(languageCode: string): string {
  const mapping: Record<string, string> = {
    'english': 'english',
    'turkish': 'turkish',
    'german': 'german',
    'bosnian': 'bosnian'
  }
  return mapping[languageCode.toLowerCase()] || 'otherlang'
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

function loadPrompt(targetLanguage: string, sourceLanguage: string, variant: TranslationVariant = 'normal') {
  try {
    // Create cache key
    const cacheKey = `${sourceLanguage}-${targetLanguage}-${variant}`
    
    // Check cache first
    if (promptCache.has(cacheKey)) {
      console.log(`[Prompts API] Cache hit for: ${cacheKey}`)
      return promptCache.get(cacheKey)!
    }
    
    console.log(`[Prompts API] Cache miss for: ${cacheKey}`)
    
    const baseDir = join(process.cwd(), 'app', 'api', 'ai', 'translate', 'prompts')
    const targetLower = targetLanguage.toLowerCase()
    const sourceLower = sourceLanguage.toLowerCase()
    const suffix = getVariantSuffix(variant)
    
    let folderPath: string
    let fileName: string
    
    // Determine folder path based on source language
    if (sourceLower === 'arabic') {
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
      let template = readFileSync(filePath, 'utf-8')
      template = template
        .replace(/{targetLanguage}/g, targetLanguage)
        .replace(/{sourceLanguage}/g, sourceLanguage)
        .replace('{text}', '{transcript}')
      
      // Store in cache
      promptCache.set(cacheKey, template)
      console.log(`[Prompts API] Successfully loaded and cached: ${fileName}`)
      return template
    }
    
    // Fallback: try base variant (normal) if specific variant doesn't exist
    if (variant !== 'normal') {
      const baseFolderPath = sourceLower === 'arabic' 
        ? join(baseDir, 'ar_source_to', getPromptFolderName(targetLower))
        : join(baseDir, 'any_source_to_any')
      
      const baseFileName = sourceLower === 'arabic'
        ? `${getPromptFolderName(targetLower)}.txt`
        : 'any_source_to_any.txt'
      
      const baseFilePath = join(baseFolderPath, baseFileName)
      
      console.log(`[Prompts API] Variant ${variant} not found, falling back to: ${baseFilePath}`)
      
      if (existsSync(baseFilePath)) {
        let template = readFileSync(baseFilePath, 'utf-8')
        template = template
          .replace(/{targetLanguage}/g, targetLanguage)
          .replace(/{sourceLanguage}/g, sourceLanguage)
          .replace('{text}', '{transcript}')
        
        // Store fallback in cache with original cache key
        promptCache.set(cacheKey, template)
        console.log(`[Prompts API] Successfully loaded and cached fallback: ${baseFileName}`)
        return template
      }
    }
    
    throw new Error(`Prompt file not found: ${filePath}`)
  } catch (e) {
    console.error('[Prompts API] Error loading prompt:', e)
    // Return empty prompt as last resort
    return `Translate the following {sourceLanguage} text to {targetLanguage}:\n\n{transcript}`
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const target = searchParams.get('target') || 'English'
  const source = searchParams.get('source') || 'Auto'
  const variant = (searchParams.get('variant') || 'normal') as TranslationVariant
  
  console.log(`[Prompts API] Request: source=${source}, target=${target}, variant=${variant}`)
  
  const prompt = loadPrompt(target, source, variant)
  return NextResponse.json({ prompt })
}


