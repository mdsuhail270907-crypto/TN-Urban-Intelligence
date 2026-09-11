import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  analyzeBusHandler,
  batchAnalyzeBusesHandler,
  getAIAnalysisHistoryHandler,
  getLatestAIAnalysisHandler
} from '../controllers/ai.controller';
import { predictBusHandler, getPredictionHistoryHandler } from '../controllers/prediction.controller';
import { getUrbanSummaryHandler } from '../controllers/urban.controller';

const router = Router();

router.use(authenticate);

router.post('/analyze/:busId', requireRole('ADMIN', 'AUTHORITY', 'ANALYST'), analyzeBusHandler);
router.get('/bus/:busId', requireRole('ADMIN', 'AUTHORITY', 'ANALYST', 'OPERATOR'), getLatestAIAnalysisHandler);
router.get('/bus/:busId/history', requireRole('ADMIN', 'AUTHORITY', 'ANALYST', 'OPERATOR'), getAIAnalysisHistoryHandler);
router.post('/batch-analyze', requireRole('ADMIN', 'AUTHORITY', 'ANALYST'), batchAnalyzeBusesHandler);
router.post('/predict/:busId', requireRole('ADMIN', 'AUTHORITY', 'ANALYST', 'OPERATOR'), predictBusHandler);
router.get('/predict/:busId/history', requireRole('ADMIN', 'AUTHORITY', 'ANALYST', 'OPERATOR'), getPredictionHistoryHandler);
router.get('/urban/summary', requireRole('ADMIN', 'AUTHORITY', 'ANALYST', 'OPERATOR'), getUrbanSummaryHandler);

export default router;
