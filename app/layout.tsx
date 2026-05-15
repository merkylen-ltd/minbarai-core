import './globals.css'
import type { Metadata } from 'next'
import { Inter, Lora } from 'next/font/google'
import Script from 'next/script'

const inter = Inter({ subsets: ['latin'] })
const lora = Lora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-hero',
})

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
      <body className={`${inter.className} ${lora.variable} text-neutral-50 font-body app-container`}>
        <Script
          src="https://calendar.google.com/calendar/scheduling-button-script.js"
          strategy="afterInteractive"
        />
        <div className="min-h-screen bg-primary-gradient overflow-x-hidden">
          {children}
        </div>
      </body>
    </html>
  )
}
