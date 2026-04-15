/**
 * IRG_FTR PLATFORM - Registration Security Middleware
 * TROT REGISTRATION PROTOCOL COMPLIANT
 * 
 * Express middleware for:
 * - Rate limiting per action type
 * - CSRF token validation
 * - Session validation
 * - Fraud detection
 * - Geo-blocking
 * - Request logging
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import { Request, Response, NextFunction } from 'express';
import {
  SecurityService,
  SessionSecurityContext,
  FraudSignal,
} from '../services/security.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RegistrationRequest extends Request {
  registrationSession?: SessionSecurityContext;
  fraudSignals?: FraudSignal[];
  rateLimitInfo?: {
    remaining: number;
    resetAt: Date;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rate limiting middleware factory
 */
export function rateLimit(action: string) {
  return (req: RegistrationRequest, res: Response, next: NextFunction) => {
    const identifier = getClientIdentifier(req);
    const result = SecurityService.checkRateLimit(identifier, action);
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());
    
    if (!result.allowed) {
      const errorResponse: any = {
        success: false,
        error: {
          code: result.blocked ? 'RATE_LIMIT_BLOCKED' : 'RATE_LIMIT_EXCEEDED',
          message: result.blocked
            ? `Too many requests. Blocked until ${result.blockExpiresAt?.toISOString()}`
            : `Rate limit exceeded. Try again at ${result.resetAt.toISOString()}`,
        },
      };
      
      if (result.blockExpiresAt) {
        errorResponse.blockedUntil = result.blockExpiresAt.toISOString();
      }
      
      return res.status(429).json(errorResponse);
    }
    
    req.rateLimitInfo = {
      remaining: result.remaining,
      resetAt: result.resetAt,
    };
    
    next();
  };
}

/**
 * Session validation middleware
 */
export function validateSession(req: RegistrationRequest, res: Response, next: NextFunction) {
  const sessionToken = req.headers['x-registration-session'] as string;
  
  if (!sessionToken) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'SESSION_REQUIRED',
        message: 'Registration session token is required',
      },
    });
  }
  
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'];
  
  const validation = SecurityService.validateSession(sessionToken, ipAddress, userAgent);
  
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'SESSION_INVALID',
        message: validation.reason || 'Invalid or expired session',
      },
    });
  }
  
  // Get full session context
  const session = SecurityService.getSession(sessionToken);
  if (session) {
    req.registrationSession = session;
    
    // Log security flags if any
    if (validation.flags && validation.flags.length > 0) {
      console.warn(`[SECURITY] Session ${sessionToken.substring(0, 8)}... has flags:`, validation.flags);
    }
  }
  
  next();
}

/**
 * CSRF validation middleware
 */
export function validateCsrf(req: RegistrationRequest, res: Response, next: NextFunction) {
  // Skip for GET/HEAD/OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  const sessionToken = req.headers['x-registration-session'] as string;
  const csrfToken = req.headers['x-csrf-token'] as string;
  
  if (!sessionToken || !csrfToken) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_MISSING',
        message: 'CSRF token is required for this request',
      },
    });
  }
  
  const isValid = SecurityService.validateCsrfToken(sessionToken, csrfToken);
  
  if (!isValid) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_INVALID',
        message: 'Invalid CSRF token',
      },
    });
  }
  
  next();
}

/**
 * Fraud detection middleware
 */
export function detectFraud(action: string) {
  return (req: RegistrationRequest, res: Response, next: NextFunction) => {
    if (!req.registrationSession) {
      return next();
    }
    
    const signals = SecurityService.analyzeForFraud(
      req.registrationSession,
      action,
      { body: req.body, query: req.query }
    );
    
    req.fraudSignals = signals;
    
    const decision = SecurityService.determineFraudAction(signals);
    
    switch (decision) {
      case 'BLOCK':
        return res.status(403).json({
          success: false,
          error: {
            code: 'FRAUD_DETECTED',
            message: 'This request has been blocked due to suspicious activity',
          },
        });
        
      case 'REVIEW':
        // Log for manual review but allow to proceed
        console.warn(`[FRAUD] Request flagged for review:`, {
          sessionId: req.registrationSession.sessionId.substring(0, 8),
          action,
          signals,
        });
        break;
        
      case 'CHALLENGE':
        // In production, could require additional verification (CAPTCHA, 2FA)
        res.setHeader('X-Fraud-Challenge', 'required');
        break;
        
      case 'ALLOW':
      default:
        break;
    }
    
    next();
  };
}

/**
 * Geo-blocking middleware
 */
export function checkGeoRestrictions(req: RegistrationRequest, res: Response, next: NextFunction) {
  if (!req.registrationSession?.geoLocation) {
    return next();
  }
  
  const geo = req.registrationSession.geoLocation;
  const sanctionedCountries = ['KP', 'IR', 'SY', 'CU'];
  
  if (sanctionedCountries.includes(geo.countryCode)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'GEO_RESTRICTED',
        message: 'Service is not available in your region due to regulatory restrictions',
      },
    });
  }
  
  next();
}

/**
 * Request logging middleware for audit trail
 */
export function auditLog(action: string) {
  return (req: RegistrationRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Log request
    console.log(`[AUDIT] ${requestId} START`, {
      action,
      method: req.method,
      path: req.path,
      ip: getClientIp(req),
      sessionId: req.registrationSession?.sessionId?.substring(0, 8),
      timestamp: new Date().toISOString(),
    });
    
    // Capture response
    const originalSend = res.send;
    res.send = function(body: any) {
      const duration = Date.now() - startTime;
      
      console.log(`[AUDIT] ${requestId} END`, {
        action,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
      
      return originalSend.call(this, body);
    };
    
    next();
  };
}

/**
 * Honeypot field detection (bot protection)
 */
export function honeypotCheck(req: RegistrationRequest, res: Response, next: NextFunction) {
  // Check for honeypot fields that should be empty
  const honeypotFields = ['_hp_email', '_hp_phone', '_hp_name', 'website_url_confirm'];
  
  for (const field of honeypotFields) {
    if (req.body[field]) {
      console.warn(`[BOT_DETECTION] Honeypot triggered: ${field}`);
      
      // Return success but don't process (silent fail for bots)
      return res.json({
        success: true,
        data: { message: 'Request processed' },
      });
    }
  }
  
  next();
}

/**
 * Request timing validation (anti-bot)
 */
export function validateRequestTiming(minDelayMs: number = 2000) {
  return (req: RegistrationRequest, res: Response, next: NextFunction) => {
    if (!req.registrationSession) {
      return next();
    }
    
    const sessionAge = Date.now() - req.registrationSession.createdAt.getTime();
    
    if (sessionAge < minDelayMs) {
      console.warn(`[BOT_DETECTION] Request too fast: ${sessionAge}ms`);
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'REQUEST_TOO_FAST',
          message: 'Please take your time to complete the form',
        },
      });
    }
    
    next();
  };
}

/**
 * Combined security middleware for registration endpoints
 */
export function registrationSecurity(action: string, options?: {
  skipCsrf?: boolean;
  skipFraud?: boolean;
  skipTiming?: boolean;
  minDelay?: number;
}) {
  const middlewares = [
    rateLimit(action),
    validateSession,
  ];
  
  if (!options?.skipCsrf) {
    middlewares.push(validateCsrf);
  }
  
  if (!options?.skipFraud) {
    middlewares.push(detectFraud(action));
  }
  
  if (!options?.skipTiming) {
    middlewares.push(validateRequestTiming(options?.minDelay));
  }
  
  middlewares.push(checkGeoRestrictions);
  middlewares.push(auditLog(action));
  middlewares.push(honeypotCheck);
  
  return middlewares;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get client IP address
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
    return ips[0].trim();
  }
  
  return req.socket.remoteAddress || req.ip || 'unknown';
}

/**
 * Get client identifier for rate limiting (IP + fingerprint if available)
 */
function getClientIdentifier(req: Request): string {
  const ip = getClientIp(req);
  const fingerprint = req.headers['x-device-fingerprint'] as string;
  
  if (fingerprint) {
    return `${ip}:${fingerprint}`;
  }
  
  return ip;
}

/**
 * Create a new registration session
 */
export async function createRegistrationSession(req: Request): Promise<SessionSecurityContext> {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const fingerprint = req.headers['x-device-fingerprint'] as string;
  
  // Lookup geo location
  const geoLocation = await SecurityService.lookupGeoLocation(ipAddress);
  
  return SecurityService.createSession(
    ipAddress,
    userAgent,
    fingerprint,
    geoLocation || undefined
  );
}

/**
 * Refresh CSRF token for session
 */
export function refreshCsrfToken(sessionId: string): string | null {
  return SecurityService.refreshCsrfToken(sessionId);
}

/**
 * End registration session
 */
export function endRegistrationSession(sessionId: string): void {
  SecurityService.destroySession(sessionId);
}
