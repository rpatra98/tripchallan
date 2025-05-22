import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format as fnsFormat } from "date-fns";

/**
 * Combines class names using clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Utility functions for the application
 */

/**
 * Determines if a user agent string is from a mobile device
 * @param userAgent The user agent string to check
 * @returns Object with device type and boolean flags for mobile/desktop
 */
export function detectDevice(userAgent: string = "") {
  const ua = userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua);
  
  return isMobile ? "mobile" : "desktop";
}

/**
 * Formats a date for display
 * @param date The date to format
 * @param formatStr Optional format string for date-fns
 * @returns Formatted date string
 */
export function formatDate(date: Date | string, formatStr?: string): string {
  if (!date) return '';
  
  const d = new Date(date);
  
  // If format string is provided, use date-fns formatting
  if (formatStr) {
    return fnsFormat(d, formatStr);
  }
  
  const now = new Date();
  const diffInHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
  
  // Format the time with seconds and AM/PM
  const timeFormat = { 
    hour: 'numeric' as const, 
    minute: 'numeric' as const, 
    second: 'numeric' as const, 
    hour12: true 
  };
  
  if (diffInHours < 24) {
    return `Today at ${d.toLocaleTimeString(undefined, timeFormat)}`;
  } else if (diffInHours < 48) {
    return `Yesterday at ${d.toLocaleTimeString(undefined, timeFormat)}`;
  } else {
    // Format: Month Day, Year h:mm:ss AM/PM
    return d.toLocaleString(undefined, {
      year: 'numeric' as const,
      month: 'short' as const,
      day: 'numeric' as const,
      hour: 'numeric' as const,
      minute: 'numeric' as const,
      second: 'numeric' as const,
      hour12: true
    });
  }
}

/**
 * Truncates a string to a maximum length and adds ellipsis if needed
 * @param text String to truncate
 * @param maxLength Maximum allowed length
 * @returns Truncated string
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + '...';
}

/**
 * Creates a deep copy of an object
 * @param obj Object to clone
 * @returns A deep copy of the object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Converts a File object to a base64 string
 * @param file The File to convert
 * @returns Promise resolving to base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
} 