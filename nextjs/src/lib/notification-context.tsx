'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: number;
  type: NotificationType;
  message: string;
  removing?: boolean;
}

interface NotificationContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const DURATIONS: Record<NotificationType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
};

const ICONS: Record<NotificationType, string> = {
  success: 'ri-check-line',
  error: 'ri-error-warning-line',
  warning: 'ri-alert-line',
  info: 'ri-information-line',
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const counterRef = useRef(0);

  const removeNotification = useCallback((id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, removing: true } : n));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 300);
  }, []);

  const addNotification = useCallback((type: NotificationType, message: string) => {
    const id = ++counterRef.current;
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => removeNotification(id), DURATIONS[type]);
  }, [removeNotification]);

  const contextValue: NotificationContextType = {
    success: useCallback((msg: string) => addNotification('success', msg), [addNotification]),
    error: useCallback((msg: string) => addNotification('error', msg), [addNotification]),
    warning: useCallback((msg: string) => addNotification('warning', msg), [addNotification]),
    info: useCallback((msg: string) => addNotification('info', msg), [addNotification]),
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <div className="notification-toast-container" style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '360px',
      }}>
        {notifications.map(n => (
          <div
            key={n.id}
            className={`notification-toast notification-${n.type} ${n.removing ? 'removing' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: n.type === 'success' ? '#2ecc71' :
                n.type === 'error' ? '#e74c3c' :
                n.type === 'warning' ? '#fd7e14' : '#3498db',
              color: 'white',
              fontSize: '13px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              animation: n.removing ? 'slideOut 0.3s ease forwards' : 'slideIn 0.3s ease forwards',
              cursor: 'pointer',
            }}
            onClick={() => removeNotification(n.id)}
          >
            <i className={ICONS[n.type]} style={{ fontSize: '18px' }} />
            <span style={{ flex: 1 }}>{n.message}</span>
            <i className="ri-close-line" style={{ fontSize: '16px', opacity: 0.8 }} />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `}</style>
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextType {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}
