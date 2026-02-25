import React, { useEffect, useState } from 'react';
import { Bell, Info, AlertTriangle, XCircle, CheckCircle, Clock, Check, CheckCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { fetchWithAuth } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { Button } from '../ui/Button';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  created_at: string;
  read: boolean;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth('/notifications');
      setNotifications(data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetchWithAuth(`/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, read: true } : n
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetchWithAuth('/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getBgColor = (type: string, read: boolean) => {
    const baseColor = read ? 'opacity-60' : '';
    switch (type) {
      case 'info':
        return `bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 ${baseColor}`;
      case 'warning':
        return `bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800 ${baseColor}`;
      case 'error':
        return `bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 ${baseColor}`;
      case 'success':
        return `bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800 ${baseColor}`;
      default:
        return `bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 ${baseColor}`;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Notifications"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {unreadCount} unread
          </span>
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleMarkAllAsRead}
              className="text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all as read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            {error}
            <button 
              onClick={loadNotifications}
              className="block mx-auto mt-2 text-sm text-blue-600 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No new notifications</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border flex items-start space-x-3 transition-all ${getBgColor(notification.type, notification.read)}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className={`text-sm font-medium ${notification.read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                      {notification.title}
                    </h4>
                    {!notification.read && (
                      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5 ml-2"></span>
                    )}
                  </div>
                  <p className={`text-sm mt-1 ${notification.read ? 'text-gray-500 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                    {notification.message}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center text-xs text-gray-400 dark:text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDate(notification.created_at)}
                    </div>
                    {!notification.read && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
