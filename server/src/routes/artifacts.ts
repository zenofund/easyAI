import express from 'express';
import { getArtifacts, getArtifact, deleteArtifact } from '../controllers/artifactsController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

router.use(authenticateUser);

router.get('/', getArtifacts);
router.get('/:id', getArtifact);
router.delete('/:id', deleteArtifact);

export default router;
