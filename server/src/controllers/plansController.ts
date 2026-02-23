import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// Public: Get active plans for pricing page
export const getPlans = async (req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      where: {
        is_active: true
      },
      orderBy: {
        price: 'asc'
      }
    });
    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
};

// Admin: Get all plans (active and inactive)
export const getAllPlans = async (req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: {
        created_at: 'desc'
      }
    });
    res.json(plans);
  } catch (error) {
    console.error('Error fetching all plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
};

// Admin: Create a new plan
export const createPlan = async (req: Request, res: Response) => {
  try {
    const {
      name,
      tier,
      price,
      billing_cycle,
      split_account, // Paystack Split Code
      features,
      max_documents,
      max_chats_per_day,
      internet_search,
      ai_drafting,
      collaboration,
      legal_citation,
      case_summarizer,
      document_export,
      priority_support,
      advanced_analytics,
      is_active
    } = req.body;

    // Validation
    if (!name || !tier || price === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        tier,
        price,
        billing_cycle: billing_cycle || 'monthly',
        split_account,
        features: features || {},
        max_documents: max_documents || 10,
        max_chats_per_day: max_chats_per_day || 50,
        internet_search: internet_search || false,
        ai_drafting: ai_drafting || false,
        collaboration: collaboration || false,
        legal_citation: legal_citation || false,
        case_summarizer: case_summarizer || false,
        document_export: document_export || false,
        priority_support: priority_support || false,
        advanced_analytics: advanced_analytics || false,
        is_active: is_active !== undefined ? is_active : true
      }
    });

    res.status(201).json(plan);
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ error: 'Failed to create plan' });
  }
};

// Admin: Update an existing plan
export const updatePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    const {
      name,
      tier,
      price,
      billing_cycle,
      split_account,
      features,
      max_documents,
      max_chats_per_day,
      internet_search,
      ai_drafting,
      collaboration,
      legal_citation,
      case_summarizer,
      document_export,
      priority_support,
      advanced_analytics,
      is_active
    } = req.body;

    const plan = await prisma.plan.update({
      where: { id: String(id) },
      data: {
        name,
        tier,
        price,
        billing_cycle,
        split_account,
        features,
        max_documents,
        max_chats_per_day,
        internet_search,
        ai_drafting,
        collaboration,
        legal_citation,
        case_summarizer,
        document_export,
        priority_support,
        advanced_analytics,
        is_active
      }
    });

    res.json(plan);
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
};

// Admin: Delete (or deactivate) a plan
export const deletePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }
    
    // Check if plan has active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        plan_id: String(id),
        status: 'active'
      }
    });

    if (activeSubscriptions > 0) {
      // Soft delete (deactivate) if there are active subscriptions
      const plan = await prisma.plan.update({
        where: { id: String(id) },
        data: { is_active: false }
      });
      return res.json({ message: 'Plan deactivated (has active subscriptions)', plan });
    }

    // Hard delete if no active subscriptions
    await prisma.plan.delete({
      where: { id: String(id) }
    });

    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({ error: 'Failed to delete plan' });
  }
};
