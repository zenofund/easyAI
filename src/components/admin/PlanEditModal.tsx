import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { fetchWithAuth } from '../../lib/api';

interface Plan {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
  price: number;
  billing_cycle: 'monthly' | 'yearly';
  split_account: string | null;
  features: Record<string, any>;
  max_documents: number;
  max_chats_per_day: number;
  internet_search: boolean;
  ai_drafting: boolean;
  collaboration: boolean;
  legal_citation: boolean;
  case_summarizer: boolean;
  document_export: boolean;
  priority_support: boolean;
  advanced_analytics: boolean;
  is_active: boolean;
  created_at: string;
}

interface PlanEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan | null;
  onSuccess: () => void;
}

export function PlanEditModal({ isOpen, onClose, plan, onSuccess }: PlanEditModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    tier: 'free',
    price: 0,
    billing_cycle: 'monthly',
    split_account: '',
    max_documents: 10,
    max_chats_per_day: 50,
    internet_search: false,
    ai_drafting: false,
    collaboration: false,
    legal_citation: false,
    case_summarizer: false,
    document_export: false,
    priority_support: false,
    advanced_analytics: false,
    is_active: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name,
        tier: plan.tier,
        price: Number(plan.price),
        billing_cycle: plan.billing_cycle,
        split_account: plan.split_account || '',
        max_documents: plan.max_documents,
        max_chats_per_day: plan.max_chats_per_day,
        internet_search: plan.internet_search,
        ai_drafting: plan.ai_drafting,
        collaboration: plan.collaboration,
        legal_citation: plan.legal_citation || false,
        case_summarizer: plan.case_summarizer || false,
        document_export: plan.document_export || false,
        priority_support: plan.priority_support || false,
        advanced_analytics: plan.advanced_analytics || false,
        is_active: plan.is_active
      });
    } else {
      // Reset for create mode
      setFormData({
        name: '',
        tier: 'free',
        price: 0,
        billing_cycle: 'monthly',
        split_account: '',
        max_documents: 10,
        max_chats_per_day: 50,
        internet_search: false,
        ai_drafting: false,
        collaboration: false,
        legal_citation: false,
        case_summarizer: false,
        document_export: false,
        priority_support: false,
        advanced_analytics: false,
        is_active: true
      });
    }
  }, [plan, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: Number(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = plan ? `/plans/${plan.id}` : '/plans';
      const method = plan ? 'PUT' : 'POST';

      // Ensure empty string for split_account is sent as null or preserved if backend handles it
      // Prisma schema says String? so we can send null if empty
      const payload = {
        ...formData,
        split_account: formData.split_account.trim() || null
      };

      await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload)
      });

      onSuccess();
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('Failed to save plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={plan ? 'Edit Plan' : 'Create New Plan'}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Plan Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Basic Plan"
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tier</label>
            <select
              name="tier"
              value={formData.tier}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <Input
            label="Price"
            name="price"
            type="number"
            value={formData.price}
            onChange={handleChange}
            min={0}
            step="0.01"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Billing Cycle</label>
            <select
              name="billing_cycle"
              value={formData.billing_cycle}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <Input
              label="Paystack Split Code (Subaccount)"
              name="split_account"
              value={formData.split_account}
              onChange={handleChange}
              placeholder="e.g. SPL_xxxxxxxx"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the Paystack Split Code to automatically split payments for this plan. Leave empty if not applicable.
            </p>
          </div>

          <Input
            label="Max Documents (-1 for unlimited)"
            name="max_documents"
            type="number"
            value={formData.max_documents}
            onChange={handleChange}
            min={-1}
          />

          <Input
            label="Max Chats Per Day (-1 for unlimited)"
            name="max_chats_per_day"
            type="number"
            value={formData.max_chats_per_day}
            onChange={handleChange}
            min={-1}
          />
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Feature Flags</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="internet_search"
                checked={formData.internet_search}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable Internet Search</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="ai_drafting"
                checked={formData.ai_drafting}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable AI Drafting</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="collaboration"
                checked={formData.collaboration}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable Collaboration</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="legal_citation"
                checked={formData.legal_citation}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable Legal Citation</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="case_summarizer"
                checked={formData.case_summarizer}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable Case Summarizer</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="document_export"
                checked={formData.document_export}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable Document Export</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="priority_support"
                checked={formData.priority_support}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable Priority Support</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="advanced_analytics"
                checked={formData.advanced_analytics}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable Advanced Analytics</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Plan is Active</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} type="button" disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : plan ? 'Update Plan' : 'Create Plan'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
