'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';

interface SummaryCard {
  title: string;
  value: number;
  icon: string;
  color: string;
}

interface RecentActivity {
  id: string;
  module: string;
  action: string;
  timestamp: string;
  requestedBy: string;
  status: string;
}

const quickActions = [
  { label: 'Employee Joining', icon: 'ri-user-add-line', route: '/office/employee/registered-employees', color: '#4a7fc1' },
  { label: 'Site Tagging', icon: 'ri-map-pin-line', route: '/office/employee/site-tagging', color: '#28a745' },
  { label: 'Contractor Order', icon: 'ri-file-add-line', route: '/office/contractor/site-order-entry', color: '#ffc107' },
  { label: 'Invoice Entry', icon: 'ri-bill-line', route: '/office/purchase/retail-site-invoice', color: '#e74c3c' },
  { label: 'Retail Purchase', icon: 'ri-store-2-line', route: '/office/purchase/add-retailer', color: '#9b59b6' },
  { label: 'Attendance', icon: 'ri-calendar-check-line', route: '/office/employee/employee-attendance', color: '#17a2b8' },
  { label: 'Payment List', icon: 'ri-receipt-line', route: '/office/employee/payment-list', color: '#fd7e14' },
  { label: 'Stock View', icon: 'ri-stack-line', route: '/office/contractor/product-entry', color: '#20c997' },
];

export default function OfficeDashboardPage() {
  const { currentUser } = useAuth();
  const api = useApi();
  const notifications = useNotification();

  const [kpiCards, setKpiCards] = useState<SummaryCard[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Load pending counts
  useEffect(() => {
    async function loadPendingCounts() {
      try {
        const counts = await api.get<any>('/approvals/pending-counts');
        setKpiCards([
          { title: 'Office Pending Approvals', value: counts?.office ?? 0, icon: 'ri-time-line', color: 'warning' },
          { title: 'Supervisor Pending', value: counts?.supervisor ?? 0, icon: 'ri-shield-check-line', color: 'success' },
          { title: 'Loan Pending', value: counts?.loans ?? 0, icon: 'ri-bank-line', color: 'info' },
          { title: 'Total Pending', value: (counts?.office ?? 0) + (counts?.supervisor ?? 0) + (counts?.loans ?? 0), icon: 'ri-notification-3-line', color: 'danger' },
        ]);
        setLoading(false);
      } catch {
        notifications.error('Failed to load pending approval counts');
        setLoading(false);
      }
    }
    loadPendingCounts();
  }, [api, notifications]);

  // Load recent activity
  useEffect(() => {
    async function loadRecentActivity() {
      try {
        const data = await api.get<any[]>('/approvals', { status: 'all' });
        const items = (data ?? []).slice(0, 10).map((r: any) => ({
          id: r.request_id ?? String(r.id),
          module: r.module ?? '',
          action: r.action ?? '',
          timestamp: r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '',
          requestedBy: r.requested_by_name ?? '',
          status: r.status ?? '',
        }));
        setRecentActivity(items);
      } catch {}
    }
    loadRecentActivity();
  }, [api]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-building-line" /> Office Dashboard</h1>
        {currentUser && (
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Welcome, {currentUser.name} ({currentUser.displayId})
          </p>
        )}
      </div>

      {/* KPI Cards */}
      <div className="summary-grid">
        {kpiCards.map((card) => (
          <div key={card.title} className={`summary-card card-${card.color}`}>
            <div className="card-icon-area">
              <i className={card.icon} />
            </div>
            <div className="card-content">
              <span className="card-title">{card.title}</span>
              <span className="card-value">{card.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions Grid */}
      <div className="card-container" style={{ marginTop: 20 }}>
        <h3 style={{ color: 'var(--text-main)', margin: '0 0 16px' }}>
          <i className="ri-flashlight-line" /> Quick Actions
        </h3>
        <div className="quick-actions-grid">
          {quickActions.map((action) => (
            <Link
              key={action.route}
              href={action.route}
              className="quick-action-btn"
              style={{ '--action-color': action.color } as React.CSSProperties}
            >
              <div className="action-icon">
                <i className={action.icon} />
              </div>
              <span className="action-label">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card-container" style={{ marginTop: 20 }}>
        <h3 style={{ color: 'var(--text-main)', margin: '0 0 16px' }}>
          <i className="ri-time-line" /> Recent Activity
        </h3>
        {recentActivity.length > 0 ? (
          <div className="activity-timeline">
            {recentActivity.map((item) => (
              <div key={item.id} className="timeline-item">
                <div
                  className={`timeline-dot${
                    item.status === 'pending' ? ' pending' :
                    item.status === 'approved' ? ' approved' :
                    item.status === 'rejected' ? ' rejected' : ''
                  }`}
                />
                <div className="timeline-content">
                  <div className="timeline-header">
                    <strong>{item.module}</strong> &mdash; {item.action}
                    {item.status === 'pending' && (
                      <span className="badge badge-warning">Pending</span>
                    )}
                    {item.status === 'approved' && (
                      <span className="badge badge-success">Approved</span>
                    )}
                    {item.status !== 'pending' && item.status !== 'approved' && (
                      <span className="badge badge-danger">{item.status}</span>
                    )}
                  </div>
                  <div className="timeline-meta">
                    <span>By: {item.requestedBy}</span>
                    <span>{item.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>
            {loading ? 'Loading recent activity...' : 'No recent activity to show.'}
          </p>
        )}
      </div>
    </div>
  );
}
