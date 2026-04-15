/**
 * IRG_FTR PLATFORM - Registration Module Types
 * TROT REGISTRATION PROTOCOL COMPLIANT
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

export type ParticipantArchetype =
  | 'TGDP_MINTER'
  | 'TGDP_JEWELER'
  | 'MARKET_MAKER'
  | 'FTR_BUYER_HOUSEHOLD'
  | 'FTR_BUYER_OTHER'
  | 'SERVICE_PROVIDER'
  | 'DAC_PARTICIPANT'
  | 'CONSULTANT'
  | 'BANK_TRUSTEE'
  | 'INVESTOR';

export type EntityType =
  | 'INDIVIDUAL'
  | 'LISTED_COMPANY'
  | 'UNLISTED_PUBLIC_COMPANY'
  | 'PRIVATE_COMPANY'
  | 'PUBLIC_TRUST'
  | 'PRIVATE_TRUST'
  | 'COOPERATIVE'
  | 'PROPRIETORSHIP'
  | 'PARTNERSHIP'
  | 'LLP'
  | 'GOVERNMENT_ENTITY';

export type KycTier =
  | 'TIER_0_PROVISIONAL'
  | 'TIER_1_BASIC'
  | 'TIER_2_STANDARD'
  | 'TIER_3_ENHANCED'
  | 'TIER_4_INSTITUTIONAL';

export type KycStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'DOCUMENTS_SUBMITTED'
  | 'VIDEO_KYC_PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'CONDITIONALLY_APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'UPGRADE_REQUIRED';

export type RegistrationStatus =
  | 'DRAFT'
  | 'PENDING_KYC'
  | 'KYC_IN_PROGRESS'
  | 'PENDING_ELIGIBILITY'
  | 'PENDING_WALLET'
  | 'PENDING_TERMS'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DEREGISTERED'
  | 'COOLING_OFF'
  | 'BLACKLISTED';

export type RiskRating = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNACCEPTABLE';

export type WalletNamespace = 'TGDP_SOVEREIGN' | 'FTR_STANDARD' | 'DAC_COMMERCE' | 'TRCS_SETTLEMENT';

export type KycDocumentType =
  | 'AADHAAR' | 'PAN' | 'VOTER_ID' | 'DRIVING_LICENSE' | 'PASSPORT'
  | 'NATIONAL_ID' | 'SSN_ITIN' | 'EMIRATES_ID' | 'NRIC' | 'BVN_NIN'
  | 'REGISTRATION_CERT' | 'GST_CERTIFICATE' | 'MOA_AOA' | 'BOARD_RESOLUTION' | 'UBO_DECLARATION'
  | 'BANK_STATEMENT' | 'TAX_RETURN' | 'AUDITED_FINANCIALS' | 'CREDIT_REPORT'
  | 'SOURCE_OF_WEALTH' | 'SOURCE_OF_FUNDS' | 'REFERENCE_LETTER' | 'INSURANCE_DEED' | 'ESCROW_PROOF';

export type SanctionsListType =
  | 'OFAC' | 'UN_CONSOLIDATED' | 'EU_SANCTIONS' | 'UK_SANCTIONS' | 'MHA_INDIA' | 'FATF_HIGH_RISK' | 'LOCAL_WATCHLIST';

export type DataSubjectRight =
  | 'ACCESS' | 'RECTIFICATION' | 'ERASURE' | 'RESTRICT_PROCESSING' | 'PORTABILITY' | 'OBJECT' | 'WITHDRAW_CONSENT';

export type RenewalType = 'KYC' | 'LICENCE' | 'BIOMETRIC' | 'BANK_VERIFICATION' | 'CREDIT_CHECK';

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRATION FLOW INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Step 1: Role & Category Selection
 */
export interface RoleSelectionData {
  selectedRoles: ParticipantArchetype[];
  ftrCategories?: string[];
  ftrSubCategories?: string[];
  earmarkedLimit?: number; // For Market Makers
  newCategoryRequest?: {
    categoryName: string;
    aiDraftedDescription?: string;
  };
}

/**
 * Step 2: Entity Type & Basic Identity
 */
export interface EntityTypeSelectionData {
  entityType: EntityType;
}

/**
 * Step 3a: Individual Profile
 */
export interface IndividualProfileData {
  salutation?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string; // ISO date
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  maritalStatus?: 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
  nationality: string; // ISO country code
  countryOfResidence: string;
  education?: string;
  occupation?: string;
  annualIncome?: string; // Range string
  address: AddressData;
  familyMembers?: FamilyMemberData[];
}

/**
 * Step 3b: Corporate Profile
 */
export interface CorporateProfileData {
  legalName: string;
  tradingName?: string;
  businessType: EntityType;
  registrationNumber: string;
  registrationDate: string;
  registrationAuthority: string;
  registrationValidity?: string;
  taxId?: string;
  gstNumber?: string;
  registeredAddress: AddressData;
  operatingAddress?: AddressData;
  businessPhone: string;
  businessEmail: string;
  websiteUrl?: string;
  authorizedSignatories: AuthorizedSignatoryData[];
  beneficialOwners: BeneficialOwnerData[];
}

export interface AddressData {
  line1: string;
  line2?: string;
  city: string;
  stateProvince: string;
  countryCode: string;
  postalCode: string;
}

export interface FamilyMemberData {
  name: string;
  relation: string;
  dateOfBirth?: string;
  contactPhone?: string;
  contactEmail?: string;
  isNominee?: boolean;
  nomineePercentage?: number;
}

export interface AuthorizedSignatoryData {
  name: string;
  designation: string;
  email: string;
  phone: string;
  effectiveFrom: string;
  effectiveTo?: string;
  canTransact?: boolean;
  transactionLimit?: number;
}

export interface BeneficialOwnerData {
  name: string;
  nationality: string;
  ownershipPercentage: number;
  controlType?: 'DIRECT' | 'INDIRECT';
  linkedParticipantId?: string;
  dateOfBirth?: string;
  nationalId?: string;
  address?: string;
  isPep?: boolean;
  pepDetails?: string;
}

/**
 * Step 4: Contact Details
 */
export interface ContactDetailsData {
  primaryMobile: string;
  alternateMobile?: string;
  landline?: string;
  primaryEmail: string;
  alternateEmail?: string;
  socialMediaConsent?: boolean;
  whatsappNumber?: string;
  telegramHandle?: string;
  linkedinUrl?: string;
  preferredContactMethod?: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PHONE';
  preferredLanguage?: string;
  emergencyContacts?: EmergencyContactData[];
}

export interface EmergencyContactData {
  name: string;
  relation: string;
  phone: string;
  email?: string;
  priority?: number;
}

/**
 * Step 5: Bank Account Linkage
 */
export interface BankAccountData {
  bankName: string;
  bankCode?: string; // IFSC/SWIFT
  branchName?: string;
  accountNumber: string;
  accountNumber_verify: string; // Double entry
  accountHolderName: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'CORPORATE';
  currency?: string;
  isPrimary?: boolean;
}

/**
 * Step 6: Nominee Details
 */
export interface NomineeData {
  name: string;
  relation: string;
  dateOfBirth?: string;
  phone: string;
  email?: string;
  address?: string;
  percentage: number;
  percentage_verify: number; // Double entry
  canAssistRecovery?: boolean;
}

/**
 * Step 7: KYC Document Upload
 */
export interface KycDocumentUploadData {
  documentType: KycDocumentType;
  documentNumber?: string;
  documentNumber_verify?: string; // Double entry for sensitive
  frontImage?: File | string;
  backImage?: File | string;
  documentFile?: File | string;
  issueDate?: string;
  expiryDate?: string;
  issuingAuthority?: string;
  issuingCountry?: string;
}

/**
 * Step 8: Video KYC (if required)
 */
export interface VideoKycData {
  sessionId: string;
  livenessCheckPassed: boolean;
  faceMatchScore: number;
  videoRecordingUrl?: string;
  agentId?: string;
  agentNotes?: string;
}

/**
 * Step 9: Biometric Capture (optional)
 */
export interface BiometricData {
  captureType: 'FINGERPRINT' | 'FACE' | 'BOTH';
  biometricHash: string; // Encrypted hash only
  capturedAt: string;
  deviceInfo?: string;
}

/**
 * Step 10: Terms & Conditions
 */
export interface TermsAcceptanceData {
  generalTermsAccepted: boolean;
  generalTermsVersion: string;
  roleSpecificTerms: {
    role: ParticipantArchetype;
    accepted: boolean;
    version: string;
    acceptedAt: string;
  }[];
  gdprConsents?: GdprConsentData;
}

export interface GdprConsentData {
  identityVerification: boolean;
  sanctionsScreening: boolean;
  transactionMonitoring: boolean;
  dataSharing: boolean;
  crossBorderTransfers: boolean;
  marketingCommunications?: boolean;
}

/**
 * Step 11: Wallet Setup
 */
export interface WalletSetupData {
  walletAddress: string;
  namespace: WalletNamespace;
  publicKey: string;
  // Note: Private key and seed phrase are NEVER transmitted to server
  seedPhraseHint?: string; // User's own reminder only
  hardwareWalletLinked?: boolean;
  hardwareWalletType?: 'LEDGER' | 'TREZOR';
  socialRecoveryEnabled?: boolean;
  recoveryNominees?: string[]; // Nominee IDs
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETE REGISTRATION PAYLOAD
// ═══════════════════════════════════════════════════════════════════════════════

export interface RegistrationPayload {
  // Step 1
  roleSelection: RoleSelectionData;
  
  // Step 2
  entityType: EntityType;
  
  // Step 3
  individualProfile?: IndividualProfileData;
  corporateProfile?: CorporateProfileData;
  
  // Step 4
  contactDetails: ContactDetailsData;
  
  // Step 5
  bankAccounts: BankAccountData[];
  
  // Step 6
  nominees: NomineeData[];
  
  // Step 7
  kycDocuments: KycDocumentUploadData[];
  
  // Step 8 (filled after video KYC)
  videoKyc?: VideoKycData;
  
  // Step 9
  biometric?: BiometricData;
  
  // Step 10
  termsAcceptance: TermsAcceptanceData;
  
  // Metadata
  registrationSource?: string;
  referralCode?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// KYC/AML TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface KycTierRequirements {
  tier: KycTier;
  monthlyTransactionLimit: number; // USD
  requiredDocuments: KycDocumentType[];
  videoKycRequired: boolean;
  creditCheckRequired: boolean;
  enhancedDueDiligence: boolean;
  validityMonths: number;
}

export interface CountryKycConfig {
  countryCode: string;
  countryName: string;
  tierRequirements: Record<KycTier, {
    documents: KycDocumentType[];
    additionalRequirements?: string[];
  }>;
  transactionLimits: Record<KycTier, number>;
  primaryRegulator: string;
  regulatoryFramework: string;
  sanctionsLists: SanctionsListType[];
  dataRetentionYears: number;
  gdprApplicable: boolean;
  specialRules?: Record<string, any>;
}

export interface KycVerificationResult {
  verificationId: string;
  participantId: string;
  tier: KycTier;
  status: 'PASSED' | 'FAILED' | 'PENDING_REVIEW';
  score: number;
  confidence: number;
  livenessScore?: number;
  faceMatchScore?: number;
  failureReasons?: string[];
  slaDeadline: string;
  completedAt?: string;
}

export interface SanctionsScreeningResult {
  screeningId: string;
  participantId: string;
  screeningType: SanctionsListType;
  screenedName: string;
  isMatch: boolean;
  matchScore?: number;
  matchedEntity?: string;
  matchDetails?: Record<string, any>;
  isFalsePositive?: boolean;
  resolution?: {
    resolvedBy: string;
    resolvedAt: string;
    notes: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RISK SCORING TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RiskScoreComponents {
  creditBureauScore: number;      // 40% weight
  behaviouralScore: number;       // 25% weight
  adverseMediaScore: number;      // 15% weight
  sowSofScore: number;            // 10% weight (Source of Wealth/Funds)
  crossBorderScore: number;       // 5% weight
  pepFamilyScore: number;         // 5% weight
}

export interface RiskScoreMultipliers {
  defaultCascade?: number;        // ×1.3 if default in last 24 months
  deliveryPerformance?: number;   // From FTR Valuation Engine
  jurisdiction?: number;          // ×1.2 for high-risk FATF jurisdictions
}

export interface CompositeRiskScore {
  participantId: string;
  assessmentType: 'INITIAL' | 'DAILY' | 'EVENT_DRIVEN';
  triggerEvent?: string;
  components: RiskScoreComponents;
  multipliers: RiskScoreMultipliers;
  rawScore: number;
  finalScore: number; // 0.000 - 1.000
  rating: RiskRating;
  modelVersion: string;
  explanationText: string;
  factorContributions: Record<string, number>;
  assessedAt: string;
  
  // For Tier-3 dual control
  aiDecision: 'APPROVE' | 'REJECT' | 'ESCALATE';
  consultantReview?: {
    consultantId: string;
    decision: 'APPROVE' | 'REJECT';
    notes: string;
    reviewedAt: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ELIGIBILITY GATE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EligibilityCheckResult {
  participantId: string;
  isEligible: boolean;
  checks: {
    kycApproved: boolean;
    riskScoreAcceptable: boolean;
    noActiveBreaches: boolean;
    notInCoolingOff: boolean;
    notBlacklisted: boolean;
    creditScoreMinimum?: boolean; // 0.65 for FTR providers
    tgdpRatioValid?: boolean; // 9:1 for TGDP
  };
  failureReasons?: string[];
  breachHistory?: {
    breachId: string;
    type: string;
    date: string;
    severity: string;
  }[];
  checkedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIFECYCLE MANAGEMENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RenewalSchedule {
  participantId: string;
  renewalType: RenewalType;
  lastRenewalDate?: string;
  nextRenewalDate: string;
  gracePeriodDays: number;
  status: 'ACTIVE' | 'PENDING' | 'OVERDUE' | 'COMPLETED' | 'SUSPENDED';
  reminders: {
    days30Sent: boolean;
    days15Sent: boolean;
    days7Sent: boolean;
  };
}

export interface ProfileAmendment {
  participantId: string;
  fieldName: string;
  oldValue?: string;
  newValue?: string;
  isMaterialChange: boolean;
  requiresReKyc: boolean;
  reKycTriggered: boolean;
  requiresApproval: boolean;
  approval?: {
    approvedBy: string;
    approvedAt: string;
  };
  amendedBy: string;
  amendedAt: string;
  blockchainTxHash?: string;
}

export interface SuspensionRecord {
  participantId: string;
  reason: string;
  suspendedAt: string;
  suspendedBy: string;
  expectedDuration?: string;
  canReactivate: boolean;
  reactivationRequirements?: string[];
}

export interface DeregistrationRecord {
  participantId: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
  coolingOffPeriod?: string;
  reentryEligibleAt?: string;
  dataRetentionUntil: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GDPR TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface GdprRequest {
  requestId: string;
  participantId: string;
  rightType: DataSubjectRight;
  requestDetails?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  slaDeadline: string;
  slaBreached: boolean;
  response?: {
    completedAt: string;
    responseText?: string;
    dataExportUrl?: string;
  };
  rejection?: {
    reason: string;
    rejectedAt: string;
  };
  escalation?: {
    escalatedToOmbudsman: boolean;
    ombudsmanCaseId?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WalletInfo {
  participantId: string;
  walletAddress: string;
  namespace: WalletNamespace;
  createdAt: string;
  isActive: boolean;
  balance?: {
    available: number;
    locked: number;
    currency: string;
  };
}

export interface WalletRecoveryConfig {
  participantId: string;
  recoveryMethod: 'SEED_PHRASE' | 'SOCIAL' | 'HARDWARE';
  socialRecovery?: {
    enabled: boolean;
    nominees: string[]; // Nominee IDs
    requiredApprovals: number; // 2 of 3
    recoveryDelayHours: number; // 72
  };
  hardwareWallet?: {
    linked: boolean;
    type: 'LEDGER' | 'TREZOR';
  };
  seedPhraseHint?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RegistrationResponse {
  success: boolean;
  data?: {
    participantId: string;
    registrationId: string;
    status: RegistrationStatus;
    kycTier: KycTier;
    kycStatus: KycStatus;
    walletAddress?: string;
    nextSteps?: string[];
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
    fieldErrors?: Record<string, string>;
  };
}

export interface KycStatusResponse {
  participantId: string;
  currentTier: KycTier;
  status: KycStatus;
  documents: {
    type: KycDocumentType;
    status: 'PENDING' | 'VERIFIED' | 'REJECTED';
    rejectionReason?: string;
  }[];
  verifications: {
    type: string;
    status: 'PENDING' | 'PASSED' | 'FAILED';
    completedAt?: string;
  }[];
  upgradeAvailable: boolean;
  upgradeRequirements?: string[];
  expiresAt?: string;
}

export interface RiskScoreResponse {
  participantId: string;
  currentScore: number;
  rating: RiskRating;
  lastAssessment: string;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  factorBreakdown: Record<string, number>;
  recommendations?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM STEP CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface RegistrationStep {
  stepNumber: number;
  stepId: string;
  title: string;
  description: string;
  isRequired: boolean;
  isConditional: boolean;
  condition?: {
    field: string;
    value: any;
  };
  fields: FormFieldConfig[];
}

export interface FormFieldConfig {
  fieldId: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'date' | 'select' | 'multiselect' | 'file' | 'checkbox' | 'number';
  isRequired: boolean;
  isDoubleEntry: boolean; // For HEP
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    customValidator?: string;
  };
  options?: { value: string; label: string }[];
  helpText?: string;
  privacyNotice?: string;
  conditionalDisplay?: {
    field: string;
    value: any;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FTR CATEGORIES (18 Approved)
// ═══════════════════════════════════════════════════════════════════════════════

export interface FtrCategory {
  code: string;
  name: string;
  description: string;
  parentCode?: string;
  isParent: boolean;
  isApproved: boolean;
  subCategories?: FtrCategory[];
}

export const FTR_CATEGORIES: FtrCategory[] = [
  { code: 'HOSP', name: 'Hospitality', description: 'Hotels, resorts, travel services', isParent: true, isApproved: true },
  { code: 'HEALTH', name: 'Healthcare', description: 'Medical services, hospitals, clinics', isParent: true, isApproved: true },
  { code: 'EDU', name: 'Education', description: 'Schools, universities, training', isParent: true, isApproved: true },
  { code: 'TRANSPORT', name: 'Transportation', description: 'Airlines, railways, logistics', isParent: true, isApproved: true },
  { code: 'REALTY', name: 'Real Estate', description: 'Property, construction, development', isParent: true, isApproved: true },
  { code: 'RETAIL', name: 'Retail', description: 'Consumer goods, e-commerce', isParent: true, isApproved: true },
  { code: 'FOOD', name: 'Food & Beverage', description: 'Restaurants, catering, F&B', isParent: true, isApproved: true },
  { code: 'ENERGY', name: 'Energy', description: 'Power, utilities, renewables', isParent: true, isApproved: true },
  { code: 'TECH', name: 'Technology', description: 'IT services, software, hardware', isParent: true, isApproved: true },
  { code: 'FINANCE', name: 'Financial Services', description: 'Banking, insurance, investment', isParent: true, isApproved: true },
  { code: 'TELECOM', name: 'Telecommunications', description: 'Mobile, internet, broadcasting', isParent: true, isApproved: true },
  { code: 'AGRI', name: 'Agriculture', description: 'Farming, dairy, fisheries', isParent: true, isApproved: true },
  { code: 'TEXTILE', name: 'Textiles', description: 'Apparel, fabrics, fashion', isParent: true, isApproved: true },
  { code: 'PHARMA', name: 'Pharmaceuticals', description: 'Drugs, medical devices', isParent: true, isApproved: true },
  { code: 'AUTO', name: 'Automotive', description: 'Vehicles, parts, services', isParent: true, isApproved: true },
  { code: 'ENTERTAINMENT', name: 'Entertainment', description: 'Media, gaming, events', isParent: true, isApproved: true },
  { code: 'PROFESSIONAL', name: 'Professional Services', description: 'Legal, consulting, accounting', isParent: true, isApproved: true },
  { code: 'OTHER', name: 'Other Services', description: 'Miscellaneous services', isParent: true, isApproved: true },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const KYC_TIER_LIMITS: Record<KycTier, number> = {
  TIER_0_PROVISIONAL: 5000,
  TIER_1_BASIC: 50000,
  TIER_2_STANDARD: 500000,
  TIER_3_ENHANCED: Infinity,
  TIER_4_INSTITUTIONAL: Infinity,
};

export const KYC_TIER_VALIDITY_MONTHS: Record<KycTier, number> = {
  TIER_0_PROVISIONAL: 1,
  TIER_1_BASIC: 12,
  TIER_2_STANDARD: 12,
  TIER_3_ENHANCED: 6,
  TIER_4_INSTITUTIONAL: 6,
};

export const RISK_SCORE_THRESHOLDS = {
  MINIMUM_FOR_FTR_PROVIDER: 0.65,
  LOW_RISK_MIN: 0.80,
  MEDIUM_RISK_MIN: 0.65,
  HIGH_RISK_MIN: 0.40,
  UNACCEPTABLE_MAX: 0.40,
};

export const RISK_SCORE_WEIGHTS = {
  CREDIT_BUREAU: 0.40,
  BEHAVIOURAL: 0.25,
  ADVERSE_MEDIA: 0.15,
  SOW_SOF: 0.10,
  CROSS_BORDER: 0.05,
  PEP_FAMILY: 0.05,
};

export const SLA_DURATIONS = {
  KYC_VERIFICATION_SECONDS: 60,
  REGISTRATION_COMPLETION_MINUTES: 5,
  WALLET_CREATION_SECONDS: 30,
  GDPR_ACCESS_HOURS: 72,
  GDPR_OTHER_DAYS: 30,
  RISK_ASSESSMENT_HOURS: 4,
};

export const RETENTION_PERIODS = {
  FATF_MINIMUM_YEARS: 7,
  GDPR_AFTER_DEREGISTRATION_YEARS: 7,
  AUDIT_LOG_YEARS: 7,
};
