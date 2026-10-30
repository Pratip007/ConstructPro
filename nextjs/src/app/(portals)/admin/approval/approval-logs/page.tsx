'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { useExport } from '@/hooks/useExport';
import { useNotification } from '@/contexts/NotificationContext';
import SummaryCards from '@/components/SummaryCards';
import ModalDialog from '@/components/ModalDialog';

const SOURCE_MAP: Record<string, string> = {
  office: 'Office Portal',
  supervisor: 'Supervisor Portal',
  employee: 'Employee Portal',
};

const STATUS_MAP: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

interface ApprovalLog {
  logId: string;
  timestamp: string;
  rawDate: string;
  source: string;
  module: string;
  requestedBy: string;
  action: string;
  status: string;
  remarks: string;
  newData: any;
  oldData: any;
  _backendId: number;
}

function mapLog(r: any): ApprovalLog {
  return {
    _backendId: r.id,
    logId: r.request_id ?? String(r.id),
    timestamp: r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '',
    rawDate: r.created_at ? r.created_at.split('T')[0] : '',
    source: SOURCE_MAP[r.source] ?? r.source ?? '',
    module: r.module ?? '',
    requestedBy: r.requested_by_name
      ? `${r.requested_by_name} (${r.requested_by_id ?? ''})`
      : '',
    action: [r.module, r.action].filter(Boolean).join(' -- '),
    status: STATUS_MAP[r.status] ?? r.status ?? '',
    remarks: r.remarks ?? '',
    newData: r.new_data ?? null,
    oldData: r.old_data ?? null,
  };
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'Pending': return 'badge badge-warning';
    case 'Approved': return 'badge badge-success';
    case 'Rejected': return 'badge badge-danger';
    default: return 'badge badge-info';
  }
}

export default function ApprovalLogsPage() {
  const api = useApi();
  const notifs = useNotification();
  const exportService = useExport();

  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [logs, setLogs] = useState<ApprovalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<string[]>([]);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ApprovalLog | null>(null);

  const summaryCards = useMemo(() => {
    const all = logs;
    const pending = all.filter(l => l.status === 'Pending').length;
    const approved = all.filter(l => l.status === 'Approved').length;
    const rejected = all.filter(l => l.status === 'Rejected').length;
    return [
      { title: 'Total Logs', value: all.length, icon: 'ri-file-list-line', color: 'primary' as const },
      { title: 'Pending', value: pending, icon: 'ri-time-line', color: 'warning' as const },
      { title: 'Approved', value: approved, icon: 'ri-checkbox-circle-line', color: 'success' as const },
      { title: 'Rejected', value: rejected, icon: 'ri-close-circle-line', color: 'danger' as const },
    ];
  }, [logs]);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const data = await api.get<any[]>('/approvals');
        const mapped = (data ?? []).map(r => mapLog(r));
        setLogs(mapped);
        const mods = new Set<string>();
        mapped.forEach(l => { if (l.module) mods.add(l.module); });
        setModules([...mods].sort());
      } catch {
        notifs.error('Failed to load approval logs');
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredLogs = useMemo(() => {
    const source = sourceFilter;
    const status = statusFilter;
    const mod = moduleFilter;
    const query = searchQuery.toLowerCase().trim();
    const from = dateFrom;
    const to = dateTo;

    return logs.filter((log) => {
      if (source !== 'ALL' && log.source !== source) return false;
      if (status !== 'ALL' && log.status !== status) return false;
      if (mod && log.module !== mod) return false;
      if (from && log.rawDate < from) return false;
      if (to && log.rawDate > to) return false;
      if (query) {
        const combined = `${log.logId} ${log.timestamp} ${log.source} ${log.requestedBy} ${log.action}`.toLowerCase();
        if (!combined.includes(query)) return false;
      }
      return true;
    });
  }, [logs, sourceFilter, statusFilter, moduleFilter, searchQuery, dateFrom, dateTo]);

  const viewDetail = (log: ApprovalLog) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const objectKeys = (obj: any): string[] => {
    return obj ? Object.keys(obj) : [];
  };

  const exportExcel = () => {
    exportService.exportToExcel(
      filteredLogs.map(l => ({
        'Log ID': l.logId,
        'Date & Time': l.timestamp,
        'Source': l.source,
        'Module': l.module,
        'Requested By': l.requestedBy,
        'Action': l.action,
        'Status': l.status,
        'Remarks': l.remarks,
      })),
      'approval-logs', 'Approval Logs'
    );
  };

  const printReport = () => {
    exportService.printReport('approval-logs-table', 'Approval Logs');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-history-line"></i> Approval History</h1>
        <div className="header-actions">
          <button className="btn-export" onClick={exportExcel} disabled={!filteredLogs.length}>
            <i className="ri-file-excel-2-line"></i> Export Excel
          </button>
          <button className="btn-secondary" onClick={printReport} disabled={!filteredLogs.length}>
            <i className="ri-printer-line"></i> Print
          </button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container">
        <div className="table-toolbar">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Source</label>
              <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
                <option value="ALL">All Sources</option>
                <option value="Office Portal">Office Portal</option>
                <option value="Supervisor Portal">Supervisor Portal</option>
                <option value="Employee Portal">Employee Portal</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="ALL">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Module</label>
              <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}>
                <option value="">All Modules</option>
                {modules.map(mod => (
                  <option key={mod} value={mod}>{mod}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 150 }}>
              <label>Search</label>
              <input type="text" placeholder="Search logs..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 200 }}></div>
        ) : (
          <div className="table-responsive" id="approval-logs-table">
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr><td colSpan={8} className="empty-state">No approval logs found.</td></tr>
                ) : filteredLogs.map(log => (
                  <tr key={log.logId}>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{log.logId}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12.5px', color: 'var(--text-muted)' }}>{log.timestamp}</td>
                    <td><span className="badge badge-info">{log.source}</span></td>
                    <td>{log.module}</td>
                    <td style={{ fontWeight: 600 }}>{log.requestedBy}</td>
                    <td>{log.action}</td>
                    <td><span className={statusBadgeClass(log.status)}>{log.status}</span></td>
                    <td>
                      {(log.newData || log.oldData || log.remarks) && (
                        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => viewDetail(log)}>
                          <i className="ri-eye-line"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <ModalDialog isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Log Details" size="lg">
        {selectedLog && (
          <>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
              <div><strong>ID:</strong> {selectedLog.logId}</div>
              <div><strong>Source:</strong> <span className="badge badge-info">{selectedLog.source}</span></div>
              <div><strong>Date:</strong> {selectedLog.timestamp}</div>
              <div><strong>Status:</strong> <span className={statusBadgeClass(selectedLog.status)}>{selectedLog.status}</span></div>
              <div><strong>By:</strong> {selectedLog.requestedBy}</div>
            </div>
            {selectedLog.remarks && (
              <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 6, marginBottom: 12 }}>
                <strong>Remarks:</strong> {selectedLog.remarks}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {selectedLog.oldData && (
                <div>
                  <h4 style={{ marginBottom: 8, color: 'var(--danger)' }}><i className="ri-subtract-line"></i> Previous Data</h4>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12 }}>
                    {objectKeys(selectedLog.oldData).map(key => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key}</span>
                        <span>{String(selectedLog.oldData[key])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedLog.newData && (
                <div>
                  <h4 style={{ marginBottom: 8, color: 'var(--success)' }}><i className="ri-add-line"></i> New Data</h4>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12 }}>
                    {objectKeys(selectedLog.newData).map(key => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key}</span>
                        <span>{String(selectedLog.newData[key])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </ModalDialog>
    </div>
  );
}
