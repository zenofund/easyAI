import express from 'express';
import { getUsers, deleteUser, updateUser } from '../controllers/usersController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateUser, getUsers);
router.put('/:id', authenticateUser, updateUser);
router.delete('/:id', authenticateUser, deleteUser);

export default router;
