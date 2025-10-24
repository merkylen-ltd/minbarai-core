import React from 'react';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading = false,
  loadingText = 'Loading...',
  icon,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-body rounded-button transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary-900 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-accent-500 hover:bg-accent-400 text-neutral-0 shadow-glow hover:shadow-glow-lg focus:ring-accent-400',
    secondary: 'bg-primary-600 hover:bg-primary-500 text-neutral-0 border border-accent-500/20 hover:border-accent-500/40 focus:ring-accent-400',
    outline: 'border-2 border-accent-500 text-accent-400 hover:bg-accent-500 hover:text-neutral-0 focus:ring-accent-400'
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-fluid-xs',
    md: 'px-4 py-3 text-fluid-sm',
    lg: 'px-6 py-4 text-fluid-base'
  };

  const widthClasses = fullWidth ? 'w-full' : '';

  const isDisabled = disabled || isLoading;

  return (
    <button
      disabled={isDisabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClasses} ${className}`}
      {...props}
    >
      {/* Loading Spinner */}
      {isLoading && (
        <svg
          className={`animate-spin ${size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} mr-2`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}

      {/* Icon */}
      {icon && !isLoading && (
        <span className={`${size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} mr-2`}>
          {icon}
        </span>
      )}

      {/* Button Text */}
      <span className="flex-1">
        {isLoading ? loadingText : children}
      </span>
    </button>
  );
};

export default LoadingButton;
