'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

import Sidebar, { MenuItem } from '@/components/Sidebar';
import TopHeader from '@/components/TopHeader';
import styles from '@/components/PortalLayout.module.scss';

const adminMenuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    icon: 'ri-dashboard-line',
    path: '/admin/dashboard',
  },
  {
    label: 'Master',
    icon: 'ri-settings-3-line',
    path: '/admin/master',
    children: [
      { label: 'Companies', icon: 'ri-building-line', path: '/admin/companies' },
      { label: 'Sites', icon: 'ri-map-pin-line', path: '/admin/sites' },
      { label: 'Banks', icon: 'ri-bank-line', path: '/admin/banks' },
      { label: 'Employee Categories', icon: 'ri-group-line', path: '/admin/employee-categories' },
    ],
  },
  {
    label: 'Employees',
    icon: 'ri-team-line',
    path: '/admin/employees-section',
    children: [
      { label: 'All Employees', icon: 'ri-team-line', path: '/admin/employees' },
      { label: 'Site Tagging', icon: 'ri-map-2-line', path: '/admin/site-tagging' },
      { label: 'Attendance', icon: 'ri-calendar-check-line', path: '/admin/attendance' },
      { label: 'Site Leave', icon: 'ri-rest-time-line', path: '/admin/site-leaves' },
      { label: 'Employee Ledger', icon: 'ri-file-list-3-line', path: '/admin/employee-ledger' },
    ],
  },
  {
    label: 'Contractors',
    icon: 'ri-user-settings-line',
    path: '/admin/contractors-section',
    children: [
      { label: 'All Contractors', icon: 'ri-user-settings-line', path: '/admin/contractors' },
      { label: 'Contractor Ledger', icon: 'ri-file-list-3-line', path: '/admin/contractor-ledger' },
    ],
  },
  {
    label: 'Supervisors',
    icon: 'ri-user-star-line',
    path: '/admin/supervisors-section',
    children: [
      { label: 'All Supervisors', icon: 'ri-user-star-line', path: '/admin/supervisors' },
      { label: 'Supervisor Tagging', icon: 'ri-map-2-line', path: '/admin/supervisor-tagging' },
      { label: 'Supervisor Ledger', icon: 'ri-file-list-3-line', path: '/admin/supervisor-ledger' },
    ],
  },
  {
    label: 'Sales',
    icon: 'ri-shopping-bag-line',
    path: '/admin/sales-section',
    children: [
      { label: 'Purchase Orders', icon: 'ri-shopping-cart-line', path: '/admin/purchase-orders' },
      { label: 'Invoices', icon: 'ri-bill-line', path: '/admin/invoices' },
      { label: 'Balance Received', icon: 'ri-money-dollar-circle-line', path: '/admin/balance-received' },
      { label: 'Company Ledger', icon: 'ri-file-list-3-line', path: '/admin/company-ledger' },
    ],
  },
  {
    label: 'Purchase',
    icon: 'ri-store-line',
    path: '/admin/purchase-section',
    children: [
      { label: 'Retailers', icon: 'ri-store-2-line', path: '/admin/retailers' },
      { label: 'Retailer Bills', icon: 'ri-receipt-line', path: '/admin/retailer-bills' },
      { label: 'Retailer Ledger', icon: 'ri-file-list-3-line', path: '/admin/retailer-ledger' },
      { label: 'GST Report', icon: 'ri-government-line', path: '/admin/gst-report' },
      { label: 'Non-GST Report', icon: 'ri-file-text-line', path: '/admin/non-gst-report' },
    ],
  },
  {
    label: 'Payments',
    icon: 'ri-secure-payment-line',
    path: '/admin/payments-section',
    children: [
      { label: 'All Payments', icon: 'ri-secure-payment-line', path: '/admin/payments' },
      { label: 'Payroll', icon: 'ri-money-dollar-box-line', path: '/admin/payroll' },
    ],
  },
  {
    label: 'Stock',
    icon: 'ri-archive-line',
    path: '/admin/stock-section',
    children: [
      { label: 'Stock Products', icon: 'ri-archive-line', path: '/admin/stock-products' },
      { label: 'Site Inventory', icon: 'ri-stack-line', path: '/admin/site-inventory' },
      { label: 'Stock Transfers', icon: 'ri-arrow-left-right-line', path: '/admin/stock-transfers' },
      { label: 'Damaged Stocks', icon: 'ri-spam-line', path: '/admin/damaged-stocks' },
    ],
  },
  {
    label: 'Equipment',
    icon: 'ri-tools-line',
    path: '/admin/equipment-section',
    children: [
      { label: 'Equipment Parties', icon: 'ri-tools-line', path: '/admin/equipment' },
      { label: 'Equipment Assignments', icon: 'ri-links-line', path: '/admin/equipment-assignments' },
      { label: 'Mobilization Report', icon: 'ri-pie-chart-line', path: '/admin/mobilization-report' },
    ],
  },
  {
    label: 'Vehicles',
    icon: 'ri-truck-line',
    path: '/admin/vehicles',
  },
  {
    label: 'Income/Expense',
    icon: 'ri-exchange-funds-line',
    path: '/admin/income-expenses',
  },
  {
    label: 'Loans',
    icon: 'ri-hand-coin-line',
    path: '/admin/loans',
  },
  {
    label: 'Documents',
    icon: 'ri-folder-line',
    path: '/admin/documents',
  },
  {
    label: 'Approvals',
    icon: 'ri-checkbox-circle-line',
    path: '/admin/approvals',
  },
  {
    label: 'Reports',
    icon: 'ri-bar-chart-box-line',
    path: '/admin/reports-section',
    children: [
      { label: 'Site Ledger', icon: 'ri-book-open-line', path: '/admin/site-ledger' },
      { label: 'Sales Report', icon: 'ri-line-chart-line', path: '/admin/sales-report' },
    ],
  },
  {
    label: 'Settings',
    icon: 'ri-settings-4-line',
    path: '/admin/settings-section',
    children: [
      { label: 'Terms & Conditions', icon: 'ri-file-shield-line', path: '/admin/terms' },
      { label: 'Head Allotments', icon: 'ri-list-settings-line', path: '/admin/heads' },
      { label: 'Menu Allotments', icon: 'ri-menu-add-line', path: '/admin/menu-allotments' },
      { label: 'Backup/Restore', icon: 'ri-database-line', path: '/admin/backup' },
      { label: 'Users', icon: 'ri-shield-user-line', path: '/admin/users' },
      { label: 'Change Password', icon: 'ri-lock-password-line', path: '/admin/change-password' },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Middleware already guards this route server-side via httpOnly cookie.
  // We only need role-based redirect here.
  const { currentUser, isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn && currentUser && currentUser.role !== 'admin') {
      router.replace(`/${currentUser.role}`);
    }
  }, [isLoggedIn, currentUser, router]);

  return (
    <div className={styles.layout}>
      <Sidebar
        menuItems={adminMenuItems}
        portalName="Admin Portal"
        portalIcon="ri-shield-star-line"
      />
      <div className={styles.content}>
        <TopHeader portalPrefix="/admin" />
        {children}
      </div>
    </div>
  );
}
