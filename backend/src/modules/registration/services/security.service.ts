/**
 * IRG_FTR PLATFORM - Registration Security Service
 * TROT REGISTRATION PROTOCOL COMPLIANT
 * 
 * Provides comprehensive security for registration:
 * - Rate limiting (IP, device, fingerprint)
 * - CSRF token management
 * - Session security
 * - Fraud detection
 * - Brute force protection
 * - Geo-blocking/risk assessment
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  blocked: boolean;
  blockExpiresAt?: Date;
}

export interface SessionSecurityContext {
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  geoLocation?: GeoLocation;
  createdAt: Date;
  lastActivityAt: Date;
  csrfToken: string;
  isVerified: boolean;
  riskScore: number;
  flags: SecurityFlag[];
}

export interface GeoLocation {
  countryCode: string;
  regionCode?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  isVpn?: boolean;
  isProxy?: boolean;
  isTor?: boolean;
  isBotnet?: boolean;
  threatLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface SecurityFlag {
  type: SecurityFlagType;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export type SecurityFlagType =
  | 'RATE_LIMIT_EXCEEDED'
  | 'SUSPICIOUS_PATTERN'
  | 'GEO_ANOMALY'
  | 'DEVICE_MISMATCH'
  | 'CONCURRENT_SESSION'
  | 'BRUTE_FORCE_ATTEMPT'
  | 'CSRF_VIOLATION'
  | 'SESSION_HIJACK_ATTEMPT'
  | 'VPN_DETECTED'
  | 'TOR_EXIT_NODE'
  | 'KNOWN_BAD_IP'
  | 'HIGH_RISK_COUNTRY';

export interface FraudSignal {
  signalType: string;
  confidence: number;
  details: string;
  action: 'ALLOW' | 'CHALLENGE' | 'BLOCK' | 'REVIEW';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Registration initiation
  'registration:initiate': { windowMs: 60 * 60 * 1000, maxRequests: 10, blockDurationMs: 24 * 60 * 60 * 1000 },
  
  // Step submissions
  'registration:step': { windowMs: 60 * 1000, maxRequests: 30, blockDurationMs: 15 * 60 * 1000 },
  
  // OTP requests
  'registration:otp': { windowMs: 60 * 60 * 1000, maxRequests: 5, blockDurationMs: 60 * 60 * 1000 },
  
  // Document uploads
  'registration:upload': { windowMs: 60 * 60 * 1000, maxRequests: 20, blockDurationMs: 60 * 60 * 1000 },
  
  // Video KYC
  'registration:video_kyc': { windowMs: 24 * 60 * 60 * 1000, maxRequests: 3, blockDurationMs: 24 * 60 * 60 * 1000 },
  
  // Global per IP
  'global:ip': { windowMs: 60 * 1000, maxRequests: 100, blockDurationMs: 5 * 60 * 1000 },
};

const HIGH_RISK_COUNTRIES = ['KP', 'IR', 'SY', 'CU', 'VE', 'MM', 'YE', 'LY', 'SO', 'SD'];
const SANCTIONED_COUNTRIES = ['KP', 'IR', 'SY', 'CU'];

// Session configuration
const SESSION_CONFIG = {
  maxIdleTimeMs: 30 * 60 * 1000, // 30 minutes
  maxSessionDurationMs: 4 * 60 * 60 * 1000, // 4 hours
  maxConcurrentSessions: 2,
  csrfTokenTtlMs: 60 * 60 * 1000, // 1 hour
};

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY STORES (Use Redis in production)
// ═══════════════════════════════════════════════════════════════════════════════

// Rate limit tracking
const rateLimitStore = new Map<string, { count: number; resetAt: number; blocked?: number }>();

// Session store
const sessionStore = new Map<string, SessionSecurityContext>();

// Blocked IPs/fingerprints
const blockedStore = new Map<string, { until: number; reason: string }>();

// Failed attempts tracking (for brute force detection)
const failedAttempts = new Map<string, { count: number; firstAttempt: number }>();

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class SecurityService {
  
  // ─────────────────────────────────────────────────────────────────────────────
  // RATE LIMITING
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Check rate limit for an action
   */
  static checkRateLimit(
    identifier: string,
    action: string
  ): RateLimitResult {
    const config = RATE_LIMITS[action] || RATE_LIMITS['global:ip'];
    const key = `${action}:${identifier}`;
    const now = Date.now();
    
    // Check if blocked
    const blockEntry = blockedStore.get(key);
    if (blockEntry && blockEntry.until > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(blockEntry.until),
        blocked: true,
        blockExpiresAt: new Date(blockEntry.until),
      };
    }
    
    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + config.windowMs };
      rateLimitStore.set(key, entry);
    }
    
    entry.count++;
    
    // Check if exceeded
    if (entry.count > config.maxRequests) {
      // Block if configured
      if (config.blockDurationMs) {
        blockedStore.set(key, {
          until: now + config.blockDurationMs,
          reason: `Rate limit exceeded for ${action}`,
        });
      }
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.resetAt),
        blocked: !!config.blockDurationMs,
        blockExpiresAt: config.blockDurationMs 
          ? new Date(now + config.blockDurationMs) 
          : undefined,
      };
    }
    
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetAt: new Date(entry.resetAt),
      blocked: false,
    };
  }
  
  /**
   * Reset rate limit for identifier
   */
  static resetRateLimit(identifier: string, action: string): void {
    const key = `${action}:${identifier}`;
    rateLimitStore.delete(key);
    blockedStore.delete(key);
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // CSRF PROTECTION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Generate a CSRF token
   */
  static generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Validate CSRF token
   */
  static validateCsrfToken(
    sessionId: string,
    token: string
  ): boolean {
    const session = sessionStore.get(sessionId);
    if (!session) return false;
    
    // Constant-time comparison to prevent timing attacks
    const expected = session.csrfToken;
    if (expected.length !== token.length) return false;
    
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i);
    }
    
    return mismatch === 0;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // SESSION SECURITY
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Create a secure session
   */
  static createSession(
    ipAddress: string,
    userAgent: string,
    deviceFingerprint?: string,
    geoLocation?: GeoLocation
  ): SessionSecurityContext {
    const sessionId = crypto.randomUUID();
    const csrfToken = this.generateCsrfToken();
    const now = new Date();
    
    // Calculate initial risk score
    const flags: SecurityFlag[] = [];
    let riskScore = 0;
    
    // Geo risk assessment
    if (geoLocation) {
      if (SANCTIONED_COUNTRIES.includes(geoLocation.countryCode)) {
        flags.push({
          type: 'HIGH_RISK_COUNTRY',
          severity: 'CRITICAL',
          message: `Registration from sanctioned country: ${geoLocation.countryCode}`,
          timestamp: now,
        });
        riskScore += 100;
      } else if (HIGH_RISK_COUNTRIES.includes(geoLocation.countryCode)) {
        flags.push({
          type: 'HIGH_RISK_COUNTRY',
          severity: 'WARNING',
          message: `Registration from high-risk country: ${geoLocation.countryCode}`,
          timestamp: now,
        });
        riskScore += 30;
      }
      
      if (geoLocation.isVpn || geoLocation.isProxy) {
        flags.push({
          type: 'VPN_DETECTED',
          severity: 'WARNING',
          message: 'VPN or proxy detected',
          timestamp: now,
        });
        riskScore += 20;
      }
      
      if (geoLocation.isTor) {
        flags.push({
          type: 'TOR_EXIT_NODE',
          severity: 'CRITICAL',
          message: 'Tor exit node detected',
          timestamp: now,
        });
        riskScore += 50;
      }
    }
    
    const session: SessionSecurityContext = {
      sessionId,
      ipAddress,
      userAgent,
      deviceFingerprint,
      geoLocation,
      createdAt: now,
      lastActivityAt: now,
      csrfToken,
      isVerified: false,
      riskScore: Math.min(riskScore, 100),
      flags,
    };
    
    sessionStore.set(sessionId, session);
    
    return session;
  }
  
  /**
   * Validate session
   */
  static validateSession(
    sessionId: string,
    ipAddress: string,
    userAgent?: string
  ): { valid: boolean; reason?: string; flags?: SecurityFlag[] } {
    const session = sessionStore.get(sessionId);
    const now = Date.now();
    const flags: SecurityFlag[] = [];
    
    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }
    
    // Check session expiry
    const sessionAge = now - session.createdAt.getTime();
    if (sessionAge > SESSION_CONFIG.maxSessionDurationMs) {
      sessionStore.delete(sessionId);
      return { valid: false, reason: 'Session expired (max duration)' };
    }
    
    // Check idle timeout
    const idleTime = now - session.lastActivityAt.getTime();
    if (idleTime > SESSION_CONFIG.maxIdleTimeMs) {
      sessionStore.delete(sessionId);
      return { valid: false, reason: 'Session expired (idle timeout)' };
    }
    
    // Check IP change (potential session hijack)
    if (session.ipAddress !== ipAddress) {
      flags.push({
        type: 'SESSION_HIJACK_ATTEMPT',
        severity: 'CRITICAL',
        message: `IP address changed from ${session.ipAddress} to ${ipAddress}`,
        timestamp: new Date(),
        metadata: { originalIp: session.ipAddress, newIp: ipAddress },
      });
      
      // In strict mode, invalidate session
      // For now, flag but allow with increased risk
      session.riskScore = Math.min(session.riskScore + 40, 100);
    }
    
    // Update last activity
    session.lastActivityAt = new Date();
    session.flags.push(...flags);
    
    return {
      valid: true,
      flags: flags.length > 0 ? flags : undefined,
    };
  }
  
  /**
   * Get session
   */
  static getSession(sessionId: string): SessionSecurityContext | null {
    return sessionStore.get(sessionId) || null;
  }
  
  /**
   * Destroy session
   */
  static destroySession(sessionId: string): void {
    sessionStore.delete(sessionId);
  }
  
  /**
   * Refresh CSRF token
   */
  static refreshCsrfToken(sessionId: string): string | null {
    const session = sessionStore.get(sessionId);
    if (!session) return null;
    
    session.csrfToken = this.generateCsrfToken();
    return session.csrfToken;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // BRUTE FORCE PROTECTION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Record failed attempt
   */
  static recordFailedAttempt(
    identifier: string,
    action: string
  ): { blocked: boolean; attempts: number; lockoutUntil?: Date } {
    const key = `failed:${action}:${identifier}`;
    const now = Date.now();
    const lockoutThreshold = 5;
    const lockoutDurationMs = 15 * 60 * 1000; // 15 minutes
    const windowMs = 60 * 60 * 1000; // 1 hour
    
    let entry = failedAttempts.get(key);
    
    // Reset if window expired
    if (entry && (now - entry.firstAttempt) > windowMs) {
      entry = undefined;
    }
    
    if (!entry) {
      entry = { count: 0, firstAttempt: now };
    }
    
    entry.count++;
    failedAttempts.set(key, entry);
    
    if (entry.count >= lockoutThreshold) {
      const lockoutUntil = new Date(now + lockoutDurationMs);
      blockedStore.set(identifier, {
        until: lockoutUntil.getTime(),
        reason: `Too many failed ${action} attempts`,
      });
      
      return {
        blocked: true,
        attempts: entry.count,
        lockoutUntil,
      };
    }
    
    return {
      blocked: false,
      attempts: entry.count,
    };
  }
  
  /**
   * Clear failed attempts
   */
  static clearFailedAttempts(identifier: string, action: string): void {
    const key = `failed:${action}:${identifier}`;
    failedAttempts.delete(key);
    blockedStore.delete(identifier);
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // FRAUD DETECTION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Analyze request for fraud signals
   */
  static analyzeForFraud(
    session: SessionSecurityContext,
    action: string,
    metadata?: Record<string, any>
  ): FraudSignal[] {
    const signals: FraudSignal[] = [];
    
    // High risk score
    if (session.riskScore >= 80) {
      signals.push({
        signalType: 'HIGH_RISK_SCORE',
        confidence: 0.9,
        details: `Session risk score is ${session.riskScore}`,
        action: 'BLOCK',
      });
    } else if (session.riskScore >= 50) {
      signals.push({
        signalType: 'ELEVATED_RISK_SCORE',
        confidence: 0.7,
        details: `Session risk score is ${session.riskScore}`,
        action: 'CHALLENGE',
      });
    }
    
    // Multiple critical flags
    const criticalFlags = session.flags.filter(f => f.severity === 'CRITICAL');
    if (criticalFlags.length >= 2) {
      signals.push({
        signalType: 'MULTIPLE_CRITICAL_FLAGS',
        confidence: 0.85,
        details: `${criticalFlags.length} critical security flags`,
        action: 'REVIEW',
      });
    }
    
    // Rapid submission patterns (bot detection)
    const sessionAge = Date.now() - session.createdAt.getTime();
    if (sessionAge < 5000 && action === 'registration:step') {
      signals.push({
        signalType: 'SUSPICIOUS_SPEED',
        confidence: 0.8,
        details: 'Form submitted too quickly (possible bot)',
        action: 'CHALLENGE',
      });
    }
    
    // Sanctioned country
    if (session.geoLocation && SANCTIONED_COUNTRIES.includes(session.geoLocation.countryCode)) {
      signals.push({
        signalType: 'SANCTIONED_COUNTRY',
        confidence: 1.0,
        details: `Request from sanctioned country: ${session.geoLocation.countryCode}`,
        action: 'BLOCK',
      });
    }
    
    return signals;
  }
  
  /**
   * Determine overall action based on fraud signals
   */
  static determineFraudAction(signals: FraudSignal[]): 'ALLOW' | 'CHALLENGE' | 'BLOCK' | 'REVIEW' {
    if (signals.length === 0) return 'ALLOW';
    
    // Find highest severity action
    const actions = signals.map(s => s.action);
    
    if (actions.includes('BLOCK')) return 'BLOCK';
    if (actions.includes('REVIEW')) return 'REVIEW';
    if (actions.includes('CHALLENGE')) return 'CHALLENGE';
    
    return 'ALLOW';
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // GEO-IP LOOKUP (Mock - Use MaxMind/IP2Location in production)
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Lookup geo location from IP (mock implementation)
   */
  static async lookupGeoLocation(ipAddress: string): Promise<GeoLocation | null> {
    // In production, integrate with MaxMind GeoIP2 or similar service
    // This is a mock implementation
    
    // Private/local IPs
    if (
      ipAddress.startsWith('10.') ||
      ipAddress.startsWith('192.168.') ||
      ipAddress.startsWith('172.16.') ||
      ipAddress.startsWith('127.') ||
      ipAddress === 'localhost'
    ) {
      return {
        countryCode: 'XX',
        city: 'Local',
        isVpn: false,
        isProxy: false,
        isTor: false,
        threatLevel: 'LOW',
      };
    }
    
    // Mock response
    return {
      countryCode: 'IN',
      regionCode: 'MH',
      city: 'Mumbai',
      latitude: 19.0760,
      longitude: 72.8777,
      isVpn: false,
      isProxy: false,
      isTor: false,
      threatLevel: 'LOW',
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // DEVICE FINGERPRINTING
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Generate device fingerprint from browser attributes
   */
  static generateDeviceFingerprint(attributes: {
    userAgent: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    colorDepth?: number;
    platform?: string;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    webglVendor?: string;
    webglRenderer?: string;
    canvas?: string;
  }): string {
    const data = JSON.stringify({
      ua: attributes.userAgent,
      sr: attributes.screenResolution,
      tz: attributes.timezone,
      lang: attributes.language,
      cd: attributes.colorDepth,
      plat: attributes.platform,
      hc: attributes.hardwareConcurrency,
      dm: attributes.deviceMemory,
      wv: attributes.webglVendor,
      wr: attributes.webglRenderer,
      cv: attributes.canvas ? crypto.createHash('sha256').update(attributes.canvas).digest('hex').substring(0, 16) : undefined,
    });
    
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PASSWORD SECURITY
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Check password strength
   */
  static checkPasswordStrength(password: string): {
    score: number;
    feedback: string[];
    isAcceptable: boolean;
  } {
    const feedback: string[] = [];
    let score = 0;
    
    // Length check
    if (password.length < 8) {
      feedback.push('Password must be at least 8 characters');
    } else if (password.length >= 12) {
      score += 2;
    } else {
      score += 1;
    }
    
    // Character variety
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Add lowercase letters');
    
    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Add uppercase letters');
    
    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Add numbers');
    
    if (/[^a-zA-Z0-9]/.test(password)) score += 2;
    else feedback.push('Add special characters');
    
    // Common patterns (weak)
    const weakPatterns = [
      /^123456/i, /^password/i, /^qwerty/i, /^admin/i,
      /(.)\1{2,}/, // Repeated characters
      /^[a-z]+$/i, // Only letters
      /^[0-9]+$/, // Only numbers
    ];
    
    for (const pattern of weakPatterns) {
      if (pattern.test(password)) {
        score = Math.max(0, score - 2);
        feedback.push('Avoid common patterns and repeated characters');
        break;
      }
    }
    
    // Personal info check would happen with actual user data
    // This is handled in HEP validators
    
    return {
      score: Math.min(10, Math.max(0, score)),
      feedback,
      isAcceptable: score >= 5 && password.length >= 8,
    };
  }
  
  /**
   * Hash password with salt
   */
  static hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
  }
  
  /**
   * Verify password
   */
  static verifyPassword(password: string, hash: string, salt: string): boolean {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }
}

// Export singleton instance
export const securityService = new SecurityService();
