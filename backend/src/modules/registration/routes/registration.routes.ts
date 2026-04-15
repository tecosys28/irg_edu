/**
 * IRG_FTR PLATFORM - Registration Routes
 * TROT REGISTRATION PROTOCOL COMPLIANT
 * 
 * Complete API for multi-step registration with HEP protection
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { registrationService } from '../services/registration.service';
import { kycEngineService } from '../services/kyc-engine.service';
import { riskScoringService } from '../services/risk-scoring.service';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

const participantArchetypes = z.enum([
  'TGDP_MINTER', 'TGDP_JEWELER', 'MARKET_MAKER', 'FTR_BUYER_HOUSEHOLD',
  'FTR_BUYER_OTHER', 'SERVICE_PROVIDER', 'DAC_PARTICIPANT', 'CONSULTANT',
  'BANK_TRUSTEE', 'INVESTOR',
]);

const entityTypes = z.enum([
  'INDIVIDUAL', 'LISTED_COMPANY', 'UNLISTED_PUBLIC_COMPANY', 'PRIVATE_COMPANY',
  'PUBLIC_TRUST', 'PRIVATE_TRUST', 'COOPERATIVE', 'PROPRIETORSHIP',
  'PARTNERSHIP', 'LLP', 'GOVERNMENT_ENTITY',
]);

const kycDocumentTypes = z.enum([
  'AADHAAR', 'PAN', 'VOTER_ID', 'DRIVING_LICENSE', 'PASSPORT',
  'NATIONAL_ID', 'SSN_ITIN', 'EMIRATES_ID', 'NRIC', 'BVN_NIN',
  'REGISTRATION_CERT', 'GST_CERTIFICATE', 'MOA_AOA', 'BOARD_RESOLUTION',
  'UBO_DECLARATION', 'BANK_STATEMENT', 'TAX_RETURN', 'AUDITED_FINANCIALS',
  'CREDIT_REPORT', 'SOURCE_OF_WEALTH', 'SOURCE_OF_FUNDS', 'REFERENCE_LETTER',
  'INSURANCE_DEED', 'ESCROW_PROOF',
]);

const addressSchema = z.object({
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  stateProvince: z.string().min(1, 'State/Province is required'),
  countryCode: z.string().length(2, 'Invalid country code'),
  postalCode: z.string().min(1, 'Postal code is required'),
});

const roleSelectionSchema = z.object({
  roles: z.array(participantArchetypes).min(1, 'At least one role is required'),
  ftrCategories: z.array(z.string()).optional(),
  ftrSubCategories: z.array(z.string()).optional(),
  earmarkedLimit: z.number().positive().optional(),
});

const individualProfileSchema = z.object({
  salutation: z.string().optional(),
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).optional(),
  nationality: z.string().length(2, 'Invalid nationality code'),
  countryOfResidence: z.string().length(2, 'Invalid country code'),
  education: z.string().optional(),
  occupation: z.string().optional(),
  annualIncome: z.string().optional(),
  address: addressSchema,
});

const corporateProfileSchema = z.object({
  legalName: z.string().min(1, 'Legal name is required'),
  tradingName: z.string().optional(),
  businessType: entityTypes,
  registrationNumber: z.string().min(1, 'Registration number is required'),
  registrationDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  registrationAuthority: z.string().min(1, 'Registration authority is required'),
  registrationValidity: z.string().optional(),
  taxId: z.string().optional(),
  gstNumber: z.string().optional(),
  registeredAddress: addressSchema,
  operatingAddress: addressSchema.optional(),
  businessPhone: z.string().min(10, 'Invalid phone number'),
  businessEmail: z.string().email('Invalid email'),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  authorizedSignatories: z.array(z.object({
    name: z.string().min(1),
    designation: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(10),
    effectiveFrom: z.string(),
    effectiveTo: z.string().optional(),
    canTransact: z.boolean().default(true),
    transactionLimit: z.number().positive().optional(),
  })).min(1, 'At least one authorized signatory is required'),
  beneficialOwners: z.array(z.object({
    name: z.string().min(1),
    nationality: z.string().length(2),
    ownershipPercentage: z.number().min(0).max(100),
    controlType: z.enum(['DIRECT', 'INDIRECT']).optional(),
    linkedParticipantId: z.string().optional(),
    dateOfBirth: z.string().optional(),
    nationalId: z.string().optional(),
    address: z.string().optional(),
    isPep: z.boolean().default(false),
    pepDetails: z.string().optional(),
  })).optional(),
});

const contactDetailsSchema = z.object({
  primaryMobile: z.string().min(10, 'Invalid mobile number'),
  primaryMobile_verify: z.string().min(10, 'Please re-enter mobile number'),
  alternateMobile: z.string().min(10).optional().or(z.literal('')),
  landline: z.string().optional(),
  primaryEmail: z.string().email('Invalid email'),
  primaryEmail_verify: z.string().email('Please re-enter email'),
  alternateEmail: z.string().email().optional().or(z.literal('')),
  socialMediaConsent: z.boolean().default(false),
  whatsappNumber: z.string().optional(),
  telegramHandle: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  preferredContactMethod: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PHONE']).default('EMAIL'),
  preferredLanguage: z.string().default('EN'),
}).refine((data) => data.primaryMobile === data.primaryMobile_verify, {
  message: 'Mobile numbers do not match',
  path: ['primaryMobile_verify'],
}).refine((data) => data.primaryEmail === data.primaryEmail_verify, {
  message: 'Email addresses do not match',
  path: ['primaryEmail_verify'],
});

const bankAccountSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required'),
  bankCode: z.string().min(4, 'Bank code is required'),
  branchName: z.string().optional(),
  accountNumber: z.string().min(8, 'Invalid account number'),
  accountNumber_verify: z.string().min(8, 'Please re-enter account number'),
  accountHolderName: z.string().min(1, 'Account holder name is required'),
  accountType: z.enum(['SAVINGS', 'CURRENT', 'CORPORATE']),
  currency: z.string().length(3).default('INR'),
  isPrimary: z.boolean().default(false),
}).refine((data) => data.accountNumber === data.accountNumber_verify, {
  message: 'Account numbers do not match',
  path: ['accountNumber_verify'],
});

const nomineeSchema = z.object({
  name: z.string().min(1, 'Nominee name is required'),
  relation: z.string().min(1, 'Relation is required'),
  dateOfBirth: z.string().optional(),
  phone: z.string().min(10, 'Invalid phone number'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  percentage: z.number().min(0).max(100),
  percentage_verify: z.number().min(0).max(100),
  canAssistRecovery: z.boolean().default(false),
}).refine((data) => data.percentage === data.percentage_verify, {
  message: 'Percentages do not match',
  path: ['percentage_verify'],
});

const credentialsSchema = z.object({
  username: z.string().min(4, 'Username must be at least 4 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  usernameAka: z.string().optional(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  password_verify: z.string(),
}).refine((data) => data.password === data.password_verify, {
  message: 'Passwords do not match',
  path: ['password_verify'],
});

const termsAcceptanceSchema = z.object({
  generalTermsAccepted: z.boolean().refine(val => val === true, 'You must accept the terms'),
  generalTermsVersion: z.string(),
  roleSpecificTerms: z.array(z.object({
    role: participantArchetypes,
    accepted: z.boolean(),
    version: z.string(),
  })),
  gdprConsents: z.object({
    identityVerification: z.boolean(),
    sanctionsScreening: z.boolean(),
    transactionMonitoring: z.boolean(),
    dataSharing: z.boolean(),
    crossBorderTransfers: z.boolean(),
    marketingCommunications: z.boolean().optional(),
  }).optional(),
});

const kycDocumentUploadSchema = z.object({
  documentType: kycDocumentTypes,
  documentNumber: z.string().optional(),
  documentNumber_verify: z.string().optional(),
  frontImage: z.string().optional(),
  backImage: z.string().optional(),
  documentFile: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  issuingAuthority: z.string().optional(),
  issuingCountry: z.string().length(2).optional(),
}).refine((data) => {
  if (data.documentNumber && data.documentNumber_verify) {
    return data.documentNumber === data.documentNumber_verify;
  }
  return true;
}, {
  message: 'Document numbers do not match',
  path: ['documentNumber_verify'],
});

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate registration session
 */
const validateSession = async (req: Request, res: Response, next: NextFunction) => {
  const sessionToken = req.headers['x-registration-session'] as string;
  const participantId = req.headers['x-participant-id'] as string;
  
  if (!sessionToken || !participantId) {
    return res.status(401).json({
      success: false,
      error: { code: 'SESSION_REQUIRED', message: 'Registration session required' },
    });
  }
  
  // In production: Validate session token
  (req as any).registrationContext = {
    participantId,
    registrationId: '', // Would be fetched from session
    sessionId: sessionToken,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
  
  next();
};

/**
 * Rate limiting for registration endpoints
 */
const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  // In production: Implement rate limiting
  next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/registration/initiate
 * Start a new registration session
 */
router.post('/initiate', rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { source, referralCode } = req.body;
    
    const result = await registrationService.initiateRegistration(
      source,
      referralCode,
      req.ip
    );
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Registration session initiated',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/registration/config/:countryCode
 * Get registration configuration for a country
 */
router.get('/config/:countryCode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { countryCode } = req.params;
    
    const config = {
      countryCode,
      requiredDocuments: kycEngineService.getRequiredDocuments('TIER_1_BASIC', countryCode),
      gdprApplicable: kycEngineService.isGdprApplicable(countryCode),
      gdprConsents: kycEngineService.isGdprApplicable(countryCode)
        ? kycEngineService.getGdprConsentRequirements()
        : undefined,
    };
    
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/registration/categories
 * Get FTR categories list
 */
router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Return 18 approved categories
    const categories = [
      { code: 'HOSP', name: 'Hospitality', description: 'Hotels, resorts, travel services' },
      { code: 'HEALTH', name: 'Healthcare', description: 'Medical services, hospitals, clinics' },
      { code: 'EDU', name: 'Education', description: 'Schools, universities, training' },
      { code: 'TRANSPORT', name: 'Transportation', description: 'Airlines, railways, logistics' },
      { code: 'REALTY', name: 'Real Estate', description: 'Property, construction, development' },
      { code: 'RETAIL', name: 'Retail', description: 'Consumer goods, e-commerce' },
      { code: 'FOOD', name: 'Food & Beverage', description: 'Restaurants, catering, F&B' },
      { code: 'ENERGY', name: 'Energy', description: 'Power, utilities, renewables' },
      { code: 'TECH', name: 'Technology', description: 'IT services, software, hardware' },
      { code: 'FINANCE', name: 'Financial Services', description: 'Banking, insurance, investment' },
      { code: 'TELECOM', name: 'Telecommunications', description: 'Mobile, internet, broadcasting' },
      { code: 'AGRI', name: 'Agriculture', description: 'Farming, dairy, fisheries' },
      { code: 'TEXTILE', name: 'Textiles', description: 'Apparel, fabrics, fashion' },
      { code: 'PHARMA', name: 'Pharmaceuticals', description: 'Drugs, medical devices' },
      { code: 'AUTO', name: 'Automotive', description: 'Vehicles, parts, services' },
      { code: 'ENTERTAINMENT', name: 'Entertainment', description: 'Media, gaming, events' },
      { code: 'PROFESSIONAL', name: 'Professional Services', description: 'Legal, consulting, accounting' },
      { code: 'OTHER', name: 'Other Services', description: 'Miscellaneous services' },
    ];
    
    res.json({ success: true, data: { categories } });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// STEP-BASED REGISTRATION ROUTES (Require Session)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/registration/step/roles
 * Step 1: Select roles
 */
router.post('/step/roles', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = roleSelectionSchema.parse(req.body);
    const ctx = (req as any).registrationContext;
    
    const result = await registrationService.saveRoleSelection(
      ctx,
      data.roles,
      data.ftrCategories,
      data.earmarkedLimit
    );
    
    res.json({
      success: result.isValid,
      data: result.isValid ? { step: 'roles', completed: true } : undefined,
      errors: result.errors,
      warnings: result.warnings,
      hepViolations: result.hepViolations,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/registration/step/entity-type
 * Step 2: Select entity type
 */
router.post('/step/entity-type', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType } = req.body;
    const parsed = entityTypes.parse(entityType);
    const ctx = (req as any).registrationContext;
    
    const result = await registrationService.saveEntityType(ctx, parsed);
    
    res.json({
      success: result.isValid,
      data: result.isValid ? { step: 'entityType', completed: true, entityType: parsed } : undefined,
      errors: result.errors,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid entity type' },
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/registration/step/individual-profile
 * Step 3a: Individual profile
 */
router.post('/step/individual-profile', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = individualProfileSchema.parse(req.body);
    const ctx = (req as any).registrationContext;
    
    const result = await registrationService.saveIndividualProfile(ctx, data);
    
    res.json({
      success: result.isValid,
      data: result.isValid ? { step: 'individualProfile', completed: true } : undefined,
      errors: result.errors,
      warnings: result.warnings,
      hepViolations: result.hepViolations,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/registration/step/corporate-profile
 * Step 3b: Corporate profile
 */
router.post('/step/corporate-profile', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = corporateProfileSchema.parse(req.body);
    const ctx = (req as any).registrationContext;
    
    const result = await registrationService.saveCorporateProfile(ctx, data);
    
    res.json({
      success: result.isValid,
      data: result.isValid ? { step: 'corporateProfile', completed: true } : undefined,
      errors: result.errors,
      warnings: result.warnings,
      hepViolations: result.hepViolations,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/registration/step/contact-details
 * Step 4: Contact details
 */
router.post('/step/contact-details', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = contactDetailsSchema.parse(req.body);
    const ctx = (req as any).registrationContext;
    
    const result = await registrationService.saveContactDetails(ctx, data);
    
    res.json({
      success: result.isValid,
      data: result.isValid ? {
        step: 'contactDetails',
        completed: true,
        verificationRequired: {
          mobile: true,
          email: true,
        },
      } : undefined,
      errors: result.errors,
      warnings: result.warnings,
      hepViolations: result.hepViolations,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/registration/step/bank-account
 * Step 5: Bank account
 */
router.post('/step/bank-account', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = bankAccountSchema.parse(req.body);
    const ctx = (req as any).registrationContext;
    
    const result = await registrationService.saveBankAccount(ctx, data);
    
    res.json({
      success: result.isValid,
      data: result.isValid ? { step: 'bankAccount', completed: true } : undefined,
      errors: result.errors,
      warnings: result.warnings,
      hepViolations: result.hepViolations,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/registration/step/nominees
 * Step 6: Nominees
 */
router.post('/step/nominees', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nominees } = req.body;
    const parsedNominees = z.array(nomineeSchema).parse(nominees);
    const ctx = (req as any).registrationContext;
    
    const result = await registrationService.saveNominees(ctx, parsedNominees);
    
    res.json({
      success: result.isValid,
      data: result.isValid ? { step: 'nominees', completed: true } : undefined,
      errors: result.errors,
      warnings: result.warnings,
      hepViolations: result.hepViolations,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/registration/step/credentials
 * Step 7: Username & Password
 */
router.post('/step/credentials', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = credentialsSchema.parse(req.body);
    const ctx = (req as any).registrationContext;
    
    const result = await registrationService.setCredentials(ctx, data);
    
    res.json({
      success: result.isValid,
      data: result.isValid ? { step: 'credentials', completed: true } : undefined,
      errors: result.errors,
      warnings: result.warnings,
      hepViolations: result.hepViolations,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/registration/step/kyc-documents
 * Step 8: KYC Document Upload
 */
router.post('/step/kyc-documents', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = kycDocumentUploadSchema.parse(req.body);
    const ctx = (req as any).registrationContext;
    
    // Verify document
    const verificationResult = await kycEngineService.verifyDocument(
      ctx.participantId,
      data.documentType,
      {
        documentNumber: data.documentNumber,
        frontImage: data.frontImage,
        backImage: data.backImage,
        documentFile: data.documentFile,
        issueDate: data.issueDate,
        expiryDate: data.expiryDate,
      }
    );
    
    res.json({
      success: verificationResult.isValid,
      data: verificationResult.isValid ? {
        step: 'kycDocuments',
        documentType: data.documentType,
        verified: true,
        ocrConfidence: verificationResult.ocrConfidence,
        ocrExtracted: verificationResult.ocrExtracted,
      } : undefined,
      errors: verificationResult.errors
        ? { verification: verificationResult.errors.join('; ') }
        : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/registration/step/video-kyc/initiate
 * Initiate Video KYC session
 */
router.post('/step/video-kyc/initiate', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { countryCode } = req.body;
    const ctx = (req as any).registrationContext;
    
    const session = await kycEngineService.initiateVideoKyc(ctx.participantId, countryCode);
    
    res.json({
      success: true,
      data: {
        step: 'videoKyc',
        sessionId: session.sessionId,
        sessionUrl: session.sessionUrl,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/registration/step/terms
 * Step 9: Terms acceptance
 */
router.post('/step/terms', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = termsAcceptanceSchema.parse(req.body);
    const ctx = (req as any).registrationContext;
    
    const result = await registrationService.acceptTerms(ctx, data, req.ip);
    
    res.json({
      success: result.isValid,
      data: result.isValid ? { step: 'terms', completed: true } : undefined,
      errors: result.errors,
      hepViolations: result.hepViolations,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/registration/finalize
 * Complete registration
 */
router.post('/finalize', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = (req as any).registrationContext;
    
    const result = await registrationService.finalizeRegistration(ctx);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/registration/verify/mobile
 * Verify mobile OTP
 */
router.post('/verify/mobile', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { otp } = req.body;
    
    // In production: Verify OTP
    const isValid = otp === '123456'; // Mock
    
    res.json({
      success: isValid,
      data: isValid ? { verified: 'mobile' } : undefined,
      error: !isValid ? { code: 'INVALID_OTP', message: 'Invalid OTP' } : undefined,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/registration/verify/email
 * Verify email
 */
router.post('/verify/email', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    
    // In production: Verify email token
    const isValid = true; // Mock
    
    res.json({
      success: isValid,
      data: isValid ? { verified: 'email' } : undefined,
      error: !isValid ? { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } : undefined,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/registration/verify/resend-otp
 * Resend OTP
 */
router.post('/verify/resend-otp', validateSession, rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, destination } = req.body; // type: 'mobile' | 'email'
    
    // In production: Resend OTP
    
    res.json({
      success: true,
      data: { sentTo: destination, expiresIn: 300 },
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS & ELIGIBILITY ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/registration/status
 * Get registration status
 */
router.get('/status', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = (req as any).registrationContext;
    
    // In production: Fetch from database
    const status = {
      participantId: ctx.participantId,
      currentStep: 'terms',
      completedSteps: ['roles', 'entityType', 'individualProfile', 'contactDetails', 'bankAccount', 'nominees', 'credentials', 'kycDocuments'],
      pendingSteps: ['terms'],
      kycStatus: 'APPROVED',
      kycTier: 'TIER_1_BASIC',
      eligibilityStatus: 'PENDING',
    };
    
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/registration/eligibility
 * Check eligibility
 */
router.get('/eligibility', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = (req as any).registrationContext;
    
    const eligibility = await registrationService.checkEligibility(ctx.participantId);
    
    res.json({ success: true, data: eligibility });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/registration/risk-score
 * Get risk score (for Tier-3)
 */
router.get('/risk-score', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = (req as any).registrationContext;
    
    // In production: Fetch latest risk score
    const mockInput = {
      participantId: ctx.participantId,
      countryCode: 'IN',
      creditBureauScore: 0.75,
      mintingSuccessRate: 1.0,
      deliveryFulfillmentRate: 0.95,
    };
    
    const riskScore = await riskScoringService.calculateCRS(mockInput);
    
    res.json({ success: true, data: riskScore });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY REQUEST ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/registration/category/request
 * Request new FTR category
 */
router.post('/category/request', validateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryName, description } = req.body;
    const ctx = (req as any).registrationContext;
    
    const result = await registrationService.requestNewCategory(ctx, categoryName, description);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Category request submitted for Domain Consultant review',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
