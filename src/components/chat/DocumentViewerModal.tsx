import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Loader2, Copy, Check, FileText, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchWithAuth } from '../../lib/api';
import type { DocumentSource } from '../../types/database';
import { Button } from '../ui/Button';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: DocumentSource | null;
}

export function DocumentViewerModal({ isOpen, onClose, source }: DocumentViewerModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && source) {
      // Check for web search results or external sources
      const isWebSource = 
        source.id?.startsWith('web-doc-') || 
        source.id?.startsWith('web-search-') || 
        source.metadata?.source === 'web_search';

      if (source.id && !isWebSource) {
        // Internal document
        fetchContent(source.id);
      } else if (source.metadata?.url) {
        // External source
        setContent(null); // Will use iframe
      } else {
        // Fallback for text-only sources without ID or URL
        setContent(source.excerpt || "No content available.");
      }
    } else {
      setContent(null);
      setError(null);
    }
  }, [isOpen, source]);

  const fetchContent = async (id: string) => {
    // Double check if it's a UUID to avoid server errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.warn('Invalid UUID provided to fetchContent:', id);
      // Fallback to iframe or excerpt if not a valid UUID
      setContent(null); 
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth(`/documents/${id}/content`);
      setContent(data.content);
    } catch (err) {
      console.error('Error fetching document:', err);
      setError('Failed to load document content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const HighlightedContent = ({ content, highlight }: { content: string, highlight: string }) => {
    if (!content) return null;
    
    // If no highlight or highlight not found, return markdown
    if (!highlight || !content.includes(highlight)) {
        return <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose max-w-none dark:prose-invert">{content}</ReactMarkdown>;
    }

    // Split by highlight and wrap
    const parts = content.split(highlight);
    return (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
        {parts.map((part, i) => (
            <React.Fragment key={i}>
            {part}
            {i < parts.length - 1 && (
                <span style={{ backgroundColor: '#7EACB5', color: 'white', padding: '2px 4px', borderRadius: '4px', fontWeight: 'bold' }}>
                {highlight}
                </span>
            )}
            </React.Fragment>
        ))}
        </div>
    );
  };

  if (!isOpen) return null;

  const isExternal = !!source?.metadata?.url;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0">
                   {isExternal ? (
                     <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                   ) : (
                     <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                   )}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate" title={source?.title}>
                    {source?.title || 'Document Viewer'}
                  </h3>
                  {isExternal && (
                    <a 
                      href={source?.metadata?.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline truncate flex items-center gap-1"
                    >
                      {source?.metadata?.url}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!isExternal && (
                    <Button variant="ghost" size="sm" onClick={handleCopy} title="Copy content">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                )}
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-800 relative">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p>Loading document content...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full text-red-500">
                  <p>{error}</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => source?.id && fetchContent(source.id)}>
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="h-full">
                  {isExternal && !content ? (
                     <div className="w-full h-full min-h-[500px] flex flex-col">
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 mb-4 rounded-lg text-sm text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800">
                            Note: Some external websites may not load in this preview due to security restrictions. 
                            If it doesn't load, please use the "Open in New Tab" button below.
                        </div>
                        <iframe 
                          src={source?.metadata?.url} 
                          className="w-full flex-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-white" 
                          title={source?.title}
                          sandbox="allow-scripts allow-same-origin allow-forms"
                        />
                     </div>
                  ) : (
                     <HighlightedContent content={content || ''} highlight={source?.excerpt || ''} />
                  )}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
               <div className="text-sm text-gray-500">
                 {source?.relevance_score ? `Relevance Score: ${Math.round(source.relevance_score * 100)}%` : ''}
               </div>
               {isExternal && (
                 <Button variant="outline" size="sm" onClick={() => window.open(source?.metadata?.url, '_blank')}>
                   Open in New Tab <ExternalLink className="w-4 h-4 ml-2" />
                 </Button>
               )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
