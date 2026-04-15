/**
 * IRG_FTR PLATFORM - ROI Module Service
 * Enhanced ROI Configuration with Consultant Justification
 * 
 * Features:
 * - Dynamic ROI per country
 * - Consultant override with mandatory justification
 * - ROI change history with audit trail
 * - Integration with minting approval workflow
 * - Cache management with Redis support
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RoiConfig {
  id: string;
  countryCode: string;
  countryName: string;
  baseRoiPercent: number;
  minRoiPercent: number;
  maxRoiPercent: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  regulatoryFramework?: string;
  updatedBy: string;
  updatedAt: Date;
  isActive: boolean;
}

export interface ProjectRoiOverride {
  id: string;
  projectId: string;
  minterId: string;
  minterCountry: string;
  baseRoi: number;
  approvedRoi: number;
  roiDelta: number;
  consultantId: string;
  consultantName: string;
  justificationCategory: RoiJustificationCategory;
  justificationText: string;
  supportingEvidence?: string[];
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type RoiJustificationCategory =
  | 'MARKET_CONDITIONS'
  | 'ASSET_QUALITY'
  | 'RISK_ASSESSMENT'
  | 'REGULATORY_REQUIREMENT'
  | 'COMPETITIVE_ANALYSIS'
  | 'HISTORICAL_PERFORMANCE'
  | 'SECTOR_SPECIFIC'
  | 'GEOGRAPHIC_FACTOR'
  | 'OTHER';

export interface RoiChangeHistory {
  id: string;
  entityType: 'COUNTRY' | 'PROJECT';
  entityId: string;
  previousRoi: number;
  newRoi: number;
  changeType: 'ADMIN_UPDATE' | 'CONSULTANT_OVERRIDE' | 'SYSTEM_ADJUSTMENT';
  changedBy: string;
  changedByRole: string;
  justification?: string;
  ipAddress?: string;
  timestamp: Date;
}

export interface RoiValidationResult {
  isValid: boolean;
  baseRoi: number;
  requestedRoi: number;
  minAllowed: number;
  maxAllowed: number;
  requiresJustification: boolean;
  errors: string[];
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ROI_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ROI_CHANGE_THRESHOLD_PERCENT = 1.0; // Changes > 1% require justification

// Country-specific ROI configurations
const COUNTRY_ROI_CONFIGS: Record<string, Omit<RoiConfig, 'id' | 'updatedBy' | 'updatedAt' | 'isActive'>> = {
  IN: {
    countryCode: 'IN',
    countryName: 'India',
    baseRoiPercent: 9.2,
    minRoiPercent: 6.0,
    maxRoiPercent: 15.0,
    effectiveFrom: new Date('2026-01-01'),
    regulatoryFramework: 'RBI Guidelines, SEBI Framework',
  },
  US: {
    countryCode: 'US',
    countryName: 'United States',
    baseRoiPercent: 6.5,
    minRoiPercent: 4.0,
    maxRoiPercent: 12.0,
    effectiveFrom: new Date('2026-01-01'),
    regulatoryFramework: 'SEC Guidelines, FinCEN',
  },
  GB: {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    baseRoiPercent: 7.0,
    minRoiPercent: 4.5,
    maxRoiPercent: 12.0,
    effectiveFrom: new Date('2026-01-01'),
    regulatoryFramework: 'FCA Guidelines',
  },
  AE: {
    countryCode: 'AE',
    countryName: 'United Arab Emirates',
    baseRoiPercent: 8.0,
    minRoiPercent: 5.0,
    maxRoiPercent: 14.0,
    effectiveFrom: new Date('2026-01-01'),
    regulatoryFramework: 'SCA Guidelines, ADGM',
  },
  SG: {
    countryCode: 'SG',
    countryName: 'Singapore',
    baseRoiPercent: 5.5,
    minRoiPercent: 3.5,
    maxRoiPercent: 10.0,
    effectiveFrom: new Date('2026-01-01'),
    regulatoryFramework: 'MAS Guidelines',
  },
  AU: {
    countryCode: 'AU',
    countryName: 'Australia',
    baseRoiPercent: 6.0,
    minRoiPercent: 4.0,
    maxRoiPercent: 11.0,
    effectiveFrom: new Date('2026-01-01'),
    regulatoryFramework: 'ASIC Guidelines',
  },
  CA: {
    countryCode: 'CA',
    countryName: 'Canada',
    baseRoiPercent: 6.0,
    minRoiPercent: 4.0,
    maxRoiPercent: 11.0,
    effectiveFrom: new Date('2026-01-01'),
    regulatoryFramework: 'OSC, CSA Guidelines',
  },
  DE: {
    countryCode: 'DE',
    countryName: 'Germany',
    baseRoiPercent: 4.5,
    minRoiPercent: 2.5,
    maxRoiPercent: 9.0,
    effectiveFrom: new Date('2026-01-01'),
    regulatoryFramework: 'BaFin, AMLD6',
  },
  FR: {
    countryCode: 'FR',
    countryName: 'France',
    baseRoiPercent: 4.5,
    minRoiPercent: 2.5,
    maxRoiPercent: 9.0,
    effectiveFrom: new Date('2026-01-01'),
    regulatoryFramework: 'AMF Guidelines, ACPR',
  },
  JP: {
    countryCode: 'JP',
    countryName: 'Japan',
    baseRoiPercent: 3.0,
    minRoiPercent: 1.5,
    maxRoiPercent: 7.0,
    effectiveFrom: new Date('2026-01-01'),
    regulatoryFramework: 'FSA Japan Guidelines',
  },
  HK: {
    countryCode: 'HK',
    countryName: 'Hong Kong',
    baseRoiPercent: 5.0,
    minRoiPercent: 3.0,
    maxRoiPercent: 10.0,
    effectiveFrom: new Date('2026-01-01'),
    regulatoryFramework: 'SFC, HKMA Guidelines',
  },
  CH: {
    countryCode: 'CH',
    countryName: 'Switzerland',
    baseRoiPercent: 4.0,
    minRoiPercent: 2.0,
    maxRoiPercent: 8.0,
    effectiveFrom: new Date('2026-01-01'),
    regulatoryFramework: 'FINMA Guidelines',
  },
};

const JUSTIFICATION_CATEGORIES: { value: RoiJustificationCategory; label: string; description: string }[] = [
  { value: 'MARKET_CONDITIONS', label: 'Market Conditions', description: 'Current market trends, demand-supply dynamics' },
  { value: 'ASSET_QUALITY', label: 'Asset Quality', description: 'Quality of underlying assets, collateral strength' },
  { value: 'RISK_ASSESSMENT', label: 'Risk Assessment', description: 'Credit risk, operational risk evaluation' },
  { value: 'REGULATORY_REQUIREMENT', label: 'Regulatory Requirement', description: 'Compliance with specific regulations' },
  { value: 'COMPETITIVE_ANALYSIS', label: 'Competitive Analysis', description: 'Comparison with similar offerings' },
  { value: 'HISTORICAL_PERFORMANCE', label: 'Historical Performance', description: 'Track record of minter/sector' },
  { value: 'SECTOR_SPECIFIC', label: 'Sector Specific', description: 'Industry-specific factors' },
  { value: 'GEOGRAPHIC_FACTOR', label: 'Geographic Factor', description: 'Location-based considerations' },
  { value: 'OTHER', label: 'Other', description: 'Other justified reasons' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY STORES (Use Database in production)
// ═══════════════════════════════════════════════════════════════════════════════

interface RoiCacheEntry {
  config: RoiConfig;
  cachedAt: Date;
  expiresAt: Date;
}

const roiConfigStore = new Map<string, RoiConfig>();
const roiOverrideStore = new Map<string, ProjectRoiOverride>();
const roiHistoryStore: RoiChangeHistory[] = [];
const roiCache = new Map<string, RoiCacheEntry>();

// Initialize with default configurations
Object.entries(COUNTRY_ROI_CONFIGS).forEach(([code, config]) => {
  roiConfigStore.set(code, {
    ...config,
    id: `roi_${code.toLowerCase()}`,
    updatedBy: 'SYSTEM',
    updatedAt: new Date(),
    isActive: true,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROI MODULE SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class RoiModuleService {
  
  // ─────────────────────────────────────────────────────────────────────────────
  // ROI CONFIGURATION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Get ROI configuration for a country
   */
  async getRoiConfig(countryCode: string): Promise<RoiConfig | null> {
    // Check cache first
    const cached = roiCache.get(countryCode);
    if (cached && cached.expiresAt > new Date()) {
      return cached.config;
    }
    
    // Fetch from store
    const config = roiConfigStore.get(countryCode.toUpperCase());
    
    if (config) {
      // Update cache
      roiCache.set(countryCode, {
        config,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + ROI_CACHE_TTL_MS),
      });
    }
    
    return config || null;
  }
  
  /**
   * Get base ROI for a country
   */
  async getBaseRoi(countryCode: string): Promise<number> {
    const config = await this.getRoiConfig(countryCode);
    return config?.baseRoiPercent ?? 9.2; // Default fallback
  }
  
  /**
   * Get all ROI configurations
   */
  async getAllRoiConfigs(): Promise<RoiConfig[]> {
    return Array.from(roiConfigStore.values()).filter(c => c.isActive);
  }
  
  /**
   * Update ROI configuration for a country (Admin only)
   */
  async updateRoiConfig(
    countryCode: string,
    updates: Partial<Pick<RoiConfig, 'baseRoiPercent' | 'minRoiPercent' | 'maxRoiPercent'>>,
    updatedBy: string,
    ipAddress?: string
  ): Promise<RoiConfig> {
    const existing = roiConfigStore.get(countryCode.toUpperCase());
    
    if (!existing) {
      throw new Error(`ROI configuration not found for country: ${countryCode}`);
    }
    
    const previousRoi = existing.baseRoiPercent;
    
    const updated: RoiConfig = {
      ...existing,
      ...updates,
      updatedBy,
      updatedAt: new Date(),
    };
    
    // Validate
    if (updated.minRoiPercent >= updated.maxRoiPercent) {
      throw new Error('Minimum ROI must be less than maximum ROI');
    }
    
    if (updated.baseRoiPercent < updated.minRoiPercent || updated.baseRoiPercent > updated.maxRoiPercent) {
      throw new Error('Base ROI must be within min-max range');
    }
    
    // Save
    roiConfigStore.set(countryCode.toUpperCase(), updated);
    
    // Invalidate cache
    roiCache.delete(countryCode.toUpperCase());
    
    // Record history
    if (updates.baseRoiPercent && updates.baseRoiPercent !== previousRoi) {
      this.recordHistory({
        entityType: 'COUNTRY',
        entityId: countryCode.toUpperCase(),
        previousRoi,
        newRoi: updates.baseRoiPercent,
        changeType: 'ADMIN_UPDATE',
        changedBy: updatedBy,
        changedByRole: 'ADMIN',
        ipAddress,
      });
    }
    
    console.log(`[ROI_MODULE] Updated ROI config for ${countryCode}: ${previousRoi}% → ${updated.baseRoiPercent}%`);
    
    return updated;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PROJECT ROI OVERRIDE (Consultant Justification)
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Validate ROI change for a project
   */
  async validateRoiChange(
    minterCountry: string,
    requestedRoi: number
  ): Promise<RoiValidationResult> {
    const config = await this.getRoiConfig(minterCountry);
    
    if (!config) {
      return {
        isValid: false,
        baseRoi: 9.2,
        requestedRoi,
        minAllowed: 0,
        maxAllowed: 100,
        requiresJustification: true,
        errors: [`No ROI configuration found for country: ${minterCountry}`],
        warnings: [],
      };
    }
    
    const errors: string[] = [];
    const warnings: string[] = [];
    const delta = Math.abs(requestedRoi - config.baseRoiPercent);
    const requiresJustification = delta >= ROI_CHANGE_THRESHOLD_PERCENT;
    
    // Validate against min/max
    if (requestedRoi < config.minRoiPercent) {
      errors.push(`ROI ${requestedRoi}% is below minimum allowed (${config.minRoiPercent}%)`);
    }
    
    if (requestedRoi > config.maxRoiPercent) {
      errors.push(`ROI ${requestedRoi}% exceeds maximum allowed (${config.maxRoiPercent}%)`);
    }
    
    // Warnings
    if (delta >= 2.0) {
      warnings.push(`Significant deviation (${delta.toFixed(1)}%) from base ROI - detailed justification required`);
    }
    
    if (requestedRoi > config.baseRoiPercent * 1.5) {
      warnings.push('ROI is 50%+ higher than base - may require additional approval');
    }
    
    return {
      isValid: errors.length === 0,
      baseRoi: config.baseRoiPercent,
      requestedRoi,
      minAllowed: config.minRoiPercent,
      maxAllowed: config.maxRoiPercent,
      requiresJustification,
      errors,
      warnings,
    };
  }
  
  /**
   * Create ROI override request (Consultant submits justification)
   */
  async createRoiOverride(
    projectId: string,
    minterId: string,
    minterCountry: string,
    requestedRoi: number,
    consultantId: string,
    consultantName: string,
    justificationCategory: RoiJustificationCategory,
    justificationText: string,
    supportingEvidence?: string[]
  ): Promise<ProjectRoiOverride> {
    // Validate the ROI change
    const validation = await this.validateRoiChange(minterCountry, requestedRoi);
    
    if (!validation.isValid) {
      throw new Error(`Invalid ROI request: ${validation.errors.join(', ')}`);
    }
    
    // Check if justification is required
    if (validation.requiresJustification && (!justificationText || justificationText.length < 50)) {
      throw new Error('Detailed justification (minimum 50 characters) is required for this ROI change');
    }
    
    const override: ProjectRoiOverride = {
      id: `roi_override_${Date.now()}`,
      projectId,
      minterId,
      minterCountry,
      baseRoi: validation.baseRoi,
      approvedRoi: requestedRoi,
      roiDelta: requestedRoi - validation.baseRoi,
      consultantId,
      consultantName,
      justificationCategory,
      justificationText,
      supportingEvidence,
      approvalStatus: Math.abs(validation.baseRoi - requestedRoi) < 2.0 ? 'APPROVED' : 'PENDING',
      approvedAt: Math.abs(validation.baseRoi - requestedRoi) < 2.0 ? new Date() : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Save
    roiOverrideStore.set(override.id, override);
    
    // Record history
    this.recordHistory({
      entityType: 'PROJECT',
      entityId: projectId,
      previousRoi: validation.baseRoi,
      newRoi: requestedRoi,
      changeType: 'CONSULTANT_OVERRIDE',
      changedBy: consultantId,
      changedByRole: 'CONSULTANT',
      justification: justificationText,
    });
    
    console.log(`[ROI_MODULE] ROI override created for project ${projectId}: ${validation.baseRoi}% → ${requestedRoi}%`);
    
    return override;
  }
  
  /**
   * Approve/Reject ROI override (Admin/Senior Consultant)
   */
  async processRoiOverride(
    overrideId: string,
    action: 'APPROVE' | 'REJECT',
    processedBy: string,
    rejectionReason?: string
  ): Promise<ProjectRoiOverride> {
    const override = roiOverrideStore.get(overrideId);
    
    if (!override) {
      throw new Error(`ROI override not found: ${overrideId}`);
    }
    
    if (override.approvalStatus !== 'PENDING') {
      throw new Error(`ROI override already processed: ${override.approvalStatus}`);
    }
    
    override.approvalStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    override.approvedBy = processedBy;
    override.approvedAt = new Date();
    override.updatedAt = new Date();
    
    if (action === 'REJECT') {
      if (!rejectionReason) {
        throw new Error('Rejection reason is required');
      }
      override.rejectionReason = rejectionReason;
    }
    
    roiOverrideStore.set(overrideId, override);
    
    console.log(`[ROI_MODULE] ROI override ${overrideId} ${action.toLowerCase()}ed by ${processedBy}`);
    
    return override;
  }
  
  /**
   * Get ROI override for a project
   */
  async getProjectRoiOverride(projectId: string): Promise<ProjectRoiOverride | null> {
    for (const override of roiOverrideStore.values()) {
      if (override.projectId === projectId && override.approvalStatus === 'APPROVED') {
        return override;
      }
    }
    return null;
  }
  
  /**
   * Get effective ROI for a project (base or overridden)
   */
  async getEffectiveProjectRoi(projectId: string, minterCountry: string): Promise<{
    roi: number;
    source: 'BASE' | 'OVERRIDE';
    override?: ProjectRoiOverride;
  }> {
    // Check for approved override
    const override = await this.getProjectRoiOverride(projectId);
    
    if (override) {
      return {
        roi: override.approvedRoi,
        source: 'OVERRIDE',
        override,
      };
    }
    
    // Return base ROI
    const baseRoi = await this.getBaseRoi(minterCountry);
    return {
      roi: baseRoi,
      source: 'BASE',
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // HISTORY & AUDIT
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Record ROI change in history
   */
  private recordHistory(entry: Omit<RoiChangeHistory, 'id' | 'timestamp'>): void {
    const historyEntry: RoiChangeHistory = {
      ...entry,
      id: `roi_hist_${Date.now()}`,
      timestamp: new Date(),
    };
    
    roiHistoryStore.push(historyEntry);
  }
  
  /**
   * Get ROI change history
   */
  async getRoiHistory(filters?: {
    entityType?: 'COUNTRY' | 'PROJECT';
    entityId?: string;
    changedBy?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<RoiChangeHistory[]> {
    let history = [...roiHistoryStore];
    
    if (filters?.entityType) {
      history = history.filter(h => h.entityType === filters.entityType);
    }
    
    if (filters?.entityId) {
      history = history.filter(h => h.entityId === filters.entityId);
    }
    
    if (filters?.changedBy) {
      history = history.filter(h => h.changedBy === filters.changedBy);
    }
    
    if (filters?.fromDate) {
      history = history.filter(h => h.timestamp >= filters.fromDate!);
    }
    
    if (filters?.toDate) {
      history = history.filter(h => h.timestamp <= filters.toDate!);
    }
    
    return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Get justification categories
   */
  getJustificationCategories(): typeof JUSTIFICATION_CATEGORIES {
    return JUSTIFICATION_CATEGORIES;
  }
  
  /**
   * Calculate standardization index with dynamic ROI
   */
  async calculateStandardizationIndex(
    capacity: number,
    utilization: number,
    countryCode: string
  ): Promise<number> {
    const roi = await this.getBaseRoi(countryCode);
    const index = (capacity * utilization * roi) / 100;
    return Math.round(index * 100) / 100;
  }
  
  /**
   * Invalidate cache
   */
  invalidateCache(countryCode?: string): void {
    if (countryCode) {
      roiCache.delete(countryCode.toUpperCase());
    } else {
      roiCache.clear();
    }
    console.log(`[ROI_MODULE] Cache invalidated for: ${countryCode || 'all countries'}`);
  }
}

// Singleton export
export const roiModuleService = new RoiModuleService();
export default roiModuleService;
