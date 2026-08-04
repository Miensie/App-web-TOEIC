import { Router } from 'express';
import { syncProfile } from './auth.controller';

const router = Router();
router.post('/sync', syncProfile);
export default router;