'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel, exportToPDF, printReport } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';

interface Site { id: string; name: string; }
interface Product { id: string; name: string; }

export default function StockReportPage() {
  const { error: notifyError } = useNotification();

  const [siteId, setSiteId] = useState('');
  const [productId, setProductId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [sites, setSites] = useState<Site[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);
  const productItems = useMemo(() => products.map(p => ({ value: p.id, label: p.name })), [products]);

  const totalValue = useMemo(() => rows.reduce((s, r) => s + (r.closing_value ?? 0), 0), [rows]);
  const totalInward = useMemo(() => rows.reduce((s, r) => s + (r.inward ?? 0), 0), [rows]);
  const totalOutward = useMemo(() => rows.reduce((s, r) => s + (r.outward ?? 0), 0), [rows]);

  const summaryCards = useMemo<SummaryCard[]>(() => [
    { title: 'Total Value', value: totalValue, icon: 'ri-money-rupee-circle-line', color: 'success', prefix: '₹' },
    { title: 'Total Inward', value: totalInward, icon: 'ri-arrow-down-line', color: 'info' },
    { title: 'Total Outward', value: totalOutward, icon: 'ri-arrow-up-line', color: 'warning' },
  ], [totalValue, totalInward, totalOutward]);

  useEffect(() => {
    apiGet<Site[]>('/sites').then(res => setSites(Array.isArray(res) ? res : [])).catch(() => {});
    apiGet<Product[]>('/products').then(res => setProducts(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const generate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (siteId) params.site_id = siteId;
      if (productId) params.product_id = productId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await apiGet<any[]>('/reports/stock', params);
      setRows(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load stock report');
      notifyError('Failed to load stock report');
    } finally {
      setLoading(false);
    }
  }, [siteId, productId, dateFrom, dateTo, notifyError]);

  const cols = [
    { key: 'product_name', header: 'Product' },
    { key: 'site_name', header: 'Site' },
    { key: 'opening', header: 'Opening' },
    { key: 'inward', header: 'Inward' },
    { key: 'outward', header: 'Outward' },
    { key: 'closing', header: 'Closing' },
    { key: 'closing_value', header: 'Value' },
  ];

  const handleExportExcel = () => { exportToExcel(rows, 'stock-report', 'Stock Report', cols); };
  const handleExportPdf = () => { exportToPDF({ data: rows, fileName: 'Stock_Report', title: 'Stock Report', columns: cols }); };
  const handlePrint = () => { printReport('stock-report-table', 'Stock Report'); };

  const fmt = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-bar-chart-box-line"></i> Stock Report</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleExportExcel} disabled={!rows.length}>Excel</button>
          <button className="btn-secondary" onClick={handleExportPdf} disabled={!rows.length}>PDF</button>
          <button className="btn-secondary" onClick={handlePrint} disabled={!rows.length}>Print</button>
        </div>
      </div>

      {rows.length > 0 && <SummaryCards cards={summaryCards} />}

      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <label>Site</label>
            <SearchableDropdown items={siteItems} value={siteId} onChange={setSiteId} placeholder="All Sites" />
          </div>
          <div className="form-group">
            <label>Product</label>
            <SearchableDropdown items={productItems} value={productId} onChange={setProductId} placeholder="All Products" />
          </div>
          <div className="form-group">
            <label>From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="form-group" style={{ alignSelf: 'end' }}>
            <button className="btn-primary" onClick={generate} disabled={loading}>
              {loading ? 'Loading...' : 'Generate Report'}
            </button>
          </div>
        </div>
        {error && <p style={{ color: 'var(--danger)', marginTop: 8 }}>{error}</p>}
      </div>

      {rows.length > 0 ? (
        <div className="card-container" style={{ marginTop: 16 }} id="stock-report-table">
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Product</th><th>Site</th>
                  <th style={{ textAlign: 'right' }}>Opening</th>
                  <th style={{ textAlign: 'right' }}>Inward</th>
                  <th style={{ textAlign: 'right' }}>Outward</th>
                  <th style={{ textAlign: 'right' }}>Closing</th>
                  <th style={{ textAlign: 'right' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{row.product_name ?? '-'}</td>
                    <td>{row.site_name ?? '-'}</td>
                    <td style={{ textAlign: 'right' }}>{row.opening ?? 0}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)' }}>{row.inward ?? 0}</td>
                    <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{row.outward ?? 0}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.closing ?? 0}</td>
                    <td style={{ textAlign: 'right' }}>{'₹'}{fmt(row.closing_value ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 800, background: 'var(--bg-card)', borderTop: '2px solid var(--border-color)' }}>
                  <td colSpan={4}>Total</td>
                  <td style={{ textAlign: 'right' }}>{totalInward}</td>
                  <td style={{ textAlign: 'right' }}>{totalOutward}</td>
                  <td></td>
                  <td style={{ textAlign: 'right' }}>{'₹'}{fmt(totalValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : !loading ? (
        <div className="card-container" style={{ marginTop: 16 }}>
          <p className="empty-state">Select filters and generate report.</p>
        </div>
      ) : null}
    </div>
  );
}
