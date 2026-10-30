'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type PortalType = 'admin' | 'office' | 'employee' | 'supervisor';

export interface UserProfile {
  id: number;
  authUid: string;
  displayId: string;
  name: string;
  role: PortalType;
  siteId: number | null;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoggedIn: boolean;
  loading: boolean;
  login: (email: string, password: string, portalType?: PortalType) => Promise<void>;
  logout: () => void;
  getToken: () => string | null;
  updateUser: (user: UserProfile) => void;
}

const ROLE_ROUTES: Record<PortalType, string> = {
  admin: '/admin',
  office: '/office',
  supervisor: '/supervisor',
  employee: '/admin/employee/employee-ledger',
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('atr_access_token');
    const storedUser = localStorage.getItem('atr_current_logged_user');
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('atr_current_logged_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string, portalType?: PortalType) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, portalType }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Login failed');

    const { accessToken, refreshToken, user: userData } = data.data;
    localStorage.setItem('atr_access_token', accessToken);
    localStorage.setItem('atr_refresh_token', refreshToken);
    localStorage.setItem('atr_current_logged_portal', userData.role);
    localStorage.setItem('atr_current_logged_user', JSON.stringify(userData));
    setUser(userData);

    const route = ROLE_ROUTES[userData.role as PortalType] || '/login';
    window.location.href = route;
  }, []);

  const logout = useCallback(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('atr_'));
    keys.forEach(k => localStorage.removeItem(k));
    setUser(null);
    window.location.href = '/login';
  }, []);

  const getToken = useCallback(() => {
    return localStorage.getItem('atr_access_token');
  }, []);

  const updateUser = useCallback((updatedUser: UserProfile) => {
    setUser(updatedUser);
    localStorage.setItem('atr_current_logged_user', JSON.stringify(updatedUser));
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoggedIn: !!user,
      loading,
      login,
      logout,
      getToken,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
