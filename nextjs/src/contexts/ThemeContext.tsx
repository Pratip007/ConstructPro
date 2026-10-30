'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

type ThemeValue = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeValue;
  currentTheme: ThemeValue;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeValue>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('atr_theme') as ThemeValue | null;
    const initial = saved || 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);

    // Cross-tab sync via storage event
    const handler = (e: StorageEvent) => {
      if (e.key === 'atr_theme' && e.newValue) {
        const t = e.newValue as ThemeValue;
        setTheme(t);
        document.documentElement.setAttribute('data-theme', t);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next: ThemeValue = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('atr_theme', next);
      return next;
    });
  }, []);

  const contextValue = useMemo(
    () => ({ theme, currentTheme: theme, toggleTheme }),
    [theme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
