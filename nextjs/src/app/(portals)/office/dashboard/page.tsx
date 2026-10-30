'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import PageHeader from '@/components/PageHeader';

interface KpiData {
  pendingApprovals: number;
  activeEmployees: number;
  attendanceToday: number;
  paymentsPending: number;
}

interface NotificationItem {
  id: number;
  message: string;
  type: string;
  time: string;
}

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)} K`;
  return amount.toLocaleString('en-IN');
}

export default function OfficeDashboardPage() {
  const { apiGet } = useApi();
  const { error: notifyError } = useNotification();
  const [kpis, setKpis] = useState<KpiData>({ pendingApprovals: 0, activeEmployees: 0, attendanceToday: 0, paymentsPending: 0 });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [kpiData, notifData] = await Promise.all([
        apiGet<any>('/api/dashboard/kpis').catch(() => null),
        apiGet<any>('/api/dashboard/notifications').catch(() => []),
      ]);
      if (kpiData) {
        setKpis({
          pendingApprovals: kpiData.pendingApprovals ?? 0,
          activeEmployees: kpiData.activeEmployees ?? 0,
          attendanceToday: kpiData.attendanceToday ?? 0,
          paymentsPending: kpiData.paymentsPending ?? 0,
        });
      }
      if (Array.isArray(notifData)) {
        setNotifications(notifData);
      }
    } catch (err: any) {
      notifyError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summaryCards = [
    { title: 'Pending Approvals', value: kpis.pendingApprovals, icon: 'ri-checkbox-circle-line', variant: 'cardWarning' },
    { title: 'Employees', value: kpis.activeEmployees, icon: 'ri-team-line', variant: 'cardSuccess' },
    { title: 'Attendance Today', value: kpis.attendanceToday, icon: 'ri-calendar-check-line', variant: 'cardPrimary' },
    { title: 'Payments Pending', value: kpis.paymentsPending, icon: 'ri-money-dollar-circle-line', variant: 'cardDanger', isCurrency: true },
  ];

  if (loading) {
    return (
      <div className="page-container">
        <PageHeader title="Office Dashboard" icon="ri-dashboard-line" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader title="Office Dashboard" icon="ri-dashboard-line" />

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        {summaryCards.map(card => (
          <div
            key={card.title}
            className="card-container"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: 20,
              borderLeft: `3px solid ${
                card.variant === 'cardPrimary' ? 'var(--accent)' :
                card.variant === 'cardSuccess' ? 'var(--success)' :
                card.variant === 'cardWarning' ? 'var(--warning)' :
                card.variant === 'cardDanger' ? 'var(--danger)' : 'var(--accent)'
              }`,
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
              background: card.variant === 'cardPrimary' ? 'var(--accent-glow)' :
                card.variant === 'cardSuccess' ? 'rgba(46, 204, 113, 0.12)' :
                card.variant === 'cardWarning' ? 'rgba(253, 126, 20, 0.12)' :
                'rgba(231, 76, 60, 0.12)',
              color: card.variant === 'cardPrimary' ? 'var(--accent)' :
                card.variant === 'cardSuccess' ? 'var(--success)' :
                card.variant === 'cardWarning' ? 'var(--warning)' : 'var(--danger)',
            }}>
              <i className={card.icon} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {card.title}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)' }}>
                {card.isCurrency ? `Rs. ${formatCurrency(card.value)}` : card.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="card-container">
        <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
          <i className="ri-notification-3-line" /> Recent Activity
        </h4>
        {notifications.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notifications.map(notif => (
              <div key={notif.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 8,
                background: 'var(--glass-bg)', border: '1px solid var(--border-color)', fontSize: 13,
              }}>
                <i className={
                  notif.type === 'approval' ? 'ri-checkbox-circle-line' :
                  notif.type === 'payment' ? 'ri-money-dollar-circle-line' : 'ri-information-line'
                } style={{
                  fontSize: 18, flexShrink: 0,
                  color: notif.type === 'approval' ? 'var(--success)' :
                    notif.type === 'payment' ? 'var(--accent)' : 'var(--info)',
                }} />
                <div style={{ flex: 1 }}>
                  <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{notif.message}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{notif.time}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '24px 20px' }}>
            <i className="ri-notification-off-line" />
            <h3>No Recent Activity</h3>
            <p>New notifications and activity will appear here.</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
          <i className="ri-apps-line" /> Quick Actions
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {[
            { label: 'Add Employee', icon: 'ri-user-add-line', href: '/office/employees', color: 'var(--success)' },
            { label: 'Attendance', icon: 'ri-calendar-check-line', href: '/office/attendance', color: 'var(--accent)' },
            { label: 'Record Payment', icon: 'ri-money-dollar-circle-line', href: '/office/payments', color: 'var(--info)' },
            { label: 'Retailer Bill', icon: 'ri-receipt-line', href: '/office/retailer-bills', color: 'var(--warning)' },
            { label: 'Site Tagging', icon: 'ri-map-pin-line', href: '/office/site-tagging', color: 'var(--purple, #9b59b6)' },
            { label: 'Payroll', icon: 'ri-money-dollar-box-line', href: '/office/payroll', color: 'var(--danger)' },
          ].map(action => (
            <Link key={action.label} href={action.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', borderRadius: 8,
              background: 'var(--glass-bg)', border: '1px solid var(--border-color)',
              textDecoration: 'none', color: 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
            }}>
              <i className={action.icon} style={{ fontSize: 18, color: action.color }} />
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
