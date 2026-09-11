import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getUrbanSummaryHandler } from '../controllers/urban.controller';

const router = Router();

router.use(authenticate);

router.get('/summary', requireRole('ADMIN', 'AUTHORITY', 'ANALYST', 'OPERATOR'), getUrbanSummaryHandler);

export default router;
