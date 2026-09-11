import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  acknowledgeAlertHandler,
  evaluateAlertsHandler,
  getAlertHandler,
  listAlertsHandler,
  resolveAlertHandler
} from '../controllers/alert.controller';

const router = Router();

router.use(authenticate);

router.post('/bus/:busId/evaluate', requireRole('ADMIN', 'AUTHORITY', 'ANALYST', 'OPERATOR'), evaluateAlertsHandler);
router.get('/', requireRole('ADMIN', 'AUTHORITY', 'ANALYST', 'OPERATOR'), listAlertsHandler);
router.get('/:id', requireRole('ADMIN', 'AUTHORITY', 'ANALYST', 'OPERATOR'), getAlertHandler);
router.patch('/:id/acknowledge', requireRole('ADMIN', 'AUTHORITY', 'ANALYST', 'OPERATOR'), acknowledgeAlertHandler);
router.patch('/:id/resolve', requireRole('ADMIN', 'AUTHORITY', 'ANALYST', 'OPERATOR'), resolveAlertHandler);

export default router;
