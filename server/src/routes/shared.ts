import express from 'express';
import { getSharedSession } from '../controllers/sessionController';

const router = express.Router();

router.get('/:shareToken', getSharedSession);

export default router;
