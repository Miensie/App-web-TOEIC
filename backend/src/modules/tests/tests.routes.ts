import { Router } from 'express';
import { getPublishedTests, getTestById } from './tests.controller';
import { authenticate } from '../../shared/middleware/authMiddleware';

const router = Router();
router.use(authenticate);
router.get('/', getPublishedTests);
router.get('/:id', getTestById);
export default router;