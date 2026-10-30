'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar, { MenuItem } from '@/components/Sidebar';
import TopHeader from '@/components/TopHeader';
import styles from '@/components/PortalLayout.module.scss';

const supervisorMenuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    icon: 'ri-dashboard-line',
    path: '/supervisor/dashboard',
  },
  {
    label: 'Attendance',
    icon: 'ri-calendar-check-line',
    path: '/supervisor/attendance',
  },
  {
    label: 'Site Leave',
    icon: 'ri-rest-time-line',
    path: '/supervisor/site-leaves',
  },
  {
    label: 'Employee Ledger',
    icon: 'ri-file-list-3-line',
    path: '/supervisor/employee-ledger',
  },
  {
    label: 'Retailer Bills',
    icon: 'ri-receipt-line',
    path: '/supervisor/retailer-bills',
  },
  {
    label: 'Payments',
    icon: 'ri-secure-payment-line',
    path: '/supervisor/payments',
  },
  {
    label: 'Supervisor Ledger',
    icon: 'ri-book-open-line',
    path: '/supervisor/supervisor-ledger',
  },
  {
    label: 'Change Password',
    icon: 'ri-lock-password-line',
    path: '/supervisor/change-password',
  },
];

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn && currentUser && currentUser.role !== 'supervisor') {
      router.replace(`/${currentUser.role}`);
    }
  }, [isLoggedIn, currentUser, router]);

  return (
    <div className={styles.layout}>
      <Sidebar
        menuItems={supervisorMenuItems}
        portalName="Supervisor Portal"
        portalIcon="ri-user-settings-line"
      />
      <div className={styles.content}>
        <TopHeader portalPrefix="/supervisor" />
        {children}
      </div>
    </div>
  );
}
