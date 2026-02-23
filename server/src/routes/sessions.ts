import express from 'express';
import { 
  createSession, 
  getSessions, 
  getSessionMessages, 
  shareSession,
  updateSession,
  deleteSession
} from '../controllers/sessionController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

router.use(authenticateUser);

router.post('/', createSession);
router.get('/', getSessions);
router.get('/:id/messages', getSessionMessages);
router.patch('/:id', updateSession);
router.delete('/:id', deleteSession);
router.post('/:id/share', shareSession);

export default router;
