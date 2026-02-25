import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Loader2,
  FileText,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Download,
  BookOpen,
  Scale,
  Calendar,
  MapPin,
  Tag,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Quote,
  Gavel,
  Sparkles,
  Upload,
  ChevronUp,
  ArrowUp,
  Mic,
  ChevronDown,
  Plus,
  Filter,
  X,
  Globe,
  Mail,
  Twitter,
  Linkedin,
  MessageCircle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { Tooltip } from '../ui/Tooltip';
import { VoiceDictationButton } from '../ui/VoiceDictationButton';
import { useAuth } from '../../hooks/useAuth';
import { fetchWithAuth } from '../../lib/api';
import { useChatStore } from '../../stores/chatStore';
import { CitationGeneratorModal } from './CitationGeneratorModal';
import { CaseSummarizerModal } from './CaseSummarizerModal';
import { CaseBriefGeneratorModal } from './CaseBriefGeneratorModal';
import { DocumentViewerModal } from './DocumentViewerModal';
import { SubscriptionManager } from '../subscription/SubscriptionManager';
import { UploadModal } from '../documents/UploadModal';
import { formatDate, cn, hasPremiumAccess, getPersonalizedGreeting, stripMarkdown } from '../../lib/utils';
import type { ChatMessage, DocumentSource } from '../../types/database';

interface EnhancedChatInterfaceProps {
  onShowSubscription?: () => void;
}

export function EnhancedChatInterface({ onShowSubscription }: EnhancedChatInterfaceProps = {}) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCitationGenerator, setShowCitationGenerator] = useState(false);
  const [showCaseSummarizer, setShowCaseSummarizer] = useState(false);
  const [showCaseBriefGenerator, setShowCaseBriefGenerator] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [filters, setFilters] = useState<{ document_type?: string; year?: number }>({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [usageData, setUsageData] = useState({ current: 0, max: 50 });
  const [limitError, setLimitError] = useState<any>(null);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharingMessage, setSharingMessage] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DocumentSource | null>(null);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const handleViewSource = (source: DocumentSource) => {
    setSelectedSource(source);
    setShowDocumentViewer(true);
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { profile } = useAuth();
  const { currentSession, messages, sendMessage, createNewSession, loadSession } = useChatStore();
  const { showError, showWarning, showSuccess } = useToast();

  // Deduplicate messages as a safeguard in the component
  const deduplicatedMessages = useMemo(() => {
    const seen = new Map();
    return messages.filter(msg => {
      if (seen.has(msg.id)) {
        return false;
      }
      seen.set(msg.id, true);
      return true;
    });
  }, [messages]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  // Improved scroll detection with throttling
  const checkScrollPosition = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // Use a smaller, more precise threshold (20px instead of 100px)
    const isAtBottom = scrollHeight - scrollTop - clientHeight <= 20;

    // Only show button if there are messages and content is actually scrollable
    // AND user is not at bottom
    const isScrollable = scrollHeight > clientHeight;
    const shouldShowButton = deduplicatedMessages.length > 0 && isScrollable && !isAtBottom;

    setShowScrollButton(shouldShowButton);
  }, [deduplicatedMessages.length]);

  // Throttled scroll handler for better performance
  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      checkScrollPosition();
    }, 16); // ~60fps throttling
  }, [checkScrollPosition]);

  useEffect(() => {
    scrollToBottom();
  }, [deduplicatedMessages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial check
    checkScrollPosition();
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleScroll, checkScrollPosition]);



  const handleTextareaFocus = () => {
    setIsInputFocused(true);
    
    // Multiple scroll attempts to ensure visibility
    setTimeout(() => {
      scrollToBottom('auto');
    }, 100);
    
    setTimeout(() => {
      scrollToBottom('auto');
    }, 300);
    
    setTimeout(() => {
      scrollToBottom('auto');
    }, 500);
  };

  const handleTextareaBlur = () => {
    setIsInputFocused(false);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  useEffect(() => {
    if (profile) {
      loadUsageData();
    }
  }, [profile]);

  const loadUsageData = async () => {
    if (!profile) return;

    try {
      const data = await fetchWithAuth('/usage?feature=chat_message');
      
      if (data) {
        setUsageData({
          current: data.current_usage || 0,
          max: data.max_limit === -1 ? -1 : (data.max_limit || 50)
        });
      }
    } catch (error) {
      console.error('Error loading usage data:', error);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || isLoading || !profile) return;

    setIsLoading(true);
    
    try {
      let sessionId = currentSession;
      if (!sessionId) {
        sessionId = await createNewSession();
      }

      await sendMessage(sessionId, message.trim(), filters, webSearchEnabled);
      setMessage('');
      await loadUsageData();
    } catch (error) {
      console.error('Error sending message:', error);
      
      if (error instanceof Error) {
        const errorMessage = error.message;
        
        if (errorMessage.includes('CHAT_LIMIT_REACHED:')) {
          const cleanMessage = errorMessage.replace('CHAT_LIMIT_REACHED:', '');
          try {
            const errorData = JSON.parse(errorMessage.split('CHAT_LIMIT_REACHED:')[1] || '{}');
            setLimitError(errorData);
            setShowUpgradeModal(true);
          } catch {
            showWarning('Daily Chat Limit Reached', cleanMessage);
          }
        } else if (errorMessage.includes('AI_RATE_LIMIT:')) {
          const cleanMessage = errorMessage.replace('AI_RATE_LIMIT:', '');
          showWarning('Rate Limit Exceeded', cleanMessage);
        } else if (errorMessage.includes('AI_SERVER_ERROR:')) {
          const cleanMessage = errorMessage.replace('AI_SERVER_ERROR:', '');
          showError('AI Service Unavailable', cleanMessage);
        } else if (errorMessage.includes('User not authenticated')) {
          showError('Authentication Required', 'Please sign in to continue chatting.');
        } else if (errorMessage.includes('Failed to load user profile')) {
          showError('Profile Error', 'Unable to load your profile. Please refresh the page and try again.');
      } else {
          showError('Message Failed', 'Failed to send message. Please check your connection and try again.');
        }
      } else {
        showError('Unexpected Error', 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const copyMessage = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Failed to copy text:', error);
      return false;
    }
  };

  const regenerateResponse = async (messageId: string) => {
    if (!profile || !currentSession) return;

    try {
      setIsLoading(true);

      await fetchWithAuth('/chat/regenerate', {
        method: 'POST',
        body: JSON.stringify({
          message_id: messageId,
          session_id: currentSession
        })
      });

      // Update local state with new message
      // We need to remove the old assistant message and add the new one
      // But actually, the store handles messages. We should probably reload the session or update the store manually.
      // Since useChatStore exposes messages, we can't easily mutate them directly without an action.
      // So let's reload the session.
      await loadSession(currentSession);

    } catch (error) {
      console.error('Error regenerating response:', error);
      showError('Regeneration Failed', 'Failed to regenerate response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const shareConversation = async (messageId: string) => {
    if (!profile || !currentSession) return;

    if (!profile.subscription?.plan?.collaboration) {
      setShowUpgradeModal(true);
      return;
    }

    try {
      setSharingMessage(messageId);
      
      const data = await fetchWithAuth(`/sessions/${currentSession}/share`, {
        method: 'POST'
      });

      const shareLink = `${window.location.origin}/shared/${data.share_token}`;
      setShareUrl(shareLink);
      setShareModalOpen(true);
    } catch (error) {
      console.error('Error sharing conversation:', error);
      showError('Share Failed', 'Failed to create share link. Please try again.');
    } finally {
      setSharingMessage(null);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      showWarning('Link Copied', 'Share link copied to clipboard');
    } catch (error) {
      showError('Copy Failed', 'Failed to copy link to clipboard');
    }
  };

  const submitFeedback = async (messageId: string, feedbackType: 'positive' | 'negative') => {
    if (!profile) return;

    try {
      await fetchWithAuth('/chat/feedback', {
        method: 'POST',
        body: JSON.stringify({
          message_id: messageId,
          feedback_type: feedbackType
        })
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const handleExport = async (format: 'txt' | 'pdf' | 'docx') => {
    if (!profile?.subscription?.plan?.document_export) {
      setShowUpgradeModal(true);
      return;
    }

    try {
      const fileName = `chat-${new Date().toISOString().split('T')[0]}`;

      if (format === 'txt') {
        const chatContent = deduplicatedMessages
          .map(msg => `${msg.role.toUpperCase()}: ${stripMarkdown(msg.message)}`)
          .join('\n\n' + '-'.repeat(50) + '\n\n');

        const blob = new Blob([chatContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (format === 'pdf') {
        const doc = new jsPDF();
        
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        const maxWidth = doc.internal.pageSize.width - 2 * margin;
        let y = margin;

        // Title
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('Chat History', margin, y);
        y += 10;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, y);
        y += 15;

        deduplicatedMessages.forEach(msg => {
          const role = msg.role.toUpperCase();
          const cleanMessage = stripMarkdown(msg.message);
          
          // Check if we need a new page for the role
          if (y > pageHeight - 30) {
            doc.addPage();
            y = margin;
          }

          doc.setFontSize(11);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text(role, margin, y);
          y += 7;
          
          doc.setFontSize(10);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(60, 60, 60);
          
          const lines = doc.splitTextToSize(cleanMessage, maxWidth);
          
          // Print lines, handling page breaks within long messages
          lines.forEach((line: string) => {
              if (y > pageHeight - margin) {
                  doc.addPage();
                  y = margin;
              }
              doc.text(line, margin, y);
              y += 5;
          });
          
          y += 10;
        });
        
        doc.save(`${fileName}.pdf`);
      } else if (format === 'docx') {
        const doc = new Document({
          sections: [{
            properties: {},
            children: [
              new Paragraph({
                children: [
                    new TextRun({
                        text: "Chat History",
                        bold: true,
                        size: 32, // 16pt
                    })
                ],
                spacing: { after: 400 }
              }),
              ...deduplicatedMessages.flatMap(msg => [
              new Paragraph({
                children: [
                  new TextRun({
                    text: msg.role.toUpperCase(),
                    bold: true,
                    size: 24, // 12pt
                    color: msg.role === 'user' ? "2F54EB" : "000000"
                  })
                ],
                spacing: { before: 200, after: 100 }
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: stripMarkdown(msg.message),
                    size: 24 // 12pt
                  })
                ],
                spacing: { after: 300 }
              })
            ])]
          }]
        });

        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setShowExportMenu(false);
      showSuccess('Export Successful', `Chat exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
      showError('Export Failed', 'Failed to export chat history');
    }
  };

  const handleCitationGenerated = (citation: string) => {
    setMessage(prev => prev + (prev ? '\n\n' : '') + `Generated Citation: ${citation}`);
  };

  const currentPlan = profile?.subscription?.plan;
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const showUsage = !isAdmin && usageData.max !== -1;
  const showAITools = hasPremiumAccess(currentPlan?.tier, profile?.role);

  if (!profile) return null;

  const isIdle = deduplicatedMessages.length === 0;

  const inputAreaContent = (
    <div className={cn(
      "transition-all duration-500 ease-in-out w-full z-20",
      isIdle ? "px-4 mt-8" : "bg-transparent mb-[50px]"
    )}>
      <div className={cn(
        "mx-auto px-4 py-4 rounded-t-2xl",
        isIdle ? "max-w-6xl" : "max-w-3xl"
      )}>
        
        <form onSubmit={handleSubmit} className="relative">
          <div className={cn(
            "relative flex items-end rounded-2xl border transition-colors shadow-lg",
            "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-2"
          )}>
            {/* Left Actions (Tools) */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center z-10 gap-1">
              {/* Web Search Toggle */}
              <div className="relative">
                <Tooltip content={profile?.subscription?.plan?.internet_search ? (webSearchEnabled ? "Disable Web Search" : "Enable Web Search") : "Web Search (Upgrade to Pro)"} position="top">
                  <button
                    type="button"
                    onClick={() => {
                      if (profile?.subscription?.plan?.internet_search) {
                        setWebSearchEnabled(!webSearchEnabled);
                      } else {
                        setShowUpgradeModal(true);
                      }
                    }}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      webSearchEnabled 
                        ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" 
                        : "hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400"
                    )}
                    aria-label="Toggle Web Search"
                  >
                    <Globe className="h-5 w-5" strokeWidth={2.5} />
                    {!profile?.subscription?.plan?.internet_search && (
                      <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-[8px] font-bold px-1 rounded-full">PRO</span>
                    )}
                  </button>
                </Tooltip>
              </div>

              {/* Tools Menu Button - Only show for Pro/Enterprise users */}
              {showAITools && (
                <div className="relative">
                  <Tooltip content="Legal Tools" position="top">
                    <button
                      type="button"
                      onClick={() => setShowToolsMenu(!showToolsMenu)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      aria-label="Open Legal Tools"
                    >
                      <Plus className="h-5 w-5 text-gray-800 dark:text-gray-100" strokeWidth={2.5} />
                    </button>
                  </Tooltip>

                  {/* Tools Popup Menu */}
                  <AnimatePresence>
                    {showToolsMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex flex-col space-y-2 whitespace-nowrap min-w-[200px] max-h-[80vh] overflow-y-auto scrollbar-sleek"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setShowUploadModal(true);
                            setShowToolsMenu(false);
                          }}
                          className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors w-full text-left"
                          title="Upload Document"
                        >
                          <Upload className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Upload</span>
                        </button>
                        {currentPlan?.legal_citation && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowCitationGenerator(true);
                              setShowToolsMenu(false);
                            }}
                            className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors w-full text-left"
                            title="Legal Citation"
                          >
                            <Quote className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Citation</span>
                          </button>
                        )}
                        {currentPlan?.case_summarizer && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowCaseSummarizer(true);
                              setShowToolsMenu(false);
                            }}
                            className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors w-full text-left"
                            title="Case Summarizer"
                          >
                            <Scale className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Summarizer</span>
                          </button>
                        )}
                        {currentPlan?.ai_drafting && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowCaseBriefGenerator(true);
                              setShowToolsMenu(false);
                            }}
                            className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors w-full text-left"
                            title="Brief Generator"
                          >
                            <Gavel className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Brief</span>
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleTextareaFocus}
              onBlur={handleTextareaBlur}
              placeholder="What are we analysing today?"
              className={cn(
                "flex-1 bg-transparent border-none outline-none resize-none pl-20 pr-16 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 scrollbar-sleek",
                isIdle ? "min-h-[120px] max-h-[200px]" : "min-h-[48px] max-h-[120px]"
              )}
              rows={1}
              disabled={isLoading}
            />

            {/* Inline Actions */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {/* Download Button */}
              {deduplicatedMessages.length > 0 && (
                <div className="relative">
                  <Tooltip content="Export Chat" position="top">
                    <button
                      type="button"
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      aria-label="Export Chat"
                    >
                      <Download className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    </button>
                  </Tooltip>

                  <AnimatePresence>
                    {showExportMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full right-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex flex-col space-y-1 min-w-[120px]"
                      >
                        <button
                          onClick={() => handleExport('pdf')}
                          className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-sm text-gray-700 dark:text-gray-300 w-full text-left"
                        >
                          <FileText className="h-4 w-4" />
                          <span>PDF</span>
                        </button>
                        <button
                          onClick={() => handleExport('txt')}
                          className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-sm text-gray-700 dark:text-gray-300 w-full text-left"
                        >
                          <FileText className="h-4 w-4" />
                          <span>TXT</span>
                        </button>
                        <button
                          onClick={() => handleExport('docx')}
                          className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-sm text-gray-700 dark:text-gray-300 w-full text-left"
                        >
                          <FileText className="h-4 w-4" />
                          <span>DOCX</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Voice Dictation Button */}
              {!message.trim() && (
                <VoiceDictationButton
                  onTranscriptionComplete={(text) => {
                    setMessage(prev => prev ? `${prev} ${text}` : text);
                    setTimeout(() => {
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                      }
                    }, 100);
                  }}
                  userProfile={profile}
                  disabled={isLoading}
                />
              )}

              {/* Send Button */}
              {message.trim() && (
                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                    "bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100"
                  )}
                  title="Send Message"
                >
                  <AnimatePresence mode="wait">
                    {isLoading ? (
                      <motion.div
                        key="loading"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Loader2 className="h-4 w-4 text-white dark:text-gray-900 animate-spin" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="send"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <ArrowUp className="h-4 w-4 text-white dark:text-gray-900" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              )}
            </div>
          </div>
        </form>

        {isIdle && (
          <div className="w-full max-w-3xl mx-auto mt-6">
            <div className="flex justify-center mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 ${showFilters || Object.keys(filters).length > 0 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400' : ''}`}
              >
                <Filter className="h-4 w-4" />
                <span>{showFilters ? 'Hide Filters' : 'Filter Search'}</span>
                {Object.keys(filters).length > 0 && (
                  <span className="ml-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {Object.keys(filters).length}
                  </span>
                )}
              </Button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 text-left shadow-sm overflow-hidden"
                >
                  <div className="py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Document Type</label>
                        <select
                          className="w-full text-sm border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          value={filters.document_type || ''}
                          onChange={(e) => setFilters(prev => ({ ...prev, document_type: e.target.value || undefined }))}
                        >
                          <option value="">All Types</option>
                          <option value="case_law">Case Law</option>
                          <option value="statute">Statute</option>
                          <option value="regulation">Regulation</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Year</label>
                        <input
                          type="number"
                          placeholder="e.g. 2023"
                          className="w-full text-sm border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          value={filters.year || ''}
                          onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value ? parseInt(e.target.value) : undefined }))}
                        />
                      </div>
                    </div>
                    {Object.keys(filters).length > 0 && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => setFilters({})}
                          className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center"
                        >
                          <X className="h-3 w-3 mr-1" /> Clear Filters
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-900 relative"
    >
      {/* Messages Area */}
      <div ref={messagesContainerRef} className={cn(
        "flex-1 overflow-y-auto scrollbar-conditional relative",
        isIdle && "flex"
      )}>
        <div className={cn(
          "px-4 py-6 w-full",
          isIdle ? "max-w-6xl m-auto" : "max-w-3xl mx-auto"
        )}>
          {isIdle ? (
            <div className="w-full flex flex-col items-center">
              <WelcomeScreen />
              {inputAreaContent}
            </div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence>
                {deduplicatedMessages.map((msg) => (
                  <EnhancedMessageBubble
                    key={msg.id}
                    message={msg}
                    onCopy={copyMessage}
                    onRegenerate={regenerateResponse}
                    onShare={shareConversation}
                    onFeedback={submitFeedback}
                    sharingMessage={sharingMessage}
                    userPlan={profile?.subscription?.plan}
                    onViewSource={handleViewSource}
                  />
                ))}
              </AnimatePresence>

              {isLoading && <LoadingIndicator />}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

      </div>

      {/* Scroll to Bottom Button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => scrollToBottom()}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 p-2 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-white/90 dark:hover:bg-gray-800 transition-colors"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input Area (only when not idle) */}
      {!isIdle && inputAreaContent}

      {/* Citation Generator Modal */}

      <CitationGeneratorModal
        isOpen={showCitationGenerator}
        onClose={() => setShowCitationGenerator(false)}
        onCitationGenerated={handleCitationGenerated}
      />

      {/* Case Summarizer Modal */}
      <CaseSummarizerModal
        isOpen={showCaseSummarizer}
        onClose={() => setShowCaseSummarizer(false)}
      />

      {/* Case Brief Generator Modal */}
      <CaseBriefGeneratorModal
        isOpen={showCaseBriefGenerator}
        onClose={() => setShowCaseBriefGenerator(false)}
      />

      {/* Upgrade Modal */}
      <SubscriptionManager
        isOpen={showUpgradeModal}
        onClose={() => {
          setShowUpgradeModal(false);
          setLimitError(null);
        }}
      />

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Share Conversation
              </h3>
              <button
                onClick={() => setShareModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Anyone with this link can view this conversation (login not required).
            </p>
            <div className="flex items-center space-x-2 mb-4">
              <input
                type="text"
                value={shareUrl || ''}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
              <Button onClick={copyShareUrl} variant="default">
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`mailto:?subject=${encodeURIComponent('Shared Conversation from Legal Assistant')}&body=${encodeURIComponent(`Check out this legal conversation: ${shareUrl}`)}`, '_blank')}
                title="Share via Email"
                className="flex flex-col items-center justify-center h-auto py-2"
              >
                <Mail className="h-4 w-4 mb-1" />
                <span className="text-xs">Email</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this legal conversation')}&url=${encodeURIComponent(shareUrl || '')}`, '_blank')}
                title="Share on Twitter"
                className="flex flex-col items-center justify-center h-auto py-2"
              >
                <Twitter className="h-4 w-4 mb-1" />
                <span className="text-xs">Twitter</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl || '')}`, '_blank')}
                title="Share on LinkedIn"
                className="flex flex-col items-center justify-center h-auto py-2"
              >
                <Linkedin className="h-4 w-4 mb-1" />
                <span className="text-xs">LinkedIn</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Check out this legal conversation: ${shareUrl}`)}`, '_blank')}
                title="Share on WhatsApp"
                className="flex flex-col items-center justify-center h-auto py-2"
              >
                <MessageCircle className="h-4 w-4 mb-1" />
                <span className="text-xs">WhatsApp</span>
              </Button>
            </div>

            <Button
              onClick={() => setShareModalOpen(false)}
              variant="default"
              className="w-full"
            >
              Close
            </Button>
          </motion.div>
        </div>
      )}
      {/* Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={showDocumentViewer}
        onClose={() => setShowDocumentViewer(false)}
        source={selectedSource}
      />

    </div>
  );
}

interface WelcomeScreenProps {
  // Props no longer needed for filters, but keeping interface empty or removing if unused
}

function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center w-full max-w-lg"
      >
        <h1 className="text-xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
          What are we analysing today?
        </h1>
      </motion.div>
    </div>
  );
}

function EnhancedMessageBubble({
  message,
  onCopy,
  onRegenerate,
  onShare,
  onFeedback,
  sharingMessage,
  userPlan,
  onViewSource
}: {
  message: ChatMessage;
  onCopy: (text: string, messageId: string) => Promise<boolean>;
  onRegenerate: (messageId: string) => void;
  onShare: (messageId: string) => void;
  onFeedback: (messageId: string, feedbackType: 'positive' | 'negative') => void;
  sharingMessage: string | null;
  userPlan?: any;
  onViewSource: (source: DocumentSource) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);

  const handleCopy = async () => {
    const success = await onCopy(message.message, message.id);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedback(type);
    onFeedback(message.id, type);
  };

  const getModelDisplayName = (modelName: string | null) => {
    return ''; // Disabled model display
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={`rounded-2xl px-6 py-4 ${
          message.role === 'user'
            ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white max-w-[75%]'
            : 'w-full max-w-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-gray-900/50'
        }`}
      >
        {/* Message Content */}
        <div className={`prose prose-sm max-w-none text-[13px] leading-relaxed ${
          message.role === 'user'
            ? 'prose-gray dark:prose-invert'
            : 'prose-gray dark:prose-invert dark:text-gray-300 dark:prose-p:text-gray-300 dark:prose-headings:text-gray-200 dark:prose-strong:text-gray-200 dark:prose-li:text-gray-300'
        }`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.message}
          </ReactMarkdown>
        </div>

        {/* Message Metadata */}
        {message.role === 'assistant' && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
              <span>{formatDate(message.created_at)}</span>
            </div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: showActions ? 1 : 0, 
                scale: showActions ? 1 : 0.8 
              }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex items-center space-x-2",
                !showActions && "pointer-events-none"
              )}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="p-1 h-6 w-6 relative"
              >
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Check className="h-3 w-3 text-green-600" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="copy"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Copy className="h-3 w-3" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRegenerate(message.id)}
                className="p-1 h-6 w-6"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              {userPlan?.collaboration && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onShare(message.id)}
                  className="p-1 h-6 w-6"
                  disabled={sharingMessage === message.id}
                >
                  {sharingMessage === message.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Share2 className="h-3 w-3" />
                  )}
                </Button>
              )}
            </motion.div>
          </div>
        )}
        
        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Sources
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {message.sources.length} legal {message.sources.length === 1 ? 'reference' : 'references'} found
                  </p>
                </div>
              </div>
              {message.sources.length > 3 && (
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  +{message.sources.length - 3} more
                </span>
              )}
            </div>
            <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
              {message.sources.slice(0, 3).map((source, index) => (
                <EnhancedSourceCard 
                  key={index} 
                  source={source} 
                  index={index + 1} 
                  onViewSource={onViewSource}
                />
              ))}
            </div>
          </div>
        )}

        {/* Feedback Buttons */}
        {message.role === 'assistant' && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Was this helpful?</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFeedback('positive')}
                className={cn(
                  "p-1 h-6 w-6",
                  feedback === 'positive' && "text-green-600 dark:text-green-400"
                )}
              >
                <ThumbsUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFeedback('negative')}
                className={cn(
                  "p-1 h-6 w-6",
                  feedback === 'negative' && "text-red-600 dark:text-red-400"
                )}
              >
                <ThumbsDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function EnhancedSourceCard({ source, index, onViewSource }: { source: DocumentSource; index: number; onViewSource: (source: DocumentSource) => void }) {
  const [showFullExcerpt, setShowFullExcerpt] = useState(false);

  const handleSourceClick = () => {
    onViewSource(source);
  };

  const getTypeColor = () => {
    switch (source.type) {
      case 'case':
        return 'text-gray-700 dark:text-gray-300';
      case 'statute':
        return 'text-gray-700 dark:text-gray-300';
      case 'regulation':
        return 'text-gray-700 dark:text-gray-300';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group"
    >
      <div className="flex items-start space-x-3">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0">
          {index}.
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <button
              onClick={handleSourceClick}
              className="text-left flex-1 group/link"
            >
              <h4 className={`text-xs font-semibold ${getTypeColor()} group-hover/link:underline transition-all line-clamp-2`}>
                {source.title.replace(/\.[^/.]+$/, "")}
              </h4>
            </button>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <span className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                {Math.round((source.relevance_score || source.relevance || 0) * 100)}%
              </span>
              <button
                onClick={handleSourceClick}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Open source"
              >
                <ExternalLink className="h-3 w-3 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {source.citation && (
            <div className="mb-2">
              <p className="text-[10px] text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-800/50 px-2 py-1 rounded inline-block">
                {source.citation}
              </p>
            </div>
          )}

          {source.excerpt && (
            <p className={`text-xs text-gray-700 dark:text-gray-300 leading-relaxed ${showFullExcerpt ? '' : 'line-clamp-2'}`}>
              {source.excerpt}
            </p>
          )}

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center space-x-3 text-[10px] text-gray-500 dark:text-gray-400">
              {source.page && (
                <span className="flex items-center space-x-1">
                  <FileText className="h-3 w-3" />
                  <span>Page {source.page}</span>
                </span>
              )}
              <span className="capitalize">{source.type}</span>
            </div>

            {source.excerpt && source.excerpt.length > 150 && (
              <button
                onClick={() => setShowFullExcerpt(!showFullExcerpt)}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showFullExcerpt ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function LoadingIndicator() {
  const [stage, setStage] = useState(0);
  const stages = [
    "Analyzing your legal query...",
    "Searching relevant statutes & cases...",
    "Cross-referencing legal principles...",
    "Synthesizing comprehensive response..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((prev) => (prev + 1) % stages.length);
    }, 2500); // Change text every 2.5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-6 py-4 mr-12 shadow-sm">
        <div className="flex items-center space-x-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <AnimatePresence mode="wait">
                <motion.span 
                  key={stage}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  {stages[stage]}
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
               <span>Powered by easyAI</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}