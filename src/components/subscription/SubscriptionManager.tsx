import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, CreditCard, AlertCircle, Sparkles, X, FileText, MessageSquare, Globe, Edit, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { formatCurrency } from '../../lib/utils';
import type { Plan } from '../../types/database';
import { fetchWithAuth } from '../../lib/api';

interface SubscriptionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'default' | 'limitReached' | 'featureUnlock';
  currentUsage?: number;
  maxLimit?: number;
}

export function SubscriptionManager({ 
  isOpen, 
  onClose,
  mode = 'default',
  currentUsage,
  maxLimit
}: SubscriptionManagerProps) {
  const { profile, refreshProfile } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const { showSuccess, showError, showInfo } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadPlans();
      // Refresh profile when modal opens to get latest subscription data
      refreshProfile();
    }
  }, [isOpen]);

  const loadPlans = async () => {
    try {
      // Add timestamp to prevent caching
      const data = await fetchWithAuth(`/plans?t=${new Date().getTime()}`);
      if (Array.isArray(data)) {
        setPlans(data);
      } else {
        console.error('Invalid plans data received:', data);
        setPlans([]);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
      showError('Error', 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan: Plan) => {
    if (!profile) return;

    setUpgrading(true);
    setSelectedPlan(plan);
    showInfo('Processing Payment', 'Redirecting you to secure payment page...');

    try {
      // Initialize Paystack payment
      // Convert amount from Naira to Kobo (Paystack expects amounts in kobo: 1 Naira = 100 Kobo)
      const amountInKobo = Number(plan.price) * 100;

      const paymentData = await fetchWithAuth('/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: plan.id,
          amount: amountInKobo,
          email: profile.email,
          callback_url: `${window.location.origin}/dashboard?payment=success`
        })
      });

      // Redirect to Paystack payment page
      if (paymentData.authorization_url) {
        window.location.href = paymentData.authorization_url;
      } else {
        throw new Error('No authorization URL received');
      }

    } catch (error) {
      console.error('Error upgrading subscription:', error);
      showError('Payment Failed', 'Failed to process payment. Please try again or contact support if the issue persists.');
    } finally {
      setUpgrading(false);
      setSelectedPlan(null);
    }
  };

  const currentPlan = profile?.subscription?.plan;

  const getHeaderContent = () => {
    if (mode === 'limitReached') {
      return (
        <div className="text-center mb-8 pt-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-amber-100">
            <AlertCircle className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            Daily Chat Limit Reached
          </h2>
          <p className="text-gray-600 max-w-lg mx-auto text-lg">
            You've used <span className="font-semibold text-gray-900">{currentUsage} of {maxLimit}</span> chats today.
            Upgrade now to continue your legal research without interruption.
          </p>
        </div>
      );
    }

    if (mode === 'featureUnlock') {
      return (
        <div className="text-center mb-8 pt-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            Unlock Professional Power
          </h2>
          <p className="text-gray-600 max-w-lg mx-auto text-lg">
            Get access to real-time Web Search, AI Case Summaries, and advanced legal tools with our Pro plan.
          </p>
        </div>
      );
    }

    return null; // Default header is handled by Modal title
  };

  const isModalMode = mode !== 'default';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isModalMode ? undefined : "Subscription Plans"}
      maxWidth="6xl"
    >
      <div className={isModalMode ? "relative p-2" : "space-y-6"}>
        {isModalMode && (
           <button
             onClick={onClose}
             className="absolute -top-2 -right-2 p-2 bg-white rounded-full shadow-md text-gray-400 hover:text-gray-600 transition-colors z-10"
           >
             <X className="h-5 w-5" />
           </button>
        )}

        {getHeaderContent()}

        {/* Current Plan Status - Only show in default mode */}
        {!isModalMode && currentPlan && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Current Plan: {currentPlan.name}
                </p>
                <p className="text-xs text-blue-700">
                  {currentPlan.tier === 'free' 
                    ? 'No billing required' 
                    : `${formatCurrency(currentPlan.price)} per ${currentPlan.billing_cycle}`
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className={`grid md:grid-cols-3 gap-4 mb-6 ${isModalMode ? 'px-2' : ''}`}>
          {loading ? (
            [...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                    <div className="space-y-2">
                      {[...Array(4)].map((_, j) => (
                        <div key={j} className="h-4 bg-gray-200 rounded"></div>
                      ))}
                    </div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            plans
              .map((plan) => {
                const isCurrentPlan = currentPlan?.id === plan.id;
                // const features = getPlanFeatures(plan); // We will use custom rendering based on Admin card style
                const isRecommended = plan.tier === 'pro';

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`relative overflow-hidden rounded-xl border transition-all duration-200 flex flex-col ${
                      isRecommended
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-lg scale-100 md:scale-105 z-10'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {isRecommended && (
                      <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">
                        POPULAR
                      </div>
                    )}

                    <div className="p-6 flex-grow">
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
                          <span>{plan.max_documents === -1 ? 'Unlimited' : plan.max_documents} Documents</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <MessageSquare className="h-4 w-4 mr-2 text-green-500" />
                          <span>{plan.max_chats_per_day === -1 ? 'Unlimited' : plan.max_chats_per_day} Chats/day</span>
                        </div>
                        <div className={`flex items-center text-sm ${plan.internet_search ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                          <Globe className="h-4 w-4 mr-2" />
                          <span className={!plan.internet_search ? 'line-through' : ''}>Internet Search</span>
                        </div>
                        <div className={`flex items-center text-sm ${plan.ai_drafting ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                          <Edit className="h-4 w-4 mr-2" />
                          <span className={!plan.ai_drafting ? 'line-through' : ''}>AI Drafting</span>
                        </div>
                        
                        {/* Additional Features */}
                        {plan.collaboration && (
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                            <Users className="h-4 w-4 mr-2 text-purple-500" />
                            <span>Collaboration</span>
                          </div>
                        )}
                        {plan.legal_citation && (
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                            <Shield className="h-4 w-4 mr-2 text-indigo-500" />
                            <span>Legal Citation</span>
                          </div>
                        )}
                        {plan.case_summarizer && (
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                            <Sparkles className="h-4 w-4 mr-2 text-yellow-500" />
                            <span>Case Summarizer</span>
                          </div>
                        )}
                        {plan.document_export && (
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                            <FileText className="h-4 w-4 mr-2 text-gray-500" />
                            <span>Document Export</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-6 pb-6 mt-auto">
                      {isCurrentPlan ? (
                        <Button disabled className="w-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-0">
                          Current Plan
                        </Button>
                      ) : plan.tier === 'free' ? (
                        <Button variant="outline" disabled className="w-full">
                          Downgrade Available
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleUpgrade(plan)}
                          loading={upgrading && selectedPlan?.id === plan.id}
                          className={`w-full py-2 font-semibold shadow-sm transition-all ${
                            isRecommended 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                              : ''
                          }`}
                          variant={isRecommended ? 'primary' : 'outline'}
                        >
                          {currentPlan?.tier === 'free' ? `Upgrade to ${plan.name}` : 'Switch Plan'}
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })
          )}
        </div>

        {/* Payment Security Notice */}
        <div className={isModalMode ? "text-center pb-4" : "bg-gray-50 border border-gray-200 rounded-lg p-4"}>
          {isModalMode ? (
            <p className="text-sm text-gray-500">
              Secure payment • Cancel anytime • 24/7 Support
            </p>
          ) : (
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="text-sm text-gray-600">
                <p className="font-medium mb-1">Secure Payment Processing</p>
                <p>
                  All payments are processed securely through Paystack. Your payment information 
                  is encrypted and never stored on our servers. You can cancel or modify your 
                  subscription at any time.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* FAQ Section - Only show in default mode */}
        {!isModalMode && (
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Frequently Asked Questions</h4>
            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <p className="font-medium text-gray-900 dark:text-gray-200">Can I change my plan anytime?</p>
                <p className="text-gray-600 dark:text-gray-400">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-gray-900 dark:text-gray-200">What happens to my data if I downgrade?</p>
                <p className="text-gray-600 dark:text-gray-400">Your data remains safe. However, some features may become unavailable based on your new plan limits.</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-gray-900 dark:text-gray-200">Do you offer refunds?</p>
                <p className="text-gray-600 dark:text-gray-400">We offer a 30-day money-back guarantee for all paid plans. Contact support for assistance.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}