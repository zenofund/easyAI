import express from 'express';
import multer from 'multer';
import { transcribeAudio } from '../controllers/transcribeController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Ensure uploads directory exists
import fs from 'fs';
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

router.post('/', authenticateUser, upload.single('audio'), transcribeAudio);

export default router;
