import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { 
  uploadDocument, 
  getDocuments, 
  deleteDocument,
  updateDocument,
  getDocumentUsage,
  getDocumentsCount,
  summarizeCase,
  generateBrief,
  getDocumentContent
} from '../controllers/documentsController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Document routes
router.post('/upload', authenticateUser, upload.single('file'), uploadDocument);
router.get('/', authenticateUser, getDocuments);
router.get('/count', authenticateUser, getDocumentsCount);
router.get('/:id/content', authenticateUser, getDocumentContent);
router.delete('/:id', authenticateUser, deleteDocument);
router.put('/:id', authenticateUser, updateDocument);
router.get('/usage', authenticateUser, getDocumentUsage);

// AI processing routes
router.post('/summarize', authenticateUser, summarizeCase);
router.post('/brief', authenticateUser, generateBrief);

export default router;
