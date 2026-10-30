'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPut } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import SearchableDropdown from '@/components/SearchableDropdown';

interface User {
  id: string;
  profile_id?: string;
  name: string;
  email: string;
  role: string;
}

interface MenuItem {
  key: string;
  label: string;
  category: string;
  icon?: string;
}

const ALL_MENU_ITEMS: MenuItem[] = [
  // Dashboard
  { key: 'dashboard', label: 'Dashboard', category: 'Dashboard', icon: 'ri-dashboard-line' },
  // Company
  { key: 'add-company', label: 'Add Company', category: 'Company', icon: 'ri-building-line' },
  { key: 'balance-received', label: 'Balance Received', category: 'Company', icon: 'ri-money-rupee-circle-line' },
  { key: 'company-ledger', label: 'Company Ledger', category: 'Company', icon: 'ri-file-list-3-line' },
  { key: 'company-loan', label: 'Loan Management', category: 'Company', icon: 'ri-hand-coin-line' },
  { key: 'vehicle-management', label: 'Vehicle Management', category: 'Company', icon: 'ri-truck-line' },
  { key: 'income-expense', label: 'Income & Expense', category: 'Company', icon: 'ri-exchange-funds-line' },
  { key: 'bank-statement', label: 'Bank Statement', category: 'Company', icon: 'ri-bank-line' },
  // Employee
  { key: 'employee-category', label: 'Employee Category', category: 'Employee', icon: 'ri-award-line' },
  { key: 'registered-employees', label: 'Registered Employees', category: 'Employee', icon: 'ri-team-line' },
  { key: 'site-tagging', label: 'Site Tagging', category: 'Employee', icon: 'ri-map-pin-line' },
  { key: 'employee-sub-id', label: 'Employee Sub ID', category: 'Employee', icon: 'ri-id-card-line' },
  { key: 'payment-list', label: 'Payment List', category: 'Employee', icon: 'ri-money-rupee-circle-line' },
  { key: 'employee-attendance', label: 'Attendance', category: 'Employee', icon: 'ri-calendar-check-line' },
  // Contractor
  { key: 'add-contractor', label: 'Add Contractor', category: 'Contractor', icon: 'ri-user-add-line' },
  { key: 'site-order-entry', label: 'Site Order Entry', category: 'Contractor', icon: 'ri-file-edit-line' },
  { key: 'product-entry', label: 'Product Entry', category: 'Contractor', icon: 'ri-box-3-line' },
  { key: 'contractor-ledger', label: 'Contractor Ledger', category: 'Contractor', icon: 'ri-file-list-3-line' },
  // Mobilization
  { key: 'add-equipment', label: 'Add Equipment', category: 'Mobilization', icon: 'ri-tools-line' },
  { key: 'site-order-equipment', label: 'Site Order Equipment', category: 'Mobilization', icon: 'ri-file-edit-line' },
  { key: 'equipment-leave', label: 'Equipment Leave', category: 'Mobilization', icon: 'ri-logout-box-line' },
  { key: 'site-tagging-equipment', label: 'Equipment Tagging', category: 'Mobilization', icon: 'ri-map-pin-line' },
  // Supervisor
  { key: 'add-supervisor', label: 'Add Supervisor', category: 'Supervisor', icon: 'ri-user-star-line' },
  { key: 'site-tagging-supervisor', label: 'Supervisor Tagging', category: 'Supervisor', icon: 'ri-map-pin-line' },
  { key: 'supervisor-ledger', label: 'Supervisor Ledger', category: 'Supervisor', icon: 'ri-file-list-3-line' },
  // Sales
  { key: 'purchase-order-entry', label: 'Purchase Order Entry', category: 'Sales', icon: 'ri-shopping-cart-line' },
  { key: 'invoice-entry', label: 'Invoice Entry', category: 'Sales', icon: 'ri-bill-line' },
  { key: 'view-site', label: 'View Site', category: 'Sales', icon: 'ri-eye-line' },
  // Purchase
  { key: 'add-retailer', label: 'Add Retailer', category: 'Purchase', icon: 'ri-store-line' },
  { key: 'retail-site-invoice', label: 'Retail Site Invoice', category: 'Purchase', icon: 'ri-bill-line' },
  { key: 'gst-report', label: 'GST Report', category: 'Purchase', icon: 'ri-file-chart-line' },
  { key: 'non-gst-report', label: 'Non-GST Report', category: 'Purchase', icon: 'ri-file-chart-line' },
  { key: 'retail-ledger', label: 'Retail Ledger', category: 'Purchase', icon: 'ri-file-list-3-line' },
  // Payment
  { key: 'all-type-payment', label: 'All Type Payment', category: 'Payment', icon: 'ri-bank-card-line' },
  { key: 'payment-view', label: 'Payment View', category: 'Payment', icon: 'ri-eye-line' },
  // Stock
  { key: 'stock-view', label: 'Stock View', category: 'Stock', icon: 'ri-box-3-line' },
  { key: 'current-stock', label: 'Current Stock', category: 'Stock', icon: 'ri-stack-line' },
  { key: 'stock-transfer', label: 'Stock Transfer', category: 'Stock', icon: 'ri-exchange-line' },
  { key: 'stock-report', label: 'Stock Report', category: 'Stock', icon: 'ri-file-chart-line' },
  // Reports
  { key: 'mobilization-report', label: 'Mobilization Report', category: 'Reports', icon: 'ri-file-chart-line' },
  { key: 'employee-report', label: 'Employee Report', category: 'Reports', icon: 'ri-file-chart-line' },
  { key: 'contractor-report', label: 'Contractor Report', category: 'Reports', icon: 'ri-file-chart-line' },
  { key: 'company-report', label: 'Company Report', category: 'Reports', icon: 'ri-file-chart-line' },
  { key: 'supervisor-report', label: 'Supervisor Report', category: 'Reports', icon: 'ri-file-chart-line' },
  { key: 'sales-report', label: 'Sales Report', category: 'Reports', icon: 'ri-file-chart-line' },
  { key: 'purchase-report', label: 'Purchase Report', category: 'Reports', icon: 'ri-file-chart-line' },
  { key: 'full-site-ledger', label: 'Full Site Ledger', category: 'Reports', icon: 'ri-file-chart-line' },
  // Documents
  { key: 'create-doc-list', label: 'Document Library', category: 'Documents', icon: 'ri-file-list-3-line' },
  { key: 'backup', label: 'Backup & Restore', category: 'Documents', icon: 'ri-database-2-line' },
  // Settings
  { key: 'users', label: 'User Management', category: 'Settings', icon: 'ri-user-settings-line' },
  { key: 'menu-allotments', label: 'Menu Allotments', category: 'Settings', icon: 'ri-menu-add-line' },
  { key: 'heads', label: 'Head Allotments', category: 'Settings', icon: 'ri-organization-chart' },
  { key: 'terms', label: 'Terms & Conditions', category: 'Settings', icon: 'ri-file-text-line' },
  { key: 'approvals', label: 'Approvals', category: 'Settings', icon: 'ri-checkbox-circle-line' },
];

const CATEGORIES = Array.from(new Set(ALL_MENU_ITEMS.map(m => m.category)));

export default function MenuAllotmentsPage() {
  const { success, error: notifyError } = useNotification();

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [allotedMenus, setAllotedMenus] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<User[]>('/users')
      .then(res => setUsers((Array.isArray(res) ? res : []).filter(u => u.role === 'office')))
      .catch(() => {});
  }, []);

  const userItems = useMemo(
    () => users.map(u => ({ value: u.profile_id ?? u.id, label: `${u.name} (${u.email})` })),
    [users]
  );

  const loadAllotments = useCallback(async (profileId: string) => {
    setLoading(true);
    try {
      const res = await apiGet<{ menuItems?: string[] }>(`/settings/menus/${profileId}`);
      setAllotedMenus(Array.isArray(res?.menuItems) ? res.menuItems : Array.isArray(res) ? res as any : []);
    } catch {
      setAllotedMenus([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onUserChange = useCallback((val: string | null) => {
    setSelectedUserId(val);
    if (val) {
      loadAllotments(val);
    } else {
      setAllotedMenus([]);
    }
  }, [loadAllotments]);

  const toggleMenu = useCallback((key: string) => {
    setAllotedMenus(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }, []);

  const toggleCategory = useCallback((category: string) => {
    const categoryKeys = ALL_MENU_ITEMS.filter(m => m.category === category).map(m => m.key);
    const allSelected = categoryKeys.every(k => allotedMenus.includes(k));
    if (allSelected) {
      setAllotedMenus(prev => prev.filter(k => !categoryKeys.includes(k)));
    } else {
      setAllotedMenus(prev => {
        const newMenus = new Set([...prev, ...categoryKeys]);
        return Array.from(newMenus);
      });
    }
  }, [allotedMenus]);

  const selectAll = useCallback(() => {
    setAllotedMenus(ALL_MENU_ITEMS.map(m => m.key));
  }, []);

  const deselectAll = useCallback(() => {
    setAllotedMenus([]);
  }, []);

  const saveAllotments = useCallback(async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await apiPut(`/settings/menus/${selectedUserId}`, { menuItems: allotedMenus });
      success('Menu allotments saved successfully');
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to save allotments');
    } finally {
      setSaving(false);
    }
  }, [selectedUserId, allotedMenus, success, notifyError]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-menu-add-line" /> Menu Allotments</h1>
      </div>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group" style={{ minWidth: 300 }}>
            <SearchableDropdown
              items={userItems}
              label="Select User (Office Role)"
              placeholder="Search user..."
              value={selectedUserId}
              onChange={onUserChange}
            />
          </div>
        </div>
      </div>

      {selectedUserId && (
        <div className="card-container" style={{ marginTop: 16 }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading menu allotments...</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                  Assign Menu Items ({allotedMenus.length} / {ALL_MENU_ITEMS.length} selected)
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary" onClick={selectAll} style={{ fontSize: 12, padding: '4px 12px' }}>
                    Select All
                  </button>
                  <button className="btn-secondary" onClick={deselectAll} style={{ fontSize: 12, padding: '4px 12px' }}>
                    Deselect All
                  </button>
                </div>
              </div>

              {CATEGORIES.map(category => {
                const categoryItems = ALL_MENU_ITEMS.filter(m => m.category === category);
                const allCatSelected = categoryItems.every(m => allotedMenus.includes(m.key));
                const someCatSelected = categoryItems.some(m => allotedMenus.includes(m.key));

                return (
                  <div key={category} style={{ marginBottom: 16 }}>
                    <label
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        padding: '6px 0', borderBottom: '1px solid var(--border-color)', marginBottom: 8,
                        color: 'var(--text-main)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={allCatSelected}
                        ref={el => { if (el) el.indeterminate = someCatSelected && !allCatSelected; }}
                        onChange={() => toggleCategory(category)}
                        style={{ width: 16, height: 16 }}
                      />
                      {category}
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>
                        ({categoryItems.filter(m => allotedMenus.includes(m.key)).length}/{categoryItems.length})
                      </span>
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingLeft: 8 }}>
                      {categoryItems.map(item => (
                        <label
                          key={item.key}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                            background: allotedMenus.includes(item.key) ? 'rgba(59,130,246,0.1)' : 'var(--bg-secondary)',
                            border: `1px solid ${allotedMenus.includes(item.key) ? 'rgba(59,130,246,0.3)' : 'var(--border-color)'}`,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={allotedMenus.includes(item.key)}
                            onChange={() => toggleMenu(item.key)}
                            style={{ width: 14, height: 14 }}
                          />
                          {item.icon && <i className={item.icon} style={{ fontSize: 14 }} />}
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                <button
                  className="btn-primary"
                  onClick={saveAllotments}
                  disabled={saving}
                >
                  <i className={saving ? 'ri-loader-4-line' : 'ri-save-line'} />
                  {saving ? ' Saving...' : ' Save Allotments'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
