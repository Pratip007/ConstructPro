'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel, exportToPDF, printReport } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import styles from './ContractorLedgerPage.module.scss';

interface Contractor {
  id: number;
  name: string;
  category: string;
  tds_applicable?: boolean;
  tds_percent?: number;
}

interface Site { id: number; name: string; }

interface LedgerEntry {
  id: number;
  date: string;
  site_name?: string;
  invoice_ref?: string;
  description: string;
  gross_amount: number;
  tds_amount: number;
  net_payable: number;
  debit: number;
  credit: number;
  balance: number;
}

export default function ContractorLedgerPage() {
  const { error: notifyError } = useNotification();

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedContractorId, setSelectedContractorId] = useState<number | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loadingContractors, setLoadingContractors] = useState(false);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const contractorItems = useMemo(() =>
    contractors.map(c => ({ value: c.id, label: c.name })), [contractors]
  );

  const siteItems = useMemo(() => [
    { value: 0, label: 'All Sites (Consolidated)' },
    ...sites.map(s => ({ value: s.id, label: s.name }))
  ], [sites]);

  const selectedContractor = useMemo(() => {
    if (!selectedContractorId) return null;
    return contractors.find(c => c.id === selectedContractorId) ?? null;
  }, [contractors, selectedContractorId]);

  const filteredLedger = useMemo(() => {
    let entries = ledger;
    if (dateFrom) entries = entries.filter(e => e.date >= dateFrom);
    if (dateTo) entries = entries.filter(e => e.date <= dateTo);
    if (selectedSiteId && selectedSiteId > 0) {
      const siteName = sites.find(s => s.id === selectedSiteId)?.name?.toLowerCase() || '';
      entries = entries.filter(e => e.site_name?.toLowerCase().includes(siteName));
    }
    const q = searchQuery.toLowerCase();
    if (q) entries = entries.filter(e =>
      e.description.toLowerCase().includes(q) ||
      (e.invoice_ref || '').toLowerCase().includes(q) ||
      (e.site_name || '').toLowerCase().includes(q)
    );
    return entries;
  }, [ledger, dateFrom, dateTo, selectedSiteId, searchQuery, sites]);

  const totalGross = useMemo(() =>
    filteredLedger.reduce((s, e) => s + (e.gross_amount || e.debit || 0), 0), [filteredLedger]
  );

  const totalTds = useMemo(() => {
    const entryTds = filteredLedger.reduce((s, e) => s + (e.tds_amount || 0), 0);
    if (entryTds > 0) return entryTds;
    const c = selectedContractor;
    if (c?.tds_applicable && c.tds_percent) {
      return Math.round(totalGross * c.tds_percent / 100 * 100) / 100;
    }
    return 0;
  }, [filteredLedger, selectedContractor, totalGross]);

  const netBilled = useMemo(() =>
    Math.round((totalGross - totalTds) * 100) / 100, [totalGross, totalTds]
  );

  const totalPayments = useMemo(() =>
    filteredLedger.reduce((s, e) => s + (e.credit || 0), 0), [filteredLedger]
  );

  const outstandingDue = useMemo(() =>
    Math.round((netBilled - totalPayments) * 100) / 100, [netBilled, totalPayments]
  );

  const summaryCards = useMemo(() => [
    { title: 'Total Billed (Net)', value: netBilled, prefix: '₹', icon: 'ri-bill-line', color: 'info' as const },
    { title: 'Total Payments Cleared', value: totalPayments, prefix: '₹', icon: 'ri-money-dollar-circle-line', color: 'success' as const },
    { title: 'Outstanding Due Balance', value: outstandingDue, prefix: '₹', icon: 'ri-funds-line', color: (outstandingDue > 0 ? 'danger' : 'success') as any },
  ], [netBilled, totalPayments, outstandingDue]);

  useEffect(() => {
    const loadContractors = async () => {
      setLoadingContractors(true);
      try {
        const data = await apiGet<Contractor[]>('/contractors');
        setContractors(data);
      } catch (err: any) {
        notifyError('Failed to load contractors: ' + err.message);
      } finally {
        setLoadingContractors(false);
      }
    };
    loadContractors();
    apiGet<Site[]>('/sites').then(setSites).catch(() => {});
  }, [notifyError]);

  const onContractorChange = useCallback(async (id: number | null) => {
    setSelectedContractorId(id);
    if (!id) { setLedger([]); return; }
    setLoadingLedger(true);
    setLedger([]);
    try {
      const data = await apiGet<LedgerEntry[]>(`/ledger/contractor/${id}`);
      setLedger(data);
    } catch (err: any) {
      notifyError('Failed to load ledger: ' + err.message);
    } finally {
      setLoadingLedger(false);
    }
  }, [notifyError]);

  const formatCurrency = (val: number) => {
    if (val == null || val === 0) return '';
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleExportExcel = useCallback(() => {
    const name = selectedContractor?.name ?? 'contractor';
    exportToExcel(filteredLedger as any, `${name}_ledger`, `Ledger - ${name}`, [
      { key: 'date', header: 'Date' },
      { key: 'site_name', header: 'Site / Project' },
      { key: 'invoice_ref', header: 'Invoice / Ref' },
      { key: 'description', header: 'Particulars' },
      { key: 'gross_amount', header: 'Gross Bill' },
      { key: 'tds_amount', header: 'TDS Deducted' },
      { key: 'net_payable', header: 'Net Payable' },
      { key: 'credit', header: 'Payments' },
      { key: 'balance', header: 'Due Balance' },
    ]);
  }, [filteredLedger, selectedContractor]);

  const handleExportPdf = useCallback(() => {
    const name = selectedContractor?.name ?? 'Contractor';
    exportToPDF({
      title: `Contractor Ledger - ${name}`,
      fileName: `${name}_ledger`,
      data: filteredLedger as any,
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'site_name', header: 'Site' },
        { key: 'invoice_ref', header: 'Ref No' },
        { key: 'gross_amount', header: 'Gross', format: 'currency', align: 'right' },
        { key: 'tds_amount', header: 'TDS', format: 'currency', align: 'right' },
        { key: 'net_payable', header: 'Net', format: 'currency', align: 'right' },
        { key: 'credit', header: 'Paid', format: 'currency', align: 'right' },
        { key: 'balance', header: 'Due', format: 'currency', align: 'right' },
      ],
      summaryRow: {
        date: '', site_name: '', invoice_ref: 'TOTAL',
        gross_amount: totalGross, tds_amount: totalTds,
        net_payable: netBilled, credit: totalPayments, balance: outstandingDue
      },
      dualCopy: { partyLabel: 'Contractor Copy' },
      footerLeft: 'Contractor Signature',
      footerRight: 'Authorized Signatory',
      dateRange: dateFrom || dateTo ? { from: dateFrom, to: dateTo } : undefined,
    });
  }, [filteredLedger, selectedContractor, totalGross, totalTds, netBilled, totalPayments, outstandingDue, dateFrom, dateTo]);

  const handlePrint = useCallback(() => {
    const name = selectedContractor?.name ?? 'Contractor';
    printReport('ledgerTable', `Ledger - ${name}`);
  }, [selectedContractor]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Contractor Ledger</h1>
      </div>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={contractorItems}
              label="Select Contractor"
              placeholder="Search contractor..."
              value={selectedContractorId}
              onChange={(val: any) => onContractorChange(val)}
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              label="Site / Project"
              placeholder="All Sites"
              value={selectedSiteId}
              onChange={(val: any) => setSelectedSiteId(val)}
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
            <i className="ri-close-line" /> Clear Date Filter
          </button>
        )}
      </div>

      {(loadingContractors || loadingLedger) && (
        <div className="skeleton" style={{ height: 200, marginTop: 16 }} />
      )}

      {selectedContractorId && (
        <>
          <div style={{ marginTop: 16 }}>
            <SummaryCards cards={summaryCards} />
          </div>

          <div className="card-container" style={{ marginTop: 16 }}>
            <div className={styles.toolbarRow}>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search ledger entries..." className={styles.searchInput} />
              <div className={styles.exportButtons}>
                <button className="btn-secondary" onClick={handleExportExcel}><i className="ri-file-excel-2-line" /> Excel</button>
                <button className="btn-secondary" onClick={handleExportPdf}><i className="ri-file-pdf-line" /> PDF</button>
                <button className="btn-secondary" onClick={handlePrint}><i className="ri-printer-line" /> Print</button>
              </div>
            </div>
          </div>

          <div className="table-responsive" style={{ marginTop: 8 }}>
            <table id="ledgerTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Site / Project</th>
                  <th>Invoice / Ref</th>
                  <th>Particulars</th>
                  <th className={styles.textRight}>Gross Bill</th>
                  <th className={`${styles.textRight} ${styles.textDangerHeader}`}>TDS Deducted</th>
                  <th className={styles.textRight}>Net Payable</th>
                  <th className={styles.textRight}>Payments</th>
                  <th className={styles.textRight}>Due Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.length === 0 ? (
                  <tr><td colSpan={10} className="empty-state">No ledger entries found.</td></tr>
                ) : (
                  filteredLedger.map((entry, i) => (
                    <tr key={entry.id}>
                      <td>{i + 1}</td>
                      <td>{entry.date}</td>
                      <td>
                        {entry.site_name && <span className="badge badge-info">{entry.site_name}</span>}
                      </td>
                      <td>
                        {entry.invoice_ref && <span className={styles.refLabel}>{entry.invoice_ref}</span>}
                      </td>
                      <td>{entry.description}</td>
                      <td className={styles.textRight}>{formatCurrency(entry.gross_amount || entry.debit)}</td>
                      <td className={`${styles.textRight} ${styles.textDanger}`}>{formatCurrency(entry.tds_amount)}</td>
                      <td className={`${styles.textRight} ${styles.highlightNet}`}>{formatCurrency(entry.net_payable)}</td>
                      <td className={`${styles.textRight} ${styles.textSuccess}`}>{formatCurrency(entry.credit)}</td>
                      <td className={`${styles.textRight} ${entry.balance > 0 ? styles.textDanger : ''}`}>
                        {formatCurrency(entry.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className={styles.totalsRow}>
                  <td colSpan={5}><strong>Net Outstanding Due</strong></td>
                  <td className={styles.textRight}><strong>{formatCurrency(totalGross)}</strong></td>
                  <td className={`${styles.textRight} ${styles.textDanger}`}><strong>{formatCurrency(totalTds)}</strong></td>
                  <td className={styles.textRight}><strong>{formatCurrency(netBilled)}</strong></td>
                  <td className={`${styles.textRight} ${styles.textSuccess}`}><strong>{formatCurrency(totalPayments)}</strong></td>
                  <td className={`${styles.textRight} ${outstandingDue > 0 ? styles.textDanger : ''}`}>
                    <strong>{formatCurrency(outstandingDue)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
