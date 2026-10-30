'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import styles from './TopHeader.module.scss';

interface TopHeaderProps {
  onToggleSidebar?: () => void;
  portalPrefix?: string;
}

export default function TopHeader({ onToggleSidebar, portalPrefix = '' }: TopHeaderProps) {
  const { currentUser, logout } = useAuth();
  const { currentTheme, toggleTheme } = useTheme();
  const pathname = usePathname();

  const [notifOpen, setNotifOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [notifItems, setNotifItems] = useState<{ icon: string; label: string; route: string }[]>([]);

  // Build breadcrumb from pathname — memoized so it doesn't recalculate every render
  const breadcrumbs = useMemo(() => {
    return pathname
      .split('/')
      .filter(Boolean)
      .map(s => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
  }, [pathname]);

  // Load notification count
  useEffect(() => {
    async function loadNotifications() {
      try {
        const res = await fetch('/api/approvals/pending-counts', {
          credentials: 'same-origin',
        });
        const envelope = await res.json();
        if (envelope.success) {
          const counts = envelope.data;
          const total = counts.total ?? Object.values(counts).reduce((a: number, b: unknown) => a + (typeof b === 'number' ? b : 0), 0);
          setNotifCount(total as number);

          const items: { icon: string; label: string; route: string }[] = [];
          if (counts.office > 0) {
            items.push({ icon: 'ri-building-4-line', label: `${counts.office} Office Requests`, route: `${portalPrefix}/approvals` });
          }
          if (counts.supervisor > 0) {
            items.push({ icon: 'ri-shield-star-line', label: `${counts.supervisor} Supervisor Requests`, route: `${portalPrefix}/approvals` });
          }
          setNotifItems(items);
        }
      } catch {
        // Silently ignore
      }
    }
    loadNotifications();
  }, [portalPrefix]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = () => {
      setNotifOpen(false);
      setUserDropdownOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleNotifToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setUserDropdownOpen(false);
    setNotifOpen(prev => !prev);
  }, []);

  const handleUserToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifOpen(false);
    setUserDropdownOpen(prev => !prev);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        {/* Hamburger for mobile */}
        <button className={styles.hamburger} onClick={onToggleSidebar}>
          <i className="ri-menu-line" />
        </button>

        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          {breadcrumbs.map((crumb: string, idx: number) => (
            <React.Fragment key={idx}>
              {idx > 0 && <i className="ri-arrow-right-s-line" />}
              {idx === breadcrumbs.length - 1 ? (
                <span>{crumb}</span>
              ) : (
                crumb
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className={styles.headerRight}>
        {/* Theme toggle */}
        <button
          className={styles.iconBtn}
          onClick={toggleTheme}
          title={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <i className={currentTheme === 'dark' ? 'ri-sun-line' : 'ri-moon-line'} />
        </button>

        {/* Notification bell */}
        <div
          className={`${styles.notifWrapper} ${notifOpen ? styles.notifOpen : ''}`}
          onClick={handleNotifToggle}
        >
          <button className={styles.iconBtn} title="Notifications">
            <i className="ri-notification-3-line" />
            {notifCount > 0 && (
              <span className={styles.notifBadge}>{notifCount > 9 ? '9+' : notifCount}</span>
            )}
          </button>
          <div className={styles.notifDropdown}>
            <h4>Notifications</h4>
            {notifItems.length > 0 ? (
              notifItems.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.route}
                  className={styles.notifItem}
                  onClick={e => e.stopPropagation()}
                >
                  <i className={item.icon} /> {item.label}
                </Link>
              ))
            ) : (
              <div className={styles.notifEmpty}>
                <i className="ri-checkbox-circle-line" />
                No pending notifications
              </div>
            )}
          </div>
        </div>

        {/* User avatar / dropdown */}
        <div
          className={`${styles.userDropdown} ${userDropdownOpen ? styles.userDropdownOpen : ''}`}
          onClick={handleUserToggle}
        >
          <div className={styles.userBtn}>
            <div className={styles.userAvatar}>
              {currentUser ? getInitials(currentUser.name) : 'U'}
            </div>
            <span className={styles.userName}>
              {currentUser?.name || 'User'}
            </span>
            <i className="ri-arrow-down-s-line" style={{ fontSize: 14, color: 'var(--text-muted)' }} />
          </div>
          <div className={styles.userDropdownMenu}>
            <div style={{ textAlign: 'center', padding: '4px 0 8px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
                {currentUser?.name || 'User'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>
                {currentUser?.role?.toUpperCase() || 'USER'}
              </div>
            </div>
            <hr className={styles.divider} />
            <Link
              href={`${portalPrefix}/change-password`}
              className={styles.dropdownItem}
              onClick={e => e.stopPropagation()}
            >
              <i className="ri-lock-password-line" /> Change Password
            </Link>
            <button
              className={`${styles.dropdownItem} ${styles.logoutItem}`}
              onClick={(e) => {
                e.stopPropagation();
                logout().catch(() => {});
              }}
            >
              <i className="ri-logout-box-r-line" /> Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
