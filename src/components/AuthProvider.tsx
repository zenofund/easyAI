import React, { useState, useEffect, createContext } from 'react';
import type { UserProfile } from '../types/database';
import { transformApiUserToProfile } from '../lib/profileService';

export interface AuthContextType {
  user: { id: string; email: string; role?: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: any }>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<{ id: string; email: string; role?: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        const profile = transformApiUserToProfile(userData);
        setUser({ id: profile.id, email: profile.email, role: profile.role });
        setProfile(profile);
      } else {
        localStorage.removeItem('token');
        setUser(null);
        setProfile(null);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      localStorage.removeItem('token');
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchProfile(token);
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: new Error(data.error || 'Login failed') };
      }

      localStorage.setItem('token', data.token);
      setUser(data.user);
      // Fetch full profile
      await fetchProfile(data.token);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: new Error(data.error || 'Registration failed') };
      }

      localStorage.setItem('token', data.token);
      setUser(data.user);
      // Fetch full profile
      await fetchProfile(data.token);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('token');
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const token = localStorage.getItem('token');
    if (!token) return { error: new Error('Not authenticated') };

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: new Error(data.error || 'Update failed') };
      }

      setProfile(prev => ({ ...prev, ...data }));
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const refreshProfile = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      await fetchProfile(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
