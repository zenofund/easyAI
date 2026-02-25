import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Check, X, Shield, Search, Globe, FileText, MessageSquare, DollarSign } from 'lucide-react';
import { fetchWithAuth } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { PlanEditModal } from './PlanEditModal';
import { useAuth } from '../../hooks/useAuth';

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
  is_active: boolean;
  created_at: string;
}

export function PlansTab() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const data = await fetchWithAuth('/plans/all');
      setPlans(data);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = () => {
    setSelectedPlan(null);
    setShowEditModal(true);
  };

  const handleEditPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowEditModal(true);
  };

  const handleToggleActive = async (plan: Plan) => {
    if (!profile || profile.role !== 'super_admin') {
      alert('Only Super Admin can modify plans.');
      return;
    }

    if (!confirm(`Are you sure you want to ${plan.is_active ? 'deactivate' : 'activate'} this plan?`)) {
      return;
    }

    try {
      await fetchWithAuth(`/plans/${plan.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...plan, is_active: !plan.is_active })
      });
      loadPlans();
    } catch (error) {
      console.error('Error updating plan status:', error);
      alert('Failed to update plan status');
    }
  };

  const handleUpdateSuccess = () => {
    loadPlans();
    setShowEditModal(false);
    setSelectedPlan(null);
  };

  const isSuperAdmin = profile?.role === 'super_admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Subscription Plans</h2>
        {isSuperAdmin && (
          <Button onClick={handleCreatePlan} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Create Plan
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 space-y-4">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          plans.map((plan) => (
            <Card key={plan.id} className={`relative overflow-hidden ${!plan.is_active ? 'opacity-75' : ''}`}>
              {!plan.is_active && (
                <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">
                  INACTIVE
                </div>
              )}
              {plan.tier === 'pro' && plan.is_active && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">
                  POPULAR
                </div>
              )}
              
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{plan.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{plan.tier} Tier</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {plan.price === 0 ? 'Free' : formatCurrency(plan.price)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">/{plan.billing_cycle}</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <FileText className="h-4 w-4 mr-2 text-blue-500" />
                    <span>{plan.max_documents} Documents</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <MessageSquare className="h-4 w-4 mr-2 text-green-500" />
                    <span>{plan.max_chats_per_day} Chats/day</span>
                  </div>
                  <div className={`flex items-center text-sm ${plan.internet_search ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                    <Globe className="h-4 w-4 mr-2" />
                    <span className={!plan.internet_search ? 'line-through' : ''}>Internet Search</span>
                  </div>
                  <div className={`flex items-center text-sm ${plan.ai_drafting ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                    <Edit className="h-4 w-4 mr-2" />
                    <span className={!plan.ai_drafting ? 'line-through' : ''}>AI Drafting</span>
                  </div>
                  
                  {isSuperAdmin && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-xs font-semibold text-gray-500 mb-1">Paystack Split Code</p>
                      <div className="flex items-center text-sm font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded">
                        <DollarSign className="h-3 w-3 mr-2 text-gray-400" />
                        {plan.split_account || <span className="text-gray-400 italic">None configured</span>}
                      </div>
                    </div>
                  )}
                </div>

                {isSuperAdmin && (
                  <div className="flex items-center space-x-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleEditPlan(plan)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button 
                      variant={plan.is_active ? "ghost" : "outline"} 
                      size="sm"
                      className={`flex-1 ${plan.is_active ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}`}
                      onClick={() => handleToggleActive(plan)}
                    >
                      {plan.is_active ? (
                        <>
                          <X className="h-4 w-4 mr-2" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Activate
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <PlanEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        plan={selectedPlan}
        onSuccess={handleUpdateSuccess}
      />
    </div>
  );
}
