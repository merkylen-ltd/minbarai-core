import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MinbarAI - Unbound Intelligence',
  description: 'Breaking language barriers for 1.8 billion Muslims instantly, contextually, everywhere.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} text-neutral-50 font-body app-container`}>
        <div className="min-h-screen bg-primary-gradient">
          {children}
        </div>
      </body>
    </html>
  )
}
