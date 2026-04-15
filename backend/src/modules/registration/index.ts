/**
 * IRG_FTR PLATFORM - Registration Module Index
 * TROT REGISTRATION PROTOCOL COMPLIANT v6.0
 * 
 * Complete registration module with:
 * - Multi-role registration flow
 * - 5-tier global KYC engine
 * - Composite Risk Scoring (CRS)
 * - Human Error Prevention (HEP)
 * - Security (rate limiting, CSRF, fraud detection)
 * - Verification (OTP, Video KYC, Biometric)
 * - Blockchain wallet generation
 * - Social recovery
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CORE SERVICES
// ═══════════════════════════════════════════════════════════════════════════════

export { RegistrationService, registrationService } from './services/registration.service';
export { KycEngineService, kycEngineService } from './services/kyc-engine.service';
export { RiskScoringService, riskScoringService } from './services/risk-scoring.service';

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY & VERIFICATION SERVICES
// ═══════════════════════════════════════════════════════════════════════════════

export {
  SecurityService,
  securityService,
  type RateLimitConfig,
  type RateLimitResult,
  type SessionSecurityContext,
  type GeoLocation,
  type SecurityFlag,
  type SecurityFlagType,
  type FraudSignal,
} from './services/security.service';

export {
  VerificationService,
  verificationService,
  type OtpChannel,
  type OtpGenerationResult,
  type OtpVerificationResult,
  type EmailVerificationResult,
  type PennyDropResult,
  type VideoKycSession,
  type BiometricVerificationResult,
} from './services/verification.service';

export {
  WalletService,
  walletService,
  type WalletNamespace,
  type KeyAlgorithm,
  type WalletCreationResult,
  type WalletRecoveryConfig,
  type SocialRecoveryConfig,
  type SocialRecoveryNominee,
  type HardwareWalletConfig,
  type MultisigConfig,
  type WalletExportFormat,
} from './services/wallet.service';

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATORS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  HepValidator,
  RegistrationFormValidator,
  type HepValidationResult,
  type HepError,
  type HepWarning,
  type HepSuggestion,
} from './validators/hep-validators';

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export { default as registrationRoutes } from './routes/registration.routes';

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE METADATA
// ═══════════════════════════════════════════════════════════════════════════════

export const REGISTRATION_MODULE_VERSION = '6.0.0';
export const REGISTRATION_MODULE_NAME = 'TROT Registration Protocol';
export const REGISTRATION_MODULE_FEATURES = [
  'Multi-role registration (10 archetypes)',
  '9 entity types support',
  '5-tier global KYC (47+ jurisdictions)',
  'Real-time sanctions screening (OFAC/UN/EU/MHA)',
  'Composite Risk Scoring (CRS)',
  'Human Error Prevention (HEP)',
  'GDPR compliance engine',
  'Video KYC integration',
  'Biometric verification',
  'Penny drop bank verification',
  'BIP-39 wallet generation',
  'Social recovery (3-of-5)',
  'Hardware wallet support',
  '7-year FATF audit trail',
];
