'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useAuth } from '@/contexts/AuthContext';
import { isSupervisor, isOffice, isAdmin } from '@/lib/role-utils';
import { requiresApproval, submitForApproval } from '@/lib/approval-utils';
import styles from './BankEntryPage.module.scss';

interface Bank {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  ifsc_code: string;
  branch_name: string;
  status?: string;
  pending_status?: string;
  editing?: boolean;
  editBankName?: string;
  editAccountName?: string;
  editAccountNumber?: string;
  editIfsc?: string;
  editBranch?: string;
}

export default function BankEntryPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const { currentUser } = useAuth();

  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);

  const canModify = !isSupervisor(currentUser);
  const roleBadge = useMemo(() => {
    if (isOffice(currentUser)) return 'Office Mode - Requires Approval';
    if (isSupervisor(currentUser)) return 'Supervisor Mode - View Only';
    return '';
  }, [currentUser]);

  const loadBanks = useCallback(async () => {
    try {
      const res = await apiGet<Bank[]>('/banks');
      setBanks((res ?? []).map(b => ({
        ...b,
        account_name: b.account_name ?? '',
        status: b.status ?? 'Active',
      })));
    } catch {
      notifyError('Failed to load banks');
    }
  }, [notifyError]);

  useEffect(() => {
    loadBanks();
  }, [loadBanks]);

  const resetForm = () => {
    setBankName('');
    setAccountName('');
    setAccountNumber('');
    setIfscCode('');
    setBranchName('');
  };

  const onSubmit = async () => {
    if (!bankName || !accountName || !accountNumber || !ifscCode || !branchName) {
      notifyError('All fields are required');
      return;
    }
    if (isSupervisor(currentUser)) return;

    const payload = {
      bank_name: bankName,
      account_name: accountName,
      account_number: accountNumber,
      ifsc_code: ifscCode.toUpperCase(),
      branch_name: branchName,
    };

    if (requiresApproval(currentUser)) {
      try {
        await submitForApproval('BankEntry', 0, 'create', payload);
        success('Bank account request sent for approval');
        resetForm();
      } catch (err: unknown) {
        notifyError((err as Error)?.message ?? 'Failed to submit request');
      }
      return;
    }

    setLoading(true);
    try {
      await apiPost('/banks', payload);
      success('Bank account registered');
      resetForm();
      loadBanks();
    } catch (err: unknown) {
      notifyError((err as Error)?.message ?? 'Failed to add bank');
    }
    setLoading(false);
  };

  const startEdit = async (bank: Bank) => {
    if (isSupervisor(currentUser)) return;

    if (isAdmin(currentUser)) {
      const confirmed = await confirm({
        title: 'Admin Protected Action',
        message: 'Enter admin password to edit this bank account.',
        type: 'warning',
      });
      if (!confirmed) return;
    }

    setBanks(list => list.map(b =>
      b.id === bank.id
        ? {
            ...b,
            editing: true,
            editBankName: b.bank_name,
            editAccountName: b.account_name,
            editAccountNumber: b.account_number,
            editIfsc: b.ifsc_code,
            editBranch: b.branch_name,
          }
        : { ...b, editing: false }
    ));
  };

  const cancelEdit = () => {
    setBanks(list => list.map(b => ({ ...b, editing: false })));
  };

  const saveEdit = async (bank: Bank) => {
    if (!bank.editBankName || !bank.editAccountName || !bank.editAccountNumber || !bank.editIfsc || !bank.editBranch) {
      notifyError('All fields are required');
      return;
    }

    const payload = {
      bank_name: bank.editBankName,
      account_name: bank.editAccountName,
      account_number: bank.editAccountNumber,
      ifsc_code: bank.editIfsc!.toUpperCase(),
      branch_name: bank.editBranch,
    };

    if (requiresApproval(currentUser)) {
      cancelEdit();
      try {
        await submitForApproval('BankEntry', Number(bank.id) || 0, 'update', payload);
        success('Edit request sent for approval');
        loadBanks();
      } catch (err: unknown) {
        notifyError((err as Error)?.message ?? 'Failed to submit request');
      }
      return;
    }

    try {
      await apiPut(`/banks/${bank.id}`, payload);
      success('Bank account updated');
      cancelEdit();
      loadBanks();
    } catch (err: unknown) {
      notifyError((err as Error)?.message ?? 'Failed to update bank');
    }
  };

  const deleteBank = async (bank: Bank) => {
    if (isSupervisor(currentUser)) return;

    if (requiresApproval(currentUser)) {
      try {
        await submitForApproval('BankEntry', Number(bank.id) || 0, 'delete', { id: bank.id });
        success('Delete request sent for approval');
        loadBanks();
      } catch (err: unknown) {
        notifyError((err as Error)?.message ?? 'Failed to submit request');
      }
      return;
    }

    const confirmed = await confirm({
      title: 'Admin Protected Action',
      message: `Delete bank account: ${bank.bank_name} (A/C: ${bank.account_number})?`,
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await apiDelete(`/banks/${bank.id}`);
      success('Bank account deleted');
      loadBanks();
    } catch (err: unknown) {
      notifyError((err as Error)?.message ?? 'Failed to delete bank');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-bank-line" /> Company Bank Entry</h1>
        {roleBadge && <span className="role-badge">{roleBadge}</span>}
      </div>

      {canModify && (
        <div className="card-container">
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className={`form-grid ${styles.formGrid3}`}>
            <div className="form-group">
              <label>Bank Name</label>
              <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g., State Bank of India" required />
            </div>
            <div className="form-group">
              <label>Account Name</label>
              <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g., ATR Construction Pvt Ltd" required />
            </div>
            <div className="form-group">
              <label>Account Number</label>
              <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g., 0000123456789" required />
            </div>
            <div className="form-group">
              <label>IFSC Code</label>
              <input type="text" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)}
                placeholder="e.g., SBIN0001234" required />
            </div>
            <div className="form-group">
              <label>Branch Name</label>
              <input type="text" value={branchName} onChange={(e) => setBranchName(e.target.value)}
                placeholder="e.g., Kolkata Main Branch" required />
            </div>
            <div className="form-group" style={{ alignSelf: 'end' }}>
              <button type="submit" className="btn-primary" disabled={loading}>
                {requiresApproval(currentUser)
                  ? (loading ? 'Submitting...' : 'Request New Bank Approval')
                  : (loading ? 'Adding...' : 'Register Bank Account')
                }
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card-container" style={{ marginTop: '16px' }}>
        <h3 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--accent)' }}>
          <span><i className="ri-bank-line" /> Registered Corporate Banks</span>
          {isAdmin(currentUser) && <span className={styles.adminBadge}>Protected Actions</span>}
        </h3>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Bank Name</th>
                <th>A/C Name</th>
                <th>A/C Number</th>
                <th>IFSC Code</th>
                <th>Branch</th>
                {canModify && <th style={{ textAlign: 'center' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {banks.length === 0 ? (
                <tr>
                  <td colSpan={canModify ? 6 : 5} className="empty-state">No company banks registered.</td>
                </tr>
              ) : banks.map(bank => (
                bank.editing ? (
                  <tr key={bank.id}>
                    <td>
                      <input type="text" className={styles.editInput}
                        value={bank.editBankName ?? ''} onChange={(e) => setBanks(list => list.map(b => b.id === bank.id ? { ...b, editBankName: e.target.value } : b))} />
                    </td>
                    <td>
                      <input type="text" className={styles.editInput}
                        value={bank.editAccountName ?? ''} onChange={(e) => setBanks(list => list.map(b => b.id === bank.id ? { ...b, editAccountName: e.target.value } : b))} />
                    </td>
                    <td>
                      <input type="text" className={styles.editInput}
                        value={bank.editAccountNumber ?? ''} onChange={(e) => setBanks(list => list.map(b => b.id === bank.id ? { ...b, editAccountNumber: e.target.value } : b))} />
                    </td>
                    <td>
                      <input type="text" className={styles.editInput}
                        value={bank.editIfsc ?? ''} onChange={(e) => setBanks(list => list.map(b => b.id === bank.id ? { ...b, editIfsc: e.target.value } : b))} />
                    </td>
                    <td>
                      <input type="text" className={styles.editInput}
                        value={bank.editBranch ?? ''} onChange={(e) => setBanks(list => list.map(b => b.id === bank.id ? { ...b, editBranch: e.target.value } : b))} />
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button className="btn-icon btn-success" onClick={() => saveEdit(bank)}>Save</button>
                      <button className="btn-icon" onClick={cancelEdit}>Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={bank.id}>
                    <td style={{ fontWeight: 700 }}>{bank.bank_name}</td>
                    <td>{bank.account_name}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)' }}>{bank.account_number}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)' }}>{bank.ifsc_code}</td>
                    <td>
                      {bank.branch_name}
                      {bank.pending_status && (
                        <>
                          <br />
                          <span className="badge badge-warning" style={{ fontSize: '10px', marginTop: '4px' }}>
                            {bank.pending_status}
                          </span>
                        </>
                      )}
                    </td>
                    {canModify && (
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button className="btn-icon" onClick={() => startEdit(bank)}>Edit</button>
                        <button className="btn-icon btn-danger" onClick={() => deleteBank(bank)}>Delete</button>
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
