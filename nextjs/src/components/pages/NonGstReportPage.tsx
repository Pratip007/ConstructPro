'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import { exportToExcel } from '@/lib/export-utils';

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

export default function NonGstReportPage() {
  const { error: showError } = useNotification();

  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedRetailerId, setSelectedRetailerId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [retailers, setRetailers] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);

  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => cur - i);
  }, []);

  const retailerItems = useMemo(() =>
    [{ value: '', label: 'All Retailers' }, ...retailers.map(r => ({ value: r.id, label: r.name }))], [retailers]);
  const siteItems = useMemo(() =>
    [{ value: '', label: 'All Sites' }, ...sites.map(s => ({ value: s.id, label: s.name }))], [sites]);

  const filtered = useMemo(() => {
    let list = bills;
    const q = searchQuery.toLowerCase();
    if (q) list = list.filter(b => (b.bill_number ?? '').toLowerCase().includes(q) || (b.retailer_name ?? '').toLowerCase().includes(q));
    return list;
  }, [bills, searchQuery]);

  const totalAmount = useMemo(() => filtered.reduce((s, b) => s + (b.total_amount ?? b.amount ?? 0), 0), [filtered]);
  const totalPaid = useMemo(() => filtered.reduce((s, b) => s + (b.paid_amount ?? 0), 0), [filtered]);
  const totalDue = useMemo(() => filtered.reduce((s, b) => s + (b.due_amount ?? 0), 0), [filtered]);

  const summaryCards = useMemo(() => [
    { title: 'Total Bills', value: filtered.length, color: 'primary' as const, icon: 'ri-file-list-3-line' },
    { title: 'Total Amount', value: totalAmount, color: 'info' as const, prefix: '₹', icon: 'ri-money-rupee-circle-line' },
    { title: 'Total Paid', value: totalPaid, color: 'success' as const, prefix: '₹', icon: 'ri-checkbox-circle-line' },
    { title: 'Total Due', value: totalDue, color: (totalDue > 0 ? 'danger' : 'success') as any, prefix: '₹', icon: 'ri-error-warning-line' },
  ], [filtered, totalAmount, totalPaid, totalDue]);

  useEffect(() => {
    apiGet<any[]>('/retailers').then(d => setRetailers(d)).catch(() => {});
    apiGet<any[]>('/sites').then(d => setSites(d)).catch(() => {});
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { month: String(selectedMonth), year: String(selectedYear) };
      if (selectedRetailerId) params.retailer_id = selectedRetailerId;
      if (selectedSiteId) params.site_id = selectedSiteId;
      const data = await apiGet<any[]>('/retailer-bills/non-gst-report', params);
      setBills(data);
    } catch { showError('Failed to load Non-GST report'); }
    setLoading(false);
  }, [selectedMonth, selectedYear, selectedRetailerId, selectedSiteId, showError]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const exportReport = () => {
    exportToExcel(filtered as any[], 'Non_GST_Report', 'Non-GST Report', [
      { key: 'bill_number', header: 'Bill / Ref No' }, { key: 'retailer_name', header: 'Retailer' },
      { key: 'site_name', header: 'Site' }, { key: 'date', header: 'Date' },
      { key: 'total_amount', header: 'Amount' }, { key: 'paid_amount', header: 'Paid' },
      { key: 'due_amount', header: 'Due' }, { key: 'status', header: 'Status' },
    ]);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Non-GST Report</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-export" onClick={exportReport}><i className="ri-file-excel-2-line" /> Excel</button>
        </div>
      </div>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <label>Month</label>
            <select value={selectedMonth} onChange={e => setSelectedMonth(+e.target.value)}>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Year</label>
            <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Retailer</label>
            <SearchableDropdown items={retailerItems} value={selectedRetailerId} onChange={setSelectedRetailerId} placeholder="All Retailers" />
          </div>
          <div className="form-group">
            <label>Site</label>
            <SearchableDropdown items={siteItems} value={selectedSiteId} onChange={setSelectedSiteId} placeholder="All Sites" />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn-primary" onClick={loadReport} style={{ width: '100%' }}>Generate Report</button>
          </div>
          <div className="form-group">
            <label>Search</label>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Bill no, retailer..." />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}><SummaryCards cards={summaryCards} /></div>

      {loading ? <div className="skeleton" style={{ height: 300, marginTop: 20 }} /> : (
        <div className="card-container" style={{ marginTop: 20, padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Bill / Ref No</th><th>Retailer</th><th>Site</th><th>Date</th>
                  <th>Amount</th><th>Paid</th><th>Due</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="empty-state">No non-GST bills found for the selected period.</td></tr>
                ) : filtered.map((b, i) => (
                  <tr key={b.id ?? i}>
                    <td>{i + 1}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 700 }}>{b.bill_number ?? 'N/A'}</td>
                    <td style={{ fontWeight: 600 }}>{b.retailer_name ?? '-'}</td>
                    <td>{b.site_name ?? '-'}</td>
                    <td>{b.date}</td>
                    <td style={{ fontWeight: 700 }}>{(b.total_amount ?? b.amount ?? 0).toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>{(b.paid_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 700, color: (b.due_amount ?? 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>{(b.due_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td>{b.status === 'PAID' ? <span className="badge badge-success">PAID</span> : <span className="badge badge-danger">DUE</span>}</td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700, background: 'var(--glass-bg)' }}>
                    <td colSpan={5} style={{ textAlign: 'right' }}>TOTAL:</td>
                    <td>{totalAmount.toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--success)' }}>{totalPaid.toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--danger)' }}>{totalDue.toLocaleString('en-IN')}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
