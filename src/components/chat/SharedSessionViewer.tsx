import React, { useEffect, useState } from 'react';
import { MessageSquare, Calendar, User, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { formatDate } from '../../lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SharedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string; // mapped from 'message' in API response
  created_at: string;
  sources?: any[];
}

interface SharedSessionData {
  session: {
    title: string;
    created_at: string;
    user: {
      name: string;
    };
  };
  messages: SharedMessage[];
}

export function SharedSessionViewer() {
  const [data, setData] = useState<SharedSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSharedSession = async () => {
      try {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const token = pathParts[pathParts.length - 1];
        
        if (!token) {
          throw new Error('Invalid share link');
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
        const response = await fetch(`${apiUrl}/shared/${token}`);
        
        if (!response.ok) {
          if (response.status === 404) throw new Error('Shared session not found or inactive');
          if (response.status === 410) throw new Error('Shared link has expired');
          throw new Error('Failed to load shared session');
        }

        const jsonData = await response.json();
        
        // Transform API response to match interface
        const messages = jsonData.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.message,
          created_at: msg.created_at,
          sources: msg.sources
        }));

        setData({
          session: {
            title: jsonData.title,
            created_at: jsonData.created_at,
            user: {
              name: jsonData.shared_by
            }
          },
          messages
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadSharedSession();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Conversation</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => window.location.href = '/'}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/'}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{data.session.title}</h1>
              <div className="flex items-center text-sm text-gray-500 space-x-4">
                <span className="flex items-center">
                  <User className="w-3 h-3 mr-1" />
                  {data.session.user.name}
                </span>
                <span className="flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  {formatDate(data.session.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {data.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                <div className="prose dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold mb-2 opacity-70">Sources:</p>
                    <div className="space-y-1">
                      {message.sources.map((source: any, idx: number) => (
                        <div key={idx} className="text-xs opacity-70 truncate">
                          • {source.title || source.name || 'Unknown Source'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
