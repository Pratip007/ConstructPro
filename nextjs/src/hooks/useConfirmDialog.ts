'use client';

import { useState, useCallback, useRef } from 'react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  requirePassword?: boolean;
  passwordLabel?: string;
}

export interface ConfirmDialogState {
  isOpen: boolean;
  options: ConfirmOptions | null;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  handleConfirm: (password?: string) => void;
  handleCancel: () => void;
  password: string;
  setPassword: (v: string) => void;
}

export function useConfirmDialog(): ConfirmDialogState {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [password, setPassword] = useState('');
  const resolveRef = useRef<((result: boolean) => void) | null>(null);
  const passwordRef = useRef('');

  // Keep a ref in sync so handleConfirm captures latest password
  passwordRef.current = password;

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setPassword('');
    setIsOpen(true);
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback((pwd?: string) => {
    setIsOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  return { isOpen, options, confirm, handleConfirm, handleCancel, password, setPassword };
}
