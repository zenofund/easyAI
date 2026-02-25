import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';

export function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const { showSuccess, showError } = useToast();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  useEffect(() => {
    // Extract token from URL
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      showError('Error', 'Invalid or missing reset token');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      showError('Error', 'Invalid or missing reset token');
      return;
    }

    if (password.length < 6) {
      showError('Error', 'Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      showError('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      showSuccess('Success', 'Your password has been reset successfully');
      // Redirect to login
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (error: any) {
      showError('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Reset Password</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Enter your new password below
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New Password"
              className="pr-10"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm New Password"
            disabled={loading}
          />
        </div>

        <Button
          type="submit"
          loading={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-all shadow-md hover:shadow-lg"
        >
          Reset Password
        </Button>
      </form>
    </motion.div>
  );
}
