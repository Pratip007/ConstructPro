'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { exportToExcel, printReport } from '@/lib/export-utils';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards from '@/components/SummaryCards';
import styles from './ApprovalLogsPage.module.scss';

const SOURCE_MAP: Record<string, string> = {
  office: 'Office Staff',
  supervisor: 'Supervisor',
  admin: 'Admin',
  system: 'System',
};

const STATUS_MAP: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

interface ApprovalLog {
  id: number;
  date: string;
  source: string;
  module: string;
  requestedBy: string;
  action: string;
  status: string;
  remarks: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}

interface ApiLogRecord {
  id?: number;
  created_at?: string;
  date?: string;
  source?: string;
  entity_type?: string;
  module?: string;
  submitted_by_name?: string;
  requested_by?: string;
  action?: string;
  action_type?: string;
  status?: string;
  remarks?: string;
  admin_remarks?: string;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
}

function mapLog(r: ApiLogRecord): ApprovalLog {
  return {
    id: r.id ?? 0,
    date: r.created_at ?? r.date ?? '',
    source: r.source ?? '',
    module: r.entity_type ?? r.module ?? '',
    requestedBy: r.submitted_by_name ?? r.requested_by ?? '',
    action: r.action_type ?? r.action ?? '',
    status: r.status ?? 'pending',
    remarks: r.admin_remarks ?? r.remarks ?? '',
    oldData: r.old_data ?? null,
    newData: r.new_data ?? r.data ?? null,
  };
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'pending': return 'badge-warning';
    case 'approved': return 'badge-success';
    case 'rejected': return 'badge-danger';
    default: return '';
  }
}

export default function ApprovalLogsPage() {
  const { success, error: notifyError } = useNotification();
  const { currentUser } = useAuth();

  const [logs, setLogs] = useState<ApprovalLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ApprovalLog | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<ApiLogRecord[]>('/approvals/logs');
      setLogs(data.map(mapLog));
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to load approval logs');
    }
    setLoading(false);
  }, [notifyError]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const modules = useMemo(() => {
    return [...new Set(logs.map(l => l.module).filter(Boolean))].sort();
  }, [logs]);

  const summaryCards = useMemo(() => {
    const approved = logs.filter(l => l.status === 'approved').length;
    const rejected = logs.filter(l => l.status === 'rejected').length;
    const pending = logs.filter(l => l.status === 'pending').length;
    return [
      { title: 'Total Logs', value: logs.length, icon: 'ri-file-list-3-line', color: 'primary' as const },
      { title: 'Approved', value: approved, icon: 'ri-check-double-line', color: 'success' as const },
      { title: 'Rejected', value: rejected, icon: 'ri-close-circle-line', color: 'danger' as const },
      { title: 'Pending', value: pending, icon: 'ri-time-line', color: 'warning' as const },
    ];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (sourceFilter) result = result.filter(l => l.source === sourceFilter);
    if (statusFilter) result = result.filter(l => l.status === statusFilter);
    if (moduleFilter) result = result.filter(l => l.module === moduleFilter);
    if (dateFrom) result = result.filter(l => l.date >= dateFrom);
    if (dateTo) result = result.filter(l => l.date <= dateTo + 'T23:59:59');
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.requestedBy.toLowerCase().includes(q) ||
        l.module.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        String(l.id).includes(q)
      );
    }
    return result;
  }, [logs, sourceFilter, statusFilter, moduleFilter, searchQuery, dateFrom, dateTo]);

  const viewDetail = (log: ApprovalLog) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return dateStr; }
  };

  const exportExcel = () => {
    const columns = [
      { header: 'Log ID', key: 'id' },
      { header: 'Date & Time', key: 'date' },
      { header: 'Source', key: 'source' },
      { header: 'Module', key: 'module' },
      { header: 'Requested By', key: 'requestedBy' },
      { header: 'Action', key: 'action' },
      { header: 'Status', key: 'status' },
      { header: 'Remarks', key: 'remarks' },
    ];
    exportToExcel(
      columns,
      filteredLogs as unknown as Record<string, unknown>[],
      'Approval_Logs'
    );
  };

  const handlePrint = () => {
    const rows = filteredLogs.map(l => `
      <tr>
        <td>${l.id}</td>
        <td>${formatDate(l.date)}</td>
        <td>${SOURCE_MAP[l.source] ?? l.source}</td>
        <td>${l.module}</td>
        <td>${l.requestedBy}</td>
        <td>${l.action}</td>
        <td>${l.status}</td>
      </tr>
    `).join('');
    const content = `
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead><tr>
          <th>ID</th><th>Date</th><th>Source</th><th>Module</th><th>Requested By</th><th>Action</th><th>Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    printReport('Approval Logs', content);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-file-list-3-line" /> Approval Logs</h1>
        <div className={styles.headerActions}>
          <button className="btn-outline" onClick={exportExcel} disabled={!filteredLogs.length}>
            <i className="ri-file-excel-line" /> Export Excel
          </button>
          <button className="btn-outline" onClick={handlePrint} disabled={!filteredLogs.length}>
            <i className="ri-printer-line" /> Print
          </button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className={styles.filterBar}>
        <select className={styles.filterSelect} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="">All Sources</option>
          <option value="office">Office</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Admin</option>
          <option value="system">System</option>
        </select>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className={styles.filterSelect} value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}>
          <option value="">All Modules</option>
          {modules.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="date" className={styles.filterInput} value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From Date" />
        <input type="date" className={styles.filterInput} value={dateTo} onChange={e => setDateTo(e.target.value)} title="To Date" />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search logs..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {loading && <p className="loading-text">Loading logs...</p>}

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Log ID</th>
              <th>Date &amp; Time</th>
              <th>Source</th>
              <th>Module</th>
              <th>Requested By</th>
              <th>Action</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>View</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr><td colSpan={8} className="empty-state">No approval logs found.</td></tr>
            ) : filteredLogs.map(log => (
              <tr key={log.id}>
                <td style={{ fontWeight: 700, color: 'var(--accent)' }}>#{log.id}</td>
                <td>{formatDate(log.date)}</td>
                <td>
                  <span className="badge badge-info">{SOURCE_MAP[log.source] ?? log.source}</span>
                </td>
                <td>{log.module}</td>
                <td style={{ fontWeight: 600 }}>{log.requestedBy}</td>
                <td>{log.action}</td>
                <td>
                  <span className={`badge ${statusBadgeClass(log.status)}`}>{STATUS_MAP[log.status] ?? log.status}</span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button className="btn-outline btn-sm" onClick={() => viewDetail(log)} title="View Details">
                    <i className="ri-eye-line" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      <ModalDialog isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title={`Log #${selectedLog?.id} Details`}>
        {selectedLog && (
          <div style={{ maxWidth: 700 }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: '0.75rem' }}>Log Information</h4>
              <div style={{ display: 'grid', gap: '6px', fontSize: 13 }}>
                <div><strong style={{ color: 'var(--text-muted)' }}>Log ID:</strong> #{selectedLog.id}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Date:</strong> {formatDate(selectedLog.date)}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Source:</strong> {SOURCE_MAP[selectedLog.source] ?? selectedLog.source}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Module:</strong> {selectedLog.module}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Requested By:</strong> {selectedLog.requestedBy}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Action:</strong> {selectedLog.action}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Status:</strong> <span className={`badge ${statusBadgeClass(selectedLog.status)}`}>{STATUS_MAP[selectedLog.status] ?? selectedLog.status}</span></div>
                {selectedLog.remarks && <div><strong style={{ color: 'var(--text-muted)' }}>Remarks:</strong> {selectedLog.remarks}</div>}
              </div>
            </div>
            {(selectedLog.oldData || selectedLog.newData) && (
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: '0.75rem' }}>Data Changes</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {selectedLog.oldData && (
                    <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.75rem' }}>
                      <h5 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Old Data</h5>
                      {Object.entries(selectedLog.oldData).map(([key, val]) => (
                        <div key={key} style={{ fontSize: 12, padding: '3px 0', borderBottom: '1px solid var(--border-color)' }}>
                          <strong style={{ color: 'var(--text-muted)' }}>{key}:</strong> {String(val ?? '')}
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedLog.newData && (
                    <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.75rem' }}>
                      <h5 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>New Data</h5>
                      {Object.entries(selectedLog.newData).map(([key, val]) => (
                        <div key={key} style={{ fontSize: 12, padding: '3px 0', borderBottom: '1px solid var(--border-color)' }}>
                          <strong style={{ color: 'var(--text-muted)' }}>{key}:</strong> {String(val ?? '')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
