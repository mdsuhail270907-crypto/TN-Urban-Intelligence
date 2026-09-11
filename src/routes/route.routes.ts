import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { createRouteHandler, listRoutesHandler, getRouteHandler, updateRouteHandler, deleteRouteHandler } from '../controllers/route.controller';

const router = Router();

router.use(authenticate);

router.post('/', requireRole('ADMIN', 'AUTHORITY'), createRouteHandler);
router.get('/', requireRole('ADMIN', 'AUTHORITY', 'OPERATOR', 'ANALYST'), listRoutesHandler);
router.get('/:id', requireRole('ADMIN', 'AUTHORITY', 'OPERATOR', 'ANALYST'), getRouteHandler);
router.patch('/:id', requireRole('ADMIN', 'AUTHORITY'), updateRouteHandler);
router.delete('/:id', requireRole('ADMIN', 'AUTHORITY'), deleteRouteHandler);

export default router;
