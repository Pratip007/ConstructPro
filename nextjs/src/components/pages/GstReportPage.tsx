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

export default function GstReportPage() {
  const { error: showError, info: showInfo } = useNotification();

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
    if (q) {
      list = list.filter(b =>
        (b.bill_number ?? '').toLowerCase().includes(q) ||
        (b.retailer_name ?? '').toLowerCase().includes(q) ||
        (b.gst_number ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [bills, searchQuery]);

  const totalBaseAmount = useMemo(() => filtered.reduce((s, b) => s + (b.base_amount ?? b.subtotal ?? 0), 0), [filtered]);
  const totalCgst = useMemo(() => filtered.reduce((s, b) => s + (b.cgst_amount ?? 0), 0), [filtered]);
  const totalSgst = useMemo(() => filtered.reduce((s, b) => s + (b.sgst_amount ?? 0), 0), [filtered]);
  const totalIgst = useMemo(() => filtered.reduce((s, b) => s + (b.igst_amount ?? 0), 0), [filtered]);
  const totalGstAmount = useMemo(() => filtered.reduce((s, b) => s + (b.gst_amount ?? 0), 0), [filtered]);
  const totalAmount = useMemo(() => filtered.reduce((s, b) => s + (b.total_amount ?? 0), 0), [filtered]);

  const summaryCards = useMemo(() => [
    { title: 'Total Bills', value: filtered.length, color: 'primary' as const, icon: 'ri-file-list-3-line' },
    { title: 'Total Taxable Value', value: totalBaseAmount, color: 'info' as const, prefix: '₹', icon: 'ri-money-rupee-circle-line' },
    { title: 'Total GST', value: totalGstAmount, color: 'warning' as const, prefix: '₹', icon: 'ri-percent-line' },
    { title: 'Total Invoice Value', value: totalAmount, color: 'success' as const, prefix: '₹', icon: 'ri-wallet-3-line' },
  ], [filtered, totalBaseAmount, totalGstAmount, totalAmount]);

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
      const data = await apiGet<any[]>('/retailer-bills/gst-report', params);
      setBills(data);
    } catch { showError('Failed to load GST report'); }
    setLoading(false);
  }, [selectedMonth, selectedYear, selectedRetailerId, selectedSiteId, showError]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const exportGSTR1 = () => {
    exportToExcel(filtered as any[], `GSTR1_${selectedYear}_${MONTHS[selectedMonth - 1].label}`, 'GSTR-1', [
      { key: 'bill_number', header: 'Invoice Number' }, { key: 'date', header: 'Invoice Date' },
      { key: 'retailer_name', header: 'Supplier Name' }, { key: 'gst_number', header: 'GSTIN' },
      { key: 'base_amount', header: 'Taxable Value' }, { key: 'cgst_amount', header: 'CGST' },
      { key: 'sgst_amount', header: 'SGST' }, { key: 'igst_amount', header: 'IGST' },
      { key: 'gst_amount', header: 'Total Tax' }, { key: 'total_amount', header: 'Invoice Value' },
    ]);
  };

  const exportReport = () => {
    exportToExcel(filtered as any[], 'GST_Report', 'GST Report', [
      { key: 'bill_number', header: 'Bill Number' }, { key: 'retailer_name', header: 'Retailer' },
      { key: 'gst_number', header: 'GSTIN' }, { key: 'date', header: 'Date' },
      { key: 'base_amount', header: 'Taxable Value' }, { key: 'gst_rate', header: 'GST Rate (%)' },
      { key: 'cgst_amount', header: 'CGST' }, { key: 'sgst_amount', header: 'SGST' },
      { key: 'igst_amount', header: 'IGST' }, { key: 'gst_amount', header: 'Total GST' },
      { key: 'total_amount', header: 'Total' },
    ]);
  };

  const downloadInvoice = (bill: any) => {
    if (bill.document_url) window.open(bill.document_url, '_blank');
    else showInfo('No invoice document available');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>GST Report</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-export" onClick={exportGSTR1}><i className="ri-file-excel-2-line" /> GSTR-1 Export</button>
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
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Bill no, retailer, GSTIN..." />
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
                  <th>#</th><th>Bill Number</th><th>Date</th><th>Retailer</th><th>GSTIN</th><th>Site</th>
                  <th>Taxable Value</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total Tax</th><th>Invoice Value</th><th>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={13} className="empty-state">No GST bills found for the selected period.</td></tr>
                ) : filtered.map((b, i) => (
                  <tr key={b.id ?? i}>
                    <td>{i + 1}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 700 }}>{b.bill_number ?? '-'}</td>
                    <td>{b.date}</td>
                    <td style={{ fontWeight: 600 }}>{b.retailer_name ?? '-'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{b.gst_number ?? 'N/A'}</td>
                    <td>{b.site_name ?? '-'}</td>
                    <td style={{ fontWeight: 600 }}>{(b.base_amount ?? b.subtotal ?? 0).toLocaleString('en-IN')}</td>
                    <td>{(b.cgst_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td>{(b.sgst_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td>{(b.igst_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--warning)', fontWeight: 700 }}>{(b.gst_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 800 }}>{(b.total_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td>
                      {b.document_url ? (
                        <button style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(59,130,246,0.15)', color: 'var(--accent)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 4, cursor: 'pointer' }} onClick={() => downloadInvoice(b)}><i className="ri-download-line" /></button>
                      ) : <span style={{ opacity: 0.4, fontSize: 11 }}>N/A</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700, background: 'var(--glass-bg)' }}>
                    <td colSpan={6} style={{ textAlign: 'right' }}>TOTAL:</td>
                    <td>{totalBaseAmount.toLocaleString('en-IN')}</td>
                    <td>{totalCgst.toLocaleString('en-IN')}</td>
                    <td>{totalSgst.toLocaleString('en-IN')}</td>
                    <td>{totalIgst.toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--warning)' }}>{totalGstAmount.toLocaleString('en-IN')}</td>
                    <td>{totalAmount.toLocaleString('en-IN')}</td>
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
