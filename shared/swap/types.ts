// ═══════════════════════════════════════════════════════════════════════════════
// IRG SWAP SYSTEM - SHARED TYPES & CONSTANTS (v6.0 Production)
// Zero loose ends - Full coverage for all FTR products + TGDP
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────────

export enum SwapStatus {
  PENDING = 'PENDING',
  INVENTORY_CHECK = 'INVENTORY_CHECK',
  SHORT_SALE_INITIATED = 'SHORT_SALE_INITIATED',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum CorpusStatus {
  ACTIVE = 'ACTIVE',
  LOCKED = 'LOCKED',
  RECALL_TRANSFERRED = 'RECALL_TRANSFERRED',
}

export enum TokenState {
  ACTIVE = 'ACTIVE',
  LISTED = 'LISTED',
  SURRENDERED = 'SURRENDERED',
  REDEEMED = 'REDEEMED',
  EXPIRED = 'EXPIRED',
}

export enum FtrProductType {
  TROT_REALTY = 'TROT_REALTY',
  TAXI_FTR = 'TAXI_FTR',
  AF_FTR = 'AF_FTR',
  GIC = 'GIC',
  HOSP = 'HOSP',
  HEALTH = 'HEALTH',
  EDU = 'EDU',
  K_FTR = 'K_FTR',
  T_JR = 'T_JR',
  TGDP = 'TGDP',
}

export enum TransactionType {
  SWAP_SETTLEMENT = 'SWAP_SETTLEMENT',
  SWAP_FEE = 'SWAP_FEE',
  SHORT_SALE_PROFIT_LOSS = 'SHORT_SALE_PROFIT_LOSS',
  SURRENDER_RETURN = 'SURRENDER_RETURN',
  FX_ADJUSTMENT = 'FX_ADJUSTMENT',
  RECALL_TRANSFER = 'RECALL_TRANSFER',
  CORPUS_DEPOSIT = 'CORPUS_DEPOSIT',
  CORPUS_WITHDRAWAL = 'CORPUS_WITHDRAWAL',
}

export enum InventorySource {
  OPEN_MARKET = 'OPEN_MARKET',
  MINTER_CF = 'MINTER_CF',
  POOLED_CF = 'POOLED_CF',
  SHORT_SALE = 'SHORT_SALE',
}

// ─────────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  walletAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Minter {
  id: string;
  name: string;
  businessType: string;
  country: string;
  currency: string;
  corpusFundId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FtrToken {
  id: string;
  tokenId: string;
  productType: FtrProductType;
  minterId: string;
  holderId: string;
  faceValue: number;
  currency: string;
  state: TokenState;
  expiresAt: Date;
  surrenderedAt?: Date;
  redemptionOrderId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  minter?: Minter;
  holder?: User;
}

export interface SwapRequest {
  id: string;
  initiatorId: string;
  offeredTokenId?: string;
  requestedMinterId: string;
  requestedService: RequestedService;
  status: SwapStatus;
  marketRateOffered?: number;
  marketRateRequested?: number;
  fxRate?: number;
  shortSaleTriggered: boolean;
  corpusAccountId?: string;
  inventorySource?: InventorySource;
  failureReason?: string;
  executedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  initiator?: User;
  offeredToken?: FtrToken;
  requestedMinter?: Minter;
  corpusAccount?: CorpusFund;
  transactions?: Transaction[];
}

export interface RequestedService {
  description: string;
  quantity: number;
  productType: FtrProductType;
  estimatedValue: number;
  currency: string;
  metadata?: Record<string, any>;
}

export interface CorpusFund {
  id: string;
  minterId: string;
  totalBalance: number;
  shortSaleBalance: number;
  fxReserve: number;
  perUnitValue: number;
  outstandingUnits: number;
  marketMakerLimit: number;
  investmentReturns: number;
  lastSnapshotAt?: Date;
  status: CorpusStatus;
  createdAt: Date;
  updatedAt: Date;
  minter?: Minter;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  swapRequestId?: string;
  fromUserId?: string;
  toMinterId?: string;
  toCorpusFundId?: string;
  amount: number;
  currency: string;
  fxRate?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface MarketplaceListing {
  id: string;
  tokenId: string;
  sellerId: string;
  askPrice: number;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  token?: FtrToken;
  seller?: User;
}

// ─────────────────────────────────────────────────────────────────────────────────
// API REQUEST/RESPONSE TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface InitiateSwapRequest {
  offeredTokenId?: string;
  requestedMinterId: string;
  requestedService: RequestedService;
}

export interface InitiateSwapResponse {
  success: boolean;
  swap?: SwapRequest;
  requiresConfirmation: boolean;
  confirmationToken?: string;
  inventoryStatus: InventoryCheckResult;
  estimatedRates: {
    offeredRate: number;
    requestedRate: number;
    fxRate: number;
    netValue: number;
  };
  error?: string;
}

export interface ConfirmSwapRequest {
  swapId: string;
  confirmationToken: string;
}

export interface ExecuteSwapResponse {
  success: boolean;
  swap?: SwapRequest;
  transaction?: Transaction;
  corpusImpact?: {
    shortSaleTriggered: boolean;
    pnlAmount: number;
    fxImpact: number;
  };
  error?: string;
}

export interface InventoryCheckResult {
  available: boolean;
  source: InventorySource;
  quantity: number;
  marketPrice?: number;
  corpusFundId?: string;
  requiresShortSale: boolean;
}

export interface SwapHistoryRequest {
  userId: string;
  status?: SwapStatus;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface SwapHistoryResponse {
  swaps: SwapRequest[];
  total: number;
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HEP HOOK TYPES (8 Hooks for Payment Atomicity)
// ─────────────────────────────────────────────────────────────────────────────────

export interface HepHookConfig {
  doubleEntry: boolean;
  confirmation: boolean;
  duplicateGuard: boolean;
  rateLimit: boolean;
  debounce: boolean;
  validation: boolean;
  auditLog: boolean;
  rollback: boolean;
}

export interface ConfirmationOptions {
  confirmText: string;
  timeout: number;
  requiresOtp?: boolean;
}

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
}

export interface DuplicateGuardKey {
  initiatorId: string;
  offeredTokenId?: string;
  requestedMinterId: string;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

export const SWAP_CONSTANTS = {
  // Timing
  CONFIRMATION_TIMEOUT_MS: 30000,
  RATE_LIMIT_WINDOW_MS: 60000,
  RATE_LIMIT_MAX_REQUESTS: 10,
  DUPLICATE_GUARD_TTL_MS: 5000,
  DEBOUNCE_MS: 500,
  
  // Fees
  SWAP_FEE_PERCENTAGE: 0.02, // 2% IRG fee
  FX_SPREAD_PERCENTAGE: 0.005, // 0.5% FX spread
  
  // Limits
  MAX_SWAP_VALUE: 1000000,
  MIN_SWAP_VALUE: 1,
  MAX_BATCH_SIZE: 10,
  
  // Corpus Fund
  CORPUS_CONTRIBUTION_MIN: 0.10, // 10%
  CORPUS_CONTRIBUTION_MAX: 0.15, // 15%
  SHORT_SALE_THRESHOLD: 0.8, // 80% of outstanding
  
  // Inventory check order
  INVENTORY_CHECK_ORDER: [
    InventorySource.OPEN_MARKET,
    InventorySource.MINTER_CF,
    InventorySource.POOLED_CF,
    InventorySource.SHORT_SALE,
  ] as InventorySource[],
} as const;

export const FTR_PRODUCT_LABELS: Record<FtrProductType, string> = {
  [FtrProductType.TROT_REALTY]: 'TROT Realty',
  [FtrProductType.TAXI_FTR]: 'Taxi FTR',
  [FtrProductType.AF_FTR]: 'AF FTR',
  [FtrProductType.GIC]: 'GIC',
  [FtrProductType.HOSP]: 'Hospitality',
  [FtrProductType.HEALTH]: 'Healthcare',
  [FtrProductType.EDU]: 'Education',
  [FtrProductType.K_FTR]: 'K-FTR',
  [FtrProductType.T_JR]: 'T-JR',
  [FtrProductType.TGDP]: 'TGDP',
};

export const SWAP_STATUS_LABELS: Record<SwapStatus, string> = {
  [SwapStatus.PENDING]: 'Pending',
  [SwapStatus.INVENTORY_CHECK]: 'Checking Inventory',
  [SwapStatus.SHORT_SALE_INITIATED]: 'Short Sale Active',
  [SwapStatus.EXECUTED]: 'Completed',
  [SwapStatus.FAILED]: 'Failed',
  [SwapStatus.CANCELLED]: 'Cancelled',
};

export const SWAP_STATUS_COLORS: Record<SwapStatus, string> = {
  [SwapStatus.PENDING]: '#f59e0b',
  [SwapStatus.INVENTORY_CHECK]: '#3b82f6',
  [SwapStatus.SHORT_SALE_INITIATED]: '#8b5cf6',
  [SwapStatus.EXECUTED]: '#10b981',
  [SwapStatus.FAILED]: '#ef4444',
  [SwapStatus.CANCELLED]: '#6b7280',
};
