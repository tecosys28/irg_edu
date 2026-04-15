/**
 * IRG_FTR MASTER PLATFORM - PARAMETRIC VALUES v5.0
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

export const PLATFORM_FEE_PERCENT = 1.5;
export const CONSULTANT_FEE_PERCENT = 2.0;
export const SURRENDER_RATIO = 0.55;
export const GST_RATE_PERCENT = 18;
export const REVIEW_DEADLINE_HOURS = 48;
export const CONSULTANT_ON_TIME_BONUS = 1.0;
export const CONSULTANT_LATE_PENALTY_PER_DAY = 0.5;
export const CONSULTANT_LATE_PENALTY_MAX = 2.0;
export const CONSULTANT_AI_WEIGHT = 0.3;
export const CONSULTANT_PEER_WEIGHT = 0.2;
export const CONSULTANT_ON_TIME_WEIGHT = 0.4;
export const CONSULTANT_MINTER_FEEDBACK_WEIGHT = 0.1;
export const RATING_SCALE_MIN = 0;
export const RATING_SCALE_MAX = 5;
export const CONSULTANT_OFFER_VALIDITY_HOURS = 72;
export const MAX_OFFERS_PER_APPLICATION = 5;
export const MIN_SHORTLIST_COUNT = 3;
export const MAX_SHORTLIST_COUNT = 10;
export const REDEMPTION_SLA_HOURS = 24;
export const SURRENDER_WALLET_PREFIX = 'SURRENDER-';
export const HOLDER_CANCEL_OPTION_DAYS = 7;
export const AI_AUTO_APPROVE_THRESHOLD = 85;
export const AI_MANUAL_REVIEW_THRESHOLD = 60;
export const AI_AUTO_REJECT_THRESHOLD = 30;
export const DEBOUNCE_MS = 500;
export const SUBMIT_COOLDOWN_MS = 2000;
export const AUTO_SAVE_INTERVAL_MS = 30000;
export const DOUBLE_ENTRY_TOLERANCE = 0.01;
export const FX_DOUBLE_ENTRY_TOLERANCE = 0.005;
export const RATE_LIMIT_REQUESTS_PER_MINUTE = 60;
export const CONCURRENT_EDIT_LOCK_TIMEOUT_SECONDS = 300;

export const TRANSACTION_CODES = {
  REG: 'REG', KYC: 'KYC', MAP: 'MAP', CON: 'CON', APR: 'APR', MNT: 'MNT',
  PRI: 'PRI', SEC: 'SEC', TRF: 'TRF', ERM: 'ERM', RLS: 'RLS', RDM: 'RDM',
  PT15: 'PT15', PT16: 'PT16', PT17: 'PT17', PT18: 'PT18', PT19: 'PT19', PT20: 'PT20',
  RT01: 'RT01', RT02: 'RT02', RT03: 'RT03', RT04: 'RT04',
  RDM_ORDER: 'RDM_ORDER', RDM_VERIFY: 'RDM_VERIFY', RDM_CONFIRM: 'RDM_CONFIRM', 
  RDM_FLAG: 'RDM_FLAG', RDM_DEREG: 'RDM_DEREG',
} as const;

export const generateTransactionNumber = (code: string): string => 
  `${code}-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
export const generateSurrenderWalletAddress = (minterId: string): string =>
  `${SURRENDER_WALLET_PREFIX}${minterId.substring(0, 8)}-${Date.now()}`;
export const canExerciseDeregistration = (surrenderedAt: Date): boolean =>
  Date.now() <= surrenderedAt.getTime() + (HOLDER_CANCEL_OPTION_DAYS * 24 * 60 * 60 * 1000);
export const getAIRecommendation = (score: number) => 
  score >= AI_AUTO_APPROVE_THRESHOLD ? 'AUTO_APPROVE' : score >= AI_MANUAL_REVIEW_THRESHOLD ? 'MANUAL_REVIEW' : 'AUTO_REJECT';
export const calculateConsultantRating = (ai: number, peer: number, onTime: number, feedback: number): number =>
  Math.min(RATING_SCALE_MAX, (CONSULTANT_AI_WEIGHT * ai/100 + CONSULTANT_PEER_WEIGHT * peer/100 + 
    CONSULTANT_ON_TIME_WEIGHT * (onTime + 2)/3 + CONSULTANT_MINTER_FEEDBACK_WEIGHT * feedback/5) * 5);

// ═══════════════════════════════════════════════════════════════════════════════
// SWAP MODULE CONSTANTS (v6.0 Integrated)
// ═══════════════════════════════════════════════════════════════════════════════

export const SWAP_CONFIRMATION_TIMEOUT_MS = 30000;
export const SWAP_RATE_LIMIT_WINDOW_MS = 60000;
export const SWAP_RATE_LIMIT_MAX_REQUESTS = 10;
export const SWAP_DUPLICATE_GUARD_TTL_MS = 5000;
export const SWAP_DEBOUNCE_MS = 500;
export const SWAP_FEE_PERCENTAGE = 0.02; // 2% IRG fee
export const FX_SPREAD_PERCENTAGE = 0.005; // 0.5% FX spread
export const MAX_SWAP_VALUE = 1000000;
export const MIN_SWAP_VALUE = 1;
export const MAX_BATCH_SIZE = 10;
export const CORPUS_CONTRIBUTION_MIN = 0.10; // 10%
export const CORPUS_CONTRIBUTION_MAX = 0.15; // 15%
export const SHORT_SALE_THRESHOLD = 0.8; // 80% of outstanding

export const SWAP_TRANSACTION_CODES = {
  SWP_INIT: 'SWP_INIT',
  SWP_CONFIRM: 'SWP_CONFIRM',
  SWP_EXECUTE: 'SWP_EXECUTE',
  SWP_CANCEL: 'SWP_CANCEL',
  SWP_SHORT_SALE: 'SWP_SHORT_SALE',
  SWP_FX_ADJ: 'SWP_FX_ADJ',
} as const;
