import { create } from 'zustand';
import type { ChatMessage } from '../types/database';
import { getNetworkStatus } from '../lib/sessionManager';

interface ChatStore {
  currentSession: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingSession: boolean;
  error: string | null;
  abortController: AbortController | null;
  sessionRefreshTrigger: number;

  // Actions
  createNewSession: () => Promise<string>;
  loadSession: (sessionId: string) => Promise<void>;
  sendMessage: (sessionId: string, content: string, filters?: { document_type?: string; year?: number }, web_search?: boolean) => Promise<void>;
  clearMessages: () => void;
  cancelRequest: () => void;
  triggerSessionRefresh: () => void;
}

// Deduplication utility function
function deduplicateMessages(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Map<string, ChatMessage>();

  for (const message of messages) {
    if (!seen.has(message.id)) {
      seen.set(message.id, message);
    }
  }

  return Array.from(seen.values());
}

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getAuthToken = () => localStorage.getItem('token');

const getAuthHeaders = () => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('User not authenticated');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

const getUserIdFromToken = (): string => {
  const token = getAuthToken();
  if (!token) throw new Error('User not authenticated');
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id;
  } catch (e) {
    throw new Error('Invalid token');
  }
};

export const useChatStore = create<ChatStore>((set, get) => ({
  currentSession: null,
  messages: [],
  isLoading: false,
  isLoadingSession: false,
  error: null,
  abortController: null,
  sessionRefreshTrigger: 0,

  triggerSessionRefresh: () => {
    set(state => ({ sessionRefreshTrigger: state.sessionRefreshTrigger + 1 }));
  },

  createNewSession: async () => {
    if (!getNetworkStatus()) {
      throw new Error('NETWORK_ERROR:Cannot create session while offline. Please check your connection.');
    }

    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${apiUrl}/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const session = await response.json();
      set(state => ({ 
        currentSession: session.id, 
        messages: [],
        sessionRefreshTrigger: state.sessionRefreshTrigger + 1
      }));
      return session.id;
    } catch (error) {
      console.error('Create session error:', error);
      throw error;
    }
  },

  loadSession: async (sessionId: string) => {
    // Prevent loading same session concurrently
    const state = get();
    if (state.isLoadingSession && state.currentSession === sessionId) {
      return;
    }

    if (!getNetworkStatus()) {
      const cached = state.messages;
      if (cached.length > 0) {
        console.log('Offline mode: Using cached messages');
        return;
      }
      throw new Error('NETWORK_ERROR:Cannot load session while offline.');
    }

    set({ isLoadingSession: true, error: null });

    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${apiUrl}/sessions/${sessionId}/messages`, {
        headers
      });

      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await response.json();

      // Deduplicate messages before setting state
      const deduplicated = deduplicateMessages(data || []);

      set({
        currentSession: sessionId,
        messages: deduplicated,
        isLoadingSession: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'An error occurred',
        isLoadingSession: false
      });
    }
  },

  sendMessage: async (sessionId: string, content: string, filters?: { document_type?: string; year?: number }, web_search?: boolean) => {
    const userId = getUserIdFromToken();
    
    set({ isLoading: true, error: null });

    // Optimistic update: Add user message to local state immediately
    const tempUserMessage: ChatMessage = {
      id: crypto.randomUUID(), // Temporary ID
      user_id: userId,
      session_id: sessionId,
      message: content,
      role: 'user',
      sources: [],
      metadata: {},
      tokens_used: 0,
      model_used: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    set(state => {
      const newMessages = deduplicateMessages([...state.messages, tempUserMessage]);
      return { messages: newMessages };
    });

    try {
      // Check network status before making API call
      if (!getNetworkStatus()) {
        throw new Error('NETWORK_ERROR:Cannot send message while offline. Please check your connection.');
      }

      // Create abort controller for this request
      const controller = new AbortController();
      const signal = controller.signal;

      // Store controller but don't expose it directly in state if not needed, 
      // or use a ref if inside a component. Here we use state.
      set({ abortController: controller });

      // Set a timeout for the request
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      try {
        const headers = getAuthHeaders();
        // Call AI service
        const response = await fetch(`${apiUrl}/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: content,
            session_id: sessionId,
            filters: filters,
            web_search: web_search
          }),
          signal
        });

        clearTimeout(timeoutId);
        set({ abortController: null });

        if (!response.ok) {
          let errorMessage = 'Failed to get AI response';

          try {
            const errorData = await response.json();

            if (response.status === 429 && errorData.error === 'CHAT_LIMIT_REACHED') {
              const limitData = {
                current_usage: errorData.current_usage,
                max_limit: errorData.max_limit,
                remaining: errorData.remaining,
                plan_tier: errorData.plan_tier,
                upgrade_needed: errorData.upgrade_needed
              };
              errorMessage = `CHAT_LIMIT_REACHED:${JSON.stringify(limitData)}`;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            } else if (errorData.details) {
              errorMessage = errorData.details;
            }
          } catch (parseError) {
            if (response.status === 429) {
              errorMessage = 'AI_RATE_LIMIT:Too many requests. Please wait a moment before sending another message.';
            } else if (response.status >= 500) {
              errorMessage = 'AI_SERVER_ERROR:AI service is temporarily unavailable. Please try again in a few moments.';
            }
          }

          throw new Error(errorMessage);
        }

        const aiMsgData = await response.json();

        // Update local state with AI response (deduplicated)
        set(state => {
          // We don't need to replace the temp user message because the next reload will fetch the real one.
          // However, for a perfect UI, we might want to replace the temp one with the real one if the server returned it.
          // But the server currently only returns the assistant message.
          // So we just append the assistant message.
          const newMessages = deduplicateMessages([...state.messages, aiMsgData]);
          return {
            messages: newMessages,
            isLoading: false,
            sessionRefreshTrigger: state.sessionRefreshTrigger + 1
          };
        });

      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        set({ abortController: null });

        if (fetchError.name === 'AbortError') {
          throw new Error('REQUEST_TIMEOUT:Request timed out. The AI is taking longer than expected. Please try again.');
        }

        throw fetchError;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';

      const isNetworkError = errorMessage.includes('NETWORK_ERROR') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('network') ||
        errorMessage.toLowerCase().includes('failed to fetch');

      set({
        error: errorMessage,
        isLoading: false,
        abortController: null
      });

      // Remove the optimistic user message on error
      // Ideally we should mark it as failed, but for now removing is safer to avoid confusion
      // set(state => ({
      //   messages: state.messages.filter(m => m.id !== tempUserMessage.id)
      // }));
      // Actually, let's keep it so user can retry or copy-paste? No, let's remove it to be consistent with previous behavior.
      set(state => ({
         messages: state.messages.filter(m => m.id !== tempUserMessage.id)
      }));

      if (isNetworkError) {
        console.error('Network error in sendMessage:', error);
      }

      throw error;
    }
  },

  clearMessages: () => {
    set({ messages: [], currentSession: null, isLoadingSession: false });
  },

  cancelRequest: () => {
    const controller = get().abortController;
    if (controller) {
      console.log('Cancelling ongoing request...');
      controller.abort();
      set({ abortController: null, isLoading: false });
    }
  }
}));
