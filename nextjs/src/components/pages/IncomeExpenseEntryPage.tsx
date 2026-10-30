'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { exportToExcel, exportToPDF, printReport } from '@/lib/export-utils';
import { useRole } from '@/hooks/useRole';
import { useApproval } from '@/hooks/useApproval';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import styles from './IncomeExpenseEntryPage.module.scss';

export default function IncomeExpenseEntryPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const role = useRole();
  const approval = useApproval();

  const [entries, setEntries] = useState<any[]>([]);
  const [heads, setHeads] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);

  const [entryType, setEntryType] = useState('Expense');
  const [headId, setHeadId] = useState('');
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [bankId, setBankId] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [filterType, setFilterType] = useState('');
  const [filterHead, setFilterHead] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');

  const loadMasters = useCallback(async () => {
    try {
      const [h, b] = await Promise.all([
        apiGet<any[]>('/settings/heads'),
        apiGet<any[]>('/banks'),
      ]);
      setHeads(h);
      setBanks(b);
    } catch (err: any) {
      notifyError('Failed to load masters: ' + err.message);
    }
  }, [notifyError]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<any[]>('/income-expenses');
      setEntries(data);
    } catch (err: any) {
      notifyError('Failed to load entries: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { loadMasters(); loadEntries(); }, [loadMasters, loadEntries]);

  const headItems = useMemo(() => heads.map(h => ({ value: h.id, label: h.name })), [heads]);
  const bankItems = useMemo(() => banks.map(b => ({ value: b.id, label: `${b.bank_name} - ${b.account_number}` })), [banks]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (filterType) result = result.filter(e => e.type === filterType);
    if (filterHead) result = result.filter(e => e.head_id === filterHead);
    if (filterFromDate) result = result.filter(e => (e.date ?? '').split('T')[0] >= filterFromDate);
    if (filterToDate) result = result.filter(e => (e.date ?? '').split('T')[0] <= filterToDate);
    return result;
  }, [entries, filterType, filterHead, filterFromDate, filterToDate]);

  const summaryCards = useMemo(() => {
    const totalIncome = filteredEntries.filter(e => e.type === 'Income').reduce((s, e) => s + (e.amount ?? 0), 0);
    const totalExpense = filteredEntries.filter(e => e.type === 'Expense').reduce((s, e) => s + (e.amount ?? 0), 0);
    const net = totalIncome - totalExpense;
    return [
      { title: 'Total Income', value: `₹${totalIncome.toLocaleString('en-IN')}`, icon: 'ri-arrow-up-circle-line', color: 'success' as const },
      { title: 'Total Expense', value: `₹${totalExpense.toLocaleString('en-IN')}`, icon: 'ri-arrow-down-circle-line', color: 'danger' as const },
      { title: 'Net Balance', value: `₹${Math.abs(net).toLocaleString('en-IN')} ${net >= 0 ? 'Surplus' : 'Deficit'}`, icon: 'ri-scales-3-line', color: net >= 0 ? 'success' as const : 'danger' as const },
    ];
  }, [filteredEntries]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setEntryType('Expense');
    setHeadId('');
    setAmount('');
    setEntryDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setBankId('');
  }, []);

  const onAddHead = useCallback(async (name: string) => {
    try {
      const newHead = await apiPost<any>('/settings/heads', { name });
      setHeads(prev => [...prev, newHead]);
      setHeadId(newHead.id);
      success('Head created');
    } catch (err: any) {
      notifyError('Failed to create head: ' + err.message);
    }
  }, [success, notifyError]);

  const saveEntry = useCallback(async () => {
    if (!amount || !headId) return;
    setSaving(true);
    const body = {
      type: entryType,
      head_id: headId,
      amount: parseFloat(amount),
      date: entryDate,
      description,
      bank_id: bankId || null,
    };
    try {
      if (editingId) {
        if (approval.requiresApproval()) {
          await approval.submitForApproval({
            module: 'income-expenses',
            actionType: 'update',
            summary: `Update ${entryType} entry: ₹${amount}`,
            data: body,
            referenceId: editingId,
          });
          success('Submitted for approval');
        } else {
          await apiPut(`/income-expenses/${editingId}`, body);
          success('Entry updated');
        }
      } else {
        if (approval.requiresApproval()) {
          await approval.submitForApproval({
            module: 'income-expenses',
            actionType: 'create',
            summary: `New ${entryType} entry: ₹${amount}`,
            data: body,
          });
          success('Submitted for approval');
        } else {
          await apiPost('/income-expenses', body);
          success('Entry added');
        }
      }
      resetForm();
      loadEntries();
    } catch (err: any) {
      notifyError('Failed to save entry: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [entryType, headId, amount, entryDate, description, bankId, editingId, success, notifyError, resetForm, loadEntries, approval]);

  const editEntry = useCallback((e: any) => {
    setEditingId(e.id);
    setEntryType(e.type ?? 'Expense');
    setHeadId(e.head_id ?? '');
    setAmount(String(e.amount ?? ''));
    setEntryDate(e.date?.split('T')[0] ?? '');
    setDescription(e.description ?? '');
    setBankId(e.bank_id ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const deleteEntry = useCallback(async (e: any) => {
    const ok = await confirm({ title: 'Delete Entry', message: 'Delete this entry?', type: 'danger', confirmText: 'Delete' });
    if (!ok) return;
    try {
      if (approval.requiresApproval()) {
        await approval.submitForApproval({
          module: 'income-expenses',
          actionType: 'delete',
          summary: `Delete ${e.type} entry: ₹${e.amount}`,
          data: e,
          referenceId: e.id,
        });
        success('Submitted for approval');
      } else {
        await apiDelete(`/income-expenses/${e.id}`);
        success('Entry deleted');
      }
      loadEntries();
    } catch (err: any) {
      notifyError('Delete failed: ' + err.message);
    }
  }, [confirm, success, notifyError, loadEntries, approval]);

  const clearFilters = () => { setFilterType(''); setFilterHead(''); setFilterFromDate(''); setFilterToDate(''); };

  const getHeadName = (id: string) => heads.find(h => h.id === id)?.name ?? '--';

  const handleExportExcel = () => exportToExcel(filteredEntries.map(e => ({
    Date: e.date?.split('T')[0], Type: e.type, Head: getHeadName(e.head_id), Amount: e.amount, Description: e.description,
  })), 'income-expenses');

  const handleExportPDF = () => exportToPDF('Income & Expense Report',
    ['Date', 'Type', 'Head', 'Amount', 'Description'],
    filteredEntries.map(e => [e.date?.split('T')[0], e.type, getHeadName(e.head_id), e.amount, e.description ?? ''])
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-exchange-funds-line"></i> Income & Expense Entry</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-export" onClick={handleExportExcel}><i className="ri-file-excel-2-line"></i> Excel</button>
          <button className="btn-export" onClick={handleExportPDF}><i className="ri-file-pdf-2-line"></i> PDF</button>
          <button className="btn-export" onClick={() => printReport('Income & Expense')}><i className="ri-printer-line"></i> Print</button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
          {editingId ? 'Edit Entry' : 'New Entry'}
        </h3>
        <form onSubmit={e => { e.preventDefault(); saveEntry(); }}>
          <div className="form-grid">
            <div className="form-group">
              <label>Type <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select value={entryType} onChange={e => setEntryType(e.target.value)}>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
            <div className="form-group">
              <SearchableDropdown items={headItems} label="Head / Purpose *" placeholder="Search or add head..." value={headId} onChange={setHeadId} allowAdd onAdd={onAddHead} />
            </div>
            <div className="form-group">
              <label>Amount <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" required />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
            </div>
            <div className="form-group">
              <SearchableDropdown items={bankItems} label="Bank" placeholder="Select Bank..." value={bankId} onChange={setBankId} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description..." rows={2} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn-primary" disabled={saving || !amount || !headId}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
              {editingId ? 'Update Entry' : 'Add Entry'}
            </button>
            {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>

      <div className="card-container" style={{ marginTop: 20 }}>
        <div className={styles.filters}>
          <div className="form-group">
            <label>Type</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ minWidth: 120 }}>
              <option value="">All</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 160 }}>
            <SearchableDropdown items={headItems} label="Head" placeholder="All Heads..." value={filterHead} onChange={setFilterHead} />
          </div>
          <div className="form-group">
            <label>From</label>
            <input type="date" value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>To</label>
            <input type="date" value={filterToDate} onChange={e => setFilterToDate(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={clearFilters}><i className="ri-filter-off-line"></i> Clear</button>
        </div>
      </div>

      <div className="table-responsive" style={{ marginTop: 20 }}>
        {loading ? (
          <div className="empty-state"><div className="skeleton" style={{ height: 200 }}></div></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Head</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No entries found.</td></tr>
              ) : filteredEntries.map(e => (
                <tr key={e.id}>
                  <td>{e.date?.split('T')[0] ?? '--'}</td>
                  <td>
                    <span className={`${styles.typeBadge} ${e.type === 'Income' ? styles.income : styles.expense}`}>{e.type}</span>
                  </td>
                  <td>{getHeadName(e.head_id)}</td>
                  <td style={{ fontWeight: 700, color: e.type === 'Income' ? 'var(--success)' : 'var(--danger)' }}>
                    ₹{(e.amount ?? 0).toLocaleString('en-IN')}
                  </td>
                  <td>{e.description ?? '--'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => editEntry(e)} title="Edit"><i className="ri-pencil-line"></i></button>
                      <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteEntry(e)} title="Delete"><i className="ri-delete-bin-line"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
