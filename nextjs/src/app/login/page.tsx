'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, PortalType } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import styles from './login.module.scss';

const PORTALS: { type: PortalType; label: string; icon: string; color: string }[] = [
  { type: 'admin', label: 'Admin Portal', icon: 'ri-shield-star-line', color: '#ffc107' },
  { type: 'office', label: 'Office Portal', icon: 'ri-building-2-line', color: '#3498db' },
  { type: 'supervisor', label: 'Supervisor Portal', icon: 'ri-user-settings-line', color: '#9b59b6' },
  { type: 'employee', label: 'Employee Portal', icon: 'ri-user-line', color: '#2ecc71' },
];

export default function LoginPage() {
  const { login, isLoggedIn, currentUser, setPortal } = useAuth();
  const notify = useNotification();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPortal, setSelectedPortal] = useState<PortalType>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      const routes: Record<PortalType, string> = {
        admin: '/admin/dashboard',
        office: '/office/dashboard',
        supervisor: '/supervisor/dashboard',
        employee: '/admin/employee/employee-ledger',
      };
      router.push(routes[currentUser.role as PortalType] || '/admin/dashboard');
    }
  }, [isLoggedIn, currentUser, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter email and password');
      notify.warning('Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      setPortal(selectedPortal);
      const result = await login(email, password);
      if (result && !result.success) {
        setError(result.error || 'Login failed');
        notify.error(result.error || 'Login failed');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      notify.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        <div className={styles.logoSection}>
          <div className={styles.logo}>
            <i className="ri-building-4-line" />
          </div>
          <h1>ConstructPro</h1>
          <p>Construction ERP Management System</p>
        </div>

        <div className={styles.portalSelector}>
          {PORTALS.map(portal => (
            <button
              key={portal.type}
              className={`${styles.portalBtn} ${selectedPortal === portal.type ? styles.active : ''}`}
              style={{ '--portal-color': portal.color } as React.CSSProperties}
              onClick={() => setSelectedPortal(portal.type)}
              type="button"
            >
              <i className={portal.icon} />
              <span>{portal.label}</span>
            </button>
          ))}
        </div>

        {error && (
          <div style={{
            background: 'rgba(231, 76, 60, 0.12)',
            border: '1px solid rgba(231, 76, 60, 0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 14,
            fontSize: 13,
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <i className="ri-error-warning-line" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.loginForm}>
          <div className={styles.inputGroup}>
            <i className="ri-mail-line" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className={styles.inputGroup}>
            <i className="ri-lock-line" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className={styles.togglePassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
            </button>
          </div>

          <button
            type="submit"
            className={styles.loginBtn}
            disabled={loading}
          >
            {loading ? (
              <span className={styles.spinner} />
            ) : (
              <>
                <i className="ri-login-box-line" />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className={styles.footer}>
          <p>Powered by ATR</p>
          <p>&copy; {new Date().getFullYear()} ConstructPro. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
