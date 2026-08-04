import { Router } from 'express';
import multer from 'multer';
import {
  createTest, updateTestStatus, deleteTest, importTest,
  getAllTests, getFullTest, createPart, updatePart,
  createQuestion, updateQuestion, importFromPdfs,
} from './admin.controller';
import { authenticate, requireAdmin } from '../../shared/middleware/authMiddleware';

const router = Router();
router.use(authenticate, requireAdmin);

// Tests
router.get('/tests/all', getAllTests);
router.get('/tests/:id/full', getFullTest);
router.post('/tests', createTest);
router.post('/tests/import', importTest);
router.patch('/tests/:id/status', updateTestStatus);
router.delete('/tests/:id', deleteTest);

// Parties et questions
router.post('/parts', createPart);
router.patch('/parts/:id', updatePart);
router.post('/questions', createQuestion);
router.put('/questions/:id', updateQuestion);

// Import IA depuis PDFs
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
router.post('/tests/import-pdf', upload.fields([
  { name: 'listening', maxCount: 1 },
  { name: 'reading', maxCount: 1 },
  { name: 'answers', maxCount: 1 },
]), importFromPdfs);

export default router;