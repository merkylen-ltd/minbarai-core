import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Read the terms and conditions markdown file
    // Try multiple possible paths for different deployment environments
    const possiblePaths = [
      path.join(process.cwd(), 'legal', 'terms-and-conditions.md'),
      path.join(process.cwd(), '..', 'legal', 'terms-and-conditions.md'),
      path.join(__dirname, '..', '..', '..', '..', 'legal', 'terms-and-conditions.md'),
      // Fallback to old locations for backward compatibility
      path.join(process.cwd(), 'terms-and-conditions.md'),
      path.join(process.cwd(), '..', 'terms-and-conditions.md'),
      path.join(__dirname, '..', '..', '..', '..', 'terms-and-conditions.md'),
    ];

    let termsContent: string | undefined;
    let fileFound = false;

    for (const filePath of possiblePaths) {
      try {
        termsContent = fs.readFileSync(filePath, 'utf8');
        fileFound = true;
        break;
      } catch (err) {
        // Continue to next path
        continue;
      }
    }

    if (!fileFound || !termsContent) {
      throw new Error('Terms and conditions file not found in any expected location');
    }

    // Convert markdown to plain text (basic conversion)
    const textContent = termsContent
      .replace(/#{1,6}\s+/g, '') // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
      .replace(/\*(.*?)\*/g, '$1') // Remove italic formatting
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
      .replace(/^\s*[-*+]\s+/gm, '• ') // Convert markdown lists to bullet points
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list formatting
      .trim();

    // Set headers for file download
    const headers = new Headers();
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    headers.set('Content-Disposition', 'attachment; filename="minbarai-terms-and-conditions.txt"');
    headers.set('Cache-Control', 'no-cache');

    return new NextResponse(textContent, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error serving terms and conditions:', error);
    return NextResponse.json(
      { error: 'Failed to serve terms and conditions' },
      { status: 500 }
    );
  }
}
