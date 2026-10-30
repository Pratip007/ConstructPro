'use client';

import React from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import styles from './NotificationToast.module.scss';

const TYPE_COLORS: Record<string, string> = {
  success: '#16a34a',
  error: '#dc2626',
  warning: '#d97706',
  info: '#2563eb',
};

export default function NotificationToast() {
  const { notifications, remove } = useNotification();

  if (!notifications.length) return null;

  return (
    <div className={styles.container}>
      {notifications.map(n => (
        <div
          key={n.id}
          className={styles.toast}
          style={{ backgroundColor: TYPE_COLORS[n.type] }}
        >
          <span className={styles.message}>{n.message}</span>
          <button className={styles.close} onClick={() => remove(n.id)}>
            &#x2715;
          </button>
        </div>
      ))}
    </div>
  );
}
