'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';

interface KpiCard {
  icon: string;
  title: string;
  value: string;
  isBalance?: boolean;
}

interface PendingDue {
  id: string;
  name: string;
  role: string;
  amount: string;
}

interface Handover {
  id: string;
  siteName: string;
  clientName: string;
}

interface LoanReminder {
  bank: string;
  loanId: string;
  purpose: string;
  dueDate: number;
  emiAmount: string;
  status: string;
  statusClass: string;
}

interface ActivityLog {
  logId: string;
  timestamp: string;
  source: string;
  party: string;
  details: string;
  status: string;
}

function daysUntilEmi(emiDay: number, today: Date): number {
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), emiDay);
  const diff = Math.ceil((thisMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < -15) {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, emiDay);
    return Math.ceil((nextMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }
  return diff;
}

function formatSource(source: string): string {
  const map: Record<string, string> = {
    office: 'Office Portal',
    supervisor: 'Supervisor Portal',
    employee: 'Employee Portal',
  };
  return map[source] ?? source ?? '';
}

export default function AdminDashboardPage() {
  const api = useApi();
  const { getToken } = useAuth();
  const notifications = useNotification();

  const [loading, setLoading] = useState(true);
  const [kpiCards, setKpiCards] = useState<KpiCard[]>([]);
  const [pendingDues, setPendingDues] = useState<PendingDue[]>([]);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [loanReminders, setLoanReminders] = useState<LoanReminder[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Load main dashboard data
  useEffect(() => {
    async function loadDashboard() {
      try {
        const [kpis, dues] = await Promise.all([
          api.get<any>('/dashboard/kpis'),
          api.get<any[]>('/dashboard/pending-dues'),
        ]);

        setKpiCards([
          { icon: '\u{1F3D7}️', title: 'Active Sites', value: String(kpis?.active_sites ?? 0) },
          { icon: '\u{1F465}', title: 'Active Employees', value: String(kpis?.active_employees ?? 0) },
          { icon: '\u{1F477}', title: 'Contractors', value: String(kpis?.contractors ?? 0) },
          { icon: '\u{1F6E1}️', title: 'Supervisors', value: String(kpis?.supervisors ?? 0) },
          { icon: '\u{1F3EA}', title: 'Registered Retailers', value: String(kpis?.retailers ?? 0) },
          {
            icon: '\u{1F4B0}',
            title: 'Total Bank Balance',
            value: `₹${Number(kpis?.total_bank_balance ?? 0).toLocaleString('en-IN')}`,
            isBalance: true,
          },
        ]);

        setPendingDues(
          (dues ?? []).map((d: any) => ({
            id: String(d.id),
            name: d.name ?? d.party_name ?? '',
            role: d.role ?? d.party_role ?? '',
            amount: d.formatted_amount ?? (d.amount != null ? `₹${Number(d.amount).toLocaleString('en-IN')}` : ''),
          }))
        );

        setLoading(false);
      } catch {
        notifications.error('Failed to load dashboard data');
        setLoading(false);
      }
    }
    loadDashboard();
  // notifications is intentionally excluded — it changes on every toast and would cause infinite refetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // Load loan reminders
  useEffect(() => {
    async function loadLoans() {
      try {
        const loans = await api.get<any[]>('/loans');
        const today = new Date();
        const reminders: LoanReminder[] = (loans ?? [])
          .filter((l: any) => l.status === 'active')
          .map((l: any) => {
            const emiDay = l.emi_date ?? 1;
            const days = daysUntilEmi(emiDay, today);
            let status: string;
            let statusClass: string;
            if (days < 0) {
              status = `Overdue by ${Math.abs(days)} days`;
              statusClass = 'badge badge-danger';
            } else if (days === 0) {
              status = 'Due Today';
              statusClass = 'badge badge-warning';
            } else if (days <= 7) {
              status = `Due in ${days} days`;
              statusClass = 'badge badge-info';
            } else {
              status = `Due in ${days} days`;
              statusClass = 'badge badge-success';
            }
            return {
              bank: l.bank_name ?? l.bank ?? '',
              loanId: l.loan_id ?? String(l.id),
              purpose: l.purpose ?? l.details ?? '',
              dueDate: emiDay,
              emiAmount: l.emi_amount ? `₹${Number(l.emi_amount).toLocaleString('en-IN')}` : '',
              status,
              statusClass,
            };
          });
        setLoanReminders(reminders);
      } catch {}
    }
    loadLoans();
  }, [api]);

  // Load handovers
  useEffect(() => {
    async function loadHandovers() {
      try {
        const data = await api.get<any[]>('/dashboard/handovers');
        setHandovers(
          (data ?? []).map((h: any) => ({
            id: String(h.id),
            siteName: h.site_name ?? h.siteName ?? '',
            clientName: h.client_name ?? h.clientName ?? '',
          }))
        );
      } catch {}
    }
    loadHandovers();
  }, [api]);

  // Load activity logs
  useEffect(() => {
    async function loadLogs() {
      try {
        const approvals = await api.get<any[]>('/approvals', { status: 'approved' });
        setActivityLogs(
          (approvals ?? []).map((a: any) => ({
            logId: a.request_id ?? String(a.id),
            timestamp: a.created_at ? new Date(a.created_at).toLocaleString('en-IN') : '',
            source: formatSource(a.source),
            party: a.requested_by_name
              ? `${a.requested_by_name} (${a.requested_by_id ?? ''})`
              : '',
            details: [a.module, a.action, a.summary].filter(Boolean).join(' — '),
            status: 'Approved',
          }))
        );
      } catch {}
    }
    loadLogs();
  }, [api]);

  const filteredLogs = useMemo(() => {
    const source = sourceFilter;
    const query = searchQuery.toLowerCase().trim();
    return activityLogs.filter((log) => {
      const matchSource = source === 'ALL' || log.source === source;
      const combined = `${log.logId} ${log.timestamp} ${log.source} ${log.party} ${log.details}`.toLowerCase();
      const matchSearch = !query || combined.includes(query);
      return matchSource && matchSearch;
    });
  }, [activityLogs, sourceFilter, searchQuery]);

  const clearDue = useCallback(async (due: PendingDue) => {
    if (!window.confirm(`Are you sure you want to mark the payment due for "${due.name}" (${due.amount}) as cleared?`)) return;
    setPendingDues((prev) => prev.filter((d) => d.id !== due.id));
    try {
      await api.post('/approvals', {
        module: 'Dashboard',
        actionType: 'create',
        summary: `Payment due cleared for ${due.name} — ${due.amount}`,
        data: { source: 'Dashboard Settlement', party: due.name, amount: due.amount },
      });
    } catch {}
    setActivityLogs((logs) => [
      {
        logId: `DS-${Date.now()}`,
        timestamp: new Date().toLocaleString('en-IN'),
        source: 'Dashboard Settlement',
        party: due.name,
        details: `Payment due cleared — ${due.amount}`,
        status: 'Approved',
      },
      ...logs,
    ]);
    notifications.success(`Due cleared for ${due.name}`);
  }, [api, notifications]);

  const clearHandover = useCallback(async (handover: Handover) => {
    if (!window.confirm(`Are you sure you want to mark the handover for "${handover.siteName}" (Client: ${handover.clientName}) as completed?`)) return;
    setHandovers((prev) => prev.filter((h) => h.id !== handover.id));
    try {
      await api.post('/approvals', {
        module: 'Dashboard',
        actionType: 'create',
        summary: `Site handover completed — ${handover.siteName}`,
        data: { source: 'Dashboard Settlement', site: handover.siteName, client: handover.clientName },
      });
    } catch {}
    setActivityLogs((logs) => [
      {
        logId: `DS-${Date.now()}`,
        timestamp: new Date().toLocaleString('en-IN'),
        source: 'Dashboard Settlement',
        party: handover.clientName,
        details: `Site handover completed — ${handover.siteName}`,
        status: 'Approved',
      },
      ...logs,
    ]);
    notifications.success(`Handover completed for ${handover.siteName}`);
  }, [api, notifications]);

  const removeLog = useCallback((logId: string) => {
    setActivityLogs((logs) => logs.filter((l) => l.logId !== logId));
  }, []);

  const cleanAllLogs = useCallback(async () => {
    if (!window.confirm('Are you sure you want to clear all approved activity logs? This action cannot be undone.')) return;
    setActivityLogs([]);
  }, []);

  return (
    <div className="page-container">
      {/* KPI Cards */}
      <div className="cards-grid">
        {kpiCards.map((card) => (
          <div key={card.title} className={`card${card.isBalance ? ' balance-card' : ''}`}>
            <div className="kpi-icon">{card.icon}</div>
            <h4>{card.title}</h4>
            <div className="value">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-title"><i className="ri-bar-chart-2-line" /> Financial Overview (₹ Lakhs)</div>
          <canvas id="financialChart" />
        </div>
        <div className="chart-card">
          <div className="chart-title"><i className="ri-line-chart-line" /> Site &amp; Workforce Activity</div>
          <canvas id="activityChart" />
        </div>
      </div>

      {/* Middle Grid: Dues, Loans, Handovers */}
      <div className="dashboard-footer-grid">
        {/* Pending Payment Dues */}
        <div className="widget-card dues-card">
          <h3 className="widget-title">
            <i className="ri-alert-line" /> Pending Payment Dues
          </h3>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Party / Name</th>
                  <th>Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingDues.length > 0 ? (
                  pendingDues.map((due) => (
                    <tr key={due.id}>
                      <td>
                        <strong>{due.name}</strong><br />
                        <span className="text-muted">{due.role}</span>
                      </td>
                      <td className="amount-danger">{due.amount}</td>
                      <td>
                        <button className="btn-table-clear" onClick={() => clearDue(due)}>Clear</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="empty-state success-text">
                      All pending payment dues have been cleared!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Loan EMI Reminders */}
        <div className="widget-card loan-card">
          <h3 className="widget-title">
            <i className="ri-bank-line" /> Upcoming Loan EMI Reminders
          </h3>
          <ul className="item-list">
            {loanReminders.length > 0 ? (
              loanReminders.map((loan) => (
                <li key={loan.loanId} className="loan-item">
                  <div className="loan-header">
                    <span className="loan-bank">{loan.bank} <span className="text-muted">({loan.loanId})</span></span>
                    <span className={loan.statusClass}>{loan.status}</span>
                  </div>
                  <div className="loan-details">
                    <span>Purpose: {loan.purpose}</span>
                    <span className="loan-due-date">Target Date: {loan.dueDate}th</span>
                  </div>
                </li>
              ))
            ) : (
              <li className="empty-state success-text">No upcoming EMIs due this week!</li>
            )}
          </ul>
        </div>

        {/* Upcoming Site Handovers */}
        <div className="widget-card handover-card">
          <h3 className="widget-title">
            <i className="ri-building-2-line" /> Upcoming Site Handovers
          </h3>
          <ul className="item-list">
            {handovers.length > 0 ? (
              handovers.map((site) => (
                <li key={site.id} className="handover-item">
                  <div className="site-info">
                    <span className="site-name">{site.siteName}</span>
                    <span className="client-name">{site.clientName}</span>
                  </div>
                  <button className="btn-clear-due" onClick={() => clearHandover(site)}>Clear Due</button>
                </li>
              ))
            ) : (
              <li className="empty-state success-text">All scheduled site handovers are completed!</li>
            )}
          </ul>
        </div>
      </div>

      {/* Approved Activity Log */}
      <div className="approval-log-card">
        <div className="log-header-bar">
          <div className="log-title-group">
            <h3><i className="ri-checkbox-circle-line" /> Recently Approved Activity Log</h3>
            <p>Tracks all items approved by Admin across Office, Supervisor, and Employee portals.</p>
          </div>
          <div className="log-controls">
            <select
              className="log-select"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="ALL">All Sources</option>
              <option value="Office Portal">Office Portal</option>
              <option value="Supervisor Portal">Supervisor Portal</option>
              <option value="Employee Portal">Employee Portal</option>
              <option value="Dashboard Settlement">Dashboard Settlement</option>
            </select>
            <input
              type="text"
              className="log-input"
              placeholder="Search log..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="btn-clean-logs" onClick={cleanAllLogs}>
              <i className="ri-delete-bin-line" /> Clear All
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Date &amp; Time</th>
                <th>Source / Portal</th>
                <th>Requested By / Party</th>
                <th>Approved Action &amp; Details</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Clean</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.logId}>
                    <td className="log-id">{log.logId}</td>
                    <td className="log-time">{log.timestamp}</td>
                    <td><span className="badge badge-info">{log.source}</span></td>
                    <td className="log-party">{log.party}</td>
                    <td>{log.details}</td>
                    <td><span className="badge badge-success">{log.status}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-del-log" onClick={() => removeLog(log.logId)}>
                        <i className="ri-delete-bin-line" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="empty-state">No approved activity logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
