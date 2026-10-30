'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { exportToExcel } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards from '@/components/SummaryCards';
import styles from './CompanyLoanManagementPage.module.scss';

const INTEREST_TYPES = ['%', 'fixed'];

export default function CompanyLoanManagementPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [banks, setBanks] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);

  const [bankId, setBankId] = useState('');
  const [loanIdExternal, setLoanIdExternal] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestType, setInterestType] = useState('%');
  const [interestValue, setInterestValue] = useState('');
  const [tenure, setTenure] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [status, setStatus] = useState('Active');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'Active' | 'Closed'>('Active');

  const [emiModalOpen, setEmiModalOpen] = useState(false);
  const [emiLoan, setEmiLoan] = useState<any>(null);
  const [emiAmount, setEmiAmount] = useState('');
  const [emiDate, setEmiDate] = useState(new Date().toISOString().split('T')[0]);
  const [emiMethod, setEmiMethod] = useState('');
  const [emiRemarks, setEmiRemarks] = useState('');
  const [emiSaving, setEmiSaving] = useState(false);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoan, setHistoryLoan] = useState<any>(null);
  const [emiHistory, setEmiHistory] = useState<any[]>([]);

  const loadBanks = useCallback(async () => {
    try {
      const data = await apiGet<any[]>('/banks');
      setBanks(data);
    } catch (err: any) {
      notifyError('Failed to load banks: ' + err.message);
    }
  }, [notifyError]);

  const loadLoans = useCallback(async () => {
    setLoading(true);
    try {
      const [loanData, reminderData] = await Promise.all([
        apiGet<any[]>('/loans'),
        apiGet<any[]>('/loans/reminders'),
      ]);
      setLoans(loanData);
      setReminders(reminderData);
    } catch (err: any) {
      notifyError('Failed to load loans: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { loadBanks(); loadLoans(); }, [loadBanks, loadLoans]);

  const bankItems = useMemo(() => banks.map(b => ({ value: b.id, label: `${b.bank_name} - ${b.account_number}` })), [banks]);

  const filteredLoans = useMemo(() => loans.filter(l => l.status === activeTab), [loans, activeTab]);

  const summaryCards = useMemo(() => {
    const totalPrincipal = loans.reduce((s, l) => s + (l.principal ?? 0), 0);
    const activeCount = loans.filter(l => l.status === 'Active').length;
    const closedCount = loans.filter(l => l.status === 'Closed').length;
    return [
      { title: 'Total Principal', value: `₹${totalPrincipal.toLocaleString('en-IN')}`, icon: 'ri-money-rupee-circle-line', color: 'primary' as const },
      { title: 'Active Loans', value: activeCount, icon: 'ri-checkbox-circle-line', color: 'success' as const },
      { title: 'Closed Loans', value: closedCount, icon: 'ri-close-circle-line', color: 'secondary' as const },
      { title: 'Upcoming EMIs', value: reminders.length, icon: 'ri-alarm-warning-line', color: 'warning' as const },
    ];
  }, [loans, reminders]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setBankId('');
    setLoanIdExternal('');
    setPrincipal('');
    setInterestType('%');
    setInterestValue('');
    setTenure('');
    setDueDate('');
    setPurpose('');
    setStatus('Active');
  }, []);

  const saveLoan = useCallback(async () => {
    if (!bankId || !principal) return;
    setSaving(true);
    const body = {
      bank_id: bankId,
      loan_id_external: loanIdExternal,
      principal: parseFloat(principal),
      interest_type: interestType,
      interest_value: interestValue ? parseFloat(interestValue) : null,
      tenure: tenure ? parseInt(tenure) : null,
      due_date: dueDate ? parseInt(dueDate) : null,
      purpose,
      status,
    };
    try {
      if (editingId) {
        await apiPut(`/loans/${editingId}`, body);
        success('Loan updated');
      } else {
        await apiPost('/loans', body);
        success('Loan added');
      }
      resetForm();
      loadLoans();
    } catch (err: any) {
      notifyError('Failed to save loan: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [bankId, loanIdExternal, principal, interestType, interestValue, tenure, dueDate, purpose, status, editingId, success, notifyError, resetForm, loadLoans]);

  const editLoan = useCallback((l: any) => {
    setEditingId(l.id);
    setBankId(l.bank_id ?? '');
    setLoanIdExternal(l.loan_id_external ?? '');
    setPrincipal(String(l.principal ?? ''));
    setInterestType(l.interest_type ?? '%');
    setInterestValue(String(l.interest_value ?? ''));
    setTenure(String(l.tenure ?? ''));
    setDueDate(String(l.due_date ?? ''));
    setPurpose(l.purpose ?? '');
    setStatus(l.status ?? 'Active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const deleteLoan = useCallback(async (l: any) => {
    const ok = await confirm({ title: 'Delete Loan', message: 'Delete this loan record? This cannot be undone.', type: 'danger', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await apiDelete(`/loans/${l.id}`);
      success('Loan deleted');
      loadLoans();
    } catch (err: any) {
      notifyError('Delete failed: ' + err.message);
    }
  }, [confirm, success, notifyError, loadLoans]);

  const toggleLoanStatus = useCallback(async (l: any) => {
    const newStatus = l.status === 'Active' ? 'Closed' : 'Active';
    try {
      await apiPut(`/loans/${l.id}`, { ...l, status: newStatus });
      success(`Loan marked as ${newStatus}`);
      loadLoans();
    } catch (err: any) {
      notifyError('Failed to update status: ' + err.message);
    }
  }, [success, notifyError, loadLoans]);

  const openPayEmi = (loan: any) => {
    setEmiLoan(loan);
    setEmiAmount('');
    setEmiDate(new Date().toISOString().split('T')[0]);
    setEmiMethod('');
    setEmiRemarks('');
    setEmiModalOpen(true);
  };

  const payEmi = useCallback(async () => {
    if (!emiLoan || !emiAmount) return;
    setEmiSaving(true);
    try {
      await apiPost(`/loans/${emiLoan.id}/emis`, {
        amount: parseFloat(emiAmount),
        payment_date: emiDate,
        payment_method: emiMethod,
        remarks: emiRemarks,
      });
      success('EMI payment recorded');
      setEmiModalOpen(false);
      loadLoans();
    } catch (err: any) {
      notifyError('Failed to record EMI: ' + err.message);
    } finally {
      setEmiSaving(false);
    }
  }, [emiLoan, emiAmount, emiDate, emiMethod, emiRemarks, success, notifyError, loadLoans]);

  const showEmiHistory = useCallback(async (loan: any) => {
    setHistoryLoan(loan);
    setHistoryModalOpen(true);
    try {
      const data = await apiGet<any[]>(`/loans/${loan.id}/emis`);
      setEmiHistory(data);
    } catch { setEmiHistory([]); }
  }, []);

  const getBankName = (id: string) => banks.find(b => b.id === id)?.bank_name ?? '--';

  const handleExportExcel = () => {
    exportToExcel(filteredLoans.map(l => ({
      Bank: getBankName(l.bank_id),
      'Loan ID': l.loan_id_external,
      Principal: l.principal,
      'Interest Type': l.interest_type,
      'Interest Value': l.interest_value,
      Tenure: l.tenure,
      'Due Date': l.due_date,
      Purpose: l.purpose,
      Status: l.status,
    })), 'loans');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-hand-coin-line"></i> Loan Management</h1>
        <button className="btn-export" onClick={handleExportExcel}><i className="ri-file-excel-2-line"></i> Export Excel</button>
      </div>

      <SummaryCards cards={summaryCards} />

      {reminders.length > 0 && (
        <div className={styles.reminderBanner}>
          <i className="ri-alarm-warning-line" style={{ fontSize: 20 }}></i>
          <span>{reminders.length} EMI{reminders.length > 1 ? 's' : ''} due soon — check active loans below</span>
        </div>
      )}

      <div className="card-container" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
          {editingId ? 'Edit Loan' : 'Add New Loan'}
        </h3>
        <form onSubmit={e => { e.preventDefault(); saveLoan(); }}>
          <div className="form-grid">
            <div className="form-group">
              <SearchableDropdown items={bankItems} label="Bank *" placeholder="Select Bank..." value={bankId} onChange={setBankId} />
            </div>
            <div className="form-group">
              <label>Loan ID (External)</label>
              <input type="text" value={loanIdExternal} onChange={e => setLoanIdExternal(e.target.value)} placeholder="Bank loan reference" />
            </div>
            <div className="form-group">
              <label>Principal Amount <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="0.00" min="0" step="0.01" required />
            </div>
            <div className="form-group">
              <label>Interest Type</label>
              <select value={interestType} onChange={e => setInterestType(e.target.value)}>
                {INTEREST_TYPES.map(t => <option key={t} value={t}>{t === '%' ? 'Percentage (%)' : 'Fixed Amount'}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Interest Value</label>
              <input type="number" value={interestValue} onChange={e => setInterestValue(e.target.value)} placeholder={interestType === '%' ? '% rate' : 'Fixed amount'} min="0" step="0.01" />
            </div>
            <div className="form-group">
              <label>Tenure (months)</label>
              <input type="number" value={tenure} onChange={e => setTenure(e.target.value)} placeholder="Months" min="1" />
            </div>
            <div className="form-group">
              <label>EMI Due Date (day of month)</label>
              <input type="number" value={dueDate} onChange={e => setDueDate(e.target.value)} placeholder="1-31" min="1" max="31" />
            </div>
            <div className="form-group">
              <label>Purpose</label>
              <input type="text" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Loan purpose" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn-primary" disabled={saving || !bankId || !principal}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
              {editingId ? 'Update Loan' : 'Add Loan'}
            </button>
            {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>

      <div className={styles.tabs} style={{ marginTop: 20 }}>
        <button className={`${styles.tab} ${activeTab === 'Active' ? styles.tabActive : ''}`} onClick={() => setActiveTab('Active')}>
          Active Loans ({loans.filter(l => l.status === 'Active').length})
        </button>
        <button className={`${styles.tab} ${activeTab === 'Closed' ? styles.tabActive : ''}`} onClick={() => setActiveTab('Closed')}>
          Closed Loans ({loans.filter(l => l.status === 'Closed').length})
        </button>
      </div>

      <div className="table-responsive">
        {loading ? (
          <div className="empty-state"><div className="skeleton" style={{ height: 200 }}></div></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Bank</th>
                <th>Loan ID</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>Tenure</th>
                <th>Due Date</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLoans.length === 0 ? (
                <tr><td colSpan={9} className="empty-state">No {activeTab.toLowerCase()} loans found.</td></tr>
              ) : filteredLoans.map(l => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 600 }}>{getBankName(l.bank_id)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.loan_id_external ?? '--'}</td>
                  <td style={{ fontWeight: 700 }}>₹{(l.principal ?? 0).toLocaleString('en-IN')}</td>
                  <td>{l.interest_value ? `${l.interest_value}${l.interest_type === '%' ? '%' : ' (fixed)'}` : '--'}</td>
                  <td>{l.tenure ? `${l.tenure} mo` : '--'}</td>
                  <td>{l.due_date ? `${l.due_date}th` : '--'}</td>
                  <td>{l.purpose ?? '--'}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${l.status === 'Active' ? styles.statusActive : styles.statusClosed}`}>{l.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {l.status === 'Active' && (
                        <button className="btn-success" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openPayEmi(l)} title="Pay EMI">
                          <i className="ri-money-rupee-circle-line"></i>
                        </button>
                      )}
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => showEmiHistory(l)} title="EMI History">
                        <i className="ri-history-line"></i>
                      </button>
                      <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => editLoan(l)} title="Edit">
                        <i className="ri-pencil-line"></i>
                      </button>
                      <button className="btn-warning" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleLoanStatus(l)} title={l.status === 'Active' ? 'Close Loan' : 'Reopen'}>
                        <i className={l.status === 'Active' ? 'ri-lock-line' : 'ri-lock-unlock-line'}></i>
                      </button>
                      <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteLoan(l)} title="Delete">
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pay EMI Modal */}
      <ModalDialog isOpen={emiModalOpen} title="Pay EMI" onClose={() => setEmiModalOpen(false)}>
        {emiLoan && (
          <form onSubmit={e => { e.preventDefault(); payEmi(); }}>
            <div className="form-group">
              <label>EMI Amount <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="number" value={emiAmount} onChange={e => setEmiAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" required />
            </div>
            <div className="form-group">
              <label>Payment Date</label>
              <input type="date" value={emiDate} onChange={e => setEmiDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Payment Method</label>
              <input type="text" value={emiMethod} onChange={e => setEmiMethod(e.target.value)} placeholder="NEFT / Cheque / etc." />
            </div>
            <div className="form-group">
              <label>Remarks</label>
              <textarea value={emiRemarks} onChange={e => setEmiRemarks(e.target.value)} rows={2} placeholder="Optional remarks" />
            </div>
            <div className="modal-footer">
              <button type="submit" className="btn-primary" disabled={emiSaving || !emiAmount}>
                <i className="ri-check-line"></i> {emiSaving ? 'Saving...' : 'Record Payment'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setEmiModalOpen(false)}>Cancel</button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* EMI History Modal */}
      <ModalDialog isOpen={historyModalOpen} title="EMI History" size="lg" onClose={() => setHistoryModalOpen(false)}>
        {historyLoan && (
          <>
            <div className={styles.emiSummary}>
              <div><div className={styles.emiLabel}>Principal</div><div className={styles.emiValue}>₹{(historyLoan.principal ?? 0).toLocaleString('en-IN')}</div></div>
              <div><div className={styles.emiLabel}>Total Paid</div><div className={styles.emiValue}>₹{emiHistory.reduce((s, e) => s + (e.amount ?? 0), 0).toLocaleString('en-IN')}</div></div>
              <div><div className={styles.emiLabel}>Pending</div><div className={styles.emiValue}>₹{Math.max(0, (historyLoan.principal ?? 0) - emiHistory.reduce((s, e) => s + (e.amount ?? 0), 0)).toLocaleString('en-IN')}</div></div>
            </div>
            <table>
              <thead>
                <tr><th>#</th><th>Date</th><th>Amount</th><th>Method</th><th>Remarks</th></tr>
              </thead>
              <tbody>
                {emiHistory.length === 0 ? (
                  <tr><td colSpan={5} className="empty-state">No EMI payments recorded.</td></tr>
                ) : emiHistory.map((e, i) => (
                  <tr key={e.id}>
                    <td>{i + 1}</td>
                    <td>{e.payment_date?.split('T')[0]}</td>
                    <td style={{ fontWeight: 700 }}>₹{(e.amount ?? 0).toLocaleString('en-IN')}</td>
                    <td>{e.payment_method ?? '--'}</td>
                    <td>{e.remarks ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </ModalDialog>
    </div>
  );
}
