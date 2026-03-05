import express from 'express';
import { getTemplates, generateDraft } from '../controllers/draftingController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

router.get('/templates', authenticateUser, getTemplates);
router.post('/generate', authenticateUser, generateDraft);

export default router;
