'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import { exportToExcel, exportToPDF, printReport } from '@/lib/export-utils';
import styles from './RetailLedgerPage.module.scss';

export default function RetailLedgerPage() {
  const { error: showError } = useNotification();

  const [retailers, setRetailers] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedRetailerId, setSelectedRetailerId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const retailerItems = useMemo(() => retailers.map(r => ({ value: r.id, label: r.name })), [retailers]);
  const siteItems = useMemo(() =>
    [{ value: '', label: 'All Sites (Consolidated)' }, ...sites.map(s => ({ value: s.id, label: s.name }))], [sites]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return ledgerEntries;
    return ledgerEntries.filter(e =>
      (e.description ?? e.particulars ?? '').toLowerCase().includes(q) ||
      (e.type ?? '').toLowerCase().includes(q) ||
      (e.ref_no ?? '').toLowerCase().includes(q)
    );
  }, [ledgerEntries, searchQuery]);

  const entriesWithBalance = useMemo(() => {
    let running = 0;
    return filtered.map(e => {
      running += (e.debit ?? 0) - (e.credit ?? 0);
      return { ...e, running_balance: running };
    });
  }, [filtered]);

  const totalDebit = useMemo(() => filtered.reduce((s, e) => s + (e.debit ?? 0), 0), [filtered]);
  const totalCredit = useMemo(() => filtered.reduce((s, e) => s + (e.credit ?? 0), 0), [filtered]);
  const balanceDue = totalDebit - totalCredit;

  const summaryCards = useMemo(() => [
    { title: 'Total Billed (Dr)', value: totalDebit, color: 'danger' as const, prefix: '₹', icon: 'ri-arrow-up-circle-line' },
    { title: 'Total Paid (Cr)', value: totalCredit, color: 'success' as const, prefix: '₹', icon: 'ri-arrow-down-circle-line' },
    { title: 'Closing Due Balance', value: balanceDue, color: (balanceDue > 0 ? 'warning' : 'success') as any, prefix: '₹', icon: 'ri-scales-3-line' },
  ], [totalDebit, totalCredit, balanceDue]);

  useEffect(() => {
    apiGet<any[]>('/retailers').then(d => setRetailers(d)).catch(() => showError('Failed to load retailers'));
    apiGet<any[]>('/sites').then(d => setSites(d)).catch(() => {});
  }, [showError]);

  const generateLedger = useCallback(async () => {
    if (!selectedRetailerId) { setLedgerEntries([]); return; }
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      if (selectedSiteId) params.site_id = selectedSiteId;
      const data = await apiGet<any[]>(`/ledger/retailer/${selectedRetailerId}`, params);
      setLedgerEntries(data);
    } catch { showError('Failed to load retailer ledger'); }
    setLoading(false);
  }, [selectedRetailerId, dateFrom, dateTo, selectedSiteId, showError]);

  const retailerName = useMemo(() => retailers.find(r => r.id === selectedRetailerId)?.name ?? 'Retailer', [retailers, selectedRetailerId]);

  const exportLedger = () => {
    exportToExcel(entriesWithBalance as any[], `Ledger_${retailerName}`, 'Retail Ledger', [
      { key: 'date', header: 'Date' }, { key: 'type', header: 'Type' },
      { key: 'particulars', header: 'Particulars' }, { key: 'ref_no', header: 'Ref / Bill No' },
      { key: 'debit', header: 'Debit' }, { key: 'credit', header: 'Credit' },
      { key: 'running_balance', header: 'Balance' },
    ]);
  };

  const exportPdf = () => {
    exportToPDF({
      title: `Retail Ledger - ${retailerName}`, fileName: `Ledger_${retailerName}`,
      columns: [
        { key: 'date', header: 'Date' }, { key: 'particulars', header: 'Particulars' },
        { key: 'ref_no', header: 'Ref No' }, { key: 'debit', header: 'Debit' },
        { key: 'credit', header: 'Credit' }, { key: 'running_balance', header: 'Balance' },
      ],
      data: entriesWithBalance as any[],
      summaryRow: { particulars: 'TOTAL', debit: totalDebit, credit: totalCredit, running_balance: balanceDue },
      dualCopy: { partyLabel: 'Retailer Copy' },
    });
  };

  const handlePrint = () => printReport('ledger-table', 'Retail Ledger');

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Retail Ledger</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-export" onClick={exportLedger}><i className="ri-file-excel-2-line" /> Excel</button>
          <button className="btn-primary" onClick={exportPdf}><i className="ri-file-pdf-line" /> PDF</button>
          <button className="btn-secondary" onClick={handlePrint}><i className="ri-printer-line" /> Print</button>
        </div>
      </div>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <label>Select Retailer *</label>
            <SearchableDropdown items={retailerItems} value={selectedRetailerId} onChange={setSelectedRetailerId} placeholder="Search retailer..." />
          </div>
          <div className="form-group">
            <label>Site / Project</label>
            <SearchableDropdown items={siteItems} value={selectedSiteId} onChange={setSelectedSiteId} placeholder="All Sites" />
          </div>
          <div className="form-group">
            <label>Date From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Date To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Search</label>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search entries..." />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn-primary" onClick={generateLedger} style={{ width: '100%' }}>Generate Ledger</button>
          </div>
        </div>
      </div>

      {entriesWithBalance.length > 0 && <div style={{ marginTop: 20 }}><SummaryCards cards={summaryCards} /></div>}

      {loading && <div className="skeleton" style={{ height: 300, marginTop: 20 }} />}

      <div className="card-container" style={{ marginTop: 20, padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table id="ledger-table">
            <thead>
              <tr>
                <th>Date</th><th>Particulars</th><th>Ref / Bill No</th>
                <th>Debit</th><th>Credit</th><th>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {entriesWithBalance.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">Select a retailer and generate ledger.</td></tr>
              ) : entriesWithBalance.map((e, i) => (
                <tr key={i}>
                  <td>{e.date}</td>
                  <td>
                    {e.type && (
                      <span className={`badge ${e.type === 'bill' ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: 10, marginRight: 6 }}>{e.type}</span>
                    )}
                    {e.description ?? e.particulars}
                  </td>
                  <td style={{ color: 'var(--accent)' }}>{e.ref_no ?? '-'}</td>
                  <td style={{ color: 'var(--danger)', fontWeight: 700 }}>{e.debit > 0 ? `₹${e.debit.toLocaleString('en-IN')}` : '-'}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 700 }}>{e.credit > 0 ? `₹${e.credit.toLocaleString('en-IN')}` : '-'}</td>
                  <td style={{ fontWeight: 700, color: e.running_balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    ₹{e.running_balance.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
            {entriesWithBalance.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700, background: 'var(--glass-bg)' }}>
                  <td colSpan={3} style={{ textAlign: 'right' }}>TOTAL:</td>
                  <td style={{ color: 'var(--danger)' }}>₹{totalDebit.toLocaleString('en-IN')}</td>
                  <td style={{ color: 'var(--success)' }}>₹{totalCredit.toLocaleString('en-IN')}</td>
                  <td style={{ color: balanceDue > 0 ? 'var(--danger)' : 'var(--success)' }}>₹{balanceDue.toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
