'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ConfirmResult {
  confirmed: boolean;
  password?: string;
}

interface ConfirmDialogContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmWithPassword: (options: ConfirmOptions & { passwordLabel?: string }) => Promise<ConfirmResult>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions & { passwordLabel?: string; requirePassword?: boolean }>({ message: '' });
  const [password, setPassword] = useState('');
  const resolveRef = useRef<((value: ConfirmResult) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions({ ...opts, requirePassword: false });
      setPassword('');
      setIsOpen(true);
      resolveRef.current = (result) => resolve(result.confirmed);
    });
  }, []);

  const confirmWithPassword = useCallback((opts: ConfirmOptions & { passwordLabel?: string }): Promise<ConfirmResult> => {
    return new Promise((resolve) => {
      setOptions({ ...opts, requirePassword: true });
      setPassword('');
      setIsOpen(true);
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    resolveRef.current?.({ confirmed: true, password: options.requirePassword ? password : undefined });
    resolveRef.current = null;
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolveRef.current?.({ confirmed: false });
    resolveRef.current = null;
  };

  const typeColor = options.type === 'danger' ? '#e74c3c' : options.type === 'warning' ? '#fd7e14' : '#3498db';

  return (
    <ConfirmDialogContext.Provider value={{ confirm, confirmWithPassword }}>
      {children}
      {isOpen && (
        <div className="confirm-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          animation: 'fadeIn 0.2s ease',
        }}>
          <div className="confirm-dialog" style={{
            backgroundColor: 'var(--bg-card, #1c2130)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '420px',
            width: '90%',
            boxShadow: 'var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.5))',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            animation: 'scaleIn 0.2s ease',
          }}>
            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '16px',
              color: typeColor,
              fontWeight: 600,
            }}>
              {options.title || 'Confirm'}
            </h3>
            <p style={{
              margin: '0 0 20px 0',
              fontSize: '14px',
              color: 'var(--text-main, #e8eaf0)',
              lineHeight: 1.5,
            }}>
              {options.message}
            </p>
            {options.requirePassword && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: 'var(--text-muted, #8a9ab5)',
                  marginBottom: '6px',
                }}>
                  {options.passwordLabel || 'Enter password to confirm'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                    backgroundColor: 'var(--input-bg, rgba(255,255,255,0.05))',
                    color: 'var(--text-main, #e8eaf0)',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancel}
                className="btn-secondary"
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                {options.cancelText || 'Cancel'}
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: typeColor,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog(): ConfirmDialogContextType {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  return ctx;
}
