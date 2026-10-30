'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar, { MenuItem } from './Sidebar';
import styles from './PortalLayout.module.scss';

interface PortalLayoutProps {
  children: React.ReactNode;
  menuItems: MenuItem[];
  portalName: string;
  portalColor: string;
  requiredRole: string;
}

export default function PortalLayout({ children, menuItems, portalName, portalColor, requiredRole }: PortalLayoutProps) {
  const { user, isLoggedIn, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isLoggedIn) {
        router.push('/login');
      } else if (user && user.role !== requiredRole) {
        const routes: Record<string, string> = {
          admin: '/admin', office: '/office', supervisor: '/supervisor',
          employee: '/admin/employee/employee-ledger',
        };
        router.push(routes[user.role] || '/login');
      }
    }
  }, [user, isLoggedIn, loading, requiredRole, router]);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!isLoggedIn || (user && user.role !== requiredRole)) return null;

  return (
    <div className={styles.layout}>
      <Sidebar menuItems={menuItems} portalName={portalName} portalColor={portalColor} />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
