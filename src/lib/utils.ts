import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date) {
  if (!date) {
    return 'N/A';
  }
  
  const dateObject = new Date(date);
  
  if (isNaN(dateObject.getTime())) {
    return 'Invalid Date';
  }
  
  return new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObject);
}

export function formatRelativeTime(date: string | Date) {
  if (!date) {
    return 'N/A';
  }
  
  const now = new Date();
  const target = new Date(date);
  
  if (isNaN(target.getTime())) {
    return 'Invalid Date';
  }
  
  const diffInSeconds = Math.floor((now.getTime() - target.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }

  return formatDate(date);
}

export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function generateUUID() {
  return crypto.randomUUID();
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function stripMarkdown(text: string): string {
  if (!text) return '';
  
  // Remove code blocks first to avoid matching internal characters
  let clean = text.replace(/```[\s\S]*?```/g, (match) => {
    return match.replace(/```/g, '').trim();
  });

  clean = clean
    // Remove headers (keep text)
    .replace(/^#+\s+/gm, '')
    // Remove bold/italic (keep text)
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove links (keep text)
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // Remove inline code (keep text)
    .replace(/`([^`]+)`/g, '$1')
    // Remove blockquotes (keep text)
    .replace(/^>\s+/gm, '')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1')
    // Remove horizontal rules
    .replace(/^-{3,}$/gm, '')
    .trim();

  return clean;
}

export function hasPermission(userRole: string | undefined, requiredRole: string | string[]) {
  if (!userRole) return false;
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const roleHierarchy: Record<string, number> = {
    user: 1,
    admin: 2,
    super_admin: 3
  };

  return roles.some(role => (roleHierarchy[userRole] || 0) >= (roleHierarchy[role] || 0));
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();

  if (hour >= 0 && hour < 12) {
    return 'Good morning';
  } else if (hour >= 12 && hour < 18) {
    return 'Good afternoon';
  } else {
    return 'Good evening';
  }
}

export function getPersonalizedGreeting(userName?: string): string {
  const greeting = getTimeBasedGreeting();
  const firstName = userName?.split(' ')[0] || 'there';
  return `${greeting}, ${firstName}!`;
}

export function hasPremiumAccess(userPlan?: string, userRole?: string): boolean {
  if (userRole === 'admin' || userRole === 'super_admin') return true;
  return userPlan === 'pro' || userPlan === 'enterprise';
}
