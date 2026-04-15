/**
 * IRG_FTR PLATFORM - FTR Integration Service
 * 
 * Central integration layer connecting:
 * - Registration Module (participant validation)
 * - ROI Module (dynamic country-based ROI)
 * - Minting Module (FTR product creation)
 * - Consultant Module (approval workflow)
 * 
 * This service ensures all FTR products are processed with:
 * - Valid registered participants
 * - Dynamic ROI based on minter's country
 * - Proper consultant approval with justification
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import { roiModuleService, RoiValidationResult, ProjectRoiOverride } from '../roi/services/roi-module.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ParticipantValidationResult {
  isValid: boolean;
  participantId?: string;
  registrationId?: string;
  kycStatus?: string;
  kycTier?: number;
  roles?: string[];
  countryCode?: string;
  riskScore?: number;
  errors: string[];
  warnings: string[];
}

export interface MintingEligibilityResult {
  isEligible: boolean;
  participantValidation: ParticipantValidationResult;
  roiValidation: RoiValidationResult;
  productEligibility: {
    allowed: boolean;
    productType: string;
    requiredKycTier: number;
    currentKycTier: number;
  };
  errors: string[];
  warnings: string[];
}

export interface ProjectApprovalRequest {
  projectId: string;
  minterId: string;
  minterCountry: string;
  productType: string;
  requestedRoi: number;
  totalCapacity: number;
  faceValue: number;
  validityYears: number;
}

export interface ConsultantApprovalResult {
  projectId: string;
  consultantId: string;
  consultantName: string;
  baseRoi: number;
  approvedRoi: number;
  roiDelta: number;
  roiJustificationRequired: boolean;
  roiJustificationProvided: boolean;
  roiOverride?: ProjectRoiOverride;
  recommendation: 'APPROVE' | 'REJECT' | 'CONDITIONAL_APPROVE';
  conditions?: string[];
  technicalAssessment: string;
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONDITIONAL';
  createdAt: Date;
}

export interface FtrProductContext {
  projectId: string;
  minterId: string;
  participantId: string;
  minterCountry: string;
  productType: string;
  effectiveRoi: number;
  roiSource: 'BASE' | 'OVERRIDE';
  roiOverride?: ProjectRoiOverride;
  kycTier: number;
  riskScore: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT TYPE REQUIREMENTS
// ═══════════════════════════════════════════════════════════════════════════════

const PRODUCT_KYC_REQUIREMENTS: Record<string, number> = {
  'K_FTR': 1,       // Kitchen FTR - Tier 1
  'TGDP': 2,        // Transparent Gold - Tier 2
  'T_JR': 2,        // Jeweler FTR - Tier 2
  'AF_FTR': 2,      // Agricultural FTR - Tier 2
  'GIC': 1,         // Gift Card - Tier 1
  'HOSP': 2,        // Hospitality - Tier 2
  'HEALTH': 2,      // Healthcare - Tier 2
  'EDU': 1,         // Education - Tier 1
  'TROT_REALTY': 3, // Real Estate - Tier 3
  'TAXI_FTR': 1,    // Taxi FTR - Tier 1
};

const PRODUCT_ROLES: Record<string, string[]> = {
  'K_FTR': ['SERVICE_PROVIDER', 'FTR_BUYER_HOUSEHOLD', 'FTR_BUYER_OTHER'],
  'TGDP': ['TGDP_MINTER', 'TGDP_JEWELER'],
  'T_JR': ['TGDP_JEWELER', 'SERVICE_PROVIDER'],
  'AF_FTR': ['SERVICE_PROVIDER', 'FTR_BUYER_OTHER'],
  'GIC': ['SERVICE_PROVIDER', 'FTR_BUYER_HOUSEHOLD', 'FTR_BUYER_OTHER'],
  'HOSP': ['SERVICE_PROVIDER', 'FTR_BUYER_HOUSEHOLD', 'FTR_BUYER_OTHER'],
  'HEALTH': ['SERVICE_PROVIDER', 'FTR_BUYER_HOUSEHOLD', 'FTR_BUYER_OTHER'],
  'EDU': ['SERVICE_PROVIDER', 'FTR_BUYER_HOUSEHOLD', 'FTR_BUYER_OTHER'],
  'TROT_REALTY': ['SERVICE_PROVIDER', 'INVESTOR', 'FTR_BUYER_OTHER'],
  'TAXI_FTR': ['SERVICE_PROVIDER', 'DAC_PARTICIPANT'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// FTR INTEGRATION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class FtrIntegrationService {
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PARTICIPANT VALIDATION (Registration Module Integration)
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Validate participant registration status for FTR operations
   */
  async validateParticipant(participantId: string): Promise<ParticipantValidationResult> {
    // In production: Fetch from database via Registration Module
    // For now, mock validation
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!participantId) {
      errors.push('Participant ID is required');
      return { isValid: false, errors, warnings };
    }
    
    // Mock participant data (in production, fetch from registration service)
    const mockParticipant = {
      participantId,
      registrationId: `TROT-IN-2604-${participantId.slice(-6).toUpperCase()}`,
      kycStatus: 'APPROVED',
      kycTier: 2,
      roles: ['SERVICE_PROVIDER', 'FTR_BUYER_HOUSEHOLD'],
      countryCode: 'IN',
      riskScore: 0.82,
      isActive: true,
    };
    
    // Validation checks
    if (!mockParticipant.isActive) {
      errors.push('Participant registration is not active');
    }
    
    if (mockParticipant.kycStatus !== 'APPROVED') {
      errors.push(`KYC status is ${mockParticipant.kycStatus}, must be APPROVED`);
    }
    
    if (mockParticipant.riskScore < 0.40) {
      errors.push('Risk score is below acceptable threshold (0.40)');
    } else if (mockParticipant.riskScore < 0.65) {
      warnings.push('Risk score is in MEDIUM range - some products may be restricted');
    }
    
    return {
      isValid: errors.length === 0,
      participantId: mockParticipant.participantId,
      registrationId: mockParticipant.registrationId,
      kycStatus: mockParticipant.kycStatus,
      kycTier: mockParticipant.kycTier,
      roles: mockParticipant.roles,
      countryCode: mockParticipant.countryCode,
      riskScore: mockParticipant.riskScore,
      errors,
      warnings,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // MINTING ELIGIBILITY CHECK (Combined Validation)
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Check complete minting eligibility including participant, ROI, and product rules
   */
  async checkMintingEligibility(
    participantId: string,
    productType: string,
    requestedRoi: number,
    countryCode?: string
  ): Promise<MintingEligibilityResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 1. Validate participant
    const participantValidation = await this.validateParticipant(participantId);
    
    if (!participantValidation.isValid) {
      errors.push(...participantValidation.errors);
    }
    warnings.push(...participantValidation.warnings);
    
    // Use participant's country if not provided
    const effectiveCountry = countryCode || participantValidation.countryCode || 'IN';
    
    // 2. Validate ROI
    const roiValidation = await roiModuleService.validateRoiChange(effectiveCountry, requestedRoi);
    
    if (!roiValidation.isValid) {
      errors.push(...roiValidation.errors);
    }
    warnings.push(...roiValidation.warnings);
    
    // 3. Check product eligibility
    const requiredKycTier = PRODUCT_KYC_REQUIREMENTS[productType] || 1;
    const currentKycTier = participantValidation.kycTier || 0;
    const allowedRoles = PRODUCT_ROLES[productType] || [];
    const participantRoles = participantValidation.roles || [];
    
    const hasRequiredRole = participantRoles.some(role => allowedRoles.includes(role));
    const hasRequiredKyc = currentKycTier >= requiredKycTier;
    
    if (!hasRequiredRole) {
      errors.push(`None of participant's roles (${participantRoles.join(', ')}) are allowed for ${productType}`);
    }
    
    if (!hasRequiredKyc) {
      errors.push(`KYC Tier ${currentKycTier} is below required Tier ${requiredKycTier} for ${productType}`);
    }
    
    return {
      isEligible: errors.length === 0,
      participantValidation,
      roiValidation,
      productEligibility: {
        allowed: hasRequiredRole && hasRequiredKyc,
        productType,
        requiredKycTier,
        currentKycTier,
      },
      errors,
      warnings,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PROJECT ROI MANAGEMENT (ROI Module Integration)
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Get dynamic ROI for a minting project based on minter's country
   */
  async getProjectRoi(projectId: string, minterCountry: string): Promise<{
    effectiveRoi: number;
    baseRoi: number;
    source: 'BASE' | 'OVERRIDE';
    override?: ProjectRoiOverride;
    minAllowed: number;
    maxAllowed: number;
  }> {
    // Get effective ROI (checks for overrides first)
    const effectiveRoi = await roiModuleService.getEffectiveProjectRoi(projectId, minterCountry);
    
    // Get base config for min/max bounds
    const config = await roiModuleService.getRoiConfig(minterCountry);
    const baseRoi = await roiModuleService.getBaseRoi(minterCountry);
    
    return {
      effectiveRoi: effectiveRoi.roi,
      baseRoi,
      source: effectiveRoi.source,
      override: effectiveRoi.override,
      minAllowed: config?.minRoiPercent ?? 0,
      maxAllowed: config?.maxRoiPercent ?? 100,
    };
  }
  
  /**
   * Process consultant ROI approval with justification
   */
  async processConsultantRoiApproval(
    projectId: string,
    minterId: string,
    minterCountry: string,
    approvedRoi: number,
    consultantId: string,
    consultantName: string,
    justificationCategory?: string,
    justificationText?: string,
    supportingEvidence?: string[]
  ): Promise<{
    success: boolean;
    override?: ProjectRoiOverride;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    // Get base ROI for comparison
    const baseRoi = await roiModuleService.getBaseRoi(minterCountry);
    const roiDelta = Math.abs(approvedRoi - baseRoi);
    
    // Check if justification is required
    if (roiDelta >= 1.0) {
      if (!justificationCategory) {
        errors.push('Justification category is required when changing ROI by 1% or more');
      }
      if (!justificationText || justificationText.length < 50) {
        errors.push('Detailed justification (minimum 50 characters) is required when changing ROI');
      }
    }
    
    if (errors.length > 0) {
      return { success: false, errors };
    }
    
    // Create ROI override if ROI changed
    if (roiDelta >= 0.1 && justificationCategory && justificationText) {
      try {
        const override = await roiModuleService.createRoiOverride(
          projectId,
          minterId,
          minterCountry,
          approvedRoi,
          consultantId,
          consultantName,
          justificationCategory as any,
          justificationText,
          supportingEvidence
        );
        
        return { success: true, override, errors: [] };
      } catch (error) {
        return {
          success: false,
          errors: [(error as Error).message],
        };
      }
    }
    
    return { success: true, errors: [] };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // FTR PRODUCT CONTEXT (Complete Context for Processing)
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Build complete FTR product context for processing
   */
  async buildFtrProductContext(
    projectId: string,
    minterId: string,
    participantId: string,
    productType: string
  ): Promise<FtrProductContext | null> {
    // Validate participant
    const participantValidation = await this.validateParticipant(participantId);
    
    if (!participantValidation.isValid) {
      console.error('[FTR_INTEGRATION] Invalid participant:', participantValidation.errors);
      return null;
    }
    
    const minterCountry = participantValidation.countryCode || 'IN';
    
    // Get effective ROI
    const roiInfo = await this.getProjectRoi(projectId, minterCountry);
    
    return {
      projectId,
      minterId,
      participantId,
      minterCountry,
      productType,
      effectiveRoi: roiInfo.effectiveRoi,
      roiSource: roiInfo.source,
      roiOverride: roiInfo.override,
      kycTier: participantValidation.kycTier || 0,
      riskScore: participantValidation.riskScore || 0,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITY METHODS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Get product KYC requirements
   */
  getProductKycRequirement(productType: string): number {
    return PRODUCT_KYC_REQUIREMENTS[productType] || 1;
  }
  
  /**
   * Get allowed roles for a product
   */
  getProductAllowedRoles(productType: string): string[] {
    return PRODUCT_ROLES[productType] || [];
  }
  
  /**
   * Check if participant has required role for product
   */
  hasRequiredRole(participantRoles: string[], productType: string): boolean {
    const allowedRoles = this.getProductAllowedRoles(productType);
    return participantRoles.some(role => allowedRoles.includes(role));
  }
}

// Singleton export
export const ftrIntegrationService = new FtrIntegrationService();
export default ftrIntegrationService;
