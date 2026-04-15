import { Router, Request, Response } from 'express';
import redemptionService from '../services/redemption.service';

const router = Router();

router.post('/initiate', async (req: Request, res: Response) => {
  const result = await redemptionService.initiateFromOrder(req.body);
  res.status(result.success ? 201 : 400).json(result);
});

router.post('/verify/:orderId', async (req: Request, res: Response) => {
  const result = await redemptionService.verifyFtrIds(req.params.orderId);
  res.json(result);
});

router.post('/confirm', async (req: Request, res: Response) => {
  const result = await redemptionService.confirmSale(req.body);
  res.json(result);
});

router.post('/deregister/:tokenId', async (req: Request, res: Response) => {
  const result = await redemptionService.exerciseDeregistration({ tokenId: req.params.tokenId, ...req.body });
  res.json(result);
});

router.get('/pending', async (req: Request, res: Response) => {
  const result = await redemptionService.getPendingRedemptions(req.query.userId as string);
  res.json(result);
});

router.get('/surrender-wallets', async (req: Request, res: Response) => {
  const result = await redemptionService.getSurrenderWallets(req.query.minterId as string);
  res.json(result);
});

export default router;
