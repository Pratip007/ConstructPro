'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards from '@/components/SummaryCards';

interface Loan {
  id: string;
  display_id?: string;
  loan_id_external?: string;
  bank_id: string;
  purpose?: string;
  principal: number;
  interest_type?: string;
  interest_value?: number;
  tenure?: number;
  total_payable?: number;
  monthly_emi?: number;
  due_date?: number;
  remind_days?: number;
  start_date?: string;
  status: string;
}

interface Bank { id: string; bank_name: string; account_number: string; }
interface Reminder { loan_id: string; bank_name?: string; amount?: number; due_date?: number; days_until_due?: number; }

export default function LoansPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('Active');

  // Loan form
  const [loanIdExternal, setLoanIdExternal] = useState('');
  const [bankId, setBankId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestType, setInterestType] = useState('%');
  const [interestValue, setInterestValue] = useState('');
  const [tenure, setTenure] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [remindDays, setRemindDays] = useState('7');
  const [startDate, setStartDate] = useState('');

  // EMI modal
  const [emiModalOpen, setEmiModalOpen] = useState(false);
  const [emiLoan, setEmiLoan] = useState<Loan | null>(null);
  const [emiDate, setEmiDate] = useState(new Date().toISOString().split('T')[0]);
  const [emiRefNo, setEmiRefNo] = useState('');
  const [emiPayBank, setEmiPayBank] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [emiSaving, setEmiSaving] = useState(false);

  // EMI history modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoan, setHistoryLoan] = useState<Loan | null>(null);
  const [emiHistory, setEmiHistory] = useState<any[]>([]);

  const loadBanks = useCallback(async () => {
    try {
      const data = await apiGet<Bank[]>('/banks');
      setBanks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load banks: ' + err.message);
    }
  }, [notifyError]);

  const loadLoans = useCallback(async () => {
    setLoading(true);
    try {
      const [loanData, reminderData] = await Promise.all([
        apiGet<Loan[]>('/loans'),
        apiGet<Reminder[]>('/loans/reminders'),
      ]);
      setLoans(Array.isArray(loanData) ? loanData : []);
      setReminders(Array.isArray(reminderData) ? reminderData : []);
    } catch (err: any) {
      notifyError('Failed to load loans: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { loadBanks(); loadLoans(); }, [loadBanks, loadLoans]);

  const bankItems = useMemo(() => banks.map(b => ({ value: b.id, label: `${b.bank_name} - ${b.account_number}` })), [banks]);

  const filteredLoans = useMemo(() => {
    if (!filterStatus) return loans;
    return loans.filter(l => l.status === filterStatus);
  }, [loans, filterStatus]);

  // Computed fields
  const computedTotalPayable = useMemo(() => {
    const p = parseFloat(principal);
    const iv = parseFloat(interestValue);
    const t = parseInt(tenure);
    if (isNaN(p)) return 0;
    if (interestType === '%' && !isNaN(iv) && !isNaN(t)) {
      return p + (p * iv * t) / (100 * 12);
    } else if (interestType === 'fixed' && !isNaN(iv)) {
      return p + iv;
    }
    return p;
  }, [principal, interestType, interestValue, tenure]);

  const computedMonthlyEmi = useMemo(() => {
    const t = parseInt(tenure);
    if (!t || t <= 0) return 0;
    return computedTotalPayable / t;
  }, [computedTotalPayable, tenure]);

  const summaryCards = useMemo(() => {
    const totalPrincipal = loans.reduce((s, l) => s + (l.principal ?? 0), 0);
    const activeCount = loans.filter(l => l.status === 'Active').length;
    const closedCount = loans.filter(l => l.status === 'Closed').length;
    return [
      { title: 'Total Principal', value: `₹${totalPrincipal.toLocaleString('en-IN')}`, icon: 'ri-money-rupee-circle-line', color: 'primary' as const },
      { title: 'Active Loans', value: activeCount, icon: 'ri-checkbox-circle-line', color: 'success' as const },
      { title: 'Closed Loans', value: closedCount, icon: 'ri-close-circle-line', color: 'info' as const },
      { title: 'Upcoming EMIs', value: reminders.length, icon: 'ri-alarm-warning-line', color: 'warning' as const },
    ];
  }, [loans, reminders]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setLoanIdExternal('');
    setBankId('');
    setPurpose('');
    setPrincipal('');
    setInterestType('%');
    setInterestValue('');
    setTenure('');
    setDueDate('');
    setRemindDays('7');
    setStartDate('');
  }, []);

  const getBankName = (id: string) => banks.find(b => b.id === id)?.bank_name ?? '--';

  const saveLoan = useCallback(async () => {
    if (!bankId || !principal) return;
    setSaving(true);
    const body = {
      loan_id_external: loanIdExternal || null,
      bank_id: bankId,
      purpose: purpose || null,
      principal: parseFloat(principal),
      interest_type: interestType,
      interest_value: interestValue ? parseFloat(interestValue) : null,
      tenure: tenure ? parseInt(tenure) : null,
      due_date: dueDate ? parseInt(dueDate) : null,
      remind_days: remindDays ? parseInt(remindDays) : 7,
      start_date: startDate || null,
      total_payable: computedTotalPayable,
      monthly_emi: computedMonthlyEmi,
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
  }, [loanIdExternal, bankId, purpose, principal, interestType, interestValue, tenure, dueDate, remindDays, startDate, computedTotalPayable, computedMonthlyEmi, editingId, success, notifyError, resetForm, loadLoans]);

  const editLoan = useCallback((l: Loan) => {
    setEditingId(l.id);
    setLoanIdExternal(l.loan_id_external ?? '');
    setBankId(l.bank_id ?? '');
    setPurpose(l.purpose ?? '');
    setPrincipal(String(l.principal ?? ''));
    setInterestType(l.interest_type ?? '%');
    setInterestValue(String(l.interest_value ?? ''));
    setTenure(String(l.tenure ?? ''));
    setDueDate(String(l.due_date ?? ''));
    setRemindDays(String(l.remind_days ?? '7'));
    setStartDate(l.start_date?.split('T')[0] ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const deleteLoan = useCallback(async (l: Loan) => {
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

  const toggleLoanStatus = useCallback(async (l: Loan) => {
    const newStatus = l.status === 'Active' ? 'Closed' : 'Active';
    try {
      await apiPut(`/loans/${l.id}`, { ...l, status: newStatus });
      success(`Loan marked as ${newStatus}`);
      loadLoans();
    } catch (err: any) {
      notifyError('Failed to update status: ' + err.message);
    }
  }, [success, notifyError, loadLoans]);

  // EMI Payment
  const openPayEmi = (loan: Loan) => {
    setEmiLoan(loan);
    setEmiDate(new Date().toISOString().split('T')[0]);
    setEmiRefNo('');
    setEmiPayBank('');
    setEmiAmount('');
    setEmiModalOpen(true);
  };

  const payEmi = useCallback(async () => {
    if (!emiLoan || !emiAmount) return;
    setEmiSaving(true);
    try {
      await apiPost(`/loans/${emiLoan.id}/emis`, {
        date: emiDate,
        ref_no: emiRefNo || null,
        pay_bank: emiPayBank || null,
        amount: parseFloat(emiAmount),
      });
      success('EMI payment recorded');
      setEmiModalOpen(false);
      loadLoans();
    } catch (err: any) {
      notifyError('Failed to record EMI: ' + err.message);
    } finally {
      setEmiSaving(false);
    }
  }, [emiLoan, emiDate, emiRefNo, emiPayBank, emiAmount, success, notifyError, loadLoans]);

  // EMI History
  const showEmiHistory = useCallback(async (loan: Loan) => {
    setHistoryLoan(loan);
    setHistoryModalOpen(true);
    try {
      const data = await apiGet<any[]>(`/loans/${loan.id}/emis`);
      setEmiHistory(Array.isArray(data) ? data : []);
    } catch {
      setEmiHistory([]);
    }
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-hand-coin-line"></i> Company Loans</h1>
      </div>

      <SummaryCards cards={summaryCards} />

      {/* Reminders */}
      {reminders.length > 0 && (
        <div className="card-container" style={{ marginTop: 16, borderLeft: '4px solid var(--warning)', background: 'rgba(255,193,7,0.05)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--warning)' }}>
            <i className="ri-alarm-warning-line"></i> Upcoming EMI Reminders
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reminders.map((r, i) => (
              <div key={i} style={{ fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="badge badge-warning">{r.days_until_due ?? '?'} days</span>
                <span>{r.bank_name ?? 'Unknown Bank'}</span>
                <span style={{ fontWeight: 700 }}>{r.amount ? `₹${r.amount.toLocaleString('en-IN')}` : ''}</span>
                <span style={{ color: 'var(--text-muted)' }}>Due on {r.due_date ?? '--'}th</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      <div className="card-container" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
          {editingId ? 'Edit Loan' : 'Add New Loan'}
        </h3>
        <form onSubmit={e => { e.preventDefault(); saveLoan(); }}>
          <div className="form-grid">
            <div className="form-group">
              <label>External Loan ID</label>
              <input type="text" value={loanIdExternal} onChange={e => setLoanIdExternal(e.target.value)} placeholder="Bank loan reference" />
            </div>
            <div className="form-group">
              <SearchableDropdown items={bankItems} label="Bank *" placeholder="Select Bank..." value={bankId} onChange={setBankId} required />
            </div>
            <div className="form-group">
              <label>Purpose</label>
              <input type="text" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Loan purpose" />
            </div>
            <div className="form-group">
              <label>Principal Amount <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="0.00" min="0" step="0.01" required />
            </div>
            <div className="form-group">
              <label>Interest Type</label>
              <select value={interestType} onChange={e => setInterestType(e.target.value)}>
                <option value="%">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
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
              <label>EMI Due Date (day 1-31)</label>
              <input type="number" value={dueDate} onChange={e => setDueDate(e.target.value)} placeholder="1-31" min="1" max="31" />
            </div>
            <div className="form-group">
              <label>Remind Days Before</label>
              <input type="number" value={remindDays} onChange={e => setRemindDays(e.target.value)} placeholder="7" min="0" />
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
          </div>

          {/* Computed fields */}
          {principal && (
            <div style={{ display: 'flex', gap: 20, marginTop: 12, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 13 }}>
              <div><strong>Total Payable:</strong> <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{`₹${computedTotalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}</span></div>
              <div><strong>Monthly EMI:</strong> <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{`₹${computedMonthlyEmi.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}</span></div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn-primary" disabled={saving || !bankId || !principal}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
              {editingId ? ' Update Loan' : ' Add Loan'}
            </button>
            {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>

      {/* Status Filter */}
      <div className="card-container" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Active', 'Closed', ''].map(s => (
            <button
              key={s}
              className={filterStatus === s ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setFilterStatus(s)}
              style={{ padding: '6px 16px', fontSize: 13 }}
            >
              {s || 'All'} ({s ? loans.filter(l => l.status === s).length : loans.length})
            </button>
          ))}
        </div>
      </div>

      {/* Loans Table */}
      <div className="table-responsive" style={{ marginTop: 20 }}>
        {loading ? (
          <div className="empty-state"><div className="skeleton" style={{ height: 200 }}></div></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>External ID</th>
                <th>Bank</th>
                <th>Purpose</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>Tenure</th>
                <th>Total Payable</th>
                <th>Monthly EMI</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLoans.length === 0 ? (
                <tr><td colSpan={12} className="empty-state">No loans found.</td></tr>
              ) : filteredLoans.map(l => (
                <tr key={l.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.display_id ?? '--'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.loan_id_external ?? '--'}</td>
                  <td style={{ fontWeight: 600 }}>{getBankName(l.bank_id)}</td>
                  <td>{l.purpose ?? '--'}</td>
                  <td style={{ fontWeight: 700 }}>{`₹${(l.principal ?? 0).toLocaleString('en-IN')}`}</td>
                  <td>{l.interest_value ? `${l.interest_value}${l.interest_type === '%' ? '%' : ' (fixed)'}` : '--'}</td>
                  <td>{l.tenure ? `${l.tenure} mo` : '--'}</td>
                  <td style={{ fontWeight: 600 }}>{l.total_payable ? `₹${l.total_payable.toLocaleString('en-IN')}` : '--'}</td>
                  <td style={{ fontWeight: 600 }}>{l.monthly_emi ? `₹${l.monthly_emi.toLocaleString('en-IN')}` : '--'}</td>
                  <td>{l.due_date ? `${l.due_date}th` : '--'}</td>
                  <td>
                    <span className={`badge ${l.status === 'Active' ? 'badge-success' : 'badge-info'}`}>{l.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {l.status === 'Active' && (
                        <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openPayEmi(l)} title="Pay EMI">
                          <i className="ri-money-rupee-circle-line"></i>
                        </button>
                      )}
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => showEmiHistory(l)} title="EMI History">
                        <i className="ri-history-line"></i>
                      </button>
                      <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => editLoan(l)} title="Edit">
                        <i className="ri-pencil-line"></i>
                      </button>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleLoanStatus(l)} title={l.status === 'Active' ? 'Close' : 'Reopen'}>
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
      <ModalDialog isOpen={emiModalOpen} title={`Pay EMI — ${getBankName(emiLoan?.bank_id ?? '')}`} onClose={() => setEmiModalOpen(false)}>
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
              <label>Reference No</label>
              <input type="text" value={emiRefNo} onChange={e => setEmiRefNo(e.target.value)} placeholder="Transaction ref / cheque no" />
            </div>
            <div className="form-group">
              <SearchableDropdown items={bankItems} label="Payment Bank" placeholder="Select Bank..." value={emiPayBank} onChange={setEmiPayBank} />
            </div>
            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button type="submit" className="btn-primary" disabled={emiSaving || !emiAmount}>
                <i className="ri-check-line"></i> {emiSaving ? 'Saving...' : 'Record Payment'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setEmiModalOpen(false)}>Cancel</button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* EMI History Modal */}
      <ModalDialog isOpen={historyModalOpen} title={`EMI History — ${getBankName(historyLoan?.bank_id ?? '')}`} size="lg" onClose={() => setHistoryModalOpen(false)}>
        {historyLoan && (
          <>
            <div style={{ display: 'flex', gap: 20, marginBottom: 16, padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Principal</div><div style={{ fontWeight: 700 }}>{`₹${(historyLoan.principal ?? 0).toLocaleString('en-IN')}`}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Paid</div><div style={{ fontWeight: 700, color: 'var(--success)' }}>{`₹${emiHistory.reduce((s, e) => s + (e.amount ?? 0), 0).toLocaleString('en-IN')}`}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Remaining</div><div style={{ fontWeight: 700, color: 'var(--danger)' }}>{`₹${Math.max(0, (historyLoan.total_payable ?? historyLoan.principal ?? 0) - emiHistory.reduce((s, e) => s + (e.amount ?? 0), 0)).toLocaleString('en-IN')}`}</div></div>
            </div>
            <table>
              <thead>
                <tr><th>#</th><th>Date</th><th>Ref No</th><th>Bank</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {emiHistory.length === 0 ? (
                  <tr><td colSpan={5} className="empty-state">No EMI payments recorded.</td></tr>
                ) : emiHistory.map((e, i) => (
                  <tr key={e.id ?? i}>
                    <td>{i + 1}</td>
                    <td>{e.date?.split('T')[0] ?? e.payment_date?.split('T')[0] ?? '--'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.ref_no ?? '--'}</td>
                    <td>{e.pay_bank ? getBankName(e.pay_bank) : (e.payment_method ?? '--')}</td>
                    <td style={{ fontWeight: 700 }}>{`₹${(e.amount ?? 0).toLocaleString('en-IN')}`}</td>
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
