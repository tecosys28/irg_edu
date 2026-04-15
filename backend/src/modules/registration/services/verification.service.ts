/**
 * IRG_FTR PLATFORM - Verification Service
 * TROT REGISTRATION PROTOCOL COMPLIANT
 * 
 * Handles all verification needs:
 * - OTP generation and validation (SMS, Email, WhatsApp)
 * - Email verification links
 * - Phone number verification
 * - Penny drop bank verification
 * - Video KYC session management
 * - Biometric verification
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type OtpChannel = 'SMS' | 'EMAIL' | 'WHATSAPP' | 'VOICE';

export interface OtpGenerationResult {
  otpId: string;
  channel: OtpChannel;
  destination: string;
  expiresAt: Date;
  attemptsRemaining: number;
  cooldownUntil?: Date;
}

export interface OtpVerificationResult {
  success: boolean;
  reason?: string;
  attemptsRemaining?: number;
  locked?: boolean;
  lockUntil?: Date;
}

export interface EmailVerificationResult {
  token: string;
  email: string;
  expiresAt: Date;
  verificationUrl: string;
}

export interface PennyDropResult {
  success: boolean;
  transactionId: string;
  amount: number;
  currency: string;
  accountHolderName?: string;
  nameMatchScore?: number;
  bankResponseCode?: string;
  verifiedAt?: Date;
  failureReason?: string;
}

export interface VideoKycSession {
  sessionId: string;
  sessionUrl: string;
  provider: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  livenessScore?: number;
  faceMatchScore?: number;
  documentVerified?: boolean;
  recordingUrl?: string;
}

export interface BiometricVerificationResult {
  success: boolean;
  biometricType: 'FINGERPRINT' | 'FACE' | 'IRIS';
  matchScore: number;
  livenessScore: number;
  qualityScore: number;
  deviceId?: string;
  templateHash?: string;
  verifiedAt: Date;
  failureReason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const OTP_CONFIG = {
  length: 6,
  ttlSeconds: 300, // 5 minutes
  maxAttempts: 3,
  cooldownSeconds: 60, // 1 minute between resends
  maxResendsPerHour: 5,
  lockoutDurationSeconds: 900, // 15 minutes
};

const EMAIL_VERIFICATION_CONFIG = {
  ttlHours: 24,
  baseUrl: process.env.APP_URL || 'https://irg-ftr.com',
};

const VIDEO_KYC_CONFIG = {
  ttlMinutes: 30,
  providers: {
    primary: 'DIGIO',
    fallback: 'SIGNZY',
  },
  minLivenessScore: 0.8,
  minFaceMatchScore: 0.85,
};

const PENNY_DROP_CONFIG = {
  amount: 1.00, // ₹1 for verification
  currency: 'INR',
  ttlMinutes: 15,
  minNameMatchScore: 0.7,
};

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY STORES (Use Redis in production)
// ═══════════════════════════════════════════════════════════════════════════════

interface OtpRecord {
  otpHash: string;
  channel: OtpChannel;
  destination: string;
  expiresAt: number;
  attempts: number;
  verified: boolean;
  createdAt: number;
}

interface ResendTracker {
  count: number;
  firstSendAt: number;
  lastSendAt: number;
}

const otpStore = new Map<string, OtpRecord>();
const resendTracker = new Map<string, ResendTracker>();
const lockoutStore = new Map<string, number>(); // destination -> lockout until timestamp
const emailVerificationStore = new Map<string, { email: string; expiresAt: number; verified: boolean }>();
const videoKycSessions = new Map<string, VideoKycSession>();
const pennyDropStore = new Map<string, PennyDropResult>();

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class VerificationService {
  
  // ─────────────────────────────────────────────────────────────────────────────
  // OTP GENERATION & VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Generate and send OTP
   */
  static async generateOtp(
    participantId: string,
    channel: OtpChannel,
    destination: string
  ): Promise<OtpGenerationResult> {
    const now = Date.now();
    const key = `${participantId}:${channel}:${destination}`;
    
    // Check if locked out
    const lockUntil = lockoutStore.get(destination);
    if (lockUntil && lockUntil > now) {
      throw new Error(`Account locked. Try again at ${new Date(lockUntil).toISOString()}`);
    }
    
    // Check resend cooldown
    const tracker = resendTracker.get(key);
    if (tracker) {
      // Check per-hour limit
      const hourAgo = now - 60 * 60 * 1000;
      if (tracker.firstSendAt > hourAgo && tracker.count >= OTP_CONFIG.maxResendsPerHour) {
        const cooldownUntil = new Date(tracker.firstSendAt + 60 * 60 * 1000);
        throw new Error(`Maximum OTP requests exceeded. Try again after ${cooldownUntil.toISOString()}`);
      }
      
      // Check cooldown between sends
      const cooldownEnd = tracker.lastSendAt + OTP_CONFIG.cooldownSeconds * 1000;
      if (cooldownEnd > now) {
        return {
          otpId: '', // No new OTP generated
          channel,
          destination: this.maskDestination(destination, channel),
          expiresAt: new Date(cooldownEnd),
          attemptsRemaining: OTP_CONFIG.maxAttempts,
          cooldownUntil: new Date(cooldownEnd),
        };
      }
    }
    
    // Generate OTP
    const otp = this.generateNumericOtp(OTP_CONFIG.length);
    const otpId = crypto.randomUUID();
    const otpHash = this.hashOtp(otp);
    const expiresAt = now + OTP_CONFIG.ttlSeconds * 1000;
    
    // Store OTP
    const record: OtpRecord = {
      otpHash,
      channel,
      destination,
      expiresAt,
      attempts: 0,
      verified: false,
      createdAt: now,
    };
    otpStore.set(otpId, record);
    
    // Update resend tracker
    const newTracker: ResendTracker = {
      count: (tracker?.count || 0) + 1,
      firstSendAt: tracker?.firstSendAt || now,
      lastSendAt: now,
    };
    resendTracker.set(key, newTracker);
    
    // Send OTP via appropriate channel
    await this.sendOtp(otp, channel, destination);
    
    return {
      otpId,
      channel,
      destination: this.maskDestination(destination, channel),
      expiresAt: new Date(expiresAt),
      attemptsRemaining: OTP_CONFIG.maxAttempts,
    };
  }
  
  /**
   * Verify OTP
   */
  static verifyOtp(otpId: string, otp: string): OtpVerificationResult {
    const now = Date.now();
    const record = otpStore.get(otpId);
    
    if (!record) {
      return { success: false, reason: 'Invalid or expired OTP session' };
    }
    
    if (record.verified) {
      return { success: false, reason: 'OTP already used' };
    }
    
    if (record.expiresAt < now) {
      otpStore.delete(otpId);
      return { success: false, reason: 'OTP expired' };
    }
    
    // Increment attempts
    record.attempts++;
    
    // Check lockout
    if (record.attempts > OTP_CONFIG.maxAttempts) {
      const lockUntil = now + OTP_CONFIG.lockoutDurationSeconds * 1000;
      lockoutStore.set(record.destination, lockUntil);
      otpStore.delete(otpId);
      
      return {
        success: false,
        reason: 'Too many failed attempts',
        locked: true,
        lockUntil: new Date(lockUntil),
      };
    }
    
    // Verify OTP
    const otpHash = this.hashOtp(otp);
    if (otpHash !== record.otpHash) {
      return {
        success: false,
        reason: 'Invalid OTP',
        attemptsRemaining: OTP_CONFIG.maxAttempts - record.attempts,
      };
    }
    
    // Mark as verified
    record.verified = true;
    
    return { success: true };
  }
  
  /**
   * Generate numeric OTP
   */
  private static generateNumericOtp(length: number): string {
    const chars = '0123456789';
    let otp = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      otp += chars[randomBytes[i] % chars.length];
    }
    
    // Ensure first digit is not 0
    if (otp[0] === '0') {
      otp = (Math.floor(Math.random() * 9) + 1).toString() + otp.substring(1);
    }
    
    return otp;
  }
  
  /**
   * Hash OTP for storage
   */
  private static hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }
  
  /**
   * Mask destination for display
   */
  private static maskDestination(destination: string, channel: OtpChannel): string {
    if (channel === 'EMAIL') {
      const [local, domain] = destination.split('@');
      const maskedLocal = local.substring(0, 2) + '***' + local.substring(local.length - 1);
      return `${maskedLocal}@${domain}`;
    } else {
      // Phone numbers
      const last4 = destination.slice(-4);
      return `****${last4}`;
    }
  }
  
  /**
   * Send OTP via channel (mock implementation)
   */
  private static async sendOtp(otp: string, channel: OtpChannel, destination: string): Promise<void> {
    // In production, integrate with:
    // - SMS: Twilio, MSG91, AWS SNS
    // - Email: SendGrid, AWS SES
    // - WhatsApp: Twilio WhatsApp API, Gupshup
    // - Voice: Twilio Voice
    
    console.log(`[VERIFICATION] Sending OTP ${otp} via ${channel} to ${destination}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In production, throw error on send failure
    // throw new Error('Failed to send OTP');
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // EMAIL VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Generate email verification link
   */
  static generateEmailVerification(
    participantId: string,
    email: string
  ): EmailVerificationResult {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + EMAIL_VERIFICATION_CONFIG.ttlHours * 60 * 60 * 1000;
    
    emailVerificationStore.set(token, {
      email,
      expiresAt,
      verified: false,
    });
    
    const verificationUrl = `${EMAIL_VERIFICATION_CONFIG.baseUrl}/api/v1/registration/verify/email?token=${token}&participantId=${participantId}`;
    
    // Send email with verification link
    this.sendVerificationEmail(email, verificationUrl);
    
    return {
      token,
      email: this.maskDestination(email, 'EMAIL'),
      expiresAt: new Date(expiresAt),
      verificationUrl,
    };
  }
  
  /**
   * Verify email token
   */
  static verifyEmailToken(token: string): { success: boolean; email?: string; reason?: string } {
    const record = emailVerificationStore.get(token);
    
    if (!record) {
      return { success: false, reason: 'Invalid verification link' };
    }
    
    if (record.expiresAt < Date.now()) {
      emailVerificationStore.delete(token);
      return { success: false, reason: 'Verification link expired' };
    }
    
    if (record.verified) {
      return { success: false, reason: 'Email already verified' };
    }
    
    record.verified = true;
    
    return { success: true, email: record.email };
  }
  
  /**
   * Send verification email (mock)
   */
  private static async sendVerificationEmail(email: string, verificationUrl: string): Promise<void> {
    console.log(`[VERIFICATION] Sending verification email to ${email}: ${verificationUrl}`);
    // In production, use email service
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PENNY DROP VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Initiate penny drop verification
   */
  static async initiatePennyDrop(
    participantId: string,
    bankAccount: {
      accountNumber: string;
      ifscCode: string;
      accountHolderName: string;
    }
  ): Promise<{ transactionId: string; status: string; expiresAt: Date }> {
    const transactionId = `PD_${crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
    const now = Date.now();
    const expiresAt = now + PENNY_DROP_CONFIG.ttlMinutes * 60 * 1000;
    
    // In production, integrate with bank API:
    // - ICICI Collect Now
    // - Cashfree Verification Suite
    // - Razorpay Bank Account Verification
    
    console.log(`[PENNY_DROP] Initiating for ${bankAccount.accountNumber} @ ${bankAccount.ifscCode}`);
    
    // Mock: Store pending verification
    const pendingResult: PennyDropResult = {
      success: false,
      transactionId,
      amount: PENNY_DROP_CONFIG.amount,
      currency: PENNY_DROP_CONFIG.currency,
    };
    pennyDropStore.set(transactionId, pendingResult);
    
    // Simulate async verification (in production, this would be webhook-based)
    setTimeout(() => {
      this.completePennyDrop(transactionId, bankAccount.accountHolderName);
    }, 2000);
    
    return {
      transactionId,
      status: 'INITIATED',
      expiresAt: new Date(expiresAt),
    };
  }
  
  /**
   * Complete penny drop (called by webhook or polling)
   */
  private static completePennyDrop(transactionId: string, expectedName: string): void {
    const result = pennyDropStore.get(transactionId);
    if (!result) return;
    
    // Mock: Bank returns account holder name
    const bankReturnedName = expectedName; // In production, this comes from bank API
    
    // Calculate name match score
    const nameMatchScore = this.calculateNameMatchScore(expectedName, bankReturnedName);
    
    result.success = nameMatchScore >= PENNY_DROP_CONFIG.minNameMatchScore;
    result.accountHolderName = bankReturnedName;
    result.nameMatchScore = nameMatchScore;
    result.bankResponseCode = 'SUCCESS';
    result.verifiedAt = new Date();
    
    if (!result.success) {
      result.failureReason = `Name mismatch (score: ${nameMatchScore.toFixed(2)})`;
    }
    
    console.log(`[PENNY_DROP] Completed ${transactionId}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  }
  
  /**
   * Get penny drop result
   */
  static getPennyDropResult(transactionId: string): PennyDropResult | null {
    return pennyDropStore.get(transactionId) || null;
  }
  
  /**
   * Calculate name similarity score using Jaro-Winkler
   */
  private static calculateNameMatchScore(name1: string, name2: string): number {
    // Normalize names
    const n1 = name1.toLowerCase().trim().replace(/\s+/g, ' ');
    const n2 = name2.toLowerCase().trim().replace(/\s+/g, ' ');
    
    if (n1 === n2) return 1.0;
    
    // Simple Levenshtein-based similarity
    const maxLen = Math.max(n1.length, n2.length);
    if (maxLen === 0) return 1.0;
    
    const distance = this.levenshteinDistance(n1, n2);
    return 1 - distance / maxLen;
  }
  
  /**
   * Levenshtein distance
   */
  private static levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }
    
    return dp[m][n];
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // VIDEO KYC
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Initiate video KYC session
   */
  static async initiateVideoKyc(
    participantId: string,
    countryCode: string,
    documentType: string
  ): Promise<VideoKycSession> {
    const sessionId = `VKYC_${crypto.randomUUID().replace(/-/g, '').substring(0, 16).toUpperCase()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + VIDEO_KYC_CONFIG.ttlMinutes * 60 * 1000);
    
    // In production, integrate with:
    // - DigiLocker (India)
    // - Signzy
    // - IDfy
    // - Jumio
    // - Onfido
    
    // Generate session URL (mock)
    const sessionUrl = `https://vkyc.irg-ftr.com/session/${sessionId}?participant=${participantId}`;
    
    const session: VideoKycSession = {
      sessionId,
      sessionUrl,
      provider: VIDEO_KYC_CONFIG.providers.primary,
      createdAt: now,
      expiresAt,
      status: 'PENDING',
    };
    
    videoKycSessions.set(sessionId, session);
    
    console.log(`[VIDEO_KYC] Session created: ${sessionId}`);
    
    return session;
  }
  
  /**
   * Process video KYC result (called by webhook)
   */
  static processVideoKycResult(
    sessionId: string,
    result: {
      status: 'COMPLETED' | 'FAILED';
      livenessScore: number;
      faceMatchScore: number;
      documentVerified: boolean;
      recordingUrl?: string;
      failureReason?: string;
    }
  ): VideoKycSession | null {
    const session = videoKycSessions.get(sessionId);
    if (!session) return null;
    
    session.status = result.status;
    session.livenessScore = result.livenessScore;
    session.faceMatchScore = result.faceMatchScore;
    session.documentVerified = result.documentVerified;
    session.recordingUrl = result.recordingUrl;
    
    // Validate thresholds
    if (result.status === 'COMPLETED') {
      const passesLiveness = result.livenessScore >= VIDEO_KYC_CONFIG.minLivenessScore;
      const passesFaceMatch = result.faceMatchScore >= VIDEO_KYC_CONFIG.minFaceMatchScore;
      
      if (!passesLiveness || !passesFaceMatch || !result.documentVerified) {
        session.status = 'FAILED';
      }
    }
    
    console.log(`[VIDEO_KYC] Session ${sessionId} result: ${session.status}`);
    
    return session;
  }
  
  /**
   * Get video KYC session
   */
  static getVideoKycSession(sessionId: string): VideoKycSession | null {
    return videoKycSessions.get(sessionId) || null;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // BIOMETRIC VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Verify biometric data
   */
  static async verifyBiometric(
    participantId: string,
    biometricType: 'FINGERPRINT' | 'FACE' | 'IRIS',
    biometricData: {
      template: string; // Base64 encoded biometric template
      deviceId?: string;
      captureQuality?: number;
    }
  ): Promise<BiometricVerificationResult> {
    const now = new Date();
    
    // In production, integrate with:
    // - UIDAI Aadhaar eKYC (India)
    // - Morpho MorphoBSS
    // - Neurotechnology MegaMatcher
    // - AWS Rekognition (face)
    // - Azure Face API
    
    // Mock verification
    const mockMatchScore = 0.85 + Math.random() * 0.15; // 0.85-1.0
    const mockLivenessScore = 0.90 + Math.random() * 0.10; // 0.90-1.0
    const mockQualityScore = biometricData.captureQuality || (0.75 + Math.random() * 0.25);
    
    const templateHash = crypto.createHash('sha256')
      .update(biometricData.template)
      .digest('hex');
    
    const success = mockMatchScore >= 0.8 && mockLivenessScore >= 0.85 && mockQualityScore >= 0.7;
    
    const result: BiometricVerificationResult = {
      success,
      biometricType,
      matchScore: mockMatchScore,
      livenessScore: mockLivenessScore,
      qualityScore: mockQualityScore,
      deviceId: biometricData.deviceId,
      templateHash,
      verifiedAt: now,
    };
    
    if (!success) {
      if (mockMatchScore < 0.8) {
        result.failureReason = 'Biometric template does not match';
      } else if (mockLivenessScore < 0.85) {
        result.failureReason = 'Liveness check failed';
      } else {
        result.failureReason = 'Image quality too low';
      }
    }
    
    console.log(`[BIOMETRIC] ${biometricType} verification: ${success ? 'SUCCESS' : 'FAILED'}`);
    
    return result;
  }
  
  /**
   * Generate biometric template hash for storage
   */
  static generateBiometricHash(template: string): string {
    // In production, use specialized biometric template encoding
    return crypto.createHash('sha512')
      .update(template)
      .update(crypto.randomBytes(32)) // Add entropy
      .digest('hex');
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITY METHODS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Check if a destination is verified
   */
  static isDestinationVerified(participantId: string, channel: OtpChannel, destination: string): boolean {
    const key = `${participantId}:${channel}:${destination}`;
    // In production, check database
    // For now, check OTP store for verified records
    for (const [_, record] of otpStore) {
      if (record.destination === destination && record.channel === channel && record.verified) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Cleanup expired records
   */
  static cleanupExpired(): void {
    const now = Date.now();
    
    // Cleanup OTPs
    for (const [id, record] of otpStore) {
      if (record.expiresAt < now) {
        otpStore.delete(id);
      }
    }
    
    // Cleanup email verifications
    for (const [token, record] of emailVerificationStore) {
      if (record.expiresAt < now) {
        emailVerificationStore.delete(token);
      }
    }
    
    // Cleanup lockouts
    for (const [dest, until] of lockoutStore) {
      if (until < now) {
        lockoutStore.delete(dest);
      }
    }
    
    // Cleanup video KYC sessions
    for (const [id, session] of videoKycSessions) {
      if (session.expiresAt.getTime() < now && session.status === 'PENDING') {
        session.status = 'EXPIRED';
      }
    }
  }
}

// Periodic cleanup
setInterval(() => VerificationService.cleanupExpired(), 60 * 1000);

// Export singleton
export const verificationService = new VerificationService();
