import express from 'express';
import { register, login, getMe, updateMe, changePassword, forgotPassword, resetPassword } from '../controllers/authController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticateUser, getMe);
router.put('/me', authenticateUser, updateMe);
router.post('/change-password', authenticateUser, changePassword);

export default router;
