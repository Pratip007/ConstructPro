'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel, exportToPDF, printReport } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import styles from './SupervisorLedgerPage.module.scss';

interface Supervisor {
  id: number;
  name: string;
  contact?: string;
  fund_balance?: number;
}

interface LedgerEntry {
  id: number;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  site_name?: string;
  reference?: string;
}

export default function SupervisorLedgerPage() {
  const { error: notifyError } = useNotification();

  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const supervisorItems = useMemo(
    () => supervisors.map(s => ({ value: s.id, label: s.name })),
    [supervisors]
  );

  const selectedSupervisor = useMemo(
    () => supervisors.find(s => s.id === selectedSupervisorId) ?? null,
    [supervisors, selectedSupervisorId]
  );

  const filteredLedger = useMemo(() => {
    let entries = ledger;
    if (dateFrom) entries = entries.filter(e => e.date >= dateFrom);
    if (dateTo) entries = entries.filter(e => e.date <= dateTo);
    const q = searchQuery.toLowerCase();
    if (q) {
      entries = entries.filter(e =>
        e.description.toLowerCase().includes(q) ||
        (e.reference || '').toLowerCase().includes(q) ||
        (e.site_name || '').toLowerCase().includes(q)
      );
    }
    return entries;
  }, [ledger, dateFrom, dateTo, searchQuery]);

  const ledgerWithBalance = useMemo(() => {
    let balance = 0;
    return filteredLedger.map(e => {
      balance += (e.debit ?? 0) - (e.credit ?? 0);
      return { ...e, runningBalance: balance };
    });
  }, [filteredLedger]);

  const totalDebit = useMemo(() => filteredLedger.reduce((s, e) => s + (e.debit ?? 0), 0), [filteredLedger]);
  const totalCredit = useMemo(() => filteredLedger.reduce((s, e) => s + (e.credit ?? 0), 0), [filteredLedger]);
  const netBalance = useMemo(() => Math.round((totalDebit - totalCredit) * 100) / 100, [totalDebit, totalCredit]);

  const summaryCards = useMemo(() => [
    { title: 'Total Fund Given', value: totalDebit, prefix: '₹', icon: 'ri-hand-coin-line', color: 'info' as const },
    { title: 'Total Expense', value: totalCredit, prefix: '₹', icon: 'ri-money-dollar-circle-line', color: 'success' as const },
    { title: 'Balance', value: netBalance, prefix: '₹', icon: 'ri-funds-line', color: netBalance > 0 ? 'warning' as const : 'success' as const },
  ], [totalDebit, totalCredit, netBalance]);

  const loadSupervisors = useCallback(async () => {
    setLoadingSupervisors(true);
    try {
      const data = await apiGet<Supervisor[]>('/supervisors');
      setSupervisors(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load supervisors: ' + err.message);
    } finally {
      setLoadingSupervisors(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadSupervisors();
  }, [loadSupervisors]);

  const onSupervisorChange = async (id: number | null) => {
    setSelectedSupervisorId(id);
    if (!id) {
      setLedger([]);
      return;
    }
    setLoadingLedger(true);
    try {
      const data = await apiGet<LedgerEntry[]>(`/ledger/supervisor/${id}`);
      setLedger(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load ledger: ' + err.message);
    } finally {
      setLoadingLedger(false);
    }
  };

  const formatCurrency = (val: number) => {
    if (val == null || val === 0) return '';
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleExportExcel = () => {
    const name = selectedSupervisor?.name ?? 'supervisor';
    exportToExcel(ledgerWithBalance as any, `${name}_ledger`, `Ledger - ${name}`, [
      { key: 'date', header: 'Date' },
      { key: 'site_name', header: 'Site' },
      { key: 'reference', header: 'Reference' },
      { key: 'description', header: 'Particulars' },
      { key: 'debit', header: 'Fund Given' },
      { key: 'credit', header: 'Expense' },
      { key: 'runningBalance', header: 'Balance' },
    ]);
  };

  const handleExportPdf = () => {
    const name = selectedSupervisor?.name ?? 'Supervisor';
    exportToPDF({
      title: `Supervisor Ledger - ${name}`,
      fileName: `${name}_ledger`,
      data: ledgerWithBalance as any,
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'site_name', header: 'Site' },
        { key: 'description', header: 'Particulars' },
        { key: 'debit', header: 'Fund', format: 'currency', align: 'right' },
        { key: 'credit', header: 'Expense', format: 'currency', align: 'right' },
        { key: 'runningBalance', header: 'Balance', format: 'currency', align: 'right' },
      ],
      summaryRow: {
        date: '', site_name: '', description: 'TOTAL',
        debit: totalDebit, credit: totalCredit, runningBalance: netBalance,
      },
      dateRange: dateFrom || dateTo ? { from: dateFrom, to: dateTo } : undefined,
    });
  };

  const handlePrint = () => {
    const name = selectedSupervisor?.name ?? 'Supervisor';
    printReport('supervisorLedgerTable', `Ledger - ${name}`);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Supervisor Ledger</h1>
      </div>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={supervisorItems}
              label="Select Supervisor"
              value={selectedSupervisorId}
              onChange={val => onSupervisorChange(val as number | null)}
              placeholder="Search supervisor..."
            />
          </div>
          <div className="form-group">
            <label>From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
        {(dateFrom || dateTo) && (
          <button className="btn-secondary" onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ marginTop: 8 }}>
            <i className="ri-close-line"></i> Clear Date Filter
          </button>
        )}
      </div>

      {(loadingSupervisors || loadingLedger) && (
        <div className="skeleton" style={{ height: 200, marginTop: 16 }} />
      )}

      {selectedSupervisorId && (
        <>
          <div style={{ marginTop: 16 }}>
            <SummaryCards cards={summaryCards} />
          </div>

          <div className="card-container" style={{ marginTop: 16 }}>
            <div className={styles.toolbarRow}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search ledger entries..."
                className={styles.searchInput}
              />
              <div className={styles.exportButtons}>
                <button className="btn-secondary" onClick={handleExportExcel}>
                  <i className="ri-file-excel-2-line"></i> Excel
                </button>
                <button className="btn-secondary" onClick={handleExportPdf}>
                  <i className="ri-file-pdf-line"></i> PDF
                </button>
                <button className="btn-secondary" onClick={handlePrint}>
                  <i className="ri-printer-line"></i> Print
                </button>
              </div>
            </div>
          </div>

          <div className="table-responsive" style={{ marginTop: 8 }}>
            <table id="supervisorLedgerTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Site</th>
                  <th>Reference</th>
                  <th>Particulars</th>
                  <th className={styles.textRight}>Fund Given</th>
                  <th className={styles.textRight}>Expense</th>
                  <th className={styles.textRight}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledgerWithBalance.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-state">No ledger entries found.</td>
                  </tr>
                ) : (
                  ledgerWithBalance.map((entry, i) => (
                    <tr key={entry.id}>
                      <td>{i + 1}</td>
                      <td>{entry.date}</td>
                      <td>
                        {entry.site_name && <span className="badge badge-info">{entry.site_name}</span>}
                      </td>
                      <td>
                        {entry.reference && <span className={styles.refLabel}>{entry.reference}</span>}
                      </td>
                      <td>{entry.description}</td>
                      <td className={styles.textRight}>{formatCurrency(entry.debit)}</td>
                      <td className={`${styles.textRight} ${styles.textSuccess}`}>{formatCurrency(entry.credit)}</td>
                      <td className={`${styles.textRight} ${entry.runningBalance > 0 ? styles.textWarning : styles.textSuccess}`}>
                        {formatCurrency(Math.abs(entry.runningBalance))}
                        {entry.runningBalance !== 0 && (entry.runningBalance > 0 ? ' Dr' : ' Cr')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {ledgerWithBalance.length > 0 && (
                <tfoot>
                  <tr className={styles.totalsRow}>
                    <td colSpan={5}><strong>Total</strong></td>
                    <td className={styles.textRight}><strong>{formatCurrency(totalDebit)}</strong></td>
                    <td className={`${styles.textRight} ${styles.textSuccess}`}><strong>{formatCurrency(totalCredit)}</strong></td>
                    <td className={`${styles.textRight} ${netBalance > 0 ? styles.textWarning : styles.textSuccess}`}>
                      <strong>{formatCurrency(Math.abs(netBalance))} {netBalance > 0 ? 'Dr' : netBalance < 0 ? 'Cr' : ''}</strong>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
