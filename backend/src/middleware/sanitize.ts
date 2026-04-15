/**
 * IRG_FTR PLATFORM - Input Sanitization Middleware
 * P1 AUDIT FIX: XSS protection for all description fields
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import { Request, Response, NextFunction } from 'express';

// ═══════════════════════════════════════════════════════════════════════════════
// SANITIZATION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  
  return str.replace(/[&<>"'`=\/]/g, (char) => htmlEscapes[char]);
}

/**
 * Remove potentially dangerous script tags and event handlers
 */
function stripDangerousContent(str: string): string {
  // Remove script tags
  let cleaned = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers
  cleaned = cleaned.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove javascript: URLs
  cleaned = cleaned.replace(/javascript:/gi, '');
  
  // Remove data: URLs (potential XSS vector)
  cleaned = cleaned.replace(/data:/gi, '');
  
  // Remove vbscript: (IE specific)
  cleaned = cleaned.replace(/vbscript:/gi, '');
  
  return cleaned;
}

/**
 * Fields that should be sanitized (description, comments, etc.)
 */
const FIELDS_TO_SANITIZE = [
  'description',
  'name',
  'title',
  'comment',
  'comments',
  'message',
  'content',
  'notes',
  'reason',
  'feedback',
  'bio',
  'about',
  'summary',
  'details',
  'text',
  'body',
];

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any, depth = 0): any {
  if (depth > 10) return obj; // Prevent infinite recursion
  
  if (typeof obj === 'string') {
    return escapeHtml(stripDangerousContent(obj));
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (FIELDS_TO_SANITIZE.includes(key.toLowerCase())) {
        // Sanitize known text fields
        sanitized[key] = sanitizeObject(value, depth + 1);
      } else if (typeof value === 'object') {
        // Recursively process nested objects
        sanitized[key] = sanitizeObject(value, depth + 1);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  return obj;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * P1 FIX: Middleware to sanitize all incoming request bodies
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  // Also sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  next();
}

/**
 * Sanitize a single string value (for use in services)
 */
export function sanitizeString(str: string): string {
  return escapeHtml(stripDangerousContent(str));
}

/**
 * Validate and sanitize email (prevents header injection)
 */
export function sanitizeEmail(email: string): string {
  // Remove any newlines or carriage returns (header injection prevention)
  return email.replace(/[\r\n]/g, '').trim().toLowerCase();
}

/**
 * Sanitize file name (prevent path traversal)
 */
export function sanitizeFileName(fileName: string): string {
  // Remove path separators and null bytes
  return fileName
    .replace(/[\/\\]/g, '')
    .replace(/\x00/g, '')
    .replace(/\.\./g, '')
    .trim();
}

export default sanitizeInput;
