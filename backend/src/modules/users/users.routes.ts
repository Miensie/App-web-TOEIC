import { Router } from 'express';
import { getProfile, updateProfile } from './users.controller';
import { authenticate } from '../../shared/middleware/authMiddleware';

const router = Router();
router.use(authenticate);
router.get('/me', getProfile);
router.patch('/me', updateProfile);
export default router;