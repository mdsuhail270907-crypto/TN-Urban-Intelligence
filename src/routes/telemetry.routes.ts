import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getBusLatestTelemetryHandler, getBusTelemetryHandler, submitTelemetryHandler } from '../controllers/telemetry.controller';
import { telemetryRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(authenticate);

router.post('/', requireRole('ADMIN', 'AUTHORITY', 'OPERATOR', 'DEVICE'), telemetryRateLimiter, submitTelemetryHandler);
router.get('/bus/:busId', requireRole('ADMIN', 'AUTHORITY', 'OPERATOR', 'ANALYST'), getBusTelemetryHandler);
router.get('/bus/:busId/latest', requireRole('ADMIN', 'AUTHORITY', 'OPERATOR', 'ANALYST'), getBusLatestTelemetryHandler);

export default router;
