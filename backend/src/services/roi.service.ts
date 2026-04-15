/**
 * IRG_FTR PLATFORM - ROI Configuration Service
 * P1 AUDIT FIX: Dynamic ROI per country implementation
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface RoiConfig {
  countryCode: string;
  roiPercent: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  updatedBy: string;
  updatedAt: Date;
}

interface RoiCacheEntry {
  config: RoiConfig;
  cachedAt: Date;
  expiresAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

// P1 FIX: Default ROI is no longer hardcoded everywhere
// It's now configurable per country with a fallback default
const DEFAULT_ROI_PERCENT = 9.2;
const ROI_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

// P1 FIX: Country-specific ROI defaults
// In production, these would be stored in database
const COUNTRY_ROI_DEFAULTS: Record<string, number> = {
  IN: 9.2,   // India
  US: 6.5,   // United States
  GB: 7.0,   // United Kingdom
  AE: 8.0,   // UAE
  SG: 5.5,   // Singapore
  AU: 6.0,   // Australia
  CA: 6.0,   // Canada
  DE: 4.5,   // Germany
  FR: 4.5,   // France
  JP: 3.0,   // Japan
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROI SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class RoiService {
  private cache: Map<string, RoiCacheEntry> = new Map();
  private dbConfigs: Map<string, RoiConfig> = new Map();

  constructor() {
    // Initialize with defaults (in production, load from database)
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    Object.entries(COUNTRY_ROI_DEFAULTS).forEach(([countryCode, roiPercent]) => {
      this.dbConfigs.set(countryCode, {
        countryCode,
        roiPercent,
        effectiveFrom: new Date('2026-01-01'),
        updatedBy: 'system',
        updatedAt: new Date(),
      });
    });
  }

  /**
   * P1 FIX: Get ROI for a specific country
   * This replaces all hardcoded 9.2% references
   */
  async getRoiForCountry(countryCode: string): Promise<number> {
    // Check cache first
    const cached = this.cache.get(countryCode);
    if (cached && cached.expiresAt > new Date()) {
      return cached.config.roiPercent;
    }

    // Fetch from "database" (in-memory for now)
    const config = this.dbConfigs.get(countryCode);
    
    if (config) {
      // Update cache
      this.cache.set(countryCode, {
        config,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + ROI_CACHE_TTL_MS),
      });
      return config.roiPercent;
    }

    // Return default if country not configured
    return DEFAULT_ROI_PERCENT;
  }

  /**
   * P1 FIX: Update ROI for a country
   */
  async updateRoiForCountry(
    countryCode: string,
    roiPercent: number,
    updatedBy: string,
    effectiveFrom?: Date
  ): Promise<RoiConfig> {
    const config: RoiConfig = {
      countryCode,
      roiPercent,
      effectiveFrom: effectiveFrom || new Date(),
      updatedBy,
      updatedAt: new Date(),
    };

    // Save to "database"
    this.dbConfigs.set(countryCode, config);

    // Invalidate cache
    this.cache.delete(countryCode);

    // In production, also invalidate Redis cache
    console.log(`[ROI Service] Updated ROI for ${countryCode} to ${roiPercent}%`);

    return config;
  }

  /**
   * Get all ROI configurations
   */
  async getAllRoiConfigs(): Promise<RoiConfig[]> {
    return Array.from(this.dbConfigs.values());
  }

  /**
   * P1 FIX: Calculate standardization index with dynamic ROI
   */
  async calculateStandardizationIndex(
    capacity: number,
    utilization: number,
    countryCode: string
  ): Promise<number> {
    // Get dynamic ROI for the country instead of hardcoded value
    const roi = await this.getRoiForCountry(countryCode);
    
    // Formula: (Capacity * Utilization * ROI) / 100
    const index = (capacity * utilization * roi) / 100;
    
    return Math.round(index * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Invalidate cache for a country (call after database update)
   */
  invalidateCache(countryCode?: string): void {
    if (countryCode) {
      this.cache.delete(countryCode);
    } else {
      this.cache.clear();
    }
    console.log(`[ROI Service] Cache invalidated for: ${countryCode || 'all countries'}`);
  }
}

// Singleton instance
export const roiService = new RoiService();
export default roiService;
