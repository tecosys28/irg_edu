/**
 * IRG_FTR PLATFORM - Registration Module Frontend Index
 * TROT REGISTRATION PROTOCOL COMPLIANT v6.0
 * 
 * Complete frontend registration module with:
 * - Multi-step registration form (10 steps)
 * - Role-adaptive UI (10 archetypes)
 * - Entity-specific profiles
 * - Real-time HEP validation
 * - Double-entry verification
 * - OTP/verification integration
 * - Video KYC integration
 * - Wallet setup wizard
 * - Social recovery configuration
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

// Components
export { RegistrationForm, default as RegistrationFormDefault } from './components/RegistrationForm';

// Hooks
export { useRegistration, default as useRegistrationDefault } from './hooks/useRegistration';
export {
  useHepValidation,
  default as useHepValidationDefault,
  type HepError,
  type HepWarning,
  type HepSuggestion,
  type HepValidationResult,
} from './hooks/useHepValidation';

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE METADATA
// ═══════════════════════════════════════════════════════════════════════════════

export const REGISTRATION_UI_VERSION = '6.0.0';

export const REGISTRATION_STEPS = [
  { id: 'roles', title: 'Select Roles', icon: 'Users' },
  { id: 'entityType', title: 'Entity Type', icon: 'Building' },
  { id: 'profile', title: 'Profile Details', icon: 'User' },
  { id: 'contact', title: 'Contact Details', icon: 'Phone' },
  { id: 'bankAccount', title: 'Bank Account', icon: 'CreditCard' },
  { id: 'nominees', title: 'Nominees', icon: 'UserPlus' },
  { id: 'credentials', title: 'Credentials', icon: 'Lock' },
  { id: 'kycDocuments', title: 'KYC Documents', icon: 'FileText' },
  { id: 'terms', title: 'Terms & Conditions', icon: 'CheckSquare' },
  { id: 'review', title: 'Review & Submit', icon: 'CheckCircle' },
] as const;

export const PARTICIPANT_ARCHETYPES = [
  { value: 'TGDP_MINTER', label: 'TGDP Minter (Household)', icon: 'Coins' },
  { value: 'TGDP_JEWELER', label: 'TGDP Jeweler', icon: 'Gem' },
  { value: 'MARKET_MAKER', label: 'Market Maker', icon: 'TrendingUp' },
  { value: 'FTR_BUYER_HOUSEHOLD', label: 'FTR Buyer (Household)', icon: 'ShoppingBag' },
  { value: 'FTR_BUYER_OTHER', label: 'FTR Buyer (Corporate)', icon: 'Briefcase' },
  { value: 'SERVICE_PROVIDER', label: 'Service Provider', icon: 'Wrench' },
  { value: 'DAC_PARTICIPANT', label: 'DAC Participant', icon: 'Globe' },
  { value: 'CONSULTANT', label: 'Domain Consultant', icon: 'UserCheck' },
  { value: 'BANK_TRUSTEE', label: 'Bank Trustee', icon: 'Building2' },
  { value: 'INVESTOR', label: 'Investor', icon: 'PiggyBank' },
] as const;
