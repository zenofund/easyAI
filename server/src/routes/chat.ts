import express from 'express';
import { handleChat, regenerateChat, submitFeedback } from '../controllers/chatController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

router.use(authenticateUser);

router.post('/', handleChat);
router.post('/regenerate', regenerateChat);
router.post('/feedback', submitFeedback);

export default router;
