import express from 'express';
import { getPlans, getAllPlans, createPlan, updatePlan, deletePlan } from '../controllers/plansController';
import { authenticateUser, requireAdmin, requireSuperAdmin } from '../middleware/auth';

const router = express.Router();

// Public route for pricing page
router.get('/', getPlans);

// Admin routes
router.get('/all', authenticateUser, requireAdmin, getAllPlans);

// Super Admin routes for managing plans
router.post('/', authenticateUser, requireSuperAdmin, createPlan);
router.put('/:id', authenticateUser, requireSuperAdmin, updatePlan);
router.delete('/:id', authenticateUser, requireSuperAdmin, deletePlan);

export default router;
