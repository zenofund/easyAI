import express from 'express';
import { updateSubscription } from '../controllers/subscriptionsController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

router.patch('/:id', authenticateUser, updateSubscription);

export default router;
