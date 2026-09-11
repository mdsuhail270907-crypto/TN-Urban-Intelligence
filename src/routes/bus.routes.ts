import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  createBusHandler,
  listBusesHandler,
  getBusHandler,
  updateBusHandler,
  deleteBusHandler,
  assignRouteHandler,
  removeRouteHandler
} from '../controllers/bus.controller';

const router = Router();

router.use(authenticate);

router.post('/', requireRole('ADMIN', 'AUTHORITY'), createBusHandler);
router.get('/', requireRole('ADMIN', 'AUTHORITY', 'OPERATOR', 'ANALYST'), listBusesHandler);
router.get('/:id', requireRole('ADMIN', 'AUTHORITY', 'OPERATOR', 'ANALYST'), getBusHandler);
router.patch('/:id', requireRole('ADMIN', 'AUTHORITY', 'OPERATOR'), updateBusHandler);
router.delete('/:id', requireRole('ADMIN', 'AUTHORITY'), deleteBusHandler);
router.patch('/:busId/route', requireRole('ADMIN', 'AUTHORITY'), assignRouteHandler);
router.delete('/:busId/route', requireRole('ADMIN', 'AUTHORITY'), removeRouteHandler);

export default router;
