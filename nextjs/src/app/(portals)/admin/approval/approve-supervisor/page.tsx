'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useExport } from '@/hooks/useExport';
import { useNotification } from '@/contexts/NotificationContext';
import SummaryCards from '@/components/SummaryCards';
import ModalDialog from '@/components/ModalDialog';

interface SupervisorRequest {
  id: string;
  site: string;
  module: string;
  action: string;
  actionType: string;
  summary: string;
  requestedAt: string;
  status: string;
  newData: any;
  oldData: any;
  adminRemarks: string;
  _backendId: number;
}

function mapStatus(status: string): string {
  const map: Record<string, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
  return map[status] ?? status ?? '';
}

function mapRequest(r: any): SupervisorRequest {
  return {
    _backendId: r.id,
    id: r.request_id ?? String(r.id),
    site: r.site_name ?? r.site ?? '',
    module: r.module ?? '',
    action: [r.action, r.summary].filter(Boolean).join(' - '),
    actionType: r.action ?? '',
    summary: r.summary ?? r.details ?? '',
    requestedAt: r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '',
    status: mapStatus(r.status),
    newData: r.new_data ?? null,
    oldData: r.old_data ?? null,
    adminRemarks: r.remarks ?? '',
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

function actionBadgeClass(action: string): string {
  switch (action?.toLowerCase()) {
    case 'create': return 'badge badge-success';
    case 'update': return 'badge badge-info';
    case 'delete': return 'badge badge-danger';
    default: return 'badge badge-info';
  }
}

export default function ApproveSupervisorPage() {
  const api = useApi();
  const notifs = useNotification();
  const exportService = useExport();

  const [requests, setRequests] = useState<SupervisorRequest[]>([]);
  const [allRequests, setAllRequests] = useState<SupervisorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchFilter, setSearchFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SupervisorRequest | null>(null);
  const [decisionType, setDecisionType] = useState<'approve' | 'reject'>('approve');
  const [decisionRemarks, setDecisionRemarks] = useState('');

  const summaryCards = useMemo(() => {
    const all = allRequests;
    const pending = all.filter(r => r.status === 'Pending').length;
    const approved = all.filter(r => r.status === 'Approved').length;
    const rejected = all.filter(r => r.status === 'Rejected').length;
    return [
      { title: 'Total Requests', value: all.length, icon: 'ri-file-list-line', color: 'primary' },
      { title: 'Pending', value: pending, icon: 'ri-time-line', color: pending > 0 ? 'warning' : 'success' },
      { title: 'Approved', value: approved, icon: 'ri-checkbox-circle-line', color: 'success' },
      { title: 'Rejected', value: rejected, icon: 'ri-close-circle-line', color: 'danger' },
    ];
  }, [allRequests]);

  const filteredRequests = useMemo(() => {
    let list = requests;
    const q = searchFilter.toLowerCase();
    if (q) list = list.filter(r =>
      r.module.toLowerCase().includes(q) || r.action.toLowerCase().includes(q) ||
      r.site.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
    );
    if (siteFilter) list = list.filter(r => r.site === siteFilter);
    if (actionFilter) list = list.filter(r => r.actionType === actionFilter);
    return list;
  }, [requests, searchFilter, siteFilter, actionFilter]);

  const uniqueSites = useMemo(() => {
    return [...new Set(allRequests.map(r => r.site).filter(Boolean))];
  }, [allRequests]);

  const uniqueActions = useMemo(() => {
    return [...new Set(allRequests.map(r => r.actionType).filter(Boolean))];
  }, [allRequests]);

  const loadRequests = useCallback(async (tab?: 'pending' | 'history', status?: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { source: 'supervisor' };
      const s = status ?? statusFilter;
      if (s !== 'all') params['status'] = s;
      const data = await api.get<any[]>('/approvals', params);
      const mapped = (data ?? []).map(r => mapRequest(r));
      setAllRequests(mapped);
      setRequests(mapped);
    } catch {
      notifs.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [api, notifs, statusFilter]);

  useEffect(() => {
    loadRequests();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const switchTab = (tab: 'pending' | 'history') => {
    setActiveTab(tab);
    const newStatus = tab === 'pending' ? 'pending' : 'all';
    setStatusFilter(newStatus);
    loadRequests(tab, newStatus);
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
    const req = selectedRequest;
    if (!req) return;
    if (decisionType === 'reject' && !decisionRemarks.trim()) {
      notifs.error('Remarks required for rejection');
      return;
    }
    const endpoint = decisionType === 'approve' ? 'approve' : 'reject';
    try {
      await api.put(`/approvals/${req._backendId}/${endpoint}`, { remarks: decisionRemarks });
      notifs.success(`Request ${endpoint}d`);
      setShowDecisionModal(false);
      loadRequests();
    } catch {
      notifs.error(`Failed to ${endpoint} request`);
    }
  };

  const objectKeys = (obj: any): string[] => {
    return obj ? Object.keys(obj) : [];
  };

  const exportToExcel = () => {
    exportService.exportToExcel(
      filteredRequests.map(r => ({
        id: r.id, site: r.site, module: r.module, action: r.action,
        date: r.requestedAt, status: r.status, remarks: r.adminRemarks,
      })),
      'supervisor-approvals', 'Supervisor Approvals'
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-shield-user-line"></i> Supervisor Requests</h1>
        <div className="header-actions">
          <button className="btn-export" onClick={exportToExcel} disabled={!filteredRequests.length}>
            <i className="ri-file-excel-2-line"></i> Export
          </button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container">
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border-color)' }}>
          <button
            className={activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}
            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
            onClick={() => switchTab('pending')}
          >
            <i className="ri-time-line"></i> Pending
          </button>
          <button
            className={activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}
            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
            onClick={() => switchTab('history')}
          >
            <i className="ri-history-line"></i> History
          </button>
        </div>

        <div className="table-toolbar">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
            {activeTab === 'history' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Status</label>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); loadRequests(undefined, e.target.value); }}>
                  <option value="all">All</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
              <label>Site</label>
              <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}>
                <option value="">All Sites</option>
                {uniqueSites.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 120 }}>
              <label>Action</label>
              <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
                <option value="">All Actions</option>
                {uniqueActions.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 150 }}>
              <label>Search</label>
              <input type="text" placeholder="Search requests..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 200 }}></div>
        ) : (
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.length === 0 ? (
                  <tr><td colSpan={7} className="empty-state">No {activeTab === 'pending' ? 'pending' : ''} supervisor requests.</td></tr>
                ) : filteredRequests.map(req => (
                  <tr key={req.id}>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{req.id}</td>
                    <td>{req.site}</td>
                    <td>{req.module}</td>
                    <td>
                      <span className={actionBadgeClass(req.actionType)}>{req.actionType}</span>
                      <span style={{ marginLeft: 4 }}>{req.action}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12.5px' }}>{req.requestedAt}</td>
                    <td><span className={statusBadgeClass(req.status)}>{req.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => viewDetails(req)}>
                          <i className="ri-eye-line"></i> View
                        </button>
                        {req.status === 'Pending' && (
                          <>
                            <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12, background: 'var(--success)' }} onClick={() => openDecision(req, 'approve')}>
                              <i className="ri-checkbox-circle-line"></i> Approve
                            </button>
                            <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12, background: 'var(--danger)' }} onClick={() => openDecision(req, 'reject')}>
                              <i className="ri-close-circle-line"></i> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <ModalDialog isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Request Details" size="lg">
        {selectedRequest && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                <div><strong>ID:</strong> {selectedRequest.id}</div>
                <div><strong>Site:</strong> {selectedRequest.site}</div>
                <div><strong>Date:</strong> {selectedRequest.requestedAt}</div>
                <div><strong>Status:</strong> <span className={statusBadgeClass(selectedRequest.status)}>{selectedRequest.status}</span></div>
              </div>
              {selectedRequest.adminRemarks && (
                <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 6, marginBottom: 12 }}>
                  <strong>Admin Remarks:</strong> {selectedRequest.adminRemarks}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {selectedRequest.oldData && (
                <div>
                  <h4 style={{ marginBottom: 8, color: 'var(--danger)' }}><i className="ri-subtract-line"></i> Previous Data</h4>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12 }}>
                    {objectKeys(selectedRequest.oldData).map(key => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key}</span>
                        <span>{String(selectedRequest.oldData[key])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedRequest.newData && (
                <div>
                  <h4 style={{ marginBottom: 8, color: 'var(--success)' }}><i className="ri-add-line"></i> New Data</h4>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12 }}>
                    {objectKeys(selectedRequest.newData).map(key => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key}</span>
                        <span>{String(selectedRequest.newData[key])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </ModalDialog>

      {/* Decision Modal */}
      <ModalDialog
        isOpen={showDecisionModal}
        onClose={() => setShowDecisionModal(false)}
        title={decisionType === 'approve' ? 'Approve Request' : 'Reject Request'}
        size="md"
      >
        {selectedRequest && (
          <>
            <div style={{ marginBottom: 16 }}>
              <p><strong>Request:</strong> {selectedRequest.id} — {selectedRequest.module} — {selectedRequest.action}</p>
              <p><strong>Site:</strong> {selectedRequest.site}</p>
            </div>
            <div className="form-group">
              <label>Admin Remarks {decisionType === 'reject' ? '*' : ''}</label>
              <textarea
                rows={3}
                style={{ width: '100%', padding: 10, background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-main)', resize: 'vertical' }}
                value={decisionRemarks}
                onChange={e => setDecisionRemarks(e.target.value)}
                placeholder={decisionType === 'reject' ? 'Reason for rejection (required)...' : 'Optional remarks...'}
              />
            </div>
          </>
        )}
        <div data-modal-footer="">
          {decisionType === 'approve' ? (
            <button className="btn-primary" style={{ background: 'var(--success)' }} onClick={submitDecision}>
              <i className="ri-checkbox-circle-line"></i> Confirm Approve
            </button>
          ) : (
            <button className="btn-primary" style={{ background: 'var(--danger)' }} onClick={submitDecision}>
              <i className="ri-close-circle-line"></i> Confirm Reject
            </button>
          )}
          <button className="btn-secondary" onClick={() => setShowDecisionModal(false)}>Cancel</button>
        </div>
      </ModalDialog>
    </div>
  );
}
