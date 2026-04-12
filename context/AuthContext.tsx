'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { SessionUser, Session } from '@/lib/auth';
import {
  getStoredToken,
  getStoredUser,
  setSession,
  clearSession,
  buildAuthHeader,
} from '@/lib/auth';

interface AuthContextValue {
  user: SessionUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, accountName: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchWithAuth: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const storedUser = getStoredUser();
    const storedToken = getStoredToken();
    if (storedUser && storedToken) {
      setUser(storedUser);
      setToken(storedToken);
    }
    setIsLoading(false);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Login failed');
    }

    const session: Session = {
      user: data.data.user,
      token: data.data.token,
    };
    setSession(session);
    setUser(session.user);
    setToken(session.token);
    // Wait for React state to flush so callers that check isAuthenticated
    // (e.g. router.push on the login page) see the correct value before
    // navigation. Without this, router.push() races the state update.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    accountName: string,
  ) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, accountName }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Registration failed');
    }

    const session: Session = {
      user: data.data.user,
      token: data.data.token,
    };
    setSession(session);
    setUser(session.user);
    setToken(session.token);
    // Force a re-render so isAuthenticated reflects the new session before
    // callers navigate away. Without this, router.push() may race the state
    // update and land on a page that still sees !isAuthenticated.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }, []);

  const signOut = useCallback(async () => {
    clearSession();
    setUser(null);
    setToken(null);
    // Clear stale app state (clientId/groupId) so fresh login starts clean
    try {
      localStorage.removeItem('coban_app_state');
    } catch {
      // ignore
    }
  }, []);

  const fetchWithAuth = useCallback(
    async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
      const currentToken = token ?? getStoredToken();
      const headers: Record<string, string> = {
        ...(init?.headers as Record<string, string> || {}),
      };
      if (currentToken) {
        headers['Authorization'] = buildAuthHeader(currentToken);
      }
      return fetch(input, { ...init, headers });
    },
    [token],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        signIn,
        signUp,
        signOut,
        fetchWithAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
