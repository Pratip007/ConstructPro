'use client';

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  passwordRequired?: boolean;
  passwordLabel?: string;
}

export interface ConfirmResult {
  confirmed: boolean;
  password?: string;
}

interface ConfirmDialogContextType {
  confirm: (optsOrTitle: ConfirmOptions | string, message?: string) => Promise<boolean>;
  confirmWithPassword: (opts: ConfirmOptions) => Promise<ConfirmResult>;
  options: ConfirmOptions | null;
  isVisible: boolean;
  passwordValue: string;
  setPasswordValue: (v: string) => void;
  doConfirm: () => void;
  doCancel: () => void;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [passwordValue, setPasswordValue] = useState('');
  const resolveRef = useRef<((result: ConfirmResult) => void) | null>(null);

  const showDialog = useCallback((opts: ConfirmOptions): Promise<ConfirmResult> => {
    setOptions(opts);
    setPasswordValue('');
    setIsVisible(true);
    return new Promise(resolve => {
      resolveRef.current = resolve;
    });
  }, []);

  const confirm = useCallback(async (optsOrTitle: ConfirmOptions | string, message?: string): Promise<boolean> => {
    const opts = typeof optsOrTitle === 'string'
      ? { title: optsOrTitle, message: message || 'Are you sure?' }
      : optsOrTitle;
    const result = await showDialog(opts);
    return result.confirmed;
  }, [showDialog]);

  const confirmWithPassword = useCallback(async (opts: ConfirmOptions): Promise<ConfirmResult> => {
    return showDialog({ ...opts, passwordRequired: true });
  }, [showDialog]);

  const doConfirm = useCallback(() => {
    setIsVisible(false);
    resolveRef.current?.({
      confirmed: true,
      password: options?.passwordRequired ? passwordValue : undefined,
    });
  }, [options, passwordValue]);

  const doCancel = useCallback(() => {
    setIsVisible(false);
    resolveRef.current?.({ confirmed: false });
  }, []);

  return (
    <ConfirmDialogContext.Provider value={{
      confirm, confirmWithPassword, options, isVisible, passwordValue, setPasswordValue, doConfirm, doCancel
    }}>
      {children}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  return ctx;
}
