import { Router } from 'express';
import { createSession, getSession, saveProgress, submitSession } from './sessions.controller';
import { authenticate } from '../../shared/middleware/authMiddleware';

const router = Router();
router.use(authenticate);
router.post('/', createSession);
router.get('/:id', getSession);
router.patch('/:id/progress', saveProgress);
router.post('/:id/submit', submitSession);
export default router;