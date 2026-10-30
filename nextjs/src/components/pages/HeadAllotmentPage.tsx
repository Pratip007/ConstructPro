'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet, apiPost, apiPut } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useAuth } from '@/contexts/AuthContext';
import { isSupervisor, isOffice } from '@/lib/role-utils';
import { requiresApproval, submitForApproval } from '@/lib/approval-utils';
import styles from './HeadAllotmentPage.module.scss';

interface Head {
  id: string;
  name: string;
  opening_balance: number;
  date: string;
  status: string;
  pending_status?: string;
  editing?: boolean;
  editName?: string;
  editBalance?: number;
  editDate?: string;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function HeadAllotmentPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const { currentUser } = useAuth();

  const [headName, setHeadName] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number | ''>('');
  const [headDate, setHeadDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [heads, setHeads] = useState<Head[]>([]);

  const canModify = !isSupervisor(currentUser);
  const roleBadge = useMemo(() => {
    if (isOffice(currentUser)) return 'Office Mode - Requires Approval';
    if (isSupervisor(currentUser)) return 'Supervisor Mode - View Only';
    return '';
  }, [currentUser]);

  const loadHeads = useCallback(async () => {
    try {
      const res = await apiGet<Head[]>('/settings/heads');
      setHeads((res ?? []).map(h => ({
        ...h,
        opening_balance: h.opening_balance ?? 0,
        date: h.date ?? '',
        status: h.status ?? 'Active',
      })));
    } catch {
      notifyError('Failed to load head allotments');
    }
  }, [notifyError]);

  useEffect(() => {
    loadHeads();
  }, [loadHeads]);

  const resetForm = () => {
    setHeadName('');
    setOpeningBalance('');
    setHeadDate(new Date().toISOString().split('T')[0]);
  };

  const onSubmit = async () => {
    if (!headName || openingBalance === '' || !headDate) return;
    if (isSupervisor(currentUser)) return;

    const payload = {
      name: headName,
      opening_balance: Number(openingBalance),
      date: headDate,
    };

    if (requiresApproval(currentUser)) {
      try {
        await submitForApproval('HeadAllotment', 0, 'create', { ...payload, status: 'Active' });
        success('Head allotment request sent for approval');
        resetForm();
      } catch (err: unknown) {
        notifyError((err as Error)?.message ?? 'Failed to submit request');
      }
      return;
    }

    setLoading(true);
    try {
      await apiPost('/settings/heads', payload);
      success('Head allotment registered');
      resetForm();
      loadHeads();
    } catch (err: unknown) {
      notifyError((err as Error)?.message ?? 'Failed to add head');
    }
    setLoading(false);
  };

  const startEdit = (head: Head) => {
    if (isSupervisor(currentUser)) return;
    setHeads(list => list.map(h =>
      h.id === head.id
        ? { ...h, editing: true, editName: h.name, editBalance: h.opening_balance, editDate: h.date }
        : { ...h, editing: false }
    ));
  };

  const cancelEdit = () => {
    setHeads(list => list.map(h => ({ ...h, editing: false })));
  };

  const saveEdit = async (head: Head) => {
    if (!head.editName || head.editBalance == null || !head.editDate) {
      notifyError('All fields are required');
      return;
    }

    const payload = {
      name: head.editName,
      opening_balance: head.editBalance,
      date: head.editDate,
    };

    if (requiresApproval(currentUser)) {
      cancelEdit();
      try {
        await submitForApproval('HeadAllotment', Number(head.id) || 0, 'update', payload);
        success('Edit request sent for approval');
        loadHeads();
      } catch (err: unknown) {
        notifyError((err as Error)?.message ?? 'Failed to submit request');
      }
      return;
    }

    try {
      await apiPut(`/settings/heads/${head.id}`, payload);
      success('Head updated');
      cancelEdit();
      loadHeads();
    } catch (err: unknown) {
      notifyError((err as Error)?.message ?? 'Failed to update head');
    }
  };

  const toggleStatus = async (head: Head) => {
    if (isSupervisor(currentUser)) return;
    const newStatus = head.status === 'Active' ? 'Disabled' : 'Active';

    if (requiresApproval(currentUser)) {
      try {
        await submitForApproval('HeadAllotment', Number(head.id) || 0, 'update', { ...head, status: newStatus });
        success('Status change sent for approval');
        loadHeads();
      } catch (err: unknown) {
        notifyError((err as Error)?.message ?? 'Failed to submit request');
      }
      return;
    }

    const confirmed = await confirm({
      title: `${newStatus === 'Active' ? 'Enable' : 'Disable'} Head`,
      message: `Change status of "${head.name}" to ${newStatus}?`,
      type: newStatus === 'Active' ? 'info' : 'warning',
    });
    if (!confirmed) return;

    try {
      await apiPut(`/settings/heads/${head.id}`, { status: newStatus });
      success(`Head status changed to ${newStatus}`);
      loadHeads();
    } catch (err: unknown) {
      notifyError((err as Error)?.message ?? 'Failed to update status');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-price-tag-3-line" /> Head Entry Allotment</h1>
        {roleBadge && <span className="role-badge">{roleBadge}</span>}
      </div>

      {canModify && (
        <div className="card-container">
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="form-grid">
            <div className="form-group">
              <label>Head Name</label>
              <input type="text" value={headName} onChange={(e) => setHeadName(e.target.value)}
                placeholder="e.g., Cement Supply / Labor Cost" required />
            </div>
            <div className="form-group">
              <label>Opening Balance (&#8377;)</label>
              <input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g., 50000" min={0} step="any" required />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={headDate} onChange={(e) => setHeadDate(e.target.value)} required />
            </div>
            <div className="form-group" style={{ alignSelf: 'end' }}>
              <button type="submit" className="btn-primary" disabled={loading}>
                {requiresApproval(currentUser)
                  ? (loading ? 'Submitting...' : 'Request New Head Approval')
                  : (loading ? 'Adding...' : 'Allot & Register Head')
                }
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card-container" style={{ marginTop: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: 'var(--accent)' }}>
          <i className="ri-price-tag-3-line" /> Registered Account Heads
        </h3>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Head Name</th>
                <th>Opening Balance</th>
                <th>Allotment Date</th>
                <th>Status</th>
                {canModify && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {heads.length === 0 ? (
                <tr>
                  <td colSpan={canModify ? 5 : 4} className="empty-state">No heads registered.</td>
                </tr>
              ) : heads.map(head => (
                head.editing ? (
                  <tr key={head.id}>
                    <td>
                      <input type="text" className={styles.editInput}
                        value={head.editName ?? ''} onChange={(e) => setHeads(list => list.map(h => h.id === head.id ? { ...h, editName: e.target.value } : h))} />
                    </td>
                    <td>
                      <input type="number" className={styles.editInput} step="any"
                        value={head.editBalance ?? 0} onChange={(e) => setHeads(list => list.map(h => h.id === head.id ? { ...h, editBalance: Number(e.target.value) } : h))} />
                    </td>
                    <td>
                      <input type="date" className={styles.editInput}
                        value={head.editDate ?? ''} onChange={(e) => setHeads(list => list.map(h => h.id === head.id ? { ...h, editDate: e.target.value } : h))} />
                    </td>
                    <td><span className="badge badge-info">Editing...</span></td>
                    <td>
                      <button className="btn-icon btn-success" onClick={() => saveEdit(head)}>Save</button>
                      <button className="btn-icon" onClick={cancelEdit}>Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={head.id} className={head.status !== 'Active' ? styles.rowDisabled : ''}>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{head.name}</td>
                    <td style={{ fontWeight: 600 }}>{formatInr(head.opening_balance)}</td>
                    <td>{head.date}</td>
                    <td>
                      <span className={`badge ${head.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                        {head.status}
                      </span>
                      {head.pending_status && (
                        <>
                          <br />
                          <span className="badge badge-warning" style={{ fontSize: '10px', marginTop: '4px' }}>
                            {head.pending_status}
                          </span>
                        </>
                      )}
                    </td>
                    {canModify && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn-icon" onClick={() => toggleStatus(head)}>
                          {head.status === 'Active' ? 'Disable' : 'Enable'}
                        </button>
                        <button className="btn-icon" onClick={() => startEdit(head)}>Edit</button>
                      </td>
                    )}
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
