export interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

export const calculatePasswordStrength = (password: string): PasswordStrength => {
  if (!password) {
    return { score: 0, label: '', color: 'text-neutral-400' };
  }

  let score = 0;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[@$!%*?&]/.test(password);
  const checks = {
    length: password.length >= 6,
    letter: hasLetter,
    number: hasNumber,
    special: hasSpecial,
  };

  // Calculate score based on checks
  Object.values(checks).forEach(check => {
    if (check) score++;
  });

  // Bonus points for length
  if (password.length >= 10) score += 0.5;
  if (password.length >= 14) score += 0.5;

  // Determine label and color
  if (score < 2) {
    return { score: 1, label: 'Very Weak', color: 'text-red-500' };
  } else if (score < 3) {
    return { score: 2, label: 'Weak', color: 'text-orange-500' };
  } else if (score < 4) {
    return { score: 3, label: 'Fair', color: 'text-yellow-500' };
  } else if (score < 5) {
    return { score: 4, label: 'Good', color: 'text-blue-500' };
  } else if (score < 6) {
    return { score: 5, label: 'Strong', color: 'text-green-500' };
  } else {
    return { score: 6, label: 'Very Strong', color: 'text-green-600' };
  }
};

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!password) {
    errors.push('Password is required');
  } else {
    if (password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }
    if (!(/[A-Za-z]/.test(password))) {
      errors.push('Password must contain at least one letter');
    }
    if (!(/\d/.test(password))) {
      errors.push('Password must contain at least one number');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateEmail = (email: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!email) {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Please enter a valid email address');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validatePasswordConfirmation = (password: string, confirmPassword: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!confirmPassword) {
    errors.push('Please confirm your password');
  } else if (password !== confirmPassword) {
    errors.push('Passwords do not match');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const generateSecurePassword = (length: number = 12): string => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '@$!%*?&';
  
  const allChars = lowercase + uppercase + numbers + special;
  
  let password = '';
  
  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};
