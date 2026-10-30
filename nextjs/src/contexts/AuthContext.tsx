'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

export type PortalType = 'admin' | 'office' | 'supervisor' | 'employee';

export interface User {
  id: number;
  authUid?: string;
  displayId: string;
  name: string;
  role: string;
  assignedSiteId: string | null;
}

export interface AuthContextType {
  user: User | null;
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  portal: string | null;
  setPortal: (p: string) => void;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Only profile data (not the token) lives in localStorage
const USER_KEY = 'atr_user';
const PORTAL_KEY = 'atr_portal';

const ROLE_ROUTES: Record<string, string> = {
  admin: '/admin',
  office: '/office',
  supervisor: '/supervisor',
  employee: '/admin/employee/employee-ledger',
};

function readStoredUser(): User | null {
  try {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) return JSON.parse(stored) as User;
  } catch {}
  return null;
}

function clearLocalStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PORTAL_KEY);
}

function mapProfile(u: Record<string, unknown>): User {
  return {
    id: u.id as number,
    authUid: (u.auth_uid || u.authUid || '') as string,
    displayId: (u.display_id || u.displayId) as string,
    name: u.name as string,
    role: u.role as string,
    assignedSiteId: (u.assigned_site_id ?? u.assignedSiteId ?? u.site_id ?? null) as string | null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start with null on both server and client to avoid hydration mismatch.
  // localStorage is only read inside useEffect (client-only).
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [portal, setPortalState] = useState<string | null>(null);

  useEffect(() => {
    // Step 1: Restore from localStorage instantly (no network, no flash)
    const stored = readStoredUser();
    if (stored) setUser(stored);
    const storedPortal = localStorage.getItem(PORTAL_KEY);
    if (storedPortal) setPortalState(storedPortal);

    // Step 2: Validate with server in background — but don't update UI unless invalid.
    // This prevents the 3-second re-render spike that was causing perceived lag.
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(json => {
        // Only update state if validation FAILED — successful validation keeps cached user
        if (!json.success || !json.data) {
          clearLocalStorage();
          setUser(null);
        }
      })
      .catch(() => {
        // Network error — keep localStorage user, don't force logout
      });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!json.success) {
        return { success: false, error: json.error || 'Login failed' };
      }

      // Token is now in httpOnly cookie — just store the profile
      const profile = mapProfile(json.data.user as Record<string, unknown>);
      localStorage.setItem(USER_KEY, JSON.stringify(profile));
      localStorage.setItem(PORTAL_KEY, profile.role);

      setUser(profile);
      setPortalState(profile.role);

      window.location.href = ROLE_ROUTES[profile.role] ?? '/login';
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error';
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(async () => {
    // Ask the server to clear the httpOnly cookie
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    clearLocalStorage();
    setUser(null);
    setPortalState(null);
    window.location.href = '/login';
  }, []);

  const setPortal = useCallback((p: string) => {
    setPortalState(p);
    localStorage.setItem(PORTAL_KEY, p);
  }, []);

  // getToken kept for backward compat but returns null — token is httpOnly now
  const getToken = useCallback((): string | null => null, []);

  const contextValue = useMemo<AuthContextType>(() => ({
    user,
    currentUser: user,
    isAuthenticated: !!user,
    isLoggedIn: !!user,
    isLoading,
    login,
    logout,
    portal,
    setPortal,
    getToken,
  }), [user, isLoading, login, logout, portal, setPortal, getToken]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
