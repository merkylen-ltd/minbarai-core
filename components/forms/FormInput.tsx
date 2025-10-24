import React, { forwardRef, useState } from 'react';

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  isLoading?: boolean;
  showPasswordToggle?: boolean;
  onPasswordToggle?: () => void;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
  helperClassName?: string;
}

const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      label,
      error,
      helperText,
      icon,
      suffixIcon,
      isLoading,
      showPasswordToggle,
      onPasswordToggle,
      containerClassName = '',
      labelClassName = '',
      inputClassName = '',
      errorClassName = '',
      helperClassName = '',
      className,
      id,
      type = 'text',
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const hasError = !!error;
    const isPasswordType = type === 'password' || showPasswordToggle;

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      props.onBlur?.(e);
    };

    return (
      <div className={`relative ${containerClassName}`}>
        {/* Label */}
        <label
          htmlFor={inputId}
          className={`block text-neutral-50 font-body text-fluid-xs mb-2 transition-colors duration-200 ${
            hasError ? 'text-red-400' : isFocused ? 'text-accent-400' : ''
          } ${labelClassName}`}
        >
          {label}
          {required && (
            <span className="text-red-400 ml-1" aria-label="required">
              *
            </span>
          )}
        </label>

        {/* Input Container */}
        <div className="relative">
          {/* Left Icon */}
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <div className={`${hasError ? 'text-red-400' : 'text-neutral-400'} transition-colors duration-200`}>
                {icon}
              </div>
            </div>
          )}

          {/* Input Field */}
          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled || isLoading}
            required={required}
            className={`
              w-full px-4 py-3 
              ${icon ? 'pl-10' : ''} 
              ${suffixIcon || isPasswordType ? 'pr-10' : ''}
              bg-primary-700/30 
              border transition-all duration-200
              ${hasError 
                ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' 
                : isFocused 
                ? 'border-accent-400 focus:border-accent-400 focus:ring-accent-400/20' 
                : 'border-accent-500/20 hover:border-accent-500/40'
              }
              rounded-button text-neutral-0 placeholder-neutral-400
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary-900
              disabled:opacity-50 disabled:cursor-not-allowed
              text-fluid-xs
              ${className} ${inputClassName}
            `}
            onFocus={handleFocus}
            onBlur={handleBlur}
            aria-invalid={hasError}
            aria-describedby={`${error ? errorId : ''} ${helperText ? helperId : ''}`.trim()}
            {...props}
          />

          {/* Loading Spinner */}
          {isLoading && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <div className="w-4 h-4 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {/* Password Toggle */}
          {isPasswordType && !isLoading && (
            <button
              type="button"
              onClick={onPasswordToggle}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-accent-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-2 focus:ring-offset-primary-900 rounded"
              aria-label={type === 'password' ? 'Show password' : 'Hide password'}
            >
              {type === 'password' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              )}
            </button>
          )}

          {/* Suffix Icon */}
          {suffixIcon && !isPasswordType && !isLoading && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <div className={`${hasError ? 'text-red-400' : 'text-neutral-400'} transition-colors duration-200`}>
                {suffixIcon}
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <p
            id={errorId}
            className={`mt-2 text-fluid-xs text-red-400 animate-slide-up ${errorClassName}`}
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}

        {/* Helper Text */}
        {helperText && !error && (
          <p
            id={helperId}
            className={`mt-2 text-fluid-xs text-neutral-400 ${helperClassName}`}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';

export default FormInput;
