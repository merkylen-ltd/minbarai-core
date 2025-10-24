import { useState, useEffect } from 'react';

interface UseSessionDateTimeReturn {
  gregorianDate: string;
  hijriDate: string;
  currentTime: string;
}

/**
 * Custom hook for displaying current date and time in multiple formats
 * Updates every second to show live time
 */
export const useSessionDateTime = (): UseSessionDateTimeReturn => {
  const [dateTime, setDateTime] = useState(() => {
    const now = new Date();
    return {
      gregorianDate: formatGregorianDate(now),
      hijriDate: formatHijriDate(now),
      currentTime: formatTime(now)
    };
  });

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setDateTime({
        gregorianDate: formatGregorianDate(now),
        hijriDate: formatHijriDate(now),
        currentTime: formatTime(now)
      });
    };

    // Update immediately
    updateDateTime();

    // Update every second
    const interval = setInterval(updateDateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return dateTime;
};

/**
 * Format date in Gregorian calendar
 */
function formatGregorianDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  return `Gregorian: ${date.toLocaleDateString('en-US', options)}`;
}

/**
 * Format date in Hijri calendar (simplified approximation)
 * Note: This is a basic approximation. For production, use a proper Hijri calendar library
 */
function formatHijriDate(date: Date): string {
  try {
    // Try to use Intl.DateTimeFormat with Islamic calendar if supported
    const options: Intl.DateTimeFormatOptions = {
      calendar: 'islamic',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    
    return `Hijri: ${date.toLocaleDateString('ar-SA-u-ca-islamic', options)}`;
  } catch (error) {
    // Fallback for browsers that don't support Islamic calendar
    return `Hijri: ${getApproximateHijriDate(date)}`;
  }
}

/**
 * Simple approximation for Hijri date (for fallback)
 * Note: This is not accurate and should be replaced with a proper library
 */
function getApproximateHijriDate(date: Date): string {
  // This is a very rough approximation
  // In production, use a proper Hijri calendar library like moment-hijri
  const hijriEpoch = new Date('622-07-16'); // Approximate start of Hijri calendar
  const daysDifference = Math.floor((date.getTime() - hijriEpoch.getTime()) / (1000 * 60 * 60 * 24));
  const hijriYear = Math.floor(daysDifference / 354.37) + 1; // Approximate Hijri year length
  
  const hijriMonths = [
    'Muharram', 'Safar', 'Rabi\' al-awwal', 'Rabi\' al-thani',
    'Jumada al-awwal', 'Jumada al-thani', 'Rajab', 'Sha\'ban',
    'Ramadan', 'Shawwal', 'Dhu al-Qi\'dah', 'Dhu al-Hijjah'
  ];
  
  const dayOfYear = daysDifference % 354;
  const month = Math.floor(dayOfYear / 29.5);
  const day = Math.floor(dayOfYear % 29.5) + 1;
  
  return `${day} ${hijriMonths[month] || 'Muharram'} ${hijriYear} AH`;
}

/**
 * Format current time
 */
function formatTime(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };
  
  return `Time: ${date.toLocaleTimeString('en-US', options)}`;
}
