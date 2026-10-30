'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import styles from './Sidebar.module.scss';

export interface MenuItem {
  label: string;
  icon: string;
  path: string;
  children?: MenuItem[];
}

export interface SidebarProps {
  menuItems: MenuItem[];
  portalName: string;
  portalIcon?: string;
  portalColor?: string;
  [extra: string]: any;
}

export default function Sidebar({ menuItems, portalName, portalIcon }: SidebarProps) {
  const { currentUser, logout } = useAuth();
  const { currentTheme, toggleTheme } = useTheme();
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  // Check for mobile viewport
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(false);
        setMobileOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-expand section containing the active path
  useEffect(() => {
    menuItems.forEach(item => {
      if (item.children) {
        const hasActive = item.children.some(
          child => pathname === child.path || pathname.startsWith(child.path + '/')
        );
        if (hasActive) {
          setOpenSections(prev => new Set(prev).add(item.label));
        }
      }
    });
  }, [pathname, menuItems]);

  const toggleSection = useCallback((label: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  const toggleMobile = useCallback(() => {
    setMobileOpen(prev => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    if (isMobile) setMobileOpen(false);
  }, [isMobile]);

  const isActive = useCallback(
    (path: string) => pathname === path || pathname.startsWith(path + '/'),
    [pathname]
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const sidebarClasses = [
    styles.sidebar,
    isMobile && mobileOpen ? styles.open : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {/* Mobile toggle button */}
      {isMobile && (
        <button className={styles.mobileToggle} onClick={toggleMobile}>
          <i className={mobileOpen ? 'ri-close-line' : 'ri-menu-line'} />
        </button>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div className={styles.overlay} onClick={closeMobile} />
      )}

      <aside className={sidebarClasses}>
        {/* Brand / Logo */}
        <div className={styles.brand}>
          <div className={styles.logoIcon} style={{ background: 'var(--accent-glow)' }}>
            <i className={portalIcon} style={{ color: 'var(--accent)' }} />
          </div>
          <div className={styles.brandText}>
            <h3>
              Construct<span style={{ color: 'var(--accent)' }}>Pro</span>
            </h3>
            <span style={{ color: 'var(--text-muted)' }}>{portalName}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {menuItems.map(item => {
            if (item.children && item.children.length > 0) {
              // Parent menu with children
              const isOpen = openSections.has(item.label);
              const hasActiveChild = item.children.some(child => isActive(child.path));

              return (
                <div key={item.label} className={styles.menuItem}>
                  <button
                    className={`${styles.menuButton} ${hasActiveChild ? styles.active : ''}`}
                    onClick={() => toggleSection(item.label)}
                  >
                    <i className={item.icon} />
                    <span>{item.label}</span>
                    <i className={`ri-arrow-down-s-line ${styles.arrow} ${isOpen ? styles.rotated : ''}`} />
                  </button>
                  {isOpen && (
                    <div className={styles.subMenu}>
                      {item.children.map(child => (
                        <Link
                          key={child.path}
                          href={child.path}
                          className={`${styles.subMenuItem} ${isActive(child.path) ? styles.active : ''}`}
                          onClick={closeMobile}
                        >
                          <i className={child.icon} style={{ fontSize: 14, marginRight: 6 }} />
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            // Single menu item (no children)
            return (
              <div key={item.path} className={styles.menuItem}>
                <Link
                  href={item.path}
                  className={`${styles.menuButton} ${isActive(item.path) ? styles.active : ''}`}
                  onClick={closeMobile}
                >
                  <i className={item.icon} />
                  <span>{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Footer: User info + actions */}
        <div className={styles.footer}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {currentUser ? getInitials(currentUser.name) : 'U'}
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>
                {currentUser?.name || 'User'}
              </span>
              <span
                className="badge badge-accent"
                style={{ fontSize: 9, padding: '2px 6px' }}
              >
                {currentUser?.role?.toUpperCase() || 'USER'}
              </span>
            </div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={toggleTheme}
            title={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <i className={currentTheme === 'dark' ? 'ri-sun-line' : 'ri-moon-line'} />
          </button>
          <button
            className={styles.logoutBtn}
            onClick={() => logout()}
            title="Logout"
          >
            <i className="ri-logout-box-r-line" />
          </button>
        </div>
      </aside>
    </>
  );
}
