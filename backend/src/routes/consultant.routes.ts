import { Router, Request, Response } from 'express';
import consultantService from '../services/consultant.service';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  const result = await consultantService.registerConsultant(req.body);
  res.status(result.success ? 201 : 400).json(result);
});

router.post('/shortlist', async (req: Request, res: Response) => {
  const result = await consultantService.shortlistConsultants(req.body);
  res.json(result);
});

router.post('/offer', async (req: Request, res: Response) => {
  const result = await consultantService.sendOffer(req.body);
  res.status(result.success ? 201 : 400).json(result);
});

router.post('/offer/:id/respond', async (req: Request, res: Response) => {
  const result = await consultantService.respondToOffer(req.params.id, req.body.accept, req.body.consultantId);
  res.json(result);
});

router.post('/tasks', async (req: Request, res: Response) => {
  const result = await consultantService.allocateTask(req.body);
  res.status(result.success ? 201 : 400).json(result);
});

router.post('/tasks/:id/start', async (req: Request, res: Response) => {
  const result = await consultantService.startTask(req.params.id, req.body.consultantId);
  res.json(result);
});

router.post('/tasks/:id/report', async (req: Request, res: Response) => {
  const result = await consultantService.submitReport(req.body, req.body.consultantId, req.body.doubleEntryHash);
  res.json(result);
});

router.post('/tasks/:id/fee', async (req: Request, res: Response) => {
  const result = await consultantService.processFeePament(req.params.id, req.body.approvedBy, req.body.approvedFee);
  res.json(result);
});

router.get('/tasks', async (req: Request, res: Response) => {
  const result = await consultantService.getConsultantTasks(req.query.consultantId as string, req.query.status as string);
  res.json(result);
});

router.get('/dashboard', async (req: Request, res: Response) => {
  const result = await consultantService.getConsultantDashboard(req.query.consultantId as string);
  res.json(result);
});

router.get('/:id/rating-history', async (req: Request, res: Response) => {
  const ratingService = (await import('../services/rating.service')).default;
  const history = await ratingService.getRatingHistory(req.params.id);
  res.json({ success: true, data: history });
});

export default router;
