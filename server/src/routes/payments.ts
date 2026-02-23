import express from 'express';
import { initializePayment, verifyPayment } from '../controllers/paymentsController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

router.post('/initialize', authenticateUser, initializePayment);
router.post('/verify', authenticateUser, verifyPayment);

export default router;
