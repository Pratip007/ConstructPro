'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPut } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import ModalDialog from '@/components/ModalDialog';
import DataTable, { type TableColumn, type TableAction } from '@/components/DataTable';
import SummaryCards from '@/components/SummaryCards';

interface Approval {
  id: string;
  display_id?: string;
  source?: string;
  module?: string;
  action_type?: string;
  requester?: string;
  requester_name?: string;
  amount?: number;
  status: string;
  date?: string;
  created_at?: string;
  old_data?: any;
  new_data?: any;
  remarks?: string;
  summary?: string;
}

export default function ApprovalsPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterModule, setFilterModule] = useState('');

  // Detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);

  // Reject modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectApproval, setRejectApproval] = useState<Approval | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Approval[]>('/approvals');
      setApprovals(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load approvals: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { loadApprovals(); }, [loadApprovals]);

  const modules = useMemo(() => {
    const set = new Set(approvals.map(a => a.module).filter(Boolean));
    return Array.from(set);
  }, [approvals]);

  const filteredApprovals = useMemo(() => {
    let result = approvals;
    if (filterStatus) result = result.filter(a => a.status.toLowerCase() === filterStatus.toLowerCase());
    if (filterSource) result = result.filter(a => a.source === filterSource);
    if (filterModule) result = result.filter(a => a.module === filterModule);
    return result;
  }, [approvals, filterStatus, filterSource, filterModule]);

  const summaryCards = useMemo(() => {
    const pending = approvals.filter(a => a.status === 'pending').length;
    const approved = approvals.filter(a => a.status === 'approved').length;
    const rejected = approvals.filter(a => a.status === 'rejected').length;
    return [
      { title: 'Total', value: approvals.length, icon: 'ri-file-list-3-line', color: 'primary' as const },
      { title: 'Pending', value: pending, icon: 'ri-time-line', color: 'warning' as const },
      { title: 'Approved', value: approved, icon: 'ri-checkbox-circle-line', color: 'success' as const },
      { title: 'Rejected', value: rejected, icon: 'ri-close-circle-line', color: 'danger' as const },
    ];
  }, [approvals]);

  const approveItem = useCallback(async (item: Approval) => {
    const ok = await confirm({ title: 'Approve Request', message: `Approve this ${item.module ?? ''} ${item.action_type ?? ''} request?`, confirmText: 'Approve' });
    if (!ok) return;
    try {
      await apiPut(`/approvals/${item.id}/approve`, {});
      success('Request approved');
      loadApprovals();
    } catch (err: any) {
      notifyError('Failed to approve: ' + err.message);
    }
  }, [confirm, success, notifyError, loadApprovals]);

  const openRejectModal = (item: Approval) => {
    setRejectApproval(item);
    setRejectRemarks('');
    setRejectModalOpen(true);
  };

  const rejectItem = useCallback(async () => {
    if (!rejectApproval) return;
    if (!rejectRemarks.trim()) { notifyError('Remarks are required for rejection'); return; }
    setRejecting(true);
    try {
      await apiPut(`/approvals/${rejectApproval.id}/reject`, { remarks: rejectRemarks.trim() });
      success('Request rejected');
      setRejectModalOpen(false);
      loadApprovals();
    } catch (err: any) {
      notifyError('Failed to reject: ' + err.message);
    } finally {
      setRejecting(false);
    }
  }, [rejectApproval, rejectRemarks, success, notifyError, loadApprovals]);

  const viewDetail = (item: Approval) => {
    setSelectedApproval(item);
    setDetailModalOpen(true);
  };

  const formatJson = (data: any): string => {
    if (!data) return 'N/A';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const tableData = useMemo(() => filteredApprovals.map(a => ({
    ...a,
    dateFormatted: (a.date ?? a.created_at ?? '').split('T')[0] || '--',
    requesterDisplay: a.requester_name ?? a.requester ?? '--',
    amountDisplay: a.amount != null ? a.amount : null,
  })), [filteredApprovals]);

  const columns: TableColumn[] = [
    { key: 'display_id', label: 'ID', sortable: true },
    { key: 'source', label: 'Source', type: 'badge', badgeMap: { office: 'info', supervisor: 'warning' } },
    { key: 'module', label: 'Module', sortable: true },
    { key: 'action_type', label: 'Action', sortable: true },
    { key: 'requesterDisplay', label: 'Requester' },
    { key: 'amountDisplay', label: 'Amount', type: 'currency' },
    { key: 'status', label: 'Status', type: 'badge', badgeMap: { pending: 'warning', approved: 'success', rejected: 'danger' } },
    { key: 'dateFormatted', label: 'Date', sortable: true },
  ];

  const actions: TableAction[] = [
    { label: '', icon: 'ri-eye-line', action: 'view', class: 'btn-secondary' },
    { label: '', icon: 'ri-check-line', action: 'approve', class: 'btn-primary', show: (row) => row.status === 'pending' },
    { label: '', icon: 'ri-close-line', action: 'reject', class: 'btn-danger', show: (row) => row.status === 'pending' },
  ];

  const handleAction = (event: { action: string; row: any }) => {
    if (event.action === 'view') viewDetail(event.row);
    if (event.action === 'approve') approveItem(event.row);
    if (event.action === 'reject') openRejectModal(event.row);
  };

  const statusTabs = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-shield-check-line"></i> Approvals</h1>
      </div>

      <SummaryCards cards={summaryCards} />

      {/* Filters */}
      <div className="card-container" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Status tabs */}
          <div style={{ display: 'flex', gap: 6 }}>
            {statusTabs.map(tab => (
              <button
                key={tab.value}
                className={filterStatus === tab.value ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setFilterStatus(tab.value)}
                style={{ padding: '6px 14px', fontSize: 13 }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Source</label>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={{ minWidth: 130 }}>
              <option value="">All Sources</option>
              <option value="office">Office</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Module</label>
            <select value={filterModule} onChange={e => setFilterModule(e.target.value)} style={{ minWidth: 150 }}>
              <option value="">All Modules</option>
              {modules.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <button className="btn-secondary" onClick={() => { setFilterStatus(''); setFilterSource(''); setFilterModule(''); }} style={{ marginBottom: 0 }}>
            <i className="ri-filter-off-line"></i> Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card-container" style={{ marginTop: 20 }}>
        <DataTable
          columns={columns}
          data={tableData}
          loading={loading}
          fileName="approvals"
          actions={actions}
          onActionClick={handleAction}
          emptyMessage="No approval requests found."
        />
      </div>

      {/* Detail Modal */}
      <ModalDialog isOpen={detailModalOpen} title="Approval Detail" size="lg" onClose={() => setDetailModalOpen(false)}>
        {selectedApproval && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>ID</div>
                <div style={{ fontWeight: 600 }}>{selectedApproval.display_id ?? selectedApproval.id}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Status</div>
                <span className={`badge ${selectedApproval.status === 'pending' ? 'badge-warning' : selectedApproval.status === 'approved' ? 'badge-success' : 'badge-danger'}`}>
                  {selectedApproval.status}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Source</div>
                <span className={`badge ${selectedApproval.source === 'office' ? 'badge-info' : 'badge-warning'}`}>{selectedApproval.source ?? '--'}</span>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Module</div>
                <div>{selectedApproval.module ?? '--'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Action</div>
                <div>{selectedApproval.action_type ?? '--'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Requester</div>
                <div>{selectedApproval.requester_name ?? selectedApproval.requester ?? '--'}</div>
              </div>
              {selectedApproval.amount != null && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Amount</div>
                  <div style={{ fontWeight: 700 }}>{`₹${selectedApproval.amount.toLocaleString('en-IN')}`}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Date</div>
                <div>{(selectedApproval.date ?? selectedApproval.created_at ?? '').split('T')[0] || '--'}</div>
              </div>
              {selectedApproval.summary && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Summary</div>
                  <div>{selectedApproval.summary}</div>
                </div>
              )}
              {selectedApproval.remarks && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Remarks</div>
                  <div style={{ color: 'var(--danger)' }}>{selectedApproval.remarks}</div>
                </div>
              )}
            </div>

            {/* Data comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--danger)' }}>
                  <i className="ri-arrow-left-line"></i> Old Data
                </h4>
                <pre style={{
                  padding: 12, borderRadius: 8, fontSize: 11, overflow: 'auto', maxHeight: 300,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {formatJson(selectedApproval.old_data)}
                </pre>
              </div>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--success)' }}>
                  <i className="ri-arrow-right-line"></i> New Data
                </h4>
                <pre style={{
                  padding: 12, borderRadius: 8, fontSize: 11, overflow: 'auto', maxHeight: 300,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {formatJson(selectedApproval.new_data)}
                </pre>
              </div>
            </div>

            {selectedApproval.status === 'pending' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button className="btn-primary" onClick={() => { setDetailModalOpen(false); approveItem(selectedApproval); }}>
                  <i className="ri-check-line"></i> Approve
                </button>
                <button className="btn-danger" onClick={() => { setDetailModalOpen(false); openRejectModal(selectedApproval); }}>
                  <i className="ri-close-line"></i> Reject
                </button>
              </div>
            )}
          </div>
        )}
      </ModalDialog>

      {/* Reject Modal */}
      <ModalDialog isOpen={rejectModalOpen} title="Reject Request" size="sm" onClose={() => setRejectModalOpen(false)}>
        {rejectApproval && (
          <form onSubmit={e => { e.preventDefault(); rejectItem(); }}>
            <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>
              Rejecting {rejectApproval.module ?? ''} {rejectApproval.action_type ?? ''} request
              {rejectApproval.requester_name ? ` from ${rejectApproval.requester_name}` : ''}.
            </p>
            <div className="form-group">
              <label>Rejection Remarks <span style={{ color: 'var(--danger)' }}>*</span></label>
              <textarea
                value={rejectRemarks}
                onChange={e => setRejectRemarks(e.target.value)}
                placeholder="Provide reason for rejection..."
                rows={3}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setRejectModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn-danger" disabled={rejecting || !rejectRemarks.trim()}>
                <i className="ri-close-line"></i> {rejecting ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </form>
        )}
      </ModalDialog>
    </div>
  );
}
