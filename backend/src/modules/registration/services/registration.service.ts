/**
 * IRG_FTR PLATFORM - Registration Service
 * TROT REGISTRATION PROTOCOL COMPLIANT
 * 
 * Core registration business logic with full lifecycle management
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ParticipantArchetype,
  EntityType,
  KycTier,
  KycStatus,
  RegistrationStatus,
  RegistrationPayload,
  RegistrationResponse,
  EligibilityCheckResult,
  WalletNamespace,
  RISK_SCORE_THRESHOLDS,
  KYC_TIER_LIMITS,
  RETENTION_PERIODS,
} from '@ftr-platform/shared/registration/types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface RegistrationContext {
  participantId: string;
  registrationId: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

interface StepValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  hepViolations: string[]; // Human Error Prevention violations
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRATION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class RegistrationService {
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1: INITIATE REGISTRATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Initiate a new registration session
   * Generates unique registration ID and creates draft participant record
   */
  async initiateRegistration(
    source?: string,
    referralCode?: string,
    ipAddress?: string
  ): Promise<{ participantId: string; registrationId: string; sessionToken: string }> {
    
    const participantId = `participant_${uuidv4()}`;
    const registrationId = this.generateRegistrationId();
    const sessionToken = this.generateSecureToken();
    
    // In production: Create draft participant in database
    // await prisma.participant.create({
    //   data: {
    //     id: participantId,
    //     registrationId,
    //     entityType: 'INDIVIDUAL', // Default, will be updated
    //     status: 'DRAFT',
    //     username: `temp_${Date.now()}`, // Temporary, will be updated
    //     passwordHash: '', // Will be set later
    //     registrationSource: source,
    //     referralCode,
    //   }
    // });
    
    // Audit log
    await this.createAuditLog({
      participantId,
      action: 'REGISTRATION_INITIATED',
      category: 'REGISTRATION',
      description: `Registration initiated from ${source || 'unknown'} source`,
      performedBy: 'SYSTEM',
      ipAddress,
    });
    
    return { participantId, registrationId, sessionToken };
  }
  
  /**
   * Generate immutable registration ID
   * Format: TROT-{COUNTRY}-{YEAR}{MONTH}-{SEQUENCE}
   */
  private generateRegistrationId(): string {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const sequence = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TROT-XX-${year}${month}-${sequence}`;
  }
  
  private generateSecureToken(): string {
    return uuidv4() + '-' + Date.now().toString(36);
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2: ROLE SELECTION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Save role selection with multi-role support
   */
  async saveRoleSelection(
    ctx: RegistrationContext,
    roles: ParticipantArchetype[],
    ftrCategories?: string[],
    earmarkedLimit?: number
  ): Promise<StepValidationResult> {
    
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};
    const hepViolations: string[] = [];
    
    // Validation
    if (!roles || roles.length === 0) {
      errors.roles = 'At least one role must be selected';
    }
    
    // Role-specific validations
    if (roles.includes('MARKET_MAKER') && !earmarkedLimit) {
      errors.earmarkedLimit = 'Earmarked limit is required for Market Makers';
    }
    
    if (roles.includes('SERVICE_PROVIDER') && (!ftrCategories || ftrCategories.length === 0)) {
      errors.ftrCategories = 'At least one FTR category must be selected for Service Providers';
    }
    
    // Conflict detection
    if (roles.includes('TGDP_MINTER') && roles.includes('TGDP_JEWELER')) {
      warnings.roleConflict = 'Both TGDP Minter and Jeweler selected - ensure you meet both requirements';
    }
    
    if (Object.keys(errors).length === 0) {
      // In production: Save to database
      // await prisma.participantRole.createMany({
      //   data: roles.map(role => ({
      //     participantId: ctx.participantId,
      //     archetype: role,
      //     ftrCategories: ftrCategories || [],
      //     earmarkedLimit,
      //   }))
      // });
      
      await this.createAuditLog({
        participantId: ctx.participantId,
        action: 'ROLES_SELECTED',
        category: 'REGISTRATION',
        description: `Roles selected: ${roles.join(', ')}`,
        performedBy: ctx.participantId,
        newState: { roles, ftrCategories, earmarkedLimit },
      });
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings,
      hepViolations,
    };
  }
  
  /**
   * Request new FTR category (triggers Domain Consultant workflow)
   */
  async requestNewCategory(
    ctx: RegistrationContext,
    categoryName: string,
    description: string
  ): Promise<{ ticketId: string; aiDraftedDescription: string }> {
    
    // AI-draft the description
    const aiDraftedDescription = await this.aiDraftCategoryDescription(categoryName, description);
    
    const ticketId = `CAT-${Date.now()}`;
    
    // In production: Create ticket for Domain Consultant
    // await prisma.ftrCategory.create({
    //   data: {
    //     code: `PENDING_${ticketId}`,
    //     name: categoryName,
    //     description: aiDraftedDescription,
    //     isPending: true,
    //     requestedBy: ctx.participantId,
    //   }
    // });
    
    return { ticketId, aiDraftedDescription };
  }
  
  private async aiDraftCategoryDescription(name: string, userDescription: string): Promise<string> {
    // In production: Call AI service
    return `${name}: ${userDescription}. This category covers goods and services related to ${name.toLowerCase()}, subject to standard FTR terms and regulatory compliance.`;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3: ENTITY TYPE & PROFILE
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Save entity type selection
   */
  async saveEntityType(
    ctx: RegistrationContext,
    entityType: EntityType
  ): Promise<StepValidationResult> {
    
    const errors: Record<string, string> = {};
    
    // In production: Update participant
    // await prisma.participant.update({
    //   where: { id: ctx.participantId },
    //   data: { entityType }
    // });
    
    await this.createAuditLog({
      participantId: ctx.participantId,
      action: 'ENTITY_TYPE_SELECTED',
      category: 'REGISTRATION',
      description: `Entity type set to ${entityType}`,
      performedBy: ctx.participantId,
    });
    
    return { isValid: true, errors, warnings: {}, hepViolations: [] };
  }
  
  /**
   * Save individual profile with comprehensive validation
   */
  async saveIndividualProfile(
    ctx: RegistrationContext,
    profile: {
      salutation?: string;
      firstName: string;
      middleName?: string;
      lastName: string;
      dateOfBirth: string;
      gender?: string;
      maritalStatus?: string;
      nationality: string;
      countryOfResidence: string;
      education?: string;
      occupation?: string;
      address: {
        line1: string;
        line2?: string;
        city: string;
        stateProvince: string;
        countryCode: string;
        postalCode: string;
      };
    }
  ): Promise<StepValidationResult> {
    
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};
    const hepViolations: string[] = [];
    
    // Required field validation
    if (!profile.firstName?.trim()) errors.firstName = 'First name is required';
    if (!profile.lastName?.trim()) errors.lastName = 'Last name is required';
    if (!profile.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
    if (!profile.nationality) errors.nationality = 'Nationality is required';
    if (!profile.countryOfResidence) errors.countryOfResidence = 'Country of residence is required';
    
    // Age validation (must be 18+)
    if (profile.dateOfBirth) {
      const age = this.calculateAge(profile.dateOfBirth);
      if (age < 18) {
        errors.dateOfBirth = 'Must be at least 18 years old to register';
      }
      if (age > 120) {
        errors.dateOfBirth = 'Please enter a valid date of birth';
      }
    }
    
    // Address validation
    if (!profile.address?.line1?.trim()) errors['address.line1'] = 'Address line 1 is required';
    if (!profile.address?.city?.trim()) errors['address.city'] = 'City is required';
    if (!profile.address?.stateProvince?.trim()) errors['address.stateProvince'] = 'State/Province is required';
    if (!profile.address?.countryCode) errors['address.countryCode'] = 'Country is required';
    if (!profile.address?.postalCode?.trim()) errors['address.postalCode'] = 'Postal code is required';
    
    // HEP: Name consistency check
    const fullName = [profile.firstName, profile.middleName, profile.lastName]
      .filter(Boolean)
      .join(' ');
    
    // HEP: Suspicious patterns
    if (this.containsSuspiciousPattern(profile.firstName) || 
        this.containsSuspiciousPattern(profile.lastName)) {
      hepViolations.push('Name contains unusual characters or patterns');
    }
    
    if (Object.keys(errors).length === 0) {
      // In production: Save to database
      await this.createAuditLog({
        participantId: ctx.participantId,
        action: 'INDIVIDUAL_PROFILE_SAVED',
        category: 'REGISTRATION',
        description: 'Individual profile information saved',
        performedBy: ctx.participantId,
      });
    }
    
    return { isValid: Object.keys(errors).length === 0, errors, warnings, hepViolations };
  }
  
  /**
   * Save corporate profile with OCR verification
   */
  async saveCorporateProfile(
    ctx: RegistrationContext,
    profile: {
      legalName: string;
      tradingName?: string;
      registrationNumber: string;
      registrationDate: string;
      registrationAuthority: string;
      registrationValidity?: string;
      taxId?: string;
      gstNumber?: string;
      registeredAddress: {
        line1: string;
        line2?: string;
        city: string;
        stateProvince: string;
        countryCode: string;
        postalCode: string;
      };
      businessPhone: string;
      businessEmail: string;
    },
    registrationCertImage?: string // Base64 for OCR
  ): Promise<StepValidationResult> {
    
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};
    const hepViolations: string[] = [];
    
    // Required field validation
    if (!profile.legalName?.trim()) errors.legalName = 'Legal name is required';
    if (!profile.registrationNumber?.trim()) errors.registrationNumber = 'Registration number is required';
    if (!profile.registrationDate) errors.registrationDate = 'Registration date is required';
    if (!profile.registrationAuthority?.trim()) errors.registrationAuthority = 'Registration authority is required';
    if (!profile.businessPhone?.trim()) errors.businessPhone = 'Business phone is required';
    if (!profile.businessEmail?.trim()) errors.businessEmail = 'Business email is required';
    
    // Email format validation
    if (profile.businessEmail && !this.isValidEmail(profile.businessEmail)) {
      errors.businessEmail = 'Invalid email format';
    }
    
    // Phone format validation
    if (profile.businessPhone && !this.isValidPhone(profile.businessPhone)) {
      errors.businessPhone = 'Invalid phone format';
    }
    
    // OCR verification if image provided
    if (registrationCertImage) {
      const ocrResult = await this.performOcrVerification(registrationCertImage);
      
      if (ocrResult.confidence < 0.98) {
        warnings.ocrConfidence = `OCR confidence: ${(ocrResult.confidence * 100).toFixed(1)}%. Manual verification may be required.`;
      }
      
      // Cross-verify extracted data
      if (ocrResult.extractedRegNumber && 
          ocrResult.extractedRegNumber !== profile.registrationNumber) {
        hepViolations.push(
          `Registration number mismatch: Entered "${profile.registrationNumber}" but OCR extracted "${ocrResult.extractedRegNumber}"`
        );
      }
    }
    
    // GST number format validation (India-specific)
    if (profile.gstNumber && !this.isValidGSTIN(profile.gstNumber)) {
      errors.gstNumber = 'Invalid GSTIN format';
    }
    
    if (Object.keys(errors).length === 0) {
      await this.createAuditLog({
        participantId: ctx.participantId,
        action: 'CORPORATE_PROFILE_SAVED',
        category: 'REGISTRATION',
        description: 'Corporate profile information saved',
        performedBy: ctx.participantId,
      });
    }
    
    return { isValid: Object.keys(errors).length === 0, errors, warnings, hepViolations };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4: CONTACT DETAILS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Save contact details with verification triggers
   */
  async saveContactDetails(
    ctx: RegistrationContext,
    contacts: {
      primaryMobile: string;
      primaryMobile_verify: string; // HEP double entry
      alternateMobile?: string;
      landline?: string;
      primaryEmail: string;
      primaryEmail_verify: string; // HEP double entry
      alternateEmail?: string;
      socialMediaConsent?: boolean;
      whatsappNumber?: string;
      telegramHandle?: string;
      preferredContactMethod?: string;
      preferredLanguage?: string;
    }
  ): Promise<StepValidationResult> {
    
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};
    const hepViolations: string[] = [];
    
    // Required field validation
    if (!contacts.primaryMobile?.trim()) errors.primaryMobile = 'Primary mobile is required';
    if (!contacts.primaryEmail?.trim()) errors.primaryEmail = 'Primary email is required';
    
    // HEP: Double entry verification
    if (contacts.primaryMobile !== contacts.primaryMobile_verify) {
      hepViolations.push('Primary mobile numbers do not match');
      errors.primaryMobile_verify = 'Mobile numbers must match';
    }
    
    if (contacts.primaryEmail !== contacts.primaryEmail_verify) {
      hepViolations.push('Primary email addresses do not match');
      errors.primaryEmail_verify = 'Email addresses must match';
    }
    
    // Format validation
    if (contacts.primaryMobile && !this.isValidPhone(contacts.primaryMobile)) {
      errors.primaryMobile = 'Invalid mobile number format';
    }
    
    if (contacts.primaryEmail && !this.isValidEmail(contacts.primaryEmail)) {
      errors.primaryEmail = 'Invalid email format';
    }
    
    // Social media consent check
    if ((contacts.whatsappNumber || contacts.telegramHandle) && !contacts.socialMediaConsent) {
      warnings.socialMediaConsent = 'Social media IDs provided but consent not given';
    }
    
    if (Object.keys(errors).length === 0) {
      // Trigger OTP verification
      await this.sendMobileOtp(contacts.primaryMobile);
      await this.sendEmailVerification(contacts.primaryEmail);
      
      await this.createAuditLog({
        participantId: ctx.participantId,
        action: 'CONTACT_DETAILS_SAVED',
        category: 'REGISTRATION',
        description: 'Contact details saved, verification initiated',
        performedBy: ctx.participantId,
      });
    }
    
    return { isValid: Object.keys(errors).length === 0, errors, warnings, hepViolations };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 5: BANK ACCOUNT
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Save bank account with verification
   */
  async saveBankAccount(
    ctx: RegistrationContext,
    account: {
      bankName: string;
      bankCode: string; // IFSC/SWIFT
      branchName?: string;
      accountNumber: string;
      accountNumber_verify: string; // HEP double entry
      accountHolderName: string;
      accountType: string;
      currency: string;
      isPrimary: boolean;
    }
  ): Promise<StepValidationResult> {
    
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};
    const hepViolations: string[] = [];
    
    // Required field validation
    if (!account.bankName?.trim()) errors.bankName = 'Bank name is required';
    if (!account.bankCode?.trim()) errors.bankCode = 'Bank code (IFSC/SWIFT) is required';
    if (!account.accountNumber?.trim()) errors.accountNumber = 'Account number is required';
    if (!account.accountHolderName?.trim()) errors.accountHolderName = 'Account holder name is required';
    
    // HEP: Double entry verification for account number
    if (account.accountNumber !== account.accountNumber_verify) {
      hepViolations.push('Account numbers do not match');
      errors.accountNumber_verify = 'Account numbers must match';
    }
    
    // IFSC validation (India)
    if (account.bankCode && account.currency === 'INR' && !this.isValidIFSC(account.bankCode)) {
      errors.bankCode = 'Invalid IFSC code format';
    }
    
    // SWIFT validation (International)
    if (account.bankCode && account.currency !== 'INR' && !this.isValidSWIFT(account.bankCode)) {
      errors.bankCode = 'Invalid SWIFT/BIC code format';
    }
    
    if (Object.keys(errors).length === 0) {
      // Trigger penny drop verification
      const verificationResult = await this.initiatePennyDropVerification(
        account.accountNumber,
        account.bankCode
      );
      
      if (!verificationResult.success) {
        errors.accountNumber = verificationResult.error || 'Bank account verification failed';
      }
      
      await this.createAuditLog({
        participantId: ctx.participantId,
        action: 'BANK_ACCOUNT_SAVED',
        category: 'REGISTRATION',
        description: 'Bank account details saved',
        performedBy: ctx.participantId,
      });
    }
    
    return { isValid: Object.keys(errors).length === 0, errors, warnings, hepViolations };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 6: NOMINEES
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Save nominee details with percentage validation
   */
  async saveNominees(
    ctx: RegistrationContext,
    nominees: Array<{
      name: string;
      relation: string;
      phone: string;
      email?: string;
      percentage: number;
      percentage_verify: number; // HEP double entry
      canAssistRecovery: boolean;
    }>
  ): Promise<StepValidationResult> {
    
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};
    const hepViolations: string[] = [];
    
    // Total percentage must equal 100
    const totalPercentage = nominees.reduce((sum, n) => sum + (n.percentage || 0), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      errors.totalPercentage = `Nominee percentages must total 100%. Current total: ${totalPercentage}%`;
    }
    
    // Validate each nominee
    nominees.forEach((nominee, index) => {
      if (!nominee.name?.trim()) {
        errors[`nominees[${index}].name`] = 'Nominee name is required';
      }
      if (!nominee.relation?.trim()) {
        errors[`nominees[${index}].relation`] = 'Relation is required';
      }
      if (!nominee.phone?.trim()) {
        errors[`nominees[${index}].phone`] = 'Nominee phone is required';
      }
      
      // HEP: Double entry for percentage
      if (nominee.percentage !== nominee.percentage_verify) {
        hepViolations.push(`Nominee ${index + 1}: Percentages do not match`);
        errors[`nominees[${index}].percentage_verify`] = 'Percentages must match';
      }
    });
    
    // Wallet recovery: Need at least 3 nominees if social recovery enabled
    const recoveryNominees = nominees.filter(n => n.canAssistRecovery);
    if (recoveryNominees.length > 0 && recoveryNominees.length < 3) {
      warnings.recoveryNominees = 'Social recovery requires at least 3 nominees. Currently only ' + recoveryNominees.length;
    }
    
    if (Object.keys(errors).length === 0) {
      await this.createAuditLog({
        participantId: ctx.participantId,
        action: 'NOMINEES_SAVED',
        category: 'REGISTRATION',
        description: `${nominees.length} nominee(s) saved`,
        performedBy: ctx.participantId,
      });
    }
    
    return { isValid: Object.keys(errors).length === 0, errors, warnings, hepViolations };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 7: CREDENTIALS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Set username and password
   */
  async setCredentials(
    ctx: RegistrationContext,
    credentials: {
      username: string;
      usernameAka?: string;
      password: string;
      password_verify: string; // HEP double entry
    }
  ): Promise<StepValidationResult> {
    
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};
    const hepViolations: string[] = [];
    
    // Username validation
    if (!credentials.username?.trim()) {
      errors.username = 'Username is required';
    } else if (credentials.username.length < 4) {
      errors.username = 'Username must be at least 4 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(credentials.username)) {
      errors.username = 'Username can only contain letters, numbers, and underscores';
    } else {
      // Check uniqueness
      const exists = await this.checkUsernameExists(credentials.username);
      if (exists) {
        errors.username = 'Username already taken';
      }
    }
    
    // Password validation
    if (!credentials.password) {
      errors.password = 'Password is required';
    } else {
      const passwordStrength = this.validatePasswordStrength(credentials.password);
      if (!passwordStrength.isValid) {
        errors.password = passwordStrength.message;
      }
    }
    
    // HEP: Double entry for password
    if (credentials.password !== credentials.password_verify) {
      hepViolations.push('Passwords do not match');
      errors.password_verify = 'Passwords must match';
    }
    
    if (Object.keys(errors).length === 0) {
      // Hash password
      const passwordHash = await this.hashPassword(credentials.password);
      
      // In production: Update participant
      // await prisma.participant.update({
      //   where: { id: ctx.participantId },
      //   data: {
      //     username: credentials.username,
      //     usernameAka: credentials.usernameAka,
      //     passwordHash,
      //   }
      // });
      
      await this.createAuditLog({
        participantId: ctx.participantId,
        action: 'CREDENTIALS_SET',
        category: 'REGISTRATION',
        description: 'Username and password configured',
        performedBy: ctx.participantId,
      });
    }
    
    return { isValid: Object.keys(errors).length === 0, errors, warnings, hepViolations };
  }
  
  private validatePasswordStrength(password: string): { isValid: boolean; message: string } {
    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters' };
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one number' };
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one special character' };
    }
    return { isValid: true, message: 'Password is strong' };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 8: TERMS ACCEPTANCE
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Record terms and conditions acceptance
   */
  async acceptTerms(
    ctx: RegistrationContext,
    acceptance: {
      generalTermsAccepted: boolean;
      generalTermsVersion: string;
      roleSpecificTerms: Array<{
        role: ParticipantArchetype;
        accepted: boolean;
        version: string;
      }>;
      gdprConsents?: {
        identityVerification: boolean;
        sanctionsScreening: boolean;
        transactionMonitoring: boolean;
        dataSharing: boolean;
        crossBorderTransfers: boolean;
      };
    },
    ipAddress?: string
  ): Promise<StepValidationResult> {
    
    const errors: Record<string, string> = {};
    const hepViolations: string[] = [];
    
    if (!acceptance.generalTermsAccepted) {
      errors.generalTerms = 'You must accept the general terms and conditions';
    }
    
    // Check all role-specific terms
    const unacceptedRoles = acceptance.roleSpecificTerms.filter(t => !t.accepted);
    if (unacceptedRoles.length > 0) {
      errors.roleTerms = `You must accept terms for: ${unacceptedRoles.map(r => r.role).join(', ')}`;
    }
    
    // GDPR consents for EEA participants
    if (acceptance.gdprConsents) {
      if (!acceptance.gdprConsents.identityVerification) {
        errors.gdprIdentity = 'Identity verification consent is required';
      }
      if (!acceptance.gdprConsents.sanctionsScreening) {
        errors.gdprSanctions = 'Sanctions screening consent is required (legal obligation)';
      }
    }
    
    if (Object.keys(errors).length === 0) {
      await this.createAuditLog({
        participantId: ctx.participantId,
        action: 'TERMS_ACCEPTED',
        category: 'REGISTRATION',
        description: `Terms accepted: General v${acceptance.generalTermsVersion}`,
        performedBy: ctx.participantId,
        ipAddress,
        newState: acceptance,
      });
    }
    
    return { isValid: Object.keys(errors).length === 0, errors, warnings: {}, hepViolations };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // FINALIZE REGISTRATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Complete registration and activate participant
   */
  async finalizeRegistration(
    ctx: RegistrationContext
  ): Promise<RegistrationResponse> {
    
    try {
      // 1. Verify all required steps completed
      const completionStatus = await this.checkRegistrationCompletion(ctx.participantId);
      if (!completionStatus.isComplete) {
        return {
          success: false,
          error: {
            code: 'INCOMPLETE_REGISTRATION',
            message: 'Registration is incomplete',
            details: { missingSteps: completionStatus.missingSteps },
          },
        };
      }
      
      // 2. Run eligibility check
      const eligibility = await this.checkEligibility(ctx.participantId);
      if (!eligibility.isEligible) {
        return {
          success: false,
          error: {
            code: 'ELIGIBILITY_FAILED',
            message: 'Eligibility check failed',
            details: { reasons: eligibility.failureReasons },
          },
        };
      }
      
      // 3. Create wallet
      const wallet = await this.createWallet(ctx.participantId);
      
      // 4. Activate participant
      // In production: Update status in database
      
      // 5. Trigger post-registration workflows
      await this.triggerPostRegistrationWorkflows(ctx.participantId);
      
      // 6. Create final audit log
      await this.createAuditLog({
        participantId: ctx.participantId,
        action: 'REGISTRATION_COMPLETED',
        category: 'REGISTRATION',
        description: 'Registration completed and participant activated',
        performedBy: 'SYSTEM',
      });
      
      return {
        success: true,
        data: {
          participantId: ctx.participantId,
          registrationId: ctx.registrationId,
          status: 'ACTIVE',
          kycTier: 'TIER_1_BASIC', // Initial tier
          kycStatus: 'APPROVED',
          walletAddress: wallet.address,
          nextSteps: [
            'Complete enhanced KYC for higher transaction limits',
            'Set up 2FA for additional security',
            'Configure wallet recovery options',
          ],
        },
      };
      
    } catch (error) {
      await this.createAuditLog({
        participantId: ctx.participantId,
        action: 'REGISTRATION_FAILED',
        category: 'REGISTRATION',
        description: `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        performedBy: 'SYSTEM',
      });
      
      return {
        success: false,
        error: {
          code: 'REGISTRATION_ERROR',
          message: 'An error occurred during registration',
        },
      };
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // ELIGIBILITY CHECK
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Comprehensive eligibility check
   */
  async checkEligibility(participantId: string): Promise<EligibilityCheckResult> {
    const checks = {
      kycApproved: false,
      riskScoreAcceptable: false,
      noActiveBreaches: false,
      notInCoolingOff: false,
      notBlacklisted: false,
      creditScoreMinimum: true,
      tgdpRatioValid: true,
    };
    
    const failureReasons: string[] = [];
    
    // In production: Fetch participant data and check each condition
    
    // Mock implementation
    checks.kycApproved = true;
    checks.riskScoreAcceptable = true;
    checks.noActiveBreaches = true;
    checks.notInCoolingOff = true;
    checks.notBlacklisted = true;
    
    const isEligible = Object.values(checks).every(v => v);
    
    return {
      participantId,
      isEligible,
      checks,
      failureReasons,
      checkedAt: new Date().toISOString(),
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────────────────
  
  private calculateAge(dateOfBirth: string): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
  
  private containsSuspiciousPattern(text: string): boolean {
    const suspiciousPatterns = [
      /\d{4,}/, // Multiple consecutive digits
      /[<>{}[\]\\]/, // HTML/code characters
      /(.)\1{3,}/, // Same character repeated 4+ times
    ];
    return suspiciousPatterns.some(pattern => pattern.test(text));
  }
  
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  
  private isValidPhone(phone: string): boolean {
    return /^\+?[\d\s-]{10,15}$/.test(phone.replace(/\s/g, ''));
  }
  
  private isValidGSTIN(gstin: string): boolean {
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
  }
  
  private isValidIFSC(ifsc: string): boolean {
    return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
  }
  
  private isValidSWIFT(swift: string): boolean {
    return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift);
  }
  
  private async checkUsernameExists(username: string): Promise<boolean> {
    // In production: Query database
    return false;
  }
  
  private async hashPassword(password: string): Promise<string> {
    // In production: Use bcrypt or argon2
    return `hashed_${password}`;
  }
  
  private async performOcrVerification(image: string): Promise<{
    confidence: number;
    extractedRegNumber?: string;
    extractedData?: Record<string, any>;
  }> {
    // In production: Call OCR service
    return { confidence: 0.99 };
  }
  
  private async sendMobileOtp(mobile: string): Promise<void> {
    // In production: Send OTP via SMS gateway
  }
  
  private async sendEmailVerification(email: string): Promise<void> {
    // In production: Send verification email
  }
  
  private async initiatePennyDropVerification(
    accountNumber: string,
    bankCode: string
  ): Promise<{ success: boolean; error?: string }> {
    // In production: Initiate penny drop verification
    return { success: true };
  }
  
  private async checkRegistrationCompletion(participantId: string): Promise<{
    isComplete: boolean;
    missingSteps: string[];
  }> {
    // In production: Check all required steps
    return { isComplete: true, missingSteps: [] };
  }
  
  private async createWallet(participantId: string): Promise<{
    address: string;
    namespace: WalletNamespace;
  }> {
    // In production: Create wallet on blockchain
    return {
      address: `TROTDFX-${uuidv4().substring(0, 24).toUpperCase()}`,
      namespace: 'FTR_STANDARD',
    };
  }
  
  private async triggerPostRegistrationWorkflows(participantId: string): Promise<void> {
    // 1. Generate legal documents
    // 2. Send welcome notification
    // 3. Create renewal schedules
    // 4. Initialize dashboard access
  }
  
  private async createAuditLog(params: {
    participantId: string;
    action: string;
    category: string;
    description: string;
    performedBy: string;
    ipAddress?: string;
    userAgent?: string;
    oldState?: any;
    newState?: any;
  }): Promise<void> {
    // Calculate retention date (7 years FATF)
    const retainUntil = new Date();
    retainUntil.setFullYear(retainUntil.getFullYear() + RETENTION_PERIODS.FATF_MINIMUM_YEARS);
    
    // In production: Insert into RegistrationAudit table
    console.log('[AUDIT]', params.action, params.description);
  }
}

// Export singleton instance
export const registrationService = new RegistrationService();
