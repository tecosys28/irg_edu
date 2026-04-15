/**
 * IRG_FTR PLATFORM - ROI Module Routes
 * Complete API for ROI configuration and consultant justification
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../../middleware/auth';
import { roiModuleService } from '../services/roi-module.service';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

const justificationCategories = z.enum([
  'MARKET_CONDITIONS',
  'ASSET_QUALITY',
  'RISK_ASSESSMENT',
  'REGULATORY_REQUIREMENT',
  'COMPETITIVE_ANALYSIS',
  'HISTORICAL_PERFORMANCE',
  'SECTOR_SPECIFIC',
  'GEOGRAPHIC_FACTOR',
  'OTHER',
]);

const updateRoiConfigSchema = z.object({
  baseRoiPercent: z.number().min(0).max(100).optional(),
  minRoiPercent: z.number().min(0).max(100).optional(),
  maxRoiPercent: z.number().min(0).max(100).optional(),
});

const createOverrideSchema = z.object({
  projectId: z.string().min(1),
  minterId: z.string().min(1),
  minterCountry: z.string().length(2),
  requestedRoi: z.number().min(0).max(100),
  justificationCategory: justificationCategories,
  justificationText: z.string().min(50, 'Justification must be at least 50 characters'),
  supportingEvidence: z.array(z.string()).optional(),
});

const processOverrideSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/roi/config
 * Get all ROI configurations
 */
router.get('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await roiModuleService.getAllRoiConfigs();
    
    res.json({
      success: true,
      data: {
        configs,
        defaultRoi: 9.2,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/roi/config/:countryCode
 * Get ROI configuration for a specific country
 */
router.get('/config/:countryCode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { countryCode } = req.params;
    const config = await roiModuleService.getRoiConfig(countryCode);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ROI_CONFIG_NOT_FOUND',
          message: `No ROI configuration found for country: ${countryCode}`,
        },
      });
    }
    
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/roi/base/:countryCode
 * Get base ROI for a country (simple endpoint for minting form)
 */
router.get('/base/:countryCode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { countryCode } = req.params;
    const baseRoi = await roiModuleService.getBaseRoi(countryCode);
    const config = await roiModuleService.getRoiConfig(countryCode);
    
    res.json({
      success: true,
      data: {
        countryCode: countryCode.toUpperCase(),
        baseRoi,
        minRoi: config?.minRoiPercent ?? 0,
        maxRoi: config?.maxRoiPercent ?? 100,
        regulatoryFramework: config?.regulatoryFramework,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/roi/justification-categories
 * Get list of justification categories
 */
router.get('/justification-categories', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: roiModuleService.getJustificationCategories(),
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/roi/validate
 * Validate a proposed ROI change
 */
router.post('/validate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { countryCode, requestedRoi } = req.body;
    
    if (!countryCode || requestedRoi === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'countryCode and requestedRoi are required',
        },
      });
    }
    
    const validation = await roiModuleService.validateRoiChange(countryCode, requestedRoi);
    
    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/roi/project/:projectId
 * Get effective ROI for a project
 */
router.get('/project/:projectId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const { minterCountry } = req.query;
    
    if (!minterCountry || typeof minterCountry !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'minterCountry query parameter is required',
        },
      });
    }
    
    const effectiveRoi = await roiModuleService.getEffectiveProjectRoi(projectId, minterCountry);
    
    res.json({
      success: true,
      data: effectiveRoi,
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONSULTANT ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/roi/override
 * Create ROI override with justification (Consultant only)
 */
router.post('/override', authenticate, authorize('CONSULTANT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createOverrideSchema.parse(req.body);
    const userId = (req as any).user?.id;
    const userName = (req as any).user?.name || 'Unknown';
    
    const override = await roiModuleService.createRoiOverride(
      data.projectId,
      data.minterId,
      data.minterCountry,
      data.requestedRoi,
      userId,
      userName,
      data.justificationCategory,
      data.justificationText,
      data.supportingEvidence
    );
    
    res.status(201).json({
      success: true,
      data: override,
      message: override.approvalStatus === 'APPROVED' 
        ? 'ROI override approved automatically (within threshold)'
        : 'ROI override submitted for approval',
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ROI_OVERRIDE_ERROR',
          message: error.message,
        },
      });
    }
    next(error);
  }
});

/**
 * GET /api/v1/roi/override/:overrideId
 * Get ROI override details
 */
router.get('/override/:overrideId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { overrideId } = req.params;
    
    // In production, fetch from database
    // For now, return mock or search in store
    
    res.json({
      success: true,
      data: {
        id: overrideId,
        message: 'Override details would be fetched from database',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/roi/overrides/pending
 * Get all pending ROI overrides (Admin/Senior Consultant)
 */
router.get('/overrides/pending', authenticate, authorize('ADMIN', 'CONSULTANT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In production, fetch from database with proper filtering
    
    res.json({
      success: true,
      data: {
        overrides: [],
        total: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PUT /api/v1/roi/config/:countryCode
 * Update ROI configuration for a country (Admin only)
 */
router.put('/config/:countryCode', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { countryCode } = req.params;
    const data = updateRoiConfigSchema.parse(req.body);
    const userId = (req as any).user?.id || 'admin';
    const ipAddress = req.ip;
    
    const updated = await roiModuleService.updateRoiConfig(
      countryCode,
      data,
      userId,
      ipAddress
    );
    
    res.json({
      success: true,
      data: updated,
      message: `ROI configuration updated for ${countryCode}`,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: error.message,
        },
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/roi/override/:overrideId/process
 * Approve or reject an ROI override (Admin/Senior Consultant)
 */
router.post('/override/:overrideId/process', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { overrideId } = req.params;
    const data = processOverrideSchema.parse(req.body);
    const userId = (req as any).user?.id || 'admin';
    
    if (data.action === 'REJECT' && !data.rejectionReason) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Rejection reason is required when rejecting an override',
        },
      });
    }
    
    const processed = await roiModuleService.processRoiOverride(
      overrideId,
      data.action,
      userId,
      data.rejectionReason
    );
    
    res.json({
      success: true,
      data: processed,
      message: `ROI override ${data.action.toLowerCase()}ed`,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PROCESS_ERROR',
          message: error.message,
        },
      });
    }
    next(error);
  }
});

/**
 * GET /api/v1/roi/history
 * Get ROI change history (Admin only)
 */
router.get('/history', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId, changedBy, fromDate, toDate, page = 1, limit = 50 } = req.query;
    
    const history = await roiModuleService.getRoiHistory({
      entityType: entityType as 'COUNTRY' | 'PROJECT',
      entityId: entityId as string,
      changedBy: changedBy as string,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
    });
    
    // Paginate
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginatedHistory = history.slice(startIndex, startIndex + Number(limit));
    
    res.json({
      success: true,
      data: {
        history: paginatedHistory,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: history.length,
          hasMore: startIndex + paginatedHistory.length < history.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/roi/cache/invalidate
 * Invalidate ROI cache (Admin only)
 */
router.post('/cache/invalidate', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), (req: Request, res: Response) => {
  const { countryCode } = req.body;
  
  roiModuleService.invalidateCache(countryCode);
  
  res.json({
    success: true,
    message: countryCode 
      ? `Cache invalidated for ${countryCode}`
      : 'All ROI cache invalidated',
  });
});

export default router;
