'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  remove: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const DEFAULT_DURATIONS: Record<Notification['type'], number> = {
  success: 3000,
  error: 5000,
  info: 4000,
  warning: 4000,
};

const MAX_VISIBLE = 5;

const ICONS: Record<Notification['type'], string> = {
  success: 'ri-checkbox-circle-line',
  error: 'ri-error-warning-line',
  info: 'ri-information-line',
  warning: 'ri-alert-line',
};

const COLORS: Record<Notification['type'], string> = {
  success: 'var(--success)',
  error: 'var(--danger)',
  info: 'var(--info)',
  warning: 'var(--warning)',
};

function NotificationToast({ notification, onClose }: { notification: Notification; onClose: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = notification.duration || DEFAULT_DURATIONS[notification.type];
    const exitTimer = setTimeout(() => setIsExiting(true), duration - 300);
    const removeTimer = setTimeout(() => onClose(notification.id), duration);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [notification, onClose]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        marginBottom: '8px',
        background: 'var(--card-bg, #1e2538)',
        borderRadius: '8px',
        borderLeft: `4px solid ${COLORS[notification.type]}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        color: 'var(--text-primary, #e8eaf0)',
        fontSize: '14px',
        minWidth: '300px',
        maxWidth: '420px',
        animation: isExiting ? 'toast-slide-out 0.3s ease forwards' : 'toast-slide-in 0.3s ease forwards',
      }}
    >
      <i
        className={ICONS[notification.type]}
        style={{ fontSize: '18px', color: COLORS[notification.type], flexShrink: 0 }}
      />
      <span style={{ flex: 1, lineHeight: '1.4' }}>{notification.message}</span>
      <button
        onClick={() => onClose(notification.id)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary, #8a8fa8)',
          cursor: 'pointer',
          padding: '2px',
          fontSize: '16px',
          lineHeight: 1,
          flexShrink: 0,
        }}
        aria-label="Close notification"
      >
        <i className="ri-close-line" />
      </button>
    </div>
  );
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const nextIdRef = useRef(0);

  const remove = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const add = useCallback((type: Notification['type'], message: string, duration?: number) => {
    const id = `notif-${++nextIdRef.current}-${Date.now()}`;
    setNotifications(prev => {
      const next = [...prev, { id, type, message, duration: duration || DEFAULT_DURATIONS[type] }];
      // Keep only the last MAX_VISIBLE notifications
      if (next.length > MAX_VISIBLE) {
        return next.slice(next.length - MAX_VISIBLE);
      }
      return next;
    });
  }, []);

  const success = useCallback((message: string) => add('success', message), [add]);
  const error = useCallback((message: string) => add('error', message), [add]);
  const warning = useCallback((message: string) => add('warning', message), [add]);
  const info = useCallback((message: string) => add('info', message), [add]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const contextValue = React.useMemo(
    () => ({ notifications, success, error, warning, info, remove }),
    // notifications array changes on every toast add/remove — intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notifications, success, error, warning, info, remove]
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      {/* Toast animation styles */}
      <style jsx global>{`
        @keyframes toast-slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes toast-slide-out {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `}</style>
      {/* Toast container */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          {notifications.map(n => (
            <NotificationToast key={n.id} notification={n} onClose={remove} />
          ))}
        </div>
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextType {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}
