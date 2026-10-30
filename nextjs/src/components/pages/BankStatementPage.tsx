'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel, exportToPDF, printReport } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import styles from './BankStatementPage.module.scss';

export default function BankStatementPage() {
  const { error: notifyError } = useNotification();

  const [banks, setBanks] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);

  const [selectedBankId, setSelectedBankId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const loadBanks = useCallback(async () => {
    try {
      const data = await apiGet<any[]>('/banks');
      setBanks(data);
    } catch (err: any) {
      notifyError('Failed to load banks: ' + err.message);
    }
  }, [notifyError]);

  useEffect(() => { loadBanks(); }, [loadBanks]);

  const loadStatement = useCallback(async () => {
    if (!selectedBankId) { setEntries([]); return; }
    setLoading(true);
    try {
      const params: Record<string, string> = { bank_account: selectedBankId };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const data = await apiGet<any[]>('/income-expenses', params);
      setEntries(data);
    } catch (err: any) {
      notifyError('Failed to load statement: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedBankId, fromDate, toDate, notifyError]);

  useEffect(() => { loadStatement(); }, [loadStatement]);

  const bankItems = useMemo(() => banks.map(b => ({ value: b.id, label: `${b.bank_name} - ${b.account_number}` })), [banks]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return entries;
    return entries.filter(e =>
      (e.description ?? '').toLowerCase().includes(q) ||
      (e.remarks ?? '').toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  const statementWithBalance = useMemo(() => {
    let runningBalance = 0;
    return filteredEntries.map(entry => {
      const debit = entry.type === 'Expense' ? (entry.amount ?? 0) : 0;
      const credit = entry.type === 'Income' ? (entry.amount ?? 0) : 0;
      runningBalance += credit - debit;
      return { ...entry, debit, credit, balance: runningBalance };
    });
  }, [filteredEntries]);

  const summaryCards = useMemo(() => {
    const totalDebit = statementWithBalance.reduce((s, e) => s + e.debit, 0);
    const totalCredit = statementWithBalance.reduce((s, e) => s + e.credit, 0);
    const closing = totalCredit - totalDebit;
    return [
      { title: 'Total Debit', value: `₹${totalDebit.toLocaleString('en-IN')}`, icon: 'ri-arrow-down-circle-line', color: 'danger' as const },
      { title: 'Total Credit', value: `₹${totalCredit.toLocaleString('en-IN')}`, icon: 'ri-arrow-up-circle-line', color: 'success' as const },
      { title: 'Closing Balance', value: `₹${Math.abs(closing).toLocaleString('en-IN')} ${closing >= 0 ? 'Cr' : 'Dr'}`, icon: 'ri-scales-3-line', color: closing >= 0 ? 'success' as const : 'danger' as const },
      { title: 'Transactions', value: statementWithBalance.length, icon: 'ri-exchange-line', color: 'info' as const },
    ];
  }, [statementWithBalance]);

  const exportData = statementWithBalance.map(e => ({
    Date: e.date?.split('T')[0],
    Particulars: e.description,
    Debit: e.debit,
    Credit: e.credit,
    Balance: e.balance,
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-bank-line"></i> Bank Statement</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-export" onClick={() => exportToExcel(exportData, 'bank-statement')} disabled={!statementWithBalance.length}>
            <i className="ri-file-excel-2-line"></i> Excel
          </button>
          <button className="btn-export" onClick={() => exportToPDF('Bank Statement', ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'], exportData.map(e => [e.Date, e.Particulars, e.Debit, e.Credit, e.Balance]))} disabled={!statementWithBalance.length}>
            <i className="ri-file-pdf-2-line"></i> PDF
          </button>
          <button className="btn-export" onClick={() => printReport('Bank Statement')} disabled={!statementWithBalance.length}>
            <i className="ri-printer-line"></i> Print
          </button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 20 }}>
        <div className={styles.filters}>
          <div className="form-group" style={{ minWidth: 250 }}>
            <SearchableDropdown items={bankItems} label="Bank Account *" placeholder="Select Bank..." value={selectedBankId} onChange={setSelectedBankId} />
          </div>
          <div className="form-group">
            <label>From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label>Search</label>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by particulars or remark..." />
          </div>
          <button className="btn-secondary" onClick={() => { setFromDate(''); setToDate(''); setSearchQuery(''); }}>
            <i className="ri-filter-off-line"></i> Clear
          </button>
        </div>
      </div>

      <div className="table-responsive" style={{ marginTop: 20 }}>
        {loading ? (
          <div className="empty-state"><div className="skeleton" style={{ height: 200 }}></div></div>
        ) : !selectedBankId ? (
          <div className="empty-state">Select a bank account to view statement.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Particulars</th>
                <th style={{ textAlign: 'right' }}>Debit (₹)</th>
                <th style={{ textAlign: 'right' }}>Credit (₹)</th>
                <th style={{ textAlign: 'right' }}>Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              {statementWithBalance.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No transactions found.</td></tr>
              ) : statementWithBalance.map((e, i) => (
                <tr key={i}>
                  <td>{e.date?.split('T')[0] ?? '--'}</td>
                  <td>
                    <div className={`${styles.typeIcon} ${e.type === 'Income' ? styles.typeIncome : styles.typeExpense}`}>
                      <i className={e.type === 'Income' ? 'ri-arrow-up-line' : 'ri-arrow-down-line'}></i>
                    </div>
                  </td>
                  <td>{e.description ?? '--'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{e.debit ? `₹${e.debit.toLocaleString('en-IN')}` : '--'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{e.credit ? `₹${e.credit.toLocaleString('en-IN')}` : '--'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={`${styles.drCr} ${e.balance >= 0 ? styles.cr : styles.dr}`}>
                      ₹{Math.abs(e.balance).toLocaleString('en-IN')} {e.balance >= 0 ? 'Cr' : 'Dr'}
                    </span>
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
