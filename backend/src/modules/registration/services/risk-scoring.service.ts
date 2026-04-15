/**
 * IRG_FTR PLATFORM - Risk Scoring Service
 * TROT REGISTRATION PROTOCOL COMPLIANT
 * 
 * Composite Risk Score (CRS) calculation with AI + Domain Consultant dual control
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import {
  RiskRating,
  CompositeRiskScore,
  RiskScoreComponents,
  RiskScoreMultipliers,
  RISK_SCORE_WEIGHTS,
  RISK_SCORE_THRESHOLDS,
} from '@ftr-platform/shared/registration/types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface RiskScoreInput {
  participantId: string;
  countryCode: string;
  
  // Credit Bureau
  creditBureauScore?: number; // Normalized 0-1
  creditBureauSource?: string;
  
  // Behavioural (from internal data)
  mintingSuccessRate?: number;
  deliveryFulfillmentRate?: number;
  settlementTimeliness?: number;
  defaultEvents?: Array<{
    type: string;
    severity: number;
    date: string;
  }>;
  
  // Adverse Media
  adverseMediaHits?: Array<{
    source: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    date: string;
    category: string;
  }>;
  
  // Source of Wealth/Funds
  sowVerified?: boolean;
  sofVerified?: boolean;
  sowSofAnomalies?: string[];
  
  // Cross-Border
  jurisdictionCount?: number;
  foreignRemittanceVolume?: number;
  highRiskJurisdictionExposure?: number;
  
  // PEP
  isPep?: boolean;
  pepFamilyMembers?: number;
  pepAssociates?: number;
}

interface ConsultantReview {
  consultantId: string;
  decision: 'APPROVE' | 'REJECT';
  notes: string;
  reviewedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIGH-RISK JURISDICTIONS (FATF Grey/Black List)
// ═══════════════════════════════════════════════════════════════════════════════

const HIGH_RISK_JURISDICTIONS = [
  'KP', // North Korea
  'IR', // Iran
  'MM', // Myanmar
  'SY', // Syria
  'YE', // Yemen
  'AF', // Afghanistan
];

const INCREASED_MONITORING_JURISDICTIONS = [
  'PK', 'NG', 'TZ', 'UG', 'JM', 'HT', 'PH', 'VN', 'BD',
];

// ═══════════════════════════════════════════════════════════════════════════════
// RISK SCORING SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class RiskScoringService {
  
  private readonly MODEL_VERSION = 'CRS-v1.3-2026';
  
  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN CRS CALCULATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Calculate Composite Risk Score (CRS)
   * 
   * CRS = 0.40 × CreditBureauScore
   *     + 0.25 × BehaviouralHistoryScore
   *     + 0.15 × AdverseMediaScore
   *     + 0.10 × SoW_SoF_IntegrityScore
   *     + 0.05 × CrossBorderExposureScore
   *     + 0.05 × PEP_FamilyRiskScore
   *     + Dynamic Adjustments
   */
  async calculateCRS(
    input: RiskScoreInput,
    assessmentType: 'INITIAL' | 'DAILY' | 'EVENT_DRIVEN' = 'INITIAL',
    triggerEvent?: string
  ): Promise<CompositeRiskScore> {
    
    // Calculate individual components
    const components: RiskScoreComponents = {
      creditBureauScore: this.calculateCreditBureauScore(input),
      behaviouralScore: this.calculateBehaviouralScore(input),
      adverseMediaScore: this.calculateAdverseMediaScore(input),
      sowSofScore: this.calculateSowSofScore(input),
      crossBorderScore: this.calculateCrossBorderScore(input),
      pepFamilyScore: this.calculatePepFamilyScore(input),
    };
    
    // Calculate weighted base score
    let baseScore = 
      components.creditBureauScore * RISK_SCORE_WEIGHTS.CREDIT_BUREAU +
      components.behaviouralScore * RISK_SCORE_WEIGHTS.BEHAVIOURAL +
      components.adverseMediaScore * RISK_SCORE_WEIGHTS.ADVERSE_MEDIA +
      components.sowSofScore * RISK_SCORE_WEIGHTS.SOW_SOF +
      components.crossBorderScore * RISK_SCORE_WEIGHTS.CROSS_BORDER +
      components.pepFamilyScore * RISK_SCORE_WEIGHTS.PEP_FAMILY;
    
    // Calculate dynamic multipliers
    const multipliers: RiskScoreMultipliers = {
      defaultCascade: this.calculateDefaultCascadeMultiplier(input),
      deliveryPerformance: this.calculateDeliveryPerformanceMultiplier(input),
      jurisdiction: this.calculateJurisdictionMultiplier(input.countryCode),
    };
    
    // Apply multipliers (multiplicative, not additive)
    let finalScore = baseScore;
    if (multipliers.defaultCascade && multipliers.defaultCascade > 1) {
      finalScore = finalScore / multipliers.defaultCascade; // Penalty reduces score
    }
    if (multipliers.deliveryPerformance && multipliers.deliveryPerformance !== 1) {
      finalScore = finalScore * multipliers.deliveryPerformance;
    }
    if (multipliers.jurisdiction && multipliers.jurisdiction > 1) {
      finalScore = finalScore / multipliers.jurisdiction; // Penalty reduces score
    }
    
    // Clamp to 0-1 range
    finalScore = Math.max(0, Math.min(1, finalScore));
    
    // Determine rating
    const rating = this.determineRating(finalScore);
    
    // AI decision
    const aiDecision = this.makeAiDecision(finalScore, rating);
    
    // Generate explanation
    const explanationText = this.generateExplanation(components, multipliers, finalScore, rating);
    
    // Factor contributions for transparency
    const factorContributions = this.calculateFactorContributions(components, multipliers);
    
    return {
      participantId: input.participantId,
      assessmentType,
      triggerEvent,
      components,
      multipliers,
      rawScore: baseScore,
      finalScore: parseFloat(finalScore.toFixed(3)),
      rating,
      modelVersion: this.MODEL_VERSION,
      explanationText,
      factorContributions,
      assessedAt: new Date().toISOString(),
      aiDecision,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // COMPONENT CALCULATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Credit Bureau Score (40% weight)
   * Higher is better (0 = no credit, 1 = excellent credit)
   */
  private calculateCreditBureauScore(input: RiskScoreInput): number {
    if (input.creditBureauScore === undefined) {
      // No credit data - use proxy model or neutral score
      return 0.5;
    }
    
    // Score is already normalized 0-1
    return input.creditBureauScore;
  }
  
  /**
   * Behavioural History Score (25% weight)
   * Based on internal ecosystem data
   */
  private calculateBehaviouralScore(input: RiskScoreInput): number {
    let score = 0.8; // Start with good baseline for new participants
    
    // Minting success rate
    if (input.mintingSuccessRate !== undefined) {
      score = score * 0.3 + input.mintingSuccessRate * 0.7;
    }
    
    // Delivery fulfillment
    if (input.deliveryFulfillmentRate !== undefined) {
      score = score * 0.4 + input.deliveryFulfillmentRate * 0.6;
    }
    
    // Settlement timeliness
    if (input.settlementTimeliness !== undefined) {
      score = score * 0.5 + input.settlementTimeliness * 0.5;
    }
    
    // Default events (significant penalty)
    if (input.defaultEvents && input.defaultEvents.length > 0) {
      const recentDefaults = input.defaultEvents.filter(d => {
        const eventDate = new Date(d.date);
        const monthsAgo = (Date.now() - eventDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        return monthsAgo < 24; // Last 24 months
      });
      
      for (const def of recentDefaults) {
        const severityPenalty = def.severity === 2 ? 0.15 : def.severity === 1.5 ? 0.10 : 0.05;
        score = Math.max(0, score - severityPenalty);
      }
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Adverse Media Score (15% weight)
   * Higher = less adverse media = better
   */
  private calculateAdverseMediaScore(input: RiskScoreInput): number {
    if (!input.adverseMediaHits || input.adverseMediaHits.length === 0) {
      return 1.0; // No adverse media = perfect score
    }
    
    let score = 1.0;
    
    for (const hit of input.adverseMediaHits) {
      // Recency factor (last 12 months = 3x weight)
      const hitDate = new Date(hit.date);
      const monthsAgo = (Date.now() - hitDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      const recencyMultiplier = monthsAgo < 12 ? 3 : monthsAgo < 36 ? 2 : 1;
      
      // Severity penalty
      const severityPenalty = hit.severity === 'HIGH' ? 0.20 : hit.severity === 'MEDIUM' ? 0.10 : 0.05;
      
      score = Math.max(0, score - (severityPenalty * recencyMultiplier));
    }
    
    return Math.max(0, score);
  }
  
  /**
   * Source of Wealth / Source of Funds Score (10% weight)
   */
  private calculateSowSofScore(input: RiskScoreInput): number {
    let score = 0.7; // Neutral baseline
    
    if (input.sowVerified) {
      score += 0.15;
    }
    
    if (input.sofVerified) {
      score += 0.15;
    }
    
    // Anomalies detected
    if (input.sowSofAnomalies && input.sowSofAnomalies.length > 0) {
      score -= input.sowSofAnomalies.length * 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Cross-Border Exposure Score (5% weight)
   */
  private calculateCrossBorderScore(input: RiskScoreInput): number {
    let score = 1.0; // Start perfect
    
    // Multiple jurisdictions
    if (input.jurisdictionCount && input.jurisdictionCount > 2) {
      score -= (input.jurisdictionCount - 2) * 0.05;
    }
    
    // High-risk jurisdiction exposure
    if (input.highRiskJurisdictionExposure && input.highRiskJurisdictionExposure > 0) {
      score -= Math.min(0.3, input.highRiskJurisdictionExposure * 0.1);
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * PEP Family Risk Score (5% weight)
   */
  private calculatePepFamilyScore(input: RiskScoreInput): number {
    let score = 1.0;
    
    if (input.isPep) {
      score -= 0.30; // Significant penalty for being a PEP
    }
    
    if (input.pepFamilyMembers && input.pepFamilyMembers > 0) {
      score -= Math.min(0.20, input.pepFamilyMembers * 0.05);
    }
    
    if (input.pepAssociates && input.pepAssociates > 0) {
      score -= Math.min(0.15, input.pepAssociates * 0.03);
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // MULTIPLIER CALCULATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  
  private calculateDefaultCascadeMultiplier(input: RiskScoreInput): number {
    if (!input.defaultEvents || input.defaultEvents.length === 0) {
      return 1.0;
    }
    
    const recentDefaults = input.defaultEvents.filter(d => {
      const eventDate = new Date(d.date);
      const monthsAgo = (Date.now() - eventDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsAgo < 24;
    });
    
    if (recentDefaults.length > 0) {
      return 1.3; // 30% penalty multiplier
    }
    
    return 1.0;
  }
  
  private calculateDeliveryPerformanceMultiplier(input: RiskScoreInput): number {
    if (input.deliveryFulfillmentRate === undefined) {
      return 1.0;
    }
    
    // Excellent delivery = bonus, poor delivery = penalty
    if (input.deliveryFulfillmentRate >= 0.95) {
      return 1.1; // 10% bonus
    } else if (input.deliveryFulfillmentRate < 0.7) {
      return 0.8; // 20% penalty
    }
    
    return 1.0;
  }
  
  private calculateJurisdictionMultiplier(countryCode: string): number {
    if (HIGH_RISK_JURISDICTIONS.includes(countryCode)) {
      return 1.5; // 50% penalty
    }
    
    if (INCREASED_MONITORING_JURISDICTIONS.includes(countryCode)) {
      return 1.2; // 20% penalty
    }
    
    return 1.0;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // RATING & DECISION
  // ─────────────────────────────────────────────────────────────────────────────
  
  private determineRating(score: number): RiskRating {
    if (score >= RISK_SCORE_THRESHOLDS.LOW_RISK_MIN) {
      return 'LOW';
    } else if (score >= RISK_SCORE_THRESHOLDS.MEDIUM_RISK_MIN) {
      return 'MEDIUM';
    } else if (score >= RISK_SCORE_THRESHOLDS.UNACCEPTABLE_MAX) {
      return 'HIGH';
    } else {
      return 'UNACCEPTABLE';
    }
  }
  
  private makeAiDecision(score: number, rating: RiskRating): 'APPROVE' | 'REJECT' | 'ESCALATE' {
    if (rating === 'LOW') {
      return 'APPROVE';
    } else if (rating === 'MEDIUM') {
      return 'ESCALATE'; // Requires consultant review
    } else if (rating === 'HIGH') {
      return 'ESCALATE'; // Requires consultant review with enhanced conditions
    } else {
      return 'REJECT';
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // EXPLANATIONS & TRANSPARENCY
  // ─────────────────────────────────────────────────────────────────────────────
  
  private generateExplanation(
    components: RiskScoreComponents,
    multipliers: RiskScoreMultipliers,
    finalScore: number,
    rating: RiskRating
  ): string {
    const parts: string[] = [];
    
    parts.push(`Composite Risk Score: ${(finalScore * 100).toFixed(1)}% (${rating} Risk)`);
    parts.push('');
    parts.push('Factor Breakdown:');
    
    // Credit Bureau
    const creditDesc = components.creditBureauScore >= 0.8 ? 'excellent' :
      components.creditBureauScore >= 0.6 ? 'good' :
      components.creditBureauScore >= 0.4 ? 'fair' : 'needs improvement';
    parts.push(`• Credit History (40%): ${(components.creditBureauScore * 100).toFixed(0)}% - ${creditDesc}`);
    
    // Behavioural
    parts.push(`• Behavioural History (25%): ${(components.behaviouralScore * 100).toFixed(0)}%`);
    
    // Adverse Media
    if (components.adverseMediaScore < 1.0) {
      parts.push(`• Adverse Media (15%): ${(components.adverseMediaScore * 100).toFixed(0)}% - some findings detected`);
    } else {
      parts.push(`• Adverse Media (15%): 100% - no adverse findings`);
    }
    
    // SoW/SoF
    parts.push(`• Source of Wealth/Funds (10%): ${(components.sowSofScore * 100).toFixed(0)}%`);
    
    // Cross-Border
    parts.push(`• Cross-Border Exposure (5%): ${(components.crossBorderScore * 100).toFixed(0)}%`);
    
    // PEP
    if (components.pepFamilyScore < 1.0) {
      parts.push(`• PEP/Family Risk (5%): ${(components.pepFamilyScore * 100).toFixed(0)}% - PEP associations detected`);
    } else {
      parts.push(`• PEP/Family Risk (5%): 100% - no PEP associations`);
    }
    
    // Adjustments
    if (multipliers.defaultCascade && multipliers.defaultCascade > 1) {
      parts.push('');
      parts.push('Adjustments Applied:');
      parts.push('• Default history penalty applied');
    }
    
    return parts.join('\n');
  }
  
  private calculateFactorContributions(
    components: RiskScoreComponents,
    multipliers: RiskScoreMultipliers
  ): Record<string, number> {
    return {
      creditBureau: parseFloat((components.creditBureauScore * RISK_SCORE_WEIGHTS.CREDIT_BUREAU).toFixed(3)),
      behavioural: parseFloat((components.behaviouralScore * RISK_SCORE_WEIGHTS.BEHAVIOURAL).toFixed(3)),
      adverseMedia: parseFloat((components.adverseMediaScore * RISK_SCORE_WEIGHTS.ADVERSE_MEDIA).toFixed(3)),
      sowSof: parseFloat((components.sowSofScore * RISK_SCORE_WEIGHTS.SOW_SOF).toFixed(3)),
      crossBorder: parseFloat((components.crossBorderScore * RISK_SCORE_WEIGHTS.CROSS_BORDER).toFixed(3)),
      pepFamily: parseFloat((components.pepFamilyScore * RISK_SCORE_WEIGHTS.PEP_FAMILY).toFixed(3)),
      defaultCascadeMultiplier: multipliers.defaultCascade || 1,
      jurisdictionMultiplier: multipliers.jurisdiction || 1,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TIER-3 DUAL CONTROL
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Submit for consultant review (Tier-3 dual control)
   */
  async submitForConsultantReview(
    riskScore: CompositeRiskScore
  ): Promise<{ reviewId: string; deadline: string }> {
    
    const reviewId = `RR-${Date.now()}`;
    const deadline = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours SLA
    
    // In production: Create review task in consultant queue
    
    return { reviewId, deadline };
  }
  
  /**
   * Record consultant review decision
   */
  async recordConsultantReview(
    participantId: string,
    review: ConsultantReview
  ): Promise<CompositeRiskScore> {
    
    // In production: Update risk assessment with consultant decision
    
    // Return updated score
    return {} as CompositeRiskScore;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // BATCH OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Daily batch re-scoring for all Tier-3 participants
   */
  async runDailyRescoring(): Promise<{
    processed: number;
    scoreChanges: Array<{
      participantId: string;
      oldScore: number;
      newScore: number;
      change: number;
    }>;
    alerts: Array<{
      participantId: string;
      alertType: string;
      message: string;
    }>;
  }> {
    
    // In production: Batch process all Tier-3 participants at 02:00 UTC
    
    return {
      processed: 0,
      scoreChanges: [],
      alerts: [],
    };
  }
  
  /**
   * Check if FTR provider meets minimum score requirement
   */
  meetsMinimumForFtrProvider(score: number): boolean {
    return score >= RISK_SCORE_THRESHOLDS.MINIMUM_FOR_FTR_PROVIDER;
  }
}

// Export singleton instance
export const riskScoringService = new RiskScoringService();
