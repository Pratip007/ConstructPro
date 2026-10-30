'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel, exportToPDF, exportToCSV, printReport } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import styles from './CompanyLedgerPage.module.scss';

export default function CompanyLedgerPage() {
  const { error: notifyError } = useNotification();

  const [companies, setCompanies] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);

  const loadMasters = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        apiGet<any[]>('/companies'),
        apiGet<any[]>('/sites'),
      ]);
      setCompanies(c);
      setSites(s);
    } catch (err: any) {
      notifyError('Failed to load data: ' + err.message);
    }
  }, [notifyError]);

  useEffect(() => { loadMasters(); }, [loadMasters]);

  const loadLedger = useCallback(async () => {
    if (!selectedCompanyId) { setLedgerEntries([]); return; }
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedSiteId) params.site_id = selectedSiteId;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const endpoint = selectedCompanyId === '__ALL__'
        ? '/ledger/company'
        : `/ledger/company/${selectedCompanyId}`;
      const data = await apiGet<any[]>(endpoint, params);
      setLedgerEntries(data);
    } catch (err: any) {
      notifyError('Failed to load ledger: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, selectedSiteId, fromDate, toDate, notifyError]);

  useEffect(() => { loadLedger(); }, [loadLedger]);

  const companyItems = useMemo(() => [
    { value: '__ALL__', label: '-- All Companies --' },
    ...companies.map(c => ({ value: c.id, label: c.name })),
  ], [companies]);
  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);

  const ledgerWithBalance = useMemo(() => {
    let runningBalance = 0;
    return ledgerEntries.map(entry => {
      const debit = entry.debit ?? 0;
      const credit = entry.credit ?? 0;
      runningBalance += debit - credit;
      return { ...entry, balance: runningBalance };
    });
  }, [ledgerEntries]);

  const summaryCards = useMemo(() => {
    const totalDebit = ledgerEntries.reduce((s, e) => s + (e.debit ?? 0), 0);
    const totalCredit = ledgerEntries.reduce((s, e) => s + (e.credit ?? 0), 0);
    const closing = totalDebit - totalCredit;
    return [
      { title: 'Total Billed', value: `₹${totalDebit.toLocaleString('en-IN')}`, icon: 'ri-file-list-3-line', color: 'primary' as const },
      { title: 'Bank Received', value: `₹${totalCredit.toLocaleString('en-IN')}`, icon: 'ri-bank-line', color: 'success' as const },
      { title: 'TDS Deducted', value: `₹${ledgerEntries.filter(e => e.type === 'tds').reduce((s, e) => s + (e.credit ?? 0), 0).toLocaleString('en-IN')}`, icon: 'ri-percent-line', color: 'warning' as const },
      { title: 'Closing Balance', value: `₹${Math.abs(closing).toLocaleString('en-IN')} ${closing >= 0 ? 'Dr' : 'Cr'}`, icon: 'ri-scales-3-line', color: closing >= 0 ? 'danger' as const : 'success' as const },
    ];
  }, [ledgerEntries]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'invoice': return <div className={`${styles.typeIcon} ${styles.typeInvoice}`}><i className="ri-file-text-line"></i></div>;
      case 'payment': return <div className={`${styles.typeIcon} ${styles.typePayment}`}><i className="ri-money-rupee-circle-line"></i></div>;
      case 'tds': return <div className={`${styles.typeIcon} ${styles.typeTds}`}><i className="ri-percent-line"></i></div>;
      default: return <div className={styles.typeIcon}><i className="ri-question-line"></i></div>;
    }
  };

  const exportData = ledgerWithBalance.map(e => ({
    Date: e.date?.split('T')[0],
    Particulars: e.particulars,
    Type: e.type,
    Debit: e.debit ?? 0,
    Credit: e.credit ?? 0,
    Balance: e.balance,
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-book-2-line"></i> Company Ledger</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-export" onClick={() => exportToExcel(exportData, 'company-ledger')}><i className="ri-file-excel-2-line"></i> Excel</button>
          <button className="btn-export" onClick={() => exportToPDF('Company Ledger', ['Date', 'Particulars', 'Type', 'Debit', 'Credit', 'Balance'], exportData.map(e => [e.Date, e.Particulars, e.Type, e.Debit, e.Credit, e.Balance]))}><i className="ri-file-pdf-2-line"></i> PDF</button>
          <button className="btn-export" onClick={() => exportToCSV(exportData, 'company-ledger')}><i className="ri-file-text-line"></i> CSV</button>
          <button className="btn-export" onClick={() => printReport('Company Ledger')}><i className="ri-printer-line"></i> Print</button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 20 }}>
        <div className={styles.filters}>
          <div className="form-group" style={{ minWidth: 200 }}>
            <SearchableDropdown items={companyItems} label="Company" placeholder="Select Company..." value={selectedCompanyId} onChange={setSelectedCompanyId} />
          </div>
          <div className="form-group" style={{ minWidth: 180 }}>
            <SearchableDropdown items={siteItems} label="Site" placeholder="All Sites..." value={selectedSiteId} onChange={setSelectedSiteId} />
          </div>
          <div className="form-group">
            <label>From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={() => { setFromDate(''); setToDate(''); setSelectedSiteId(''); }}>
            <i className="ri-filter-off-line"></i> Clear
          </button>
        </div>
      </div>

      <div className="table-responsive" style={{ marginTop: 20 }}>
        {loading ? (
          <div className="empty-state"><div className="skeleton" style={{ height: 200 }}></div></div>
        ) : !selectedCompanyId ? (
          <div className="empty-state">Select a company to view ledger.</div>
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
              <tr className={styles.openingRow}>
                <td colSpan={3}>Opening Balance</td>
                <td style={{ textAlign: 'right' }}>--</td>
                <td style={{ textAlign: 'right' }}>--</td>
                <td style={{ textAlign: 'right' }}>₹0.00</td>
              </tr>
              {ledgerWithBalance.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No ledger entries found.</td></tr>
              ) : ledgerWithBalance.map((e, i) => (
                <tr key={i}>
                  <td>{e.date?.split('T')[0] ?? '--'}</td>
                  <td>{getTypeIcon(e.type)}</td>
                  <td>
                    {e.particulars}
                    {e.company_name && <span className="badge badge-info" style={{ marginLeft: 6, fontSize: 10 }}>{e.company_name}</span>}
                    {e.site_name && <span className="badge badge-secondary" style={{ marginLeft: 4, fontSize: 10 }}>{e.site_name}</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{e.debit ? `₹${e.debit.toLocaleString('en-IN')}` : '--'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{e.credit ? `₹${e.credit.toLocaleString('en-IN')}` : '--'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={`${styles.drCr} ${e.balance >= 0 ? styles.dr : styles.cr}`}>
                      ₹{Math.abs(e.balance).toLocaleString('en-IN')} {e.balance >= 0 ? 'Dr' : 'Cr'}
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
