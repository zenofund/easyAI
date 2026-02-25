import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { validateEmail } from '../../lib/utils';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { showSuccess, showError } = useToast();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      showError('Error', 'Email is required');
      return;
    }

    if (!validateEmail(email)) {
      showError('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset link');
      }

      setSubmitted(true);
      showSuccess('Success', data.message || 'If an account exists, a reset link has been sent.');
    } catch (error: any) {
      showError('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        <div className="mb-6 bg-green-50 p-6 rounded-lg border border-green-100">
          <Mail className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
          <p className="text-gray-600 mb-4">
            We've sent a password reset link to <strong>{email}</strong>.
          </p>
          <p className="text-sm text-gray-500">
            Please check your spam folder if you don't see it.
          </p>
        </div>
        <Button variant="outline" onClick={onBackToLogin} className="w-full">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Login
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Forgot Password</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Enter your email to receive a password reset link
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="pr-10"
            disabled={loading}
          />
        </div>

        <Button
          type="submit"
          loading={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-all shadow-md hover:shadow-lg"
        >
          Send Reset Link
        </Button>

        <div className="text-center mt-4">
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-sm text-gray-600 hover:text-blue-600 flex items-center justify-center mx-auto transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Login
          </button>
        </div>
      </form>
    </motion.div>
  );
}
