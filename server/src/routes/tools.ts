import express from 'express';
import { generateCitation } from '../controllers/toolsController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

router.use(authenticateUser);

router.post('/citation', generateCitation);

export default router;
