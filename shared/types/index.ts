/**
 * IRG_FTR MASTER PLATFORM - SHARED TYPES v6.0
 * Includes Swap Module types (v6.0)
 * Includes Registration Module types (v6.0 - TROT Protocol)
 */

// Re-export swap types
export * from '../swap/types';

// Re-export registration types
export * from '../registration/types';

export type UserRole = 'HOLDER' | 'MINTER' | 'CONSULTANT' | 'MARKET_MAKER' | 'ADMIN' | 'SUPER_ADMIN';
export type KycStatus = 'PENDING' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type ConsultantStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DEREGISTERED';
export type ConsultantAvailability = 'AVAILABLE' | 'BUSY' | 'ON_LEAVE' | 'UNAVAILABLE';
export type OfferStatus = 'PENDING' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type TaskType = 'APPRAISAL' | 'LEGAL_REVIEW' | 'TECHNICAL_AUDIT' | 'FINANCIAL_ANALYSIS' | 'SITE_INSPECTION';
export type TaskStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'OVERDUE';
export type FtrState = 'UNMINTED' | 'AVAILABLE' | 'LISTED' | 'EARMARKED' | 'REDEEMED' | 'SURRENDERED' | 'DEREGISTERED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NotificationType = 'TRANSACTION' | 'KYC' | 'MINTING' | 'CONSULTANT' | 'RATING' | 'REDEMPTION' | 'TASK_ASSIGNED' | 'OFFER_RECEIVED' | 'SWAP';

export interface Consultant {
  id: string; userId: string; registrationNumber: string; businessName: string;
  specializations: string[]; categories: string[]; countryCode: string; stateCode?: string;
  geoScore: number; rating: number; totalReviews: number; rankingPosition?: number;
  onTimePercentage: number; availabilityStatus: ConsultantAvailability; baseFeePercent: number;
  status: ConsultantStatus; createdAt: Date; updatedAt: Date;
}

export interface ConsultantTask {
  id: string; consultantId: string; mintingAppId?: string; taskType: TaskType;
  description: string; deadline: Date; status: TaskStatus; reportUrl: string[];
  feeQuoted: number; feeApproved?: number; feePaidAt?: Date;
  aiScore?: number; onTimeBonus: number; peerRank?: number; finalRating?: number;
  doubleEntryVerified: boolean; createdAt: Date; updatedAt: Date;
}

export interface ConsultantOffer {
  id: string; consultantId: string; mintingAppId: string; feeQuoted: number;
  terms: any; validUntil: Date; status: OfferStatus; createdAt: Date;
}

export interface RatingComponents { aiScore: number; onTimeBonus: number; peerRank: number; minterFeedback: number; }
export interface AIScoreResult { score: number; confidence: number; recommendation: string; }
export interface ReportSubmissionParams { taskId: string; reportUrls: string[]; reportHash: string; findings: string; recommendation: string; riskAssessment: RiskLevel; }
export interface RedemptionInitParams { orderId: string; ftrTokenIds: string[]; sellerId: string; buyerId: string; }
export interface DeregistrationParams { tokenId: string; holderId: string; reason?: string; }
export interface ApiResponse<T> { success: boolean; data?: T; error?: { code: string; message: string; details?: any }; }
export interface ConsultantDashboardStats { totalTasks: number; pendingTasks: number; completedTasks: number; totalEarnings: number; rating: number; onTimePercentage: number; }
