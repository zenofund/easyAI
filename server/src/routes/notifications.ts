import express from 'express';
import { getUserNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateUser, getUserNotifications);
router.post('/:id/read', authenticateUser, markAsRead);
router.post('/read-all', authenticateUser, markAllAsRead);

export default router;
