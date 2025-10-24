import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

function loadPrompt(targetLanguage: string, sourceLanguage: string) {
  try {
    const dir = join(process.cwd(), 'app', 'api', 'ai', 'translate', 'prompts')
    const target = targetLanguage || 'English'
    const map: Record<string, string> = {
      English: 'english.txt',
      German: 'german.txt',
      Turkish: 'turkish.txt',
      Bosnian: 'bosnian.txt',
    }
    const file = map[target]
    const filePath = file ? join(dir, file) : join(dir, 'generic.txt')
    let template = readFileSync(filePath, 'utf-8')
    template = template
      .replace(/{targetLanguage}/g, targetLanguage)
      .replace(/{sourceLanguage}/g, sourceLanguage || 'Auto')
      .replace('{text}', '{transcript}')
    return template
  } catch (e) {
    try {
      const generic = readFileSync(join(process.cwd(), 'app', 'api', 'ai', 'translate', 'prompts', 'generic.txt'), 'utf-8')
      return generic
        .replace(/{targetLanguage}/g, targetLanguage)
        .replace(/{sourceLanguage}/g, sourceLanguage || 'Auto')
        .replace('{text}', '{transcript}')
    } catch {}
    return ''
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const target = searchParams.get('target') || 'English'
  const source = searchParams.get('source') || 'Auto'
  const prompt = loadPrompt(target, source)
  return NextResponse.json({ prompt })
}


