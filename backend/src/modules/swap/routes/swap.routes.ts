// ═══════════════════════════════════════════════════════════════════════════════
// IRG SWAP SYSTEM - API ROUTES (v6.0 Production)
// RESTful endpoints for Swap, Corpus Fund, and Payment operations
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, Request, Response, NextFunction } from 'express';
import { swapService } from '../services/swap.service';
import { corpusFundService } from '../services/corpus-fund.service';
import { paymentService } from '../services/payment.service';
import { SwapStatus } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Simple auth middleware (in production, use JWT/session)
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  (req as any).userId = userId;
  next();
};

// ─────────────────────────────────────────────────────────────────────────────────
// SWAP ROUTES
// ─────────────────────────────────────────────────────────────────────────────────

const swapRouter = Router();

// POST /api/v1/swap/initiate
// User-initiated swap (surrender any FTR/TGDP → request any minter service/goods)
swapRouter.post('/initiate', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { offeredTokenId, requestedMinterId, requestedService } = req.body;

  if (!requestedMinterId || !requestedService) {
    return res.status(400).json({ error: 'Missing required fields: requestedMinterId, requestedService' });
  }

  const result = await swapService.initiateSwap(userId, {
    offeredTokenId,
    requestedMinterId,
    requestedService,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.status(201).json(result);
}));

// POST /api/v1/swap/confirm/:swapId
// Confirm and execute swap after user confirmation
swapRouter.post('/confirm/:swapId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { swapId } = req.params;
  const { confirmationToken } = req.body;

  if (!confirmationToken) {
    return res.status(400).json({ error: 'Missing confirmationToken' });
  }

  const result = await swapService.confirmSwap(swapId, confirmationToken);

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json(result);
}));

// POST /api/v1/swap/:swapId/cancel
// Cancel pending swap
swapRouter.post('/:swapId/cancel', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { swapId } = req.params;

  const result = await swapService.cancelSwap(swapId, userId);

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true, message: 'Swap cancelled successfully' });
}));

// GET /api/v1/swap/pending
// Get user pending swaps
swapRouter.get('/pending', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  const result = await swapService.getUserSwaps(userId, { status: SwapStatus.PENDING });

  res.json(result);
}));

// GET /api/v1/swap/history
// Get swap history with filters
swapRouter.get('/history', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { status, limit, offset } = req.query;

  const result = await swapService.getUserSwaps(userId, {
    status: status as SwapStatus | undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined,
  });

  res.json(result);
}));

// GET /api/v1/swap/:swapId
// Get swap details
swapRouter.get('/:swapId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { swapId } = req.params;

  const result = await swapService.getUserSwaps(userId);
  const swap = result.swaps.find(s => s.id === swapId);

  if (!swap) {
    return res.status(404).json({ error: 'Swap not found' });
  }

  res.json({ swap });
}));

// ─────────────────────────────────────────────────────────────────────────────────
// CORPUS FUND ROUTES
// ─────────────────────────────────────────────────────────────────────────────────

const corpusFundRouter = Router();

// POST /api/v1/corpus-fund
// Create corpus fund for minter
corpusFundRouter.post('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { minterId, initialDeposit } = req.body;

  if (!minterId || !initialDeposit) {
    return res.status(400).json({ error: 'Missing required fields: minterId, initialDeposit' });
  }

  const result = await corpusFundService.createCorpusFund(minterId, initialDeposit, userId);

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.status(201).json(result);
}));

// POST /api/v1/corpus-fund/:corpusFundId/deposit
// Deposit to corpus fund
corpusFundRouter.post('/:corpusFundId/deposit', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { corpusFundId } = req.params;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid deposit amount' });
  }

  const result = await corpusFundService.deposit(corpusFundId, amount, userId);

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json(result);
}));

// POST /api/v1/corpus-fund/surrender-return
// Process surrender return
corpusFundRouter.post('/surrender-return', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { minterId, unitsSurrendered } = req.body;

  if (!minterId || !unitsSurrendered) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const result = await corpusFundService.processSurrenderReturn(minterId, unitsSurrendered, userId);

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json(result);
}));

// POST /api/v1/corpus-fund/:minterId/recall-transfer
// Transfer to recall fund
corpusFundRouter.post('/:minterId/recall-transfer', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { minterId } = req.params;

  const result = await corpusFundService.transferToRecallFund(minterId, userId);

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json(result);
}));

// GET /api/v1/corpus-fund/:minterId
// Get corpus fund details
corpusFundRouter.get('/:minterId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { minterId } = req.params;

  const result = await corpusFundService.getCorpusFund(minterId);

  if (!result) {
    return res.status(404).json({ error: 'Corpus fund not found' });
  }

  res.json({ corpusFund: result });
}));

// GET /api/v1/corpus-fund/:corpusFundId/stats
// Get corpus fund statistics
corpusFundRouter.get('/:corpusFundId/stats', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { corpusFundId } = req.params;

  const result = await corpusFundService.getCorpusFundStats(corpusFundId);

  if (!result) {
    return res.status(404).json({ error: 'Corpus fund not found' });
  }

  res.json(result);
}));

// POST /api/v1/corpus-fund/snapshot
// Run corpus snapshot (admin only - in production, add admin check)
corpusFundRouter.post('/snapshot', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const result = await corpusFundService.runCorpusSnapshot();

  res.json(result);
}));

// ─────────────────────────────────────────────────────────────────────────────────
// PAYMENT ROUTES
// ─────────────────────────────────────────────────────────────────────────────────

const paymentRouter = Router();

// GET /api/v1/payments/history
// Get transaction history
paymentRouter.get('/history', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { swapRequestId, minterId, type, fromDate, toDate, limit, offset } = req.query;

  const result = await paymentService.getTransactionHistory(
    {
      userId,
      swapRequestId: swapRequestId as string,
      minterId: minterId as string,
      type: type as any,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
    },
    {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    }
  );

  res.json(result);
}));

// GET /api/v1/payments/summary/:minterId
// Get payment summary for minter
paymentRouter.get('/summary/:minterId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { minterId } = req.params;
  const { period } = req.query;

  const result = await paymentService.getPaymentSummary(
    minterId,
    (period as 'day' | 'week' | 'month') || 'month'
  );

  res.json(result);
}));

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORT ROUTERS
// ─────────────────────────────────────────────────────────────────────────────────

export const createApiRouter = () => {
  const router = Router();

  router.use('/swap', swapRouter);
  router.use('/corpus-fund', corpusFundRouter);
  router.use('/payments', paymentRouter);

  // Health check
  router.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  return router;
};

export { swapRouter, corpusFundRouter, paymentRouter };
