import React from 'react';
import { calculatePasswordStrength } from '@/lib/auth/password-strength';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
  showLabel?: boolean;
  showRequirements?: boolean;
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  className = '',
  showLabel = true,
  showRequirements = true
}) => {
  const strengthData = calculatePasswordStrength(password);
  const { score: strength, label, color } = strengthData;

  const requirements = [
    { text: 'At least 6 characters', met: password.length >= 6 },
    { text: 'At least one letter', met: /[A-Za-z]/.test(password) },
    { text: 'At least one number', met: /\d/.test(password) },
  ];

  // Convert text color to background color
  const getBgColor = (textColor: string, level: number, currentStrength: number): string => {
    if (level >= Math.min(currentStrength, 5)) return 'bg-neutral-600';
    
    const colorMap: Record<string, string> = {
      'text-red-500': 'bg-red-500',
      'text-orange-500': 'bg-orange-500', 
      'text-yellow-500': 'bg-yellow-500',
      'text-blue-500': 'bg-blue-500',
      'text-green-500': 'bg-green-500',
      'text-green-600': 'bg-green-600',
      'text-green-700': 'bg-green-700'
    };
    
    return colorMap[textColor] || 'bg-gray-500';
  };

  if (!password) return null;

  return (
    <div className={`mt-2 ${className}`}>
      {/* Strength Bar */}
      <div className="flex space-x-1 mb-2">
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              level < Math.min(strength, 5) 
                ? `opacity-100 ${getBgColor(color, level, strength)}` 
                : 'opacity-20 bg-neutral-600'
            }`}
          />
        ))}
      </div>

      {/* Strength Label */}
      {showLabel && (
        <p className={`text-fluid-xs font-body transition-colors duration-300 ${color}`}>
          Password strength: {label}
        </p>
      )}

      {/* Requirements List */}
      {showRequirements && (
        <ul className="mt-2 space-y-1">
          {requirements.map((req, index) => (
            <li
              key={index}
              className={`flex items-center text-fluid-xs transition-colors duration-200 ${
                req.met ? 'text-green-400' : 'text-neutral-400'
              }`}
            >
              <svg
                className={`w-3 h-3 mr-2 transition-colors duration-200 ${
                  req.met ? 'text-green-400' : 'text-neutral-500'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {req.met ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                ) : (
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    strokeWidth="2"
                    fill="none"
                  />
                )}
              </svg>
              {req.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;
