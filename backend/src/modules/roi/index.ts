/**
 * IRG_FTR PLATFORM - ROI Module Index
 * 
 * Dynamic ROI Configuration Module with:
 * - Country-specific ROI rates
 * - Consultant override with justification
 * - Change history and audit trail
 * - Integration with minting workflow
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

// Services
export {
  RoiModuleService,
  roiModuleService,
  type RoiConfig,
  type ProjectRoiOverride,
  type RoiJustificationCategory,
  type RoiChangeHistory,
  type RoiValidationResult,
} from './services/roi-module.service';

// Routes
export { default as roiRoutes } from './routes/roi.routes';

// Module metadata
export const ROI_MODULE_VERSION = '1.0.0';
export const ROI_MODULE_FEATURES = [
  'Dynamic ROI per country',
  'Configurable min/max ROI bounds',
  'Consultant override with justification',
  'Justification categories',
  'Multi-level approval workflow',
  'Change history audit trail',
  'Cache management',
  'Integration with minting approval',
];
