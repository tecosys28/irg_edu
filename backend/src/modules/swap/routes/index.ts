/**
 * IRG_FTR MASTER PLATFORM - SWAP MODULE ROUTES INDEX
 */
import { Router } from 'express';
import swapRoutes from './swap.routes';

const router = Router();
router.use('/', swapRoutes);

export default router;
