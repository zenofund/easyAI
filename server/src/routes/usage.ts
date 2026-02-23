import express from 'express';
import { getUsage } from '../controllers/usageController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

router.use(authenticateUser);

router.get('/', getUsage);

export default router;
