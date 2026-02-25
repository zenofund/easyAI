import React, { useState, useEffect } from 'react';
import { Save, Send, Eye, EyeOff, Mail } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { fetchWithAuth } from '../../lib/api';
import { useToast } from '../ui/Toast';

export function SettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { showSuccess, showError } = useToast();

  const [config, setConfig] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_secure: false,
    smtp_from: ''
  });

  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await fetchWithAuth('/admin/smtp');
      if (data && Object.keys(data).length > 0) {
        setConfig(prev => ({
          ...prev,
          ...data,
          smtp_port: data.smtp_port?.toString() || '587'
        }));
      }
    } catch (error) {
      console.error('Error loading SMTP config:', error);
      showError('Error', 'Failed to load SMTP configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchWithAuth('/admin/smtp', {
        method: 'PUT',
        body: JSON.stringify(config)
      });
      showSuccess('Success', 'SMTP configuration saved successfully');
    } catch (error) {
      console.error('Error saving SMTP config:', error);
      showError('Error', 'Failed to save SMTP configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      showError('Error', 'Please enter a test email address');
      return;
    }

    setTesting(true);
    try {
      await fetchWithAuth('/admin/smtp/test', {
        method: 'POST',
        body: JSON.stringify({
          to: testEmail,
          config // Send current form config to test before saving
        })
      });
      showSuccess('Success', 'Test email sent successfully');
    } catch (error) {
      console.error('Error sending test email:', error);
      showError('Error', 'Failed to send test email. Check your configuration.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Mail className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">SMTP Configuration</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure your email server settings for system notifications.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="SMTP Host"
              name="smtp_host"
              value={config.smtp_host}
              onChange={handleChange}
              placeholder="smtp.example.com"
            />

            <Input
              label="SMTP Port"
              name="smtp_port"
              value={config.smtp_port}
              onChange={handleChange}
              placeholder="587"
              type="number"
            />

            <Input
              label="Username"
              name="smtp_user"
              value={config.smtp_user}
              onChange={handleChange}
              placeholder="user@example.com"
            />

            <div className="relative">
              <Input
                label="Password"
                name="smtp_pass"
                type={showPassword ? 'text' : 'password'}
                value={config.smtp_pass}
                onChange={handleChange}
                placeholder="********"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Input
              label="From Email"
              name="smtp_from"
              value={config.smtp_from}
              onChange={handleChange}
              placeholder="noreply@example.com"
            />

            <div className="flex items-center space-x-2 h-full pt-8">
              <input
                type="checkbox"
                id="smtp_secure"
                name="smtp_secure"
                checked={config.smtp_secure}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="smtp_secure" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                Use Secure Connection (SSL/TLS)
              </label>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Send className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Test Configuration</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Send a test email to verify your settings.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <Input
                label="Test Email Address"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your@email.com"
                type="email"
              />
            </div>
            <div className="pb-1">
              <Button
                onClick={handleTest}
                disabled={testing || !testEmail}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Send className="h-4 w-4" />
                <span>{testing ? 'Sending...' : 'Send Test Email'}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
