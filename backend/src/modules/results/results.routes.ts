import { Router } from 'express';
import { getResultById, getUserResults } from './results.controller';
import { authenticate } from '../../shared/middleware/authMiddleware';

const router = Router();
router.use(authenticate);
router.get('/', getUserResults);
router.get('/:id', getResultById);
export default router;