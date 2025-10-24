'use client'

import { useSessionDateTime } from '@/lib/hooks/useSessionDateTime'
import { useState, useEffect } from 'react'

interface DateTimeDisplayProps {
  className?: string
}

export default function DateTimeDisplay({ className = '' }: DateTimeDisplayProps) {
  const { gregorianDate, hijriDate, currentTime } = useSessionDateTime()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return (
    <div className={`flex flex-col lg:flex-row lg:items-center space-y-3 lg:space-y-0 lg:space-x-4 ${className}`}>
      {/* Gregorian Date */}
      <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-accent-400 font-body">Gregorian</span>
          <span className="text-sm text-white font-body">
            {gregorianDate.replace('Gregorian: ', '')}
          </span>
        </div>
      </div>
      
      {/* Hijri Date */}
      <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-accent-400 font-body">Hijri</span>
          <span className="text-sm text-white font-body">
            {hijriDate.replace('Hijri: ', '')}
          </span>
        </div>
      </div>
      
      {/* Current Time - Only render on client to avoid hydration mismatch */}
      <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-accent-400 font-body">Time</span>
          <span className="text-sm text-white font-mono font-display">
            {isClient ? currentTime.replace('Time: ', '') : '--:--:-- --'}
          </span>
        </div>
      </div>
    </div>
  )
}
