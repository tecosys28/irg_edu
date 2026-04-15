/**
 * IRG_FTR PLATFORM - Production Configuration
 * P1 AUDIT FIX: Enable 2FA and security features for production
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

export const PRODUCTION_CONFIG = {
  // ═══════════════════════════════════════════════════════════════════════════
  // ENVIRONMENT
  // ═══════════════════════════════════════════════════════════════════════════
  
  NODE_ENV: 'production',
  PORT: process.env.PORT || 3000,
  API_BASE_URL: process.env.API_BASE_URL || 'https://api.irg-ftr.com',
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY - P1 AUDIT FIX: 2FA ENABLED
  // ═══════════════════════════════════════════════════════════════════════════
  
  security: {
    // P1 FIX: Two-factor authentication ENABLED in production
    FEATURE_TWO_FACTOR_AUTH: true,
    
    // Session management
    SESSION_TIMEOUT_MINUTES: 30,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION_MINUTES: 30,
    
    // OTP settings
    OTP_VALIDITY_SECONDS: 300,
    OTP_LENGTH: 6,
    
    // JWT settings
    JWT_EXPIRES_IN: '1h',
    REFRESH_TOKEN_EXPIRES_IN: '7d',
    
    // Encryption
    ENCRYPTION_ALGORITHM: 'aes-256-gcm',
    
    // Rate limiting
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    
    // CORS
    CORS_ORIGINS: [
      'https://irg-ftr.com',
      'https://www.irg-ftr.com',
      'https://app.irg-ftr.com',
    ],
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURES
  // ═══════════════════════════════════════════════════════════════════════════
  
  features: {
    // P1 FIX: Security features enabled
    TWO_FACTOR_AUTH_ENABLED: true,
    EMAIL_VERIFICATION_ENABLED: true,
    KYC_PROVIDER_ENABLED: true,
    
    // Platform features
    MARKETPLACE_ENABLED: true,
    SWAP_ENABLED: true,
    CROSS_CURRENCY_SWAP_ENABLED: true,
    
    // Consultant module
    CONSULTANT_MODULE_ENABLED: true,
    AI_RATING_ENABLED: true,
    
    // Redemption module
    REDEMPTION_MODULE_ENABLED: true,
    HOLDER_DEREGISTRATION_ENABLED: true,
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PLATFORM PARAMETERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  platform: {
    // Fees
    PLATFORM_FEE_PERCENT: 1.5,
    SWAP_FEE_PERCENT: 2.0,
    FX_SPREAD_PERCENT: 0.5,
    CONSULTANT_FEE_PERCENT: 2.0,
    GST_RATE_PERCENT: 18,
    
    // Token parameters
    MIN_FACE_VALUE: 10,
    MAX_FACE_VALUE: 10000,
    MIN_VALIDITY_YEARS: 1,
    MAX_VALIDITY_YEARS: 25,
    MAX_EARMARK_PERCENT: 25,
    
    // Redemption
    SURRENDER_RATIO: 0.55,
    HOLDER_OPTION_DAYS: 7,
    REDEMPTION_SLA_HOURS: 24,
    MAX_TOKENS_PER_REDEMPTION: 100,
    MIN_BULK_REDEMPTION: 10,
    
    // Consultant
    MIN_SHORTLIST_COUNT: 3,
    MAX_SHORTLIST_COUNT: 10,
    OFFER_VALIDITY_HOURS: 72,
    REVIEW_DEADLINE_HOURS: 48,
    MIN_REVIEWS_FOR_RANKING: 5,
    
    // Corpus fund
    MIN_CORPUS_PERCENT: 10,
    MAX_CORPUS_PERCENT: 15,
    SHORT_SALE_THRESHOLD_PERCENT: 80,
    
    // Governance
    BOARD_MEMBERS_PER_CATEGORY: 7,
    QUORUM_COUNT: 4,
    VOTE_DURATION_DAYS: 7,
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // P1 FIX: DYNAMIC ROI CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  roi: {
    // Default ROI (used when country not configured)
    DEFAULT_ROI_PERCENT: 9.2,
    
    // Cache settings
    ROI_CACHE_TTL_SECONDS: 300, // 5 minutes
    
    // Country-specific defaults (loaded from database in production)
    COUNTRY_DEFAULTS: {
      IN: 9.2,
      US: 6.5,
      GB: 7.0,
      AE: 8.0,
      SG: 5.5,
      AU: 6.0,
      CA: 6.0,
      DE: 4.5,
      FR: 4.5,
      JP: 3.0,
    },
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RATING SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  
  rating: {
    // Weights
    AI_SCORE_WEIGHT: 0.30,
    PEER_RANK_WEIGHT: 0.20,
    ON_TIME_WEIGHT: 0.40,
    MINTER_FEEDBACK_WEIGHT: 0.10,
    
    // Thresholds
    AI_AUTO_APPROVE_THRESHOLD: 85,
    AI_MANUAL_REVIEW_MIN: 60,
    AI_AUTO_REJECT_MAX: 60,
    
    // Actions
    WARNING_THRESHOLD: 2.5,
    SUSPENSION_THRESHOLD: 2.0,
    
    // Bonuses/Penalties
    ON_TIME_BONUS: 1.0,
    LATE_PENALTY_PER_DAY: 0.5,
    MAX_LATE_PENALTY: 2.0,
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCKCHAIN
  // ═══════════════════════════════════════════════════════════════════════════
  
  blockchain: {
    NETWORK: 'polygon',
    CHAIN_ID: 137,
    RPC_URL: process.env.POLYGON_RPC_URL,
    CONTRACT_ADDRESS: process.env.FTR_CONTRACT_ADDRESS,
    BLOCK_CONFIRMATIONS: 5,
    GAS_LIMIT: 5000000,
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EXTERNAL SERVICES
  // ═══════════════════════════════════════════════════════════════════════════
  
  services: {
    // Firebase
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    
    // KYC Provider
    KYC_PROVIDER: 'onfido',
    KYC_API_URL: process.env.KYC_API_URL,
    
    // Email
    EMAIL_PROVIDER: 'sendgrid',
    EMAIL_FROM: 'noreply@irg-ftr.com',
    
    // SMS
    SMS_PROVIDER: 'twilio',
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT & COMPLIANCE
  // ═══════════════════════════════════════════════════════════════════════════
  
  audit: {
    LOG_RETENTION_YEARS: 7,
    ENABLE_DETAILED_LOGGING: true,
    SENSITIVE_FIELDS: ['password', 'passwordHash', 'token', 'secret', 'key'],
  },
};

export default PRODUCTION_CONFIG;
