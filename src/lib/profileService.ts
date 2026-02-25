import { fetchWithAuth } from './api';
import type { UserProfile } from '../types/database';
import { getCachedProfile, setCachedProfile } from './profileCache';
import { getNetworkStatus } from './sessionManager';

interface FetchOptions {
  useCache?: boolean;
  signal?: AbortSignal;
  skipBackgroundRefresh?: boolean;
}

export function transformApiUserToProfile(user: any): UserProfile {
  const profile: UserProfile = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as 'user' | 'admin' | 'super_admin',
    memory: user.memory || {},
    preferences: user.preferences || {},
    created_at: user.created_at,
    updated_at: user.updated_at,
  };

  const activeSubscription = user.subscriptions?.[0];

  if (activeSubscription && activeSubscription.plan) {
    const plan = activeSubscription.plan;
    profile.subscription = {
      id: activeSubscription.id,
      plan_id: activeSubscription.plan_id,
      status: activeSubscription.status || 'active',
      start_date: activeSubscription.start_date || '',
      end_date: activeSubscription.end_date || null,
      plan: {
        id: plan.id,
        name: plan.name || 'Free',
        tier: plan.tier || 'free',
        price: Number(plan.price) || 0,
        max_documents: plan.max_documents || 0,
        max_chats_per_day: plan.max_chats_per_day || 0,
        internet_search: plan.internet_search || false,
        ai_drafting: plan.ai_drafting || false,
        collaboration: plan.collaboration || false,
        legal_citation: plan.legal_citation || false,
        case_summarizer: plan.case_summarizer || false,
        document_export: plan.document_export || false,
        priority_support: plan.priority_support || false,
        advanced_analytics: plan.advanced_analytics || false,
        ai_model: plan.ai_model || 'gpt-4o-mini',
      },
    };
  }

  return profile;
}

export async function fetchUserProfile(
  userId: string,
  options: FetchOptions = {}
): Promise<UserProfile | null> {
  const { useCache = true, signal, skipBackgroundRefresh = false } = options;

  if (useCache) {
    const cached = getCachedProfile(userId);
    if (cached) {
      console.log('💾 ProfileService: Using cached profile');

      if (!skipBackgroundRefresh && getNetworkStatus()) {
        void refreshProfileInBackground(userId);
      }

      return cached;
    }
  }

  if (!getNetworkStatus()) {
    console.log('📡 ProfileService: Offline, cannot fetch profile');
    throw new Error('Network unavailable');
  }

  try {
    console.log('🔍 ProfileService: Fetching profile from API');
    
    // We don't need userId in the URL because fetchWithAuth sends the token
    const user = await fetchWithAuth('/auth/me');

    if (!user) {
      console.warn('⚠️ ProfileService: No user returned from API');
      return null;
    }

    const profile = transformApiUserToProfile(user);

    setCachedProfile(userId, profile);
    return profile;
  } catch (error) {
    console.error('❌ ProfileService: Error fetching profile:', error);
    throw error;
  }
}

export async function refreshProfileInBackground(userId: string): Promise<void> {
  try {
    console.log('🔄 ProfileService: Refreshing profile in background');
    const user = await fetchWithAuth('/auth/me');
    
    if (user) {
      const profile = transformApiUserToProfile(user);
      setCachedProfile(userId, profile);
      console.log('✅ ProfileService: Background refresh complete');
    }
  } catch (error) {
    console.warn('⚠️ ProfileService: Background refresh failed:', error);
  }
}
