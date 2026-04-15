/**
 * IRG_FTR PLATFORM - KYC Engine Service
 * TROT REGISTRATION PROTOCOL COMPLIANT
 * 
 * 5-Tier Global KYC with country-specific rules, sanctions screening,
 * video KYC, and GDPR compliance
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import {
  KycTier,
  KycStatus,
  KycDocumentType,
  SanctionsListType,
  KycVerificationResult,
  SanctionsScreeningResult,
  CountryKycConfig,
  KYC_TIER_LIMITS,
  KYC_TIER_VALIDITY_MONTHS,
  SLA_DURATIONS,
} from '@ftr-platform/shared/registration/types';

// ═══════════════════════════════════════════════════════════════════════════════
// COUNTRY CONFIGURATIONS (Pre-loaded from Legal Database)
// ═══════════════════════════════════════════════════════════════════════════════

const COUNTRY_KYC_CONFIGS: Record<string, CountryKycConfig> = {
  IN: {
    countryCode: 'IN',
    countryName: 'India',
    tierRequirements: {
      TIER_0_PROVISIONAL: {
        documents: ['AADHAAR', 'PAN'],
      },
      TIER_1_BASIC: {
        documents: ['AADHAAR', 'PAN', 'BANK_STATEMENT'],
        additionalRequirements: ['Video KYC or AI Liveness'],
      },
      TIER_2_STANDARD: {
        documents: ['AADHAAR', 'PAN', 'GST_CERTIFICATE', 'REGISTRATION_CERT', 'BANK_STATEMENT', 'UBO_DECLARATION'],
        additionalRequirements: ['Credit Score Pull', 'Company Registry Check'],
      },
      TIER_3_ENHANCED: {
        documents: ['AADHAAR', 'PAN', 'TAX_RETURN', 'AUDITED_FINANCIALS', 'SOURCE_OF_WEALTH', 'SOURCE_OF_FUNDS', 'REFERENCE_LETTER', 'INSURANCE_DEED'],
        additionalRequirements: ['Enhanced Due Diligence', 'Site Visit', 'Third-party References'],
      },
      TIER_4_INSTITUTIONAL: {
        documents: ['REGISTRATION_CERT', 'BOARD_RESOLUTION', 'AUDITED_FINANCIALS', 'UBO_DECLARATION', 'TAX_RETURN'],
        additionalRequirements: ['Full Group Structure', 'Regulatory License Copy'],
      },
    },
    transactionLimits: {
      TIER_0_PROVISIONAL: 5000,
      TIER_1_BASIC: 50000,
      TIER_2_STANDARD: 500000,
      TIER_3_ENHANCED: Infinity,
      TIER_4_INSTITUTIONAL: Infinity,
    },
    primaryRegulator: 'RBI / SEBI',
    regulatoryFramework: 'PMLA 2002, PML Rules 2005',
    sanctionsLists: ['OFAC', 'UN_CONSOLIDATED', 'MHA_INDIA'],
    dataRetentionYears: 7,
    gdprApplicable: false,
  },
  US: {
    countryCode: 'US',
    countryName: 'United States',
    tierRequirements: {
      TIER_0_PROVISIONAL: {
        documents: ['SSN_ITIN', 'DRIVING_LICENSE'],
      },
      TIER_1_BASIC: {
        documents: ['SSN_ITIN', 'DRIVING_LICENSE', 'BANK_STATEMENT'],
        additionalRequirements: ['Video KYC'],
      },
      TIER_2_STANDARD: {
        documents: ['SSN_ITIN', 'PASSPORT', 'REGISTRATION_CERT', 'BANK_STATEMENT', 'UBO_DECLARATION'],
        additionalRequirements: ['Credit Score', 'OFAC Enhanced'],
      },
      TIER_3_ENHANCED: {
        documents: ['PASSPORT', 'TAX_RETURN', 'AUDITED_FINANCIALS', 'SOURCE_OF_WEALTH', 'SOURCE_OF_FUNDS', 'REFERENCE_LETTER'],
        additionalRequirements: ['FinCEN Enhanced', 'BSA 314(b)'],
      },
      TIER_4_INSTITUTIONAL: {
        documents: ['REGISTRATION_CERT', 'BOARD_RESOLUTION', 'AUDITED_FINANCIALS', 'UBO_DECLARATION'],
        additionalRequirements: ['SEC Filings', 'Full Beneficial Ownership'],
      },
    },
    transactionLimits: {
      TIER_0_PROVISIONAL: 5000,
      TIER_1_BASIC: 50000,
      TIER_2_STANDARD: 500000,
      TIER_3_ENHANCED: Infinity,
      TIER_4_INSTITUTIONAL: Infinity,
    },
    primaryRegulator: 'FinCEN',
    regulatoryFramework: 'BSA/AML, USA PATRIOT Act',
    sanctionsLists: ['OFAC', 'UN_CONSOLIDATED'],
    dataRetentionYears: 5,
    gdprApplicable: false,
  },
  GB: {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    tierRequirements: {
      TIER_0_PROVISIONAL: {
        documents: ['PASSPORT', 'DRIVING_LICENSE'],
      },
      TIER_1_BASIC: {
        documents: ['PASSPORT', 'BANK_STATEMENT'],
        additionalRequirements: ['Proof of Address', 'Video KYC'],
      },
      TIER_2_STANDARD: {
        documents: ['PASSPORT', 'REGISTRATION_CERT', 'BANK_STATEMENT', 'UBO_DECLARATION'],
        additionalRequirements: ['Companies House Check', 'Credit Score'],
      },
      TIER_3_ENHANCED: {
        documents: ['PASSPORT', 'TAX_RETURN', 'AUDITED_FINANCIALS', 'SOURCE_OF_WEALTH', 'REFERENCE_LETTER'],
        additionalRequirements: ['HMRC Source of Wealth', 'Enhanced Due Diligence'],
      },
      TIER_4_INSTITUTIONAL: {
        documents: ['REGISTRATION_CERT', 'BOARD_RESOLUTION', 'AUDITED_FINANCIALS', 'UBO_DECLARATION'],
        additionalRequirements: ['FCA Registration Check'],
      },
    },
    transactionLimits: {
      TIER_0_PROVISIONAL: 5000,
      TIER_1_BASIC: 50000,
      TIER_2_STANDARD: 500000,
      TIER_3_ENHANCED: Infinity,
      TIER_4_INSTITUTIONAL: Infinity,
    },
    primaryRegulator: 'FCA',
    regulatoryFramework: 'MLR 2017, Proceeds of Crime Act',
    sanctionsLists: ['OFAC', 'UN_CONSOLIDATED', 'UK_SANCTIONS'],
    dataRetentionYears: 5,
    gdprApplicable: false, // Post-Brexit, but similar standards
  },
  DE: {
    countryCode: 'DE',
    countryName: 'Germany',
    tierRequirements: {
      TIER_0_PROVISIONAL: {
        documents: ['NATIONAL_ID', 'PASSPORT'],
      },
      TIER_1_BASIC: {
        documents: ['NATIONAL_ID', 'PASSPORT', 'BANK_STATEMENT'],
        additionalRequirements: ['Video Ident', 'GDPR Consent'],
      },
      TIER_2_STANDARD: {
        documents: ['PASSPORT', 'REGISTRATION_CERT', 'BANK_STATEMENT', 'UBO_DECLARATION'],
        additionalRequirements: ['Handelsregister Check', 'GDPR Full Consent'],
      },
      TIER_3_ENHANCED: {
        documents: ['PASSPORT', 'TAX_RETURN', 'AUDITED_FINANCIALS', 'SOURCE_OF_WEALTH', 'REFERENCE_LETTER'],
        additionalRequirements: ['GwG Enhanced', 'BaFin Compliance'],
      },
      TIER_4_INSTITUTIONAL: {
        documents: ['REGISTRATION_CERT', 'BOARD_RESOLUTION', 'AUDITED_FINANCIALS', 'UBO_DECLARATION'],
        additionalRequirements: ['Transparenzregister', 'Full AMLD6'],
      },
    },
    transactionLimits: {
      TIER_0_PROVISIONAL: 5000,
      TIER_1_BASIC: 50000,
      TIER_2_STANDARD: 500000,
      TIER_3_ENHANCED: Infinity,
      TIER_4_INSTITUTIONAL: Infinity,
    },
    primaryRegulator: 'BaFin',
    regulatoryFramework: 'GwG (Geldwäschegesetz), AMLD6',
    sanctionsLists: ['OFAC', 'UN_CONSOLIDATED', 'EU_SANCTIONS'],
    dataRetentionYears: 5,
    gdprApplicable: true,
  },
  AE: {
    countryCode: 'AE',
    countryName: 'United Arab Emirates',
    tierRequirements: {
      TIER_0_PROVISIONAL: {
        documents: ['EMIRATES_ID', 'PASSPORT'],
      },
      TIER_1_BASIC: {
        documents: ['EMIRATES_ID', 'PASSPORT', 'BANK_STATEMENT'],
        additionalRequirements: ['Visa Copy', 'Video KYC'],
      },
      TIER_2_STANDARD: {
        documents: ['EMIRATES_ID', 'PASSPORT', 'REGISTRATION_CERT', 'BANK_STATEMENT', 'UBO_DECLARATION'],
        additionalRequirements: ['Trade License', 'DMCC/DED Check'],
      },
      TIER_3_ENHANCED: {
        documents: ['PASSPORT', 'TAX_RETURN', 'AUDITED_FINANCIALS', 'SOURCE_OF_WEALTH', 'REFERENCE_LETTER'],
        additionalRequirements: ['SCA Enhanced', 'Central Bank Rules'],
      },
      TIER_4_INSTITUTIONAL: {
        documents: ['REGISTRATION_CERT', 'BOARD_RESOLUTION', 'AUDITED_FINANCIALS', 'UBO_DECLARATION'],
        additionalRequirements: ['DFSA/ADGM License'],
      },
    },
    transactionLimits: {
      TIER_0_PROVISIONAL: 5000,
      TIER_1_BASIC: 50000,
      TIER_2_STANDARD: 500000,
      TIER_3_ENHANCED: Infinity,
      TIER_4_INSTITUTIONAL: Infinity,
    },
    primaryRegulator: 'Central Bank UAE',
    regulatoryFramework: 'AML-CFT Federal Law, SCA Regulations',
    sanctionsLists: ['OFAC', 'UN_CONSOLIDATED', 'LOCAL_WATCHLIST'],
    dataRetentionYears: 5,
    gdprApplicable: false,
  },
  SG: {
    countryCode: 'SG',
    countryName: 'Singapore',
    tierRequirements: {
      TIER_0_PROVISIONAL: {
        documents: ['NRIC', 'PASSPORT'],
      },
      TIER_1_BASIC: {
        documents: ['NRIC', 'PASSPORT', 'BANK_STATEMENT'],
        additionalRequirements: ['Singpass MyInfo', 'Video KYC'],
      },
      TIER_2_STANDARD: {
        documents: ['NRIC', 'PASSPORT', 'REGISTRATION_CERT', 'BANK_STATEMENT', 'UBO_DECLARATION'],
        additionalRequirements: ['ACRA Check', 'MAS Guidelines'],
      },
      TIER_3_ENHANCED: {
        documents: ['PASSPORT', 'TAX_RETURN', 'AUDITED_FINANCIALS', 'SOURCE_OF_WEALTH', 'REFERENCE_LETTER'],
        additionalRequirements: ['MAS Notice 626', 'Enhanced CDD'],
      },
      TIER_4_INSTITUTIONAL: {
        documents: ['REGISTRATION_CERT', 'BOARD_RESOLUTION', 'AUDITED_FINANCIALS', 'UBO_DECLARATION'],
        additionalRequirements: ['MAS License Verification'],
      },
    },
    transactionLimits: {
      TIER_0_PROVISIONAL: 5000,
      TIER_1_BASIC: 50000,
      TIER_2_STANDARD: 500000,
      TIER_3_ENHANCED: Infinity,
      TIER_4_INSTITUTIONAL: Infinity,
    },
    primaryRegulator: 'MAS',
    regulatoryFramework: 'MAS Guidelines, CDSA',
    sanctionsLists: ['OFAC', 'UN_CONSOLIDATED'],
    dataRetentionYears: 5,
    gdprApplicable: false,
  },
};

// EEA Countries for GDPR applicability
const EEA_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO',
];

// ═══════════════════════════════════════════════════════════════════════════════
// KYC ENGINE SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class KycEngineService {
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TIER DETERMINATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Determine required KYC tier based on roles and transaction volume
   */
  determineRequiredTier(
    roles: string[],
    projectedMonthlyVolume: number,
    countryCode: string
  ): KycTier {
    
    // Tier 4: Institutional participants
    const institutionalRoles = ['BANK_TRUSTEE'];
    if (roles.some(r => institutionalRoles.includes(r))) {
      return 'TIER_4_INSTITUTIONAL';
    }
    
    // Tier 3: High-value or cross-border
    const tier3Roles = ['MARKET_MAKER'];
    if (roles.some(r => tier3Roles.includes(r)) || projectedMonthlyVolume > 500000) {
      return 'TIER_3_ENHANCED';
    }
    
    // Tier 2: Business participants
    const tier2Roles = ['TGDP_JEWELER', 'SERVICE_PROVIDER', 'FTR_BUYER_OTHER'];
    if (roles.some(r => tier2Roles.includes(r)) || projectedMonthlyVolume > 50000) {
      return 'TIER_2_STANDARD';
    }
    
    // Tier 1: Standard households
    const tier1Roles = ['TGDP_MINTER', 'FTR_BUYER_HOUSEHOLD', 'DAC_PARTICIPANT', 'INVESTOR'];
    if (roles.some(r => tier1Roles.includes(r)) || projectedMonthlyVolume > 5000) {
      return 'TIER_1_BASIC';
    }
    
    // Tier 0: Provisional
    return 'TIER_0_PROVISIONAL';
  }
  
  /**
   * Get required documents for a specific tier and country
   */
  getRequiredDocuments(tier: KycTier, countryCode: string): KycDocumentType[] {
    const config = COUNTRY_KYC_CONFIGS[countryCode] || COUNTRY_KYC_CONFIGS['IN'];
    const tierConfig = config.tierRequirements[tier];
    return tierConfig?.documents.map(d => d as KycDocumentType) || [];
  }
  
  /**
   * Get transaction limit for tier
   */
  getTransactionLimit(tier: KycTier, countryCode: string): number {
    const config = COUNTRY_KYC_CONFIGS[countryCode] || COUNTRY_KYC_CONFIGS['IN'];
    return config.transactionLimits[tier];
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // DOCUMENT VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Verify uploaded document
   */
  async verifyDocument(
    participantId: string,
    documentType: KycDocumentType,
    documentData: {
      documentNumber?: string;
      frontImage?: string;
      backImage?: string;
      documentFile?: string;
      issueDate?: string;
      expiryDate?: string;
    }
  ): Promise<{
    isValid: boolean;
    ocrExtracted?: Record<string, any>;
    ocrConfidence?: number;
    errors?: string[];
  }> {
    
    const errors: string[] = [];
    
    // Document expiry check
    if (documentData.expiryDate) {
      const expiry = new Date(documentData.expiryDate);
      if (expiry < new Date()) {
        errors.push('Document has expired');
      }
    }
    
    // OCR extraction and verification
    let ocrExtracted: Record<string, any> | undefined;
    let ocrConfidence = 0;
    
    if (documentData.frontImage) {
      const ocrResult = await this.performOcr(documentData.frontImage, documentType);
      ocrExtracted = ocrResult.data;
      ocrConfidence = ocrResult.confidence;
      
      // Cross-verify extracted data
      if (documentData.documentNumber && ocrResult.data?.documentNumber) {
        if (documentData.documentNumber !== ocrResult.data.documentNumber) {
          errors.push(`Document number mismatch: entered "${documentData.documentNumber}" but OCR extracted "${ocrResult.data.documentNumber}"`);
        }
      }
    }
    
    // Document-specific validations
    switch (documentType) {
      case 'AADHAAR':
        if (documentData.documentNumber && !this.isValidAadhaar(documentData.documentNumber)) {
          errors.push('Invalid Aadhaar number format');
        }
        break;
      case 'PAN':
        if (documentData.documentNumber && !this.isValidPAN(documentData.documentNumber)) {
          errors.push('Invalid PAN format');
        }
        break;
      case 'PASSPORT':
        if (documentData.documentNumber && !this.isValidPassport(documentData.documentNumber)) {
          errors.push('Invalid passport number format');
        }
        break;
    }
    
    return {
      isValid: errors.length === 0,
      ocrExtracted,
      ocrConfidence,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
  
  private async performOcr(
    image: string,
    documentType: KycDocumentType
  ): Promise<{ data: Record<string, any>; confidence: number }> {
    // In production: Call OCR service (Google Vision, AWS Textract, etc.)
    return {
      data: {},
      confidence: 0.98,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // VIDEO KYC
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Initiate video KYC session
   */
  async initiateVideoKyc(
    participantId: string,
    countryCode: string
  ): Promise<{
    sessionId: string;
    sessionUrl: string;
    expiresAt: string;
  }> {
    
    const sessionId = `VK-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
    
    // In production: Create session with video KYC provider
    
    return {
      sessionId,
      sessionUrl: `https://kyc.trotdfx.com/video/${sessionId}`,
      expiresAt,
    };
  }
  
  /**
   * Process video KYC result
   */
  async processVideoKycResult(
    participantId: string,
    sessionId: string,
    result: {
      livenessScore: number;
      faceMatchScore: number;
      videoUrl?: string;
      agentNotes?: string;
    }
  ): Promise<KycVerificationResult> {
    
    const status = result.livenessScore >= 0.95 && result.faceMatchScore >= 0.90
      ? 'PASSED'
      : result.livenessScore >= 0.80 && result.faceMatchScore >= 0.75
        ? 'PENDING_REVIEW'
        : 'FAILED';
    
    const failureReasons: string[] = [];
    if (result.livenessScore < 0.80) {
      failureReasons.push(`Liveness check score too low: ${(result.livenessScore * 100).toFixed(1)}%`);
    }
    if (result.faceMatchScore < 0.75) {
      failureReasons.push(`Face match score too low: ${(result.faceMatchScore * 100).toFixed(1)}%`);
    }
    
    return {
      verificationId: sessionId,
      participantId,
      tier: 'TIER_1_BASIC',
      status,
      score: (result.livenessScore + result.faceMatchScore) / 2,
      confidence: Math.min(result.livenessScore, result.faceMatchScore),
      livenessScore: result.livenessScore,
      faceMatchScore: result.faceMatchScore,
      failureReasons: failureReasons.length > 0 ? failureReasons : undefined,
      slaDeadline: new Date(Date.now() + SLA_DURATIONS.KYC_VERIFICATION_SECONDS * 1000).toISOString(),
      completedAt: new Date().toISOString(),
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // SANCTIONS SCREENING
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Screen against sanctions lists
   */
  async screenSanctions(
    participantId: string,
    name: string,
    countryCode: string,
    additionalData?: {
      dateOfBirth?: string;
      nationality?: string;
      aliases?: string[];
    }
  ): Promise<SanctionsScreeningResult[]> {
    
    const config = COUNTRY_KYC_CONFIGS[countryCode] || COUNTRY_KYC_CONFIGS['IN'];
    const results: SanctionsScreeningResult[] = [];
    
    for (const listType of config.sanctionsLists) {
      const result = await this.screenAgainstList(
        participantId,
        name,
        listType as SanctionsListType,
        additionalData
      );
      results.push(result);
    }
    
    return results;
  }
  
  private async screenAgainstList(
    participantId: string,
    name: string,
    listType: SanctionsListType,
    additionalData?: {
      dateOfBirth?: string;
      nationality?: string;
      aliases?: string[];
    }
  ): Promise<SanctionsScreeningResult> {
    
    // In production: Call sanctions screening API (Dow Jones, Refinitiv, etc.)
    
    // Mock implementation - no match
    return {
      screeningId: `SCR-${Date.now()}-${listType}`,
      participantId,
      screeningType: listType,
      screenedName: name,
      isMatch: false,
    };
  }
  
  /**
   * Run daily re-screening for all active participants
   */
  async runDailyRescreening(): Promise<{
    totalScreened: number;
    matchesFound: number;
    matches: SanctionsScreeningResult[];
  }> {
    // In production: Batch process all active participants
    
    return {
      totalScreened: 0,
      matchesFound: 0,
      matches: [],
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // CREDIT SCORE
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Pull credit score from bureau
   */
  async pullCreditScore(
    participantId: string,
    countryCode: string,
    identifiers: {
      pan?: string;
      ssn?: string;
      nationalId?: string;
    }
  ): Promise<{
    score: number;
    bureau: string;
    pullDate: string;
    normalizedScore: number; // 0-1 scale
  }> {
    
    // Country-specific bureau mapping
    const bureauMap: Record<string, string> = {
      IN: 'CIBIL',
      US: 'TransUnion',
      GB: 'Experian UK',
      DE: 'SCHUFA',
      SG: 'DP Credit',
      AE: 'Al Etihad',
    };
    
    const bureau = bureauMap[countryCode] || 'Default Bureau';
    
    // In production: Call credit bureau API
    
    // Mock implementation
    const rawScore = 750; // Example CIBIL score
    
    // Normalize to 0-1 scale based on country
    const normalizedScore = this.normalizeCreditScore(rawScore, countryCode);
    
    return {
      score: rawScore,
      bureau,
      pullDate: new Date().toISOString(),
      normalizedScore,
    };
  }
  
  private normalizeCreditScore(rawScore: number, countryCode: string): number {
    // Normalization tables per country
    const ranges: Record<string, { min: number; max: number }> = {
      IN: { min: 300, max: 900 }, // CIBIL
      US: { min: 300, max: 850 }, // FICO
      GB: { min: 0, max: 999 }, // Experian UK
      DE: { min: 0, max: 100 }, // SCHUFA (inverted - lower is better)
    };
    
    const range = ranges[countryCode] || { min: 0, max: 1000 };
    
    if (countryCode === 'DE') {
      // SCHUFA is inverted
      return 1 - (rawScore - range.min) / (range.max - range.min);
    }
    
    return (rawScore - range.min) / (range.max - range.min);
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // COMPLETE KYC VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Run complete KYC verification for a tier
   */
  async runKycVerification(
    participantId: string,
    tier: KycTier,
    countryCode: string
  ): Promise<{
    overallStatus: KycStatus;
    documentVerifications: Array<{ type: KycDocumentType; status: string }>;
    sanctionsStatus: 'CLEAR' | 'MATCH' | 'PENDING';
    videoKycStatus?: 'PASSED' | 'FAILED' | 'PENDING';
    creditScoreStatus?: 'ACCEPTABLE' | 'LOW' | 'NOT_AVAILABLE';
    slaDeadline: string;
    canUpgrade: boolean;
  }> {
    
    const requiredDocs = this.getRequiredDocuments(tier, countryCode);
    
    // In production: Fetch actual verification results from database
    
    // Calculate SLA deadline (60 seconds for most verifications)
    const slaDeadline = new Date(Date.now() + SLA_DURATIONS.KYC_VERIFICATION_SECONDS * 1000).toISOString();
    
    return {
      overallStatus: 'APPROVED',
      documentVerifications: requiredDocs.map(type => ({
        type,
        status: 'VERIFIED',
      })),
      sanctionsStatus: 'CLEAR',
      videoKycStatus: tier !== 'TIER_0_PROVISIONAL' ? 'PASSED' : undefined,
      creditScoreStatus: tier === 'TIER_2_STANDARD' || tier === 'TIER_3_ENHANCED' ? 'ACCEPTABLE' : undefined,
      slaDeadline,
      canUpgrade: tier !== 'TIER_4_INSTITUTIONAL',
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // GDPR COMPLIANCE
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Check if GDPR applies to participant
   */
  isGdprApplicable(countryCode: string, residenceCountry?: string): boolean {
    return EEA_COUNTRIES.includes(countryCode) || 
           (residenceCountry ? EEA_COUNTRIES.includes(residenceCountry) : false);
  }
  
  /**
   * Get GDPR consent requirements
   */
  getGdprConsentRequirements(): Array<{
    consentType: string;
    lawfulBasis: string;
    isMandatory: boolean;
    description: string;
  }> {
    return [
      {
        consentType: 'identityVerification',
        lawfulBasis: 'CONTRACT',
        isMandatory: true,
        description: 'Verification of your identity to provide our services',
      },
      {
        consentType: 'sanctionsScreening',
        lawfulBasis: 'LEGAL_OBLIGATION',
        isMandatory: true,
        description: 'Screening against sanctions lists as required by AML regulations',
      },
      {
        consentType: 'transactionMonitoring',
        lawfulBasis: 'LEGAL_OBLIGATION',
        isMandatory: true,
        description: 'Monitoring of transactions for compliance with AML regulations',
      },
      {
        consentType: 'dataSharing',
        lawfulBasis: 'LEGITIMATE_INTEREST',
        isMandatory: false,
        description: 'Sharing data with Domain Consultants and Ombudsman for dispute resolution',
      },
      {
        consentType: 'crossBorderTransfers',
        lawfulBasis: 'CONTRACT',
        isMandatory: true,
        description: 'Transfer of data to non-EEA countries under Standard Contractual Clauses',
      },
      {
        consentType: 'marketingCommunications',
        lawfulBasis: 'CONSENT',
        isMandatory: false,
        description: 'Receiving marketing communications about our products and services',
      },
    ];
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // VALIDATION HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  
  private isValidAadhaar(aadhaar: string): boolean {
    // Aadhaar: 12 digits, Verhoeff checksum
    if (!/^\d{12}$/.test(aadhaar)) return false;
    
    // Verhoeff algorithm validation
    const d = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
      [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
      [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
      [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
      [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
      [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
      [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
      [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
      [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    ];
    const p = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
      [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
      [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
      [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
      [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
      [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
      [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
    ];
    
    let c = 0;
    const arr = aadhaar.split('').reverse().map(Number);
    for (let i = 0; i < arr.length; i++) {
      c = d[c][p[i % 8][arr[i]]];
    }
    return c === 0;
  }
  
  private isValidPAN(pan: string): boolean {
    // PAN: AAAAA0000A format
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
  }
  
  private isValidPassport(passport: string): boolean {
    // Generic passport validation (varies by country)
    return /^[A-Z0-9]{6,12}$/.test(passport);
  }
}

// Export singleton instance
export const kycEngineService = new KycEngineService();
