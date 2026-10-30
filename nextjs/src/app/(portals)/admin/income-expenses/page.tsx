'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import DataTable, { type TableColumn, type TableAction } from '@/components/DataTable';

interface Entry {
  id: string;
  date: string;
  type: string;
  bank_account: string;
  purpose: string;
  particulars: string;
  remark: string;
  amount: number;
  bank_id?: string;
  display_id?: string;
}

interface Head { id: string; name: string; }
interface Bank { id: string; bank_name: string; account_number: string; }

export default function IncomeExpensesPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [heads, setHeads] = useState<Head[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryType, setEntryType] = useState('Expense');
  const [bankId, setBankId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [particulars, setParticulars] = useState('');
  const [remark, setRemark] = useState('');
  const [amount, setAmount] = useState('');

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterPurpose, setFilterPurpose] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [filterBank, setFilterBank] = useState('');

  const loadMasters = useCallback(async () => {
    try {
      const [h, b] = await Promise.all([
        apiGet<Head[]>('/settings/heads'),
        apiGet<Bank[]>('/banks'),
      ]);
      setHeads(Array.isArray(h) ? h : []);
      setBanks(Array.isArray(b) ? b : []);
    } catch (err: any) {
      notifyError('Failed to load masters: ' + err.message);
    }
  }, [notifyError]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Entry[]>('/income-expenses');
      setEntries(Array.isArray(data) ? data : []);
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
    if (filterPurpose) result = result.filter(e => e.purpose === filterPurpose);
    if (filterBank) result = result.filter(e => e.bank_id === filterBank);
    if (filterFromDate) result = result.filter(e => (e.date ?? '').split('T')[0] >= filterFromDate);
    if (filterToDate) result = result.filter(e => (e.date ?? '').split('T')[0] <= filterToDate);
    return result;
  }, [entries, filterType, filterPurpose, filterBank, filterFromDate, filterToDate]);

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
    setEntryDate(new Date().toISOString().split('T')[0]);
    setEntryType('Expense');
    setBankId('');
    setPurpose('');
    setParticulars('');
    setRemark('');
    setAmount('');
  }, []);

  const getBankLabel = (id?: string) => {
    if (!id) return '--';
    const b = banks.find(bk => bk.id === id);
    return b ? `${b.bank_name} - ${b.account_number}` : '--';
  };

  const saveEntry = useCallback(async () => {
    if (!amount || !purpose) return;
    setSaving(true);
    const body = {
      date: entryDate,
      type: entryType,
      bank_id: bankId || null,
      purpose,
      particulars,
      remark,
      amount: parseFloat(amount),
    };
    try {
      if (editingId) {
        await apiPut(`/income-expenses/${editingId}`, body);
        success('Entry updated');
      } else {
        await apiPost('/income-expenses', body);
        success('Entry added');
      }
      resetForm();
      loadEntries();
    } catch (err: any) {
      notifyError('Failed to save entry: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [entryDate, entryType, bankId, purpose, particulars, remark, amount, editingId, success, notifyError, resetForm, loadEntries]);

  const editEntry = useCallback((e: any) => {
    setEditingId(e.id);
    setEntryDate(e.date?.split('T')[0] ?? '');
    setEntryType(e.type ?? 'Expense');
    setBankId(e.bank_id ?? '');
    setPurpose(e.purpose ?? '');
    setParticulars(e.particulars ?? '');
    setRemark(e.remark ?? '');
    setAmount(String(e.amount ?? ''));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const deleteEntry = useCallback(async (e: any) => {
    const ok = await confirm({ title: 'Delete Entry', message: 'Delete this entry permanently?', type: 'danger', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await apiDelete(`/income-expenses/${e.id}`);
      success('Entry deleted');
      loadEntries();
    } catch (err: any) {
      notifyError('Delete failed: ' + err.message);
    }
  }, [confirm, success, notifyError, loadEntries]);

  const clearFilters = () => {
    setFilterType('');
    setFilterPurpose('');
    setFilterFromDate('');
    setFilterToDate('');
    setFilterBank('');
  };

  const tableData = useMemo(() => filteredEntries.map(e => ({
    ...e,
    dateFormatted: e.date?.split('T')[0] ?? '--',
    bankLabel: getBankLabel(e.bank_id),
    amountDisplay: e.amount ?? 0,
  })), [filteredEntries, banks]);

  const columns: TableColumn[] = [
    { key: 'dateFormatted', label: 'Date', sortable: true },
    { key: 'type', label: 'Type', type: 'badge', badgeMap: { Income: 'success', Expense: 'danger' } },
    { key: 'bankLabel', label: 'Bank Account' },
    { key: 'purpose', label: 'Purpose', sortable: true },
    { key: 'particulars', label: 'Particulars' },
    { key: 'remark', label: 'Remark' },
    { key: 'amountDisplay', label: 'Amount', type: 'currency', sortable: true },
  ];

  const actions: TableAction[] = [
    { label: '', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary' },
    { label: '', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger' },
  ];

  const handleAction = (event: { action: string; row: any }) => {
    if (event.action === 'edit') editEntry(event.row);
    if (event.action === 'delete') deleteEntry(event.row);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-exchange-funds-line"></i> Income &amp; Expenses</h1>
      </div>

      <SummaryCards cards={summaryCards} />

      {/* Add/Edit Form */}
      <div className="card-container" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
          {editingId ? 'Edit Entry' : 'New Entry'}
        </h3>
        <form onSubmit={e => { e.preventDefault(); saveEntry(); }}>
          <div className="form-grid">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Type <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select value={entryType} onChange={e => setEntryType(e.target.value)}>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
            <div className="form-group">
              <SearchableDropdown items={bankItems} label="Bank Account" placeholder="Select Bank..." value={bankId} onChange={setBankId} />
            </div>
            <div className="form-group">
              <label>Purpose <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Purpose" required />
            </div>
            <div className="form-group">
              <label>Particulars</label>
              <input type="text" value={particulars} onChange={e => setParticulars(e.target.value)} placeholder="Particulars" />
            </div>
            <div className="form-group">
              <label>Amount <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" required />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Remark</label>
              <textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder="Remark..." rows={2} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn-primary" disabled={saving || !amount || !purpose}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
              {editingId ? ' Update Entry' : ' Add Entry'}
            </button>
            {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>

      {/* Filters */}
      <div className="card-container" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Type</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ minWidth: 120 }}>
              <option value="">All</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
            <label>Purpose</label>
            <input type="text" value={filterPurpose} onChange={e => setFilterPurpose(e.target.value)} placeholder="Filter by purpose" />
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
            <SearchableDropdown items={bankItems} label="Bank" placeholder="All Banks..." value={filterBank} onChange={setFilterBank} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>From</label>
            <input type="date" value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>To</label>
            <input type="date" value={filterToDate} onChange={e => setFilterToDate(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={clearFilters} style={{ marginBottom: 0 }}>
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
          fileName="income-expenses"
          actions={actions}
          onActionClick={handleAction}
          showFooterTotals
          emptyMessage="No income/expense entries found."
        />
      </div>
    </div>
  );
}
