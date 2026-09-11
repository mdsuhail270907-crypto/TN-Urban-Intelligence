import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getPredictionHistoryHandler, predictBusHandler } from '../controllers/prediction.controller';

const router = Router();

router.use(authenticate);

router.post('/bus/:busId', requireRole('ADMIN', 'AUTHORITY', 'ANALYST', 'OPERATOR'), predictBusHandler);
router.get('/bus/:busId/history', requireRole('ADMIN', 'AUTHORITY', 'ANALYST', 'OPERATOR'), getPredictionHistoryHandler);

export default router;
