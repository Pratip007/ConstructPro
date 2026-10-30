'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface KpiData {
  activeSites: number;
  activeEmployees: number;
  contractors: number;
  supervisors: number;
  retailers: number;
  totalBankBalance: number;
}

interface FinancialSummary {
  labels: string[];
  income: number[];
  expense: number[];
}

interface SiteActivity {
  labels: string[];
  orders: number[];
  invoices: number[];
}

interface NotificationItem {
  id: number;
  message: string;
  type: string;
  time: string;
}

const defaultKpis: KpiData = {
  activeSites: 0,
  activeEmployees: 0,
  contractors: 0,
  supervisors: 0,
  retailers: 0,
  totalBankBalance: 0,
};

const defaultFinancial: FinancialSummary = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  income: [120000, 185000, 150000, 210000, 175000, 230000],
  expense: [95000, 140000, 125000, 170000, 145000, 190000],
};

const defaultSiteActivity: SiteActivity = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  orders: [12, 19, 15, 22, 18, 25],
  invoices: [8, 14, 11, 17, 13, 20],
};

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)} K`;
  return amount.toLocaleString('en-IN');
}

// Simple div-based bar chart component (no Chart.js dependency)
function BarChart({
  labels,
  datasets,
}: {
  labels: string[];
  datasets: { label: string; data: number[]; color: string }[];
}) {
  const allValues = datasets.flatMap(d => d.data);
  const maxVal = Math.max(...allValues, 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 11 }}>
        {datasets.map(ds => (
          <div key={ds.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: ds.color }} />
            <span style={{ color: 'var(--text-muted)' }}>{ds.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160 }}>
        {labels.map((label, idx) => (
          <div
            key={label}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              height: '100%',
              justifyContent: 'flex-end',
            }}
          >
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: '100%' }}>
              {datasets.map(ds => (
                <div
                  key={ds.label}
                  style={{
                    width: 14,
                    height: `${(ds.data[idx] / maxVal) * 100}%`,
                    background: ds.color,
                    borderRadius: '3px 3px 0 0',
                    minHeight: 4,
                    transition: 'height 0.5s ease',
                  }}
                  title={`${ds.label}: ${ds.data[idx].toLocaleString()}`}
                />
              ))}
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Simple div-based line chart approximation using bar heights with dots
function LineChart({
  labels,
  datasets,
}: {
  labels: string[];
  datasets: { label: string; data: number[]; color: string }[];
}) {
  const allValues = datasets.flatMap(d => d.data);
  const maxVal = Math.max(...allValues, 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 11 }}>
        {datasets.map(ds => (
          <div key={ds.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 3, borderRadius: 2, background: ds.color }} />
            <span style={{ color: 'var(--text-muted)' }}>{ds.label}</span>
          </div>
        ))}
      </div>
      <div style={{ position: 'relative', height: 160 }}>
        {datasets.map(ds => (
          <div
            key={ds.label}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 20,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              padding: '0 8px',
            }}
          >
            {ds.data.map((val, idx) => {
              const pct = (val / maxVal) * 100;
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                    height: '100%',
                    justifyContent: 'flex-end',
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: ds.color,
                      border: '2px solid var(--bg-card)',
                      position: 'absolute',
                      bottom: `${pct}%`,
                      zIndex: 2,
                    }}
                    title={`${ds.label}: ${val}`}
                  />
                  <div
                    style={{
                      width: 2,
                      height: `${pct}%`,
                      background: `${ds.color}30`,
                      borderRadius: 1,
                    }}
                  />
                </div>
              );
            })}
          </div>
        ))}
        {/* X-axis labels */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0 8px',
          }}
        >
          {labels.map(label => (
            <span key={label} style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1, textAlign: 'center' }}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { getToken } = useAuth();
  const [kpis, setKpis] = useState<KpiData>(defaultKpis);
  const [financial, setFinancial] = useState<FinancialSummary>(defaultFinancial);
  const [siteActivity, setSiteActivity] = useState<SiteActivity>(defaultSiteActivity);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };

    try {
      // Fetch KPIs
      const kpiRes = await fetch('/api/dashboard/kpis', { headers }).catch(() => null);
      if (kpiRes?.ok) {
        const kpiEnv = await kpiRes.json();
        if (kpiEnv.success) setKpis(kpiEnv.data);
      }
    } catch {
      // Use defaults
    }

    try {
      // Fetch financial summary
      const finRes = await fetch('/api/dashboard/financial-summary', { headers }).catch(() => null);
      if (finRes?.ok) {
        const finEnv = await finRes.json();
        if (finEnv.success) setFinancial(finEnv.data);
      }
    } catch {
      // Use defaults
    }

    try {
      // Fetch site activity
      const actRes = await fetch('/api/dashboard/site-activity', { headers }).catch(() => null);
      if (actRes?.ok) {
        const actEnv = await actRes.json();
        if (actEnv.success) setSiteActivity(actEnv.data);
      }
    } catch {
      // Use defaults
    }

    try {
      // Fetch notifications
      const notifRes = await fetch('/api/dashboard/notifications', { headers }).catch(() => null);
      if (notifRes?.ok) {
        const notifEnv = await notifRes.json();
        if (notifEnv.success) setNotifications(notifEnv.data ?? []);
      }
    } catch {
      // Use defaults
    }

    try {
      // Fetch pending approvals count
      const approvalRes = await fetch('/api/approvals/pending-counts', { headers }).catch(() => null);
      if (approvalRes?.ok) {
        const approvalEnv = await approvalRes.json();
        if (approvalEnv.success) {
          const counts = approvalEnv.data;
          setPendingApprovals(counts.total ?? 0);
        }
      }
    } catch {
      // Use defaults
    }

    setLoading(false);
  }, [getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summaryCards = [
    {
      title: 'Active Sites',
      value: kpis.activeSites,
      icon: 'ri-map-pin-line',
      variant: 'cardPrimary',
    },
    {
      title: 'Active Employees',
      value: kpis.activeEmployees,
      icon: 'ri-team-line',
      variant: 'cardSuccess',
    },
    {
      title: 'Contractors',
      value: kpis.contractors,
      icon: 'ri-user-settings-line',
      variant: 'cardWarning',
    },
    {
      title: 'Supervisors',
      value: kpis.supervisors,
      icon: 'ri-user-star-line',
      variant: 'cardInfo',
    },
    {
      title: 'Retailers',
      value: kpis.retailers,
      icon: 'ri-store-2-line',
      variant: 'cardDanger',
    },
    {
      title: 'Total Bank Balance',
      value: kpis.totalBankBalance,
      icon: 'ri-bank-line',
      variant: 'cardPrimary',
      isCurrency: true,
    },
  ];

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2><i className="ri-dashboard-line" /> Admin Dashboard</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
        <div className="chart-grid" style={{ marginTop: 20 }}>
          <div className="skeleton skeleton-card" style={{ height: 260 }} />
          <div className="skeleton skeleton-card" style={{ height: 260 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <h2><i className="ri-dashboard-line" /> Admin Dashboard</h2>
        <div className="header-actions">
          {pendingApprovals > 0 && (
            <Link href="/admin/approvals" className="btn-primary">
              <i className="ri-checkbox-circle-line" />
              {pendingApprovals} Pending Approval{pendingApprovals > 1 ? 's' : ''}
            </Link>
          )}
        </div>
      </div>

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
                card.variant === 'cardInfo' ? 'var(--info)' :
                card.variant === 'cardDanger' ? 'var(--danger)' :
                'var(--accent)'
              }`,
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'default',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                flexShrink: 0,
                background: card.variant === 'cardPrimary' ? 'var(--accent-glow)' :
                  card.variant === 'cardSuccess' ? 'rgba(46, 204, 113, 0.12)' :
                  card.variant === 'cardWarning' ? 'rgba(253, 126, 20, 0.12)' :
                  card.variant === 'cardInfo' ? 'rgba(52, 152, 219, 0.12)' :
                  card.variant === 'cardDanger' ? 'rgba(231, 76, 60, 0.12)' :
                  'var(--accent-glow)',
                color: card.variant === 'cardPrimary' ? 'var(--accent)' :
                  card.variant === 'cardSuccess' ? 'var(--success)' :
                  card.variant === 'cardWarning' ? 'var(--warning)' :
                  card.variant === 'cardInfo' ? 'var(--info)' :
                  card.variant === 'cardDanger' ? 'var(--danger)' :
                  'var(--accent)',
              }}
            >
              <i className={card.icon} />
            </div>
            <div>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase' as const,
                letterSpacing: 0.5,
              }}>
                {card.title}
              </div>
              <div style={{
                fontSize: 22,
                fontWeight: 800,
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'baseline',
                gap: 4,
              }}>
                {card.isCurrency && (
                  <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.7 }}>Rs.</span>
                )}
                {card.isCurrency ? formatCurrency(card.value) : card.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="chart-grid">
        {/* Financial Summary - Bar Chart */}
        <div className="chart-card">
          <h4><i className="ri-bar-chart-grouped-line" style={{ color: 'var(--accent)', marginRight: 6 }} /> Financial Summary</h4>
          <BarChart
            labels={financial.labels}
            datasets={[
              { label: 'Income', data: financial.income, color: 'var(--success)' },
              { label: 'Expense', data: financial.expense, color: 'var(--danger)' },
            ]}
          />
        </div>

        {/* Site Activity - Line Chart */}
        <div className="chart-card">
          <h4><i className="ri-line-chart-line" style={{ color: 'var(--info)', marginRight: 6 }} /> Site Activity</h4>
          <LineChart
            labels={siteActivity.labels}
            datasets={[
              { label: 'Orders', data: siteActivity.orders, color: 'var(--info)' },
              { label: 'Invoices', data: siteActivity.invoices, color: 'var(--accent)' },
            ]}
          />
        </div>
      </div>

      {/* Recent Activity / Notifications */}
      <div className="card-container" style={{ marginTop: 8 }}>
        <h4 className="section-title">
          <i className="ri-notification-3-line" /> Recent Activity
        </h4>
        {notifications.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notifications.map(notif => (
              <div
                key={notif.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--border-color)',
                  fontSize: 13,
                }}
              >
                <i
                  className={
                    notif.type === 'approval'
                      ? 'ri-checkbox-circle-line'
                      : notif.type === 'payment'
                        ? 'ri-money-dollar-circle-line'
                        : 'ri-information-line'
                  }
                  style={{
                    fontSize: 18,
                    color: notif.type === 'approval' ? 'var(--success)' :
                      notif.type === 'payment' ? 'var(--accent)' : 'var(--info)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{notif.message}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' as const }}>
                  {notif.time}
                </span>
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
        <h4 className="section-title">
          <i className="ri-apps-line" /> Quick Actions
        </h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
        }}>
          {[
            { label: 'Add Employee', icon: 'ri-user-add-line', href: '/admin/employees', color: 'var(--success)' },
            { label: 'New Invoice', icon: 'ri-bill-line', href: '/admin/invoices', color: 'var(--accent)' },
            { label: 'Record Payment', icon: 'ri-money-dollar-circle-line', href: '/admin/payments', color: 'var(--info)' },
            { label: 'Retailer Bill', icon: 'ri-receipt-line', href: '/admin/retailer-bills', color: 'var(--warning)' },
            { label: 'Attendance', icon: 'ri-calendar-check-line', href: '/admin/attendance', color: 'var(--purple)' },
            { label: 'Approvals', icon: 'ri-checkbox-circle-line', href: '/admin/approvals', color: 'var(--danger)' },
          ].map(action => (
            <Link
              key={action.label}
              href={action.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 8,
                background: 'var(--glass-bg)',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                color: 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              <i className={action.icon} style={{ fontSize: 18, color: action.color }} />
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
