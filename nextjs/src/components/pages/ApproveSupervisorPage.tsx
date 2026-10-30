'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { exportToExcel } from '@/lib/export-utils';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards from '@/components/SummaryCards';
import styles from './ApproveSupervisorPage.module.scss';

interface SupervisorRequest {
  id: number;
  backendId: number;
  site: string;
  user: string;
  module: string;
  action: string;
  summary: string;
  date: string;
  status: string;
  remarks: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}

interface ApiApprovalRecord {
  id?: number;
  submitted_by_name?: string;
  submitted_by?: string;
  entity_type?: string;
  module?: string;
  action?: string;
  action_type?: string;
  summary?: string;
  created_at?: string;
  date?: string;
  status?: string;
  remarks?: string;
  admin_remarks?: string;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
  site_name?: string;
  site?: string;
}

function mapRequest(r: ApiApprovalRecord): SupervisorRequest {
  return {
    id: r.id ?? 0,
    backendId: r.id ?? 0,
    site: r.site_name ?? r.site ?? '',
    user: r.submitted_by_name ?? r.submitted_by ?? '',
    module: r.entity_type ?? r.module ?? '',
    action: r.action_type ?? r.action ?? '',
    summary: r.summary ?? '',
    date: r.created_at ?? r.date ?? '',
    status: r.status ?? 'pending',
    remarks: r.admin_remarks ?? r.remarks ?? '',
    oldData: r.old_data ?? null,
    newData: r.new_data ?? r.data ?? null,
  };
}

function mapStatus(status: string): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    default: return status;
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'pending': return 'badge-warning';
    case 'approved': return 'badge-success';
    case 'rejected': return 'badge-danger';
    default: return '';
  }
}

function actionBadgeClass(action: string): string {
  switch (action) {
    case 'create': return 'badge-success';
    case 'update': return 'badge-info';
    case 'delete': return 'badge-danger';
    default: return 'badge-info';
  }
}

export default function ApproveSupervisorPage() {
  const { success, error: notifyError } = useNotification();
  const { currentUser } = useAuth();

  const [allRequests, setAllRequests] = useState<SupervisorRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SupervisorRequest | null>(null);
  const [decisionType, setDecisionType] = useState<'approve' | 'reject'>('approve');
  const [decisionRemarks, setDecisionRemarks] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { source: 'supervisor' };
      const data = await apiGet<ApiApprovalRecord[]>('/approvals', params);
      setAllRequests(data.map(mapRequest));
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to load requests');
    }
    setLoading(false);
  }, [notifyError]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const summaryCards = useMemo(() => {
    const pending = allRequests.filter(r => r.status === 'pending').length;
    const approved = allRequests.filter(r => r.status === 'approved').length;
    const rejected = allRequests.filter(r => r.status === 'rejected').length;
    return [
      { title: 'Pending', value: pending, icon: 'ri-time-line', color: 'warning' as const },
      { title: 'Approved', value: approved, icon: 'ri-check-double-line', color: 'success' as const },
      { title: 'Rejected', value: rejected, icon: 'ri-close-circle-line', color: 'danger' as const },
      { title: 'Total', value: allRequests.length, icon: 'ri-file-list-3-line', color: 'primary' as const },
    ];
  }, [allRequests]);

  const uniqueSites = useMemo(() => {
    return [...new Set(allRequests.map(r => r.site).filter(Boolean))].sort();
  }, [allRequests]);

  const uniqueActions = useMemo(() => {
    return [...new Set(allRequests.map(r => r.action).filter(Boolean))].sort();
  }, [allRequests]);

  const filteredRequests = useMemo(() => {
    let result = allRequests;
    if (activeTab === 'pending') {
      result = result.filter(r => r.status === 'pending');
    } else {
      result = result.filter(r => r.status !== 'pending');
      if (statusFilter) result = result.filter(r => r.status === statusFilter);
    }
    if (siteFilter) result = result.filter(r => r.site === siteFilter);
    if (actionFilter) result = result.filter(r => r.action === actionFilter);
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      result = result.filter(r =>
        r.site.toLowerCase().includes(q) ||
        r.module.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        String(r.id).includes(q)
      );
    }
    return result;
  }, [allRequests, activeTab, statusFilter, siteFilter, actionFilter, searchFilter]);

  const switchTab = (tab: 'pending' | 'history') => {
    setActiveTab(tab);
    setStatusFilter('');
  };

  const viewDetails = (req: SupervisorRequest) => {
    setSelectedRequest(req);
    setShowDetailModal(true);
  };

  const openDecision = (req: SupervisorRequest, type: 'approve' | 'reject') => {
    setSelectedRequest(req);
    setDecisionType(type);
    setDecisionRemarks('');
    setShowDecisionModal(true);
  };

  const submitDecision = async () => {
    if (!selectedRequest) return;
    if (decisionType === 'reject' && !decisionRemarks.trim()) {
      notifyError('Remarks are required for rejection');
      return;
    }
    try {
      await apiPost(`/approvals/${selectedRequest.backendId}/${decisionType}`, {
        remarks: decisionRemarks,
      });
      success(`Request ${decisionType === 'approve' ? 'approved' : 'rejected'} successfully`);
      setShowDecisionModal(false);
      setSelectedRequest(null);
      loadRequests();
    } catch (err: any) {
      notifyError(err.message ?? `Failed to ${decisionType} request`);
    }
  };

  const exportData = () => {
    const columns = [
      { header: 'Request ID', key: 'id' },
      { header: 'Site', key: 'site' },
      { header: 'Module', key: 'module' },
      { header: 'Action', key: 'action' },
      { header: 'Summary', key: 'summary' },
      { header: 'Date', key: 'date' },
      { header: 'Status', key: 'status' },
      { header: 'Remarks', key: 'remarks' },
    ];
    exportToExcel(
      columns,
      filteredRequests as unknown as Record<string, unknown>[],
      'Supervisor_Approval_Requests'
    );
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

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-shield-user-line" /> Supervisor Approval Requests</h1>
        <div className={styles.headerControls}>
          <button className="btn-outline" onClick={exportData} disabled={!filteredRequests.length}>
            <i className="ri-file-excel-line" /> Export
          </button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="tab-bar" style={{ marginBottom: '1rem' }}>
        <button className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => switchTab('pending')}>
          <i className="ri-time-line" /> Pending
        </button>
        <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => switchTab('history')}>
          <i className="ri-history-line" /> History
        </button>
      </div>

      <div className={styles.filterBar}>
        {activeTab === 'history' && (
          <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        )}
        <select className={styles.filterSelect} value={siteFilter} onChange={e => setSiteFilter(e.target.value)}>
          <option value="">All Sites</option>
          {uniqueSites.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={styles.filterSelect} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="">All Actions</option>
          {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search requests..."
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
        />
      </div>

      {loading && <p className="loading-text">Loading requests...</p>}

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Site</th>
              <th>Module</th>
              <th>Action</th>
              <th>Date</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr><td colSpan={7} className="empty-state">No requests found.</td></tr>
            ) : filteredRequests.map(req => (
              <tr key={req.id}>
                <td style={{ fontWeight: 700, color: 'var(--accent)' }}>#{req.id}</td>
                <td style={{ fontWeight: 600 }}>{req.site}</td>
                <td>{req.module}</td>
                <td>
                  <span className={`badge ${actionBadgeClass(req.action)}`}>{req.action}</span>
                </td>
                <td>{formatDate(req.date)}</td>
                <td>
                  <span className={`badge ${statusBadgeClass(req.status)}`}>{mapStatus(req.status)}</span>
                </td>
                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <button className="btn-outline btn-sm" onClick={() => viewDetails(req)} title="View" style={{ marginRight: '0.25rem' }}>
                    <i className="ri-eye-line" />
                  </button>
                  {activeTab === 'pending' && (
                    <>
                      <button className={`btn-sm ${styles.btnApprove}`} onClick={() => openDecision(req, 'approve')} title="Approve" style={{ marginRight: '0.25rem' }}>
                        <i className="ri-check-line" />
                      </button>
                      <button className={`btn-sm ${styles.btnReject}`} onClick={() => openDecision(req, 'reject')} title="Reject">
                        <i className="ri-close-line" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      <ModalDialog isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title={`Request #${selectedRequest?.id} Details`}>
        {selectedRequest && (
          <div className={styles.detailGrid}>
            <div className={styles.detailSection}>
              <h4>Request Information</h4>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Request ID:</span>
                <span className={styles.detailValue}>#{selectedRequest.id}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Site:</span>
                <span className={styles.detailValue}>{selectedRequest.site}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Module:</span>
                <span className={styles.detailValue}>{selectedRequest.module}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Action:</span>
                <span className={styles.detailValue}>
                  <span className={`badge ${actionBadgeClass(selectedRequest.action)}`}>{selectedRequest.action}</span>
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Date:</span>
                <span className={styles.detailValue}>{formatDate(selectedRequest.date)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Status:</span>
                <span className={styles.detailValue}>
                  <span className={`badge ${statusBadgeClass(selectedRequest.status)}`}>{mapStatus(selectedRequest.status)}</span>
                </span>
              </div>
              {selectedRequest.summary && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Summary:</span>
                  <span className={styles.detailValue}>{selectedRequest.summary}</span>
                </div>
              )}
              {selectedRequest.remarks && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Admin Remarks:</span>
                  <span className={styles.detailValue}>{selectedRequest.remarks}</span>
                </div>
              )}
            </div>

            {(selectedRequest.oldData || selectedRequest.newData) && (
              <div className={styles.detailSection}>
                <h4>Data Changes</h4>
                <div className={styles.diffContainer}>
                  {selectedRequest.oldData && (
                    <div className={styles.diffSide}>
                      <h5>Old Data</h5>
                      <table className={styles.detailTable}>
                        <tbody>
                          {Object.entries(selectedRequest.oldData).map(([key, val]) => (
                            <tr key={key}>
                              <td className={styles.detailLabel}>{key}</td>
                              <td className={styles.detailValue}>{String(val ?? '')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {selectedRequest.newData && (
                    <div className={styles.diffSide}>
                      <h5>New Data</h5>
                      <table className={styles.detailTable}>
                        <tbody>
                          {Object.entries(selectedRequest.newData).map(([key, val]) => (
                            <tr key={key}>
                              <td className={styles.detailLabel}>{key}</td>
                              <td className={styles.detailValue}>{String(val ?? '')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </ModalDialog>

      {/* Decision Modal */}
      <ModalDialog isOpen={showDecisionModal} onClose={() => setShowDecisionModal(false)} title={`${decisionType === 'approve' ? 'Approve' : 'Reject'} Request`}>
        {selectedRequest && (
          <div>
            <p style={{ marginBottom: '1rem' }}>
              <strong>Request #{selectedRequest.id}</strong> - {selectedRequest.module} ({selectedRequest.action})
              <br />
              <span style={{ color: 'var(--text-muted)' }}>Site: {selectedRequest.site}</span>
            </p>
            {selectedRequest.summary && (
              <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '13px' }}>{selectedRequest.summary}</p>
            )}
            <div className="form-group">
              <label>Remarks {decisionType === 'reject' ? '*' : '(optional)'}</label>
              <textarea
                className={styles.remarksInput}
                value={decisionRemarks}
                onChange={e => setDecisionRemarks(e.target.value)}
                placeholder={decisionType === 'reject' ? 'Please provide a reason for rejection...' : 'Optional remarks...'}
                rows={3}
                required={decisionType === 'reject'}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                className={decisionType === 'approve' ? styles.btnApprove : styles.btnReject}
                onClick={submitDecision}
              >
                <i className={decisionType === 'approve' ? 'ri-check-line' : 'ri-close-line'} />
                {' '}{decisionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
              <button className="btn-secondary" onClick={() => setShowDecisionModal(false)}>Cancel</button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
