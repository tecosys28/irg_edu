/**
 * IRG_FTR PLATFORM - Integration Module Index
 * 
 * Central integration layer for FTR platform modules:
 * - Registration ↔ Minting
 * - ROI ↔ Minting
 * - Consultant ↔ Approval Workflow
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

export {
  FtrIntegrationService,
  ftrIntegrationService,
  type ParticipantValidationResult,
  type MintingEligibilityResult,
  type ProjectApprovalRequest,
  type ConsultantApprovalResult,
  type FtrProductContext,
} from './services/ftr-integration.service';

export const INTEGRATION_MODULE_VERSION = '1.0.0';
export const INTEGRATION_MODULE_FEATURES = [
  'Participant validation (Registration → Minting)',
  'Dynamic ROI application (ROI → Minting)',
  'Consultant approval workflow',
  'Product-specific eligibility checks',
  'KYC tier validation by product type',
  'Role-based product access',
  'Combined eligibility assessment',
];
