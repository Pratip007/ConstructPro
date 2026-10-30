'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import { useIndianNumber } from '@/hooks/useIndianNumber';
import PageHeader from '@/components/PageHeader';

interface SiteKpis {
  siteName: string;
  employeesAtSite: number;
  todayAttendance: number;
  pendingLeaves: number;
  pendingPayments: number;
}

interface ActivityItem {
  id: number;
  message: string;
  type: string;
  time: string;
}

const defaultKpis: SiteKpis = {
  siteName: '',
  employeesAtSite: 0,
  todayAttendance: 0,
  pendingLeaves: 0,
  pendingPayments: 0,
};

export default function SupervisorDashboardPage() {
  const { apiGet } = useApi();
  const { error: notifyError } = useNotification();
  const { getSiteId, user } = useRole();
  const { formatCurrency } = useIndianNumber();

  const siteId = getSiteId();

  const [kpis, setKpis] = useState<SiteKpis>(defaultKpis);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!siteId) {
      setLoading(false);
      return;
    }

    try {
      const data = await apiGet<SiteKpis>(`/api/dashboard/kpis?site_id=${siteId}`);
      setKpis(data);
    } catch {
      // Use defaults
    }

    try {
      const data = await apiGet<ActivityItem[]>(`/api/dashboard/site-activity?site_id=${siteId}`);
      setActivities(data ?? []);
    } catch {
      // Use defaults
    }

    setLoading(false);
  }, [apiGet, siteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summaryCards = [
    {
      title: 'Employees at Site',
      value: kpis.employeesAtSite,
      icon: 'ri-team-line',
      color: 'var(--accent)',
      bg: 'var(--accent-glow)',
    },
    {
      title: "Today's Attendance",
      value: kpis.todayAttendance,
      icon: 'ri-calendar-check-line',
      color: 'var(--success)',
      bg: 'rgba(46, 204, 113, 0.12)',
    },
    {
      title: 'Pending Leaves',
      value: kpis.pendingLeaves,
      icon: 'ri-rest-time-line',
      color: 'var(--warning)',
      bg: 'rgba(253, 126, 20, 0.12)',
    },
    {
      title: 'Pending Payments',
      value: kpis.pendingPayments,
      icon: 'ri-secure-payment-line',
      color: 'var(--info)',
      bg: 'rgba(52, 152, 219, 0.12)',
    },
  ];

  if (loading) {
    return (
      <div className="page-container">
        <PageHeader title="Supervisor Dashboard" icon="ri-dashboard-line" />
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
      <PageHeader title="Supervisor Dashboard" icon="ri-dashboard-line" />

      {/* Site Name Banner */}
      {(kpis.siteName || siteId) && (
        <div
          className="card-container"
          style={{
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '16px 24px',
            background: 'linear-gradient(135deg, var(--accent-glow), transparent)',
            borderLeft: '4px solid var(--accent)',
          }}
        >
          <i className="ri-map-pin-line" style={{ fontSize: 24, color: 'var(--accent)' }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Assigned Site
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)' }}>
              {kpis.siteName || `Site #${siteId}`}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Supervisor</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>
              {user?.name || 'N/A'}
            </div>
          </div>
        </div>
      )}

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
              borderLeft: `3px solid ${card.color}`,
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
                background: card.bg,
                color: card.color,
              }}
            >
              <i className={card.icon} />
            </div>
            <div>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {card.title}
              </div>
              <div style={{
                fontSize: 26,
                fontWeight: 800,
                color: 'var(--text-main)',
              }}>
                {card.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card-container" style={{ marginBottom: 20 }}>
        <h4 className="section-title">
          <i className="ri-apps-line" /> Quick Actions
        </h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
        }}>
          {[
            { label: 'Mark Attendance', icon: 'ri-calendar-check-line', href: '/supervisor/attendance', color: 'var(--success)' },
            { label: 'Site Leave', icon: 'ri-rest-time-line', href: '/supervisor/site-leaves', color: 'var(--warning)' },
            { label: 'Employee Ledger', icon: 'ri-file-list-3-line', href: '/supervisor/employee-ledger', color: 'var(--info)' },
            { label: 'Retailer Bills', icon: 'ri-receipt-line', href: '/supervisor/retailer-bills', color: 'var(--accent)' },
            { label: 'Payments', icon: 'ri-secure-payment-line', href: '/supervisor/payments', color: 'var(--danger)' },
            { label: 'My Ledger', icon: 'ri-book-open-line', href: '/supervisor/supervisor-ledger', color: 'var(--purple, #9b59b6)' },
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

      {/* Recent Activity */}
      <div className="card-container">
        <h4 className="section-title">
          <i className="ri-notification-3-line" /> Recent Site Activity
        </h4>
        {activities.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activities.map(item => (
              <div
                key={item.id}
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
                    item.type === 'attendance' ? 'ri-calendar-check-line' :
                    item.type === 'leave' ? 'ri-rest-time-line' :
                    item.type === 'payment' ? 'ri-money-dollar-circle-line' :
                    item.type === 'bill' ? 'ri-receipt-line' :
                    'ri-information-line'
                  }
                  style={{
                    fontSize: 18,
                    color:
                      item.type === 'attendance' ? 'var(--success)' :
                      item.type === 'leave' ? 'var(--warning)' :
                      item.type === 'payment' ? 'var(--accent)' :
                      item.type === 'bill' ? 'var(--info)' :
                      'var(--text-muted)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{item.message}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '24px 20px' }}>
            <i className="ri-notification-off-line" />
            <h3>No Recent Activity</h3>
            <p>Activity for your site will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
