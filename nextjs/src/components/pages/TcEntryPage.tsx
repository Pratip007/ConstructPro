'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet, apiPost, apiPut } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useAuth } from '@/contexts/AuthContext';
import { isSupervisor, isOffice } from '@/lib/role-utils';
import { requiresApproval, submitForApproval } from '@/lib/approval-utils';
import styles from './TcEntryPage.module.scss';

interface TermsEntry {
  id: string;
  content: string;
  status: string;
  pending_status?: string;
  editing?: boolean;
  editContent?: string;
}

export default function TcEntryPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const { currentUser } = useAuth();

  const [statement, setStatement] = useState('');
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<TermsEntry[]>([]);

  const canModify = !isSupervisor(currentUser);
  const roleBadge = useMemo(() => {
    if (isOffice(currentUser)) return 'Office Mode - Requires Approval';
    if (isSupervisor(currentUser)) return 'Supervisor Mode - View Only';
    return '';
  }, [currentUser]);

  const loadTerms = useCallback(async () => {
    try {
      const res = await apiGet<TermsEntry[]>('/settings/terms');
      setEntries((res ?? []).map(t => ({
        ...t,
        content: t.content ?? '',
        status: t.status ?? 'Active',
      })));
    } catch {
      notifyError('Failed to load terms & conditions');
    }
  }, [notifyError]);

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  const onSubmit = async () => {
    if (!statement) return;
    if (isSupervisor(currentUser)) return;

    const payload = { content: statement };

    if (requiresApproval(currentUser)) {
      try {
        await submitForApproval('TCEntry', 0, 'create', { ...payload, status: 'Active' });
        success('T&C clause request sent for approval');
        setStatement('');
      } catch (err: unknown) {
        notifyError((err as Error)?.message ?? 'Failed to submit request');
      }
      return;
    }

    setLoading(true);
    try {
      await apiPost('/settings/terms', payload);
      success('T&C clause added');
      setStatement('');
      loadTerms();
    } catch (err: unknown) {
      notifyError((err as Error)?.message ?? 'Failed to add clause');
    }
    setLoading(false);
  };

  const startEdit = (entry: TermsEntry) => {
    if (isSupervisor(currentUser)) return;
    setEntries(list => list.map(e =>
      e.id === entry.id
        ? { ...e, editing: true, editContent: e.content }
        : { ...e, editing: false }
    ));
  };

  const cancelEdit = () => {
    setEntries(list => list.map(e => ({ ...e, editing: false })));
  };

  const saveEdit = async (entry: TermsEntry) => {
    if (!entry.editContent) {
      notifyError('Statement cannot be empty');
      return;
    }

    const payload = { content: entry.editContent };

    if (requiresApproval(currentUser)) {
      cancelEdit();
      try {
        await submitForApproval('TCEntry', Number(entry.id) || 0, 'update', payload);
        success('Edit request sent for approval');
        loadTerms();
      } catch (err: unknown) {
        notifyError((err as Error)?.message ?? 'Failed to submit request');
      }
      return;
    }

    try {
      await apiPut(`/settings/terms/${entry.id}`, payload);
      success('Clause updated');
      cancelEdit();
      loadTerms();
    } catch (err: unknown) {
      notifyError((err as Error)?.message ?? 'Failed to update clause');
    }
  };

  const toggleStatus = async (entry: TermsEntry) => {
    if (isSupervisor(currentUser)) return;
    const newStatus = entry.status === 'Active' ? 'Disabled' : 'Active';

    if (requiresApproval(currentUser)) {
      try {
        await submitForApproval('TCEntry', Number(entry.id) || 0, 'update', { ...entry, status: newStatus });
        success('Status change sent for approval');
        loadTerms();
      } catch (err: unknown) {
        notifyError((err as Error)?.message ?? 'Failed to submit request');
      }
      return;
    }

    const confirmed = await confirm({
      title: `${newStatus === 'Active' ? 'Enable' : 'Disable'} Clause`,
      message: `Change status to ${newStatus}?`,
      type: newStatus === 'Active' ? 'info' : 'warning',
    });
    if (!confirmed) return;

    try {
      await apiPut(`/settings/terms/${entry.id}`, { status: newStatus });
      success(`Clause status changed to ${newStatus}`);
      loadTerms();
    } catch (err: unknown) {
      notifyError((err as Error)?.message ?? 'Failed to update status');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-file-list-3-line" /> Terms &amp; Conditions Entry</h1>
        {roleBadge && <span className="role-badge">{roleBadge}</span>}
      </div>

      {canModify && (
        <div className="card-container">
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
            <div className="form-group">
              <label>Enter Terms &amp; Conditions Statement</label>
              <textarea
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                placeholder="e.g., 50% Advance payment must be cleared before construction setup startup phases."
                rows={4}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '12px' }}>
              {requiresApproval(currentUser)
                ? (loading ? 'Submitting...' : 'Request New Clause Approval')
                : (loading ? 'Adding...' : 'Add Clause Statement')
              }
            </button>
          </form>
        </div>
      )}

      <div className="card-container" style={{ marginTop: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: 'var(--accent)' }}>
          <i className="ri-file-list-3-line" /> Registered Clause Guidelines
        </h3>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ width: '65%' }}>Terms &amp; Condition Statement</th>
                <th style={{ width: '15%' }}>Status</th>
                {canModify && <th style={{ width: '20%' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={canModify ? 3 : 2} className="empty-state">No T&amp;C entries registered.</td>
                </tr>
              ) : entries.map(entry => (
                entry.editing ? (
                  <tr key={entry.id}>
                    <td>
                      <div className={styles.bulletPointText}>
                        <span className={styles.bulletDot}>&bull;</span>
                        <textarea
                          className={styles.editTextarea}
                          value={entry.editContent ?? ''}
                          onChange={(e) => setEntries(list => list.map(en => en.id === entry.id ? { ...en, editContent: e.target.value } : en))}
                        />
                      </div>
                    </td>
                    <td><span className="badge badge-info">Editing...</span></td>
                    <td>
                      <button className="btn-icon btn-success" onClick={() => saveEdit(entry)}>Save</button>
                      <button className="btn-icon" onClick={cancelEdit}>Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={entry.id} className={entry.status !== 'Active' ? styles.rowDisabled : ''}>
                    <td>
                      <div className={styles.bulletPointText}>
                        <span className={styles.bulletDot}>&bull;</span>
                        <span className={styles.clauseContent}>{entry.content}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${entry.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                        {entry.status}
                      </span>
                      {entry.pending_status && (
                        <>
                          <br />
                          <span className="badge badge-warning" style={{ fontSize: '10px', marginTop: '4px' }}>
                            {entry.pending_status}
                          </span>
                        </>
                      )}
                    </td>
                    {canModify && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn-icon" onClick={() => toggleStatus(entry)}>
                          {entry.status === 'Active' ? 'Disable' : 'Enable'}
                        </button>
                        <button className="btn-icon" onClick={() => startEdit(entry)}>Edit</button>
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
