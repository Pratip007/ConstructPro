'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';

interface SummaryCard {
  title: string;
  value: number | string;
  icon: string;
  color: string;
  suffix?: string;
}

interface PendingAction {
  id: string;
  label: string;
  icon: string;
  route: string;
  count: number;
}

const quickActions = [
  { label: 'Mark Attendance', icon: 'ri-calendar-check-line', route: '/supervisor/employee/employee-attendance', color: '#4a7fc1' },
  { label: 'Retail Invoice', icon: 'ri-receipt-line', route: '/supervisor/purchase/retail-site-invoice', color: '#28a745' },
  { label: 'Stock Request', icon: 'ri-stack-line', route: '/supervisor/payment/all-type-payment', color: '#ffc107' },
  { label: 'Site Leave Entry', icon: 'ri-calendar-close-line', route: '/supervisor/employee/site-leave-entry', color: '#e74c3c' },
  { label: 'Employee Ledger', icon: 'ri-book-open-line', route: '/supervisor/employee/employee-ledger', color: '#9b59b6' },
  { label: 'Supervisor Ledger', icon: 'ri-book-line', route: '/supervisor/supervisor/supervisor-ledger', color: '#17a2b8' },
];

export default function SupervisorDashboardPage() {
  const { currentUser } = useAuth();
  const api = useApi();
  const notifications = useNotification();

  const [employeeCount, setEmployeeCount] = useState(0);
  const [siteName, setSiteName] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [todayPresent, setTodayPresent] = useState(0);
  const [todayAbsent, setTodayAbsent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [kpiCards, setKpiCards] = useState<SummaryCard[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);

  const updateKpiCards = useCallback((empCount: number, present: number, absent: number) => {
    setKpiCards([
      { title: 'Employees at Site', value: empCount, icon: 'ri-team-line', color: 'primary' },
      { title: 'Today Present', value: present, icon: 'ri-checkbox-circle-line', color: 'success' },
      { title: 'Today Absent', value: absent, icon: 'ri-close-circle-line', color: 'danger' },
      {
        title: 'Attendance Rate',
        value: empCount > 0 ? Math.round((present / empCount) * 100) : 0,
        suffix: '%',
        icon: 'ri-pie-chart-line',
        color: 'info',
      },
    ]);
  }, []);

  useEffect(() => {
    const user = currentUser;
    if (!user?.assignedSiteId) {
      setLoading(false);
      updateKpiCards(0, 0, 0);
      return;
    }

    const siteId = String(user.assignedSiteId);

    // Load site info
    async function loadSiteInfo() {
      try {
        const sites = await api.get<any[]>('/sites');
        const site = (sites ?? []).find((s: any) => String(s.id) === siteId);
        if (site) {
          setSiteName(site.name ?? `Site #${siteId}`);
          setSiteLocation(site.address ?? site.location ?? '');
        } else {
          setSiteName(`Site #${siteId}`);
        }
      } catch {
        setSiteName(`Site #${siteId}`);
      }
    }

    // Load employees
    async function loadEmployees() {
      try {
        const employees = await api.get<any[]>('/employees', { site_id: siteId });
        const count = (employees ?? []).length;
        setEmployeeCount(count);
        setLoading(false);
        return count;
      } catch {
        notifications.error('Failed to load employee data for site');
        setLoading(false);
        return 0;
      }
    }

    // Load attendance summary
    async function loadAttendance() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const records = await api.get<any[]>('/attendance', { site_id: siteId, date: today });
        const list = Array.isArray(records) ? records : [];
        const present = list.filter((r: any) => r.status === 'present' || r.status === 'P').length;
        const absent = list.filter((r: any) => r.status === 'absent' || r.status === 'A').length;
        setTodayPresent(present);
        setTodayAbsent(absent);
        return { present, absent };
      } catch {
        return { present: 0, absent: 0 };
      }
    }

    // Load pending actions
    async function loadPendingActions() {
      try {
        const data = await api.get<any[]>('/approvals', { status: 'pending', source: 'supervisor' });
        const count = (data ?? []).length;
        const actions: PendingAction[] = [];
        if (count > 0) {
          actions.push({
            id: 'pending-approvals',
            label: 'Pending Approval Requests',
            icon: 'ri-time-line',
            route: '/supervisor/supervisor/supervisor-ledger',
            count,
          });
        }
        setPendingActions(actions);
      } catch {}
    }

    // Run all loads
    Promise.all([loadSiteInfo(), loadEmployees(), loadAttendance(), loadPendingActions()]).then(
      ([, empCount, attendance]) => {
        const ec = typeof empCount === 'number' ? empCount : 0;
        const att = attendance as { present: number; absent: number } | undefined;
        updateKpiCards(ec, att?.present ?? 0, att?.absent ?? 0);
      }
    );
  }, [currentUser, api, notifications, updateKpiCards]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-shield-user-line" /> Supervisor Dashboard</h1>
        {currentUser && (
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Welcome, {currentUser.name} ({currentUser.displayId})
          </p>
        )}
      </div>

      {/* Site Info Card */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderLeft: '4px solid var(--accent)',
        borderRadius: 10,
        padding: '20px 24px',
        marginBottom: 20,
      }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          background: 'rgba(37, 99, 235, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <i className="ri-building-2-line" style={{ fontSize: 24, color: 'var(--accent)' }} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>
            {siteName
              ? siteName
              : currentUser?.assignedSiteId != null
              ? `Site #${currentUser.assignedSiteId}`
              : 'No Site Assigned'}
          </h3>
          {siteLocation && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              <i className="ri-map-pin-line" style={{ marginRight: 4 }} /> {siteLocation}
            </p>
          )}
        </div>
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
              <span className="card-value">
                {card.value}
                {card.suffix && <span className="suffix">{card.suffix}</span>}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Actions */}
      {pendingActions.length > 0 && (
        <div className="card-container" style={{ marginTop: 20 }}>
          <h3 style={{ color: 'var(--text-main)', margin: '0 0 12px' }}>
            <i className="ri-alert-line" /> Pending Actions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingActions.map((action) => (
              <Link
                key={action.id}
                href={action.route}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  textDecoration: 'none',
                  color: 'var(--text-main)',
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'var(--bg-card)',
                  transition: 'all 0.2s',
                }}
              >
                <i className={action.icon} style={{ fontSize: 18, color: 'var(--warning)' }} />
                <span>{action.label}</span>
                <span className="badge badge-warning">{action.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
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

      {/* Site Overview */}
      <div className="card-container" style={{ marginTop: 20 }}>
        <h3 style={{ color: 'var(--text-main)', margin: '0 0 12px' }}>
          <i className="ri-information-line" /> Site Overview
        </h3>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading data...</p>
        ) : currentUser?.assignedSiteId == null ? (
          <p style={{ color: 'var(--text-muted)' }}>No site assigned to your account. Contact an administrator.</p>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>
            {employeeCount} employee(s) currently tagged to {siteName || 'your site'}.
            {(todayPresent > 0 || todayAbsent > 0) && (
              <> Today: {todayPresent} present, {todayAbsent} absent.</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
