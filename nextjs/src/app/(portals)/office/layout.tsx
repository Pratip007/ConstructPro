'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar, { MenuItem } from '@/components/Sidebar';
import TopHeader from '@/components/TopHeader';
import styles from '@/components/PortalLayout.module.scss';

// Full set of possible menu items for office users.
// The actual visible set is filtered by menu allotments from the API.
const allOfficeMenuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    icon: 'ri-dashboard-line',
    path: '/office/dashboard',
  },
  {
    label: 'Master',
    icon: 'ri-settings-3-line',
    path: '/office/master',
    children: [
      { label: 'Companies', icon: 'ri-building-line', path: '/office/companies' },
      { label: 'Sites', icon: 'ri-map-pin-line', path: '/office/sites' },
      { label: 'Banks', icon: 'ri-bank-line', path: '/office/banks' },
      { label: 'Employee Categories', icon: 'ri-group-line', path: '/office/employee-categories' },
    ],
  },
  {
    label: 'Employees',
    icon: 'ri-team-line',
    path: '/office/employees-section',
    children: [
      { label: 'All Employees', icon: 'ri-team-line', path: '/office/employees' },
      { label: 'Site Tagging', icon: 'ri-map-2-line', path: '/office/site-tagging' },
      { label: 'Attendance', icon: 'ri-calendar-check-line', path: '/office/attendance' },
      { label: 'Site Leave', icon: 'ri-rest-time-line', path: '/office/site-leaves' },
      { label: 'Employee Ledger', icon: 'ri-file-list-3-line', path: '/office/employee-ledger' },
    ],
  },
  {
    label: 'Contractors',
    icon: 'ri-user-settings-line',
    path: '/office/contractors-section',
    children: [
      { label: 'All Contractors', icon: 'ri-user-settings-line', path: '/office/contractors' },
      { label: 'Contractor Ledger', icon: 'ri-file-list-3-line', path: '/office/contractor-ledger' },
    ],
  },
  {
    label: 'Supervisors',
    icon: 'ri-user-star-line',
    path: '/office/supervisors-section',
    children: [
      { label: 'All Supervisors', icon: 'ri-user-star-line', path: '/office/supervisors' },
      { label: 'Supervisor Tagging', icon: 'ri-map-2-line', path: '/office/supervisor-tagging' },
      { label: 'Supervisor Ledger', icon: 'ri-file-list-3-line', path: '/office/supervisor-ledger' },
    ],
  },
  {
    label: 'Sales',
    icon: 'ri-shopping-bag-line',
    path: '/office/sales-section',
    children: [
      { label: 'Purchase Orders', icon: 'ri-shopping-cart-line', path: '/office/purchase-orders' },
      { label: 'Invoices', icon: 'ri-bill-line', path: '/office/invoices' },
      { label: 'Balance Received', icon: 'ri-money-dollar-circle-line', path: '/office/balance-received' },
      { label: 'Company Ledger', icon: 'ri-file-list-3-line', path: '/office/company-ledger' },
    ],
  },
  {
    label: 'Purchase',
    icon: 'ri-store-line',
    path: '/office/purchase-section',
    children: [
      { label: 'Retailers', icon: 'ri-store-2-line', path: '/office/retailers' },
      { label: 'Retailer Bills', icon: 'ri-receipt-line', path: '/office/retailer-bills' },
      { label: 'Retailer Ledger', icon: 'ri-file-list-3-line', path: '/office/retailer-ledger' },
      { label: 'GST Report', icon: 'ri-government-line', path: '/office/gst-report' },
      { label: 'Non-GST Report', icon: 'ri-file-text-line', path: '/office/non-gst-report' },
    ],
  },
  {
    label: 'Payments',
    icon: 'ri-secure-payment-line',
    path: '/office/payments-section',
    children: [
      { label: 'All Payments', icon: 'ri-secure-payment-line', path: '/office/payments' },
      { label: 'Payroll', icon: 'ri-money-dollar-box-line', path: '/office/payroll' },
    ],
  },
  {
    label: 'Stock',
    icon: 'ri-archive-line',
    path: '/office/stock-section',
    children: [
      { label: 'Stock Products', icon: 'ri-archive-line', path: '/office/stock-products' },
      { label: 'Site Inventory', icon: 'ri-stack-line', path: '/office/site-inventory' },
      { label: 'Stock Transfers', icon: 'ri-arrow-left-right-line', path: '/office/stock-transfers' },
      { label: 'Damaged Stocks', icon: 'ri-spam-line', path: '/office/damaged-stocks' },
    ],
  },
  {
    label: 'Equipment',
    icon: 'ri-tools-line',
    path: '/office/equipment-section',
    children: [
      { label: 'Equipment Parties', icon: 'ri-tools-line', path: '/office/equipment' },
      { label: 'Equipment Assignments', icon: 'ri-links-line', path: '/office/equipment-assignments' },
    ],
  },
  {
    label: 'Vehicles',
    icon: 'ri-truck-line',
    path: '/office/vehicles',
  },
  {
    label: 'Income/Expense',
    icon: 'ri-exchange-funds-line',
    path: '/office/income-expenses',
  },
  {
    label: 'Reports',
    icon: 'ri-bar-chart-box-line',
    path: '/office/reports-section',
    children: [
      { label: 'Site Ledger', icon: 'ri-book-open-line', path: '/office/site-ledger' },
      { label: 'Sales Report', icon: 'ri-line-chart-line', path: '/office/sales-report' },
    ],
  },
];

// Default menu slugs shown when the API doesn't return allotments
const defaultMenuSlugs = ['Dashboard', 'Employees', 'Contractors', 'Purchase', 'Payments', 'Supervisors'];

export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoggedIn } = useAuth();
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  // Role guard only — middleware handles the cookie check
  useEffect(() => {
    if (isLoggedIn && currentUser && currentUser.role !== 'office') {
      router.replace(`/${currentUser.role}`);
    }
  }, [isLoggedIn, currentUser, router]);

  // Fetch menu allotments from API — only once per session via sessionStorage cache
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;

    const cacheKey = `office_menus_${currentUser.id}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const items = JSON.parse(cached);
        setMenuItems(items);
        return;
      } catch {}
    }

    async function fetchMenuPermissions() {
      try {
        const res = await fetch(`/api/settings/menus/${currentUser!.id}`, {
          credentials: 'same-origin',
        });
        const envelope = await res.json();

        let items = allOfficeMenuItems.filter(m => defaultMenuSlugs.includes(m.label));
        if (envelope.success) {
          const allottedSlugs: string[] = envelope.data?.menus ?? envelope.data ?? [];
          if (Array.isArray(allottedSlugs) && allottedSlugs.length > 0) {
            const slugSet = new Set(allottedSlugs);
            slugSet.add('Dashboard');
            items = allOfficeMenuItems.filter(m => slugSet.has(m.label));
          }
        }
        setMenuItems(items);
        sessionStorage.setItem(cacheKey, JSON.stringify(items));
      } catch {
        const items = allOfficeMenuItems.filter(m => defaultMenuSlugs.includes(m.label));
        setMenuItems(items);
      }
    }

    fetchMenuPermissions();
  }, [currentUser?.id]);

  return (
    <div className={styles.layout}>
      <Sidebar
        menuItems={menuItems}
        portalName="Office Portal"
        portalIcon="ri-building-2-line"
      />
      <div className={styles.content}>
        <TopHeader portalPrefix="/office" />
        {children}
      </div>
    </div>
  );
}
