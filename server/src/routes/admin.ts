
import express from 'express';
import { 
  getStats, 
  getRecentActivity, 
  getAllSubscriptions, 
  getNotifications, 
  createNotification, 
  updateNotification, 
  deleteNotification,
  getSmtpConfig,
  updateSmtpConfig,
  sendTestEmail
} from '../controllers/adminController';
import { authenticateUser, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Apply auth and admin check to all admin routes
router.use(authenticateUser);
router.use(requireAdmin);

router.get('/stats', getStats);
router.get('/activity', getRecentActivity);
router.get('/subscriptions', getAllSubscriptions);
router.get('/notifications', getNotifications);
router.post('/notifications', createNotification);
router.put('/notifications/:id', updateNotification);
router.delete('/notifications/:id', deleteNotification);

router.get('/smtp', getSmtpConfig);
router.put('/smtp', updateSmtpConfig);
router.post('/smtp/test', sendTestEmail);

export default router;
