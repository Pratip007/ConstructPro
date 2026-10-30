'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel, printReport } from '@/lib/export-utils';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';
import DataTable from '@/components/DataTable';

interface Site { id: string; name: string; }
interface Retailer { id: string; name: string; }

const columns = [
  { key: 'bill_no', label: 'Bill No' },
  { key: 'retailer_name', label: 'Retailer' },
  { key: 'site_name', label: 'Site' },
  { key: 'bill_date', label: 'Date' },
  { key: 'total_amount', label: 'Amount' },
  { key: 'status', label: 'Status' },
];

export default function PurchaseReportPage() {
  const { error: notifyError } = useNotification();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [siteId, setSiteId] = useState('');
  const [retailerId, setRetailerId] = useState('');

  const [sites, setSites] = useState<Site[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    const totalAmount = rows.reduce((s, r) => s + (r.total_amount ?? 0), 0);
    const paid = rows.filter(r => r.status === 'paid').length;
    return [
      { title: 'Total Bills', value: rows.length, icon: 'ri-shopping-cart-line', color: 'primary' },
      { title: 'Total Amount', value: totalAmount, icon: 'ri-money-rupee-circle-line', color: 'info', prefix: '₹' },
      { title: 'Paid', value: paid, icon: 'ri-checkbox-circle-line', color: 'success' },
      { title: 'Pending', value: rows.length - paid, icon: 'ri-time-line', color: 'warning' },
    ];
  }, [rows]);

  useEffect(() => {
    apiGet<Site[]>('/sites').then(res => setSites(Array.isArray(res) ? res : [])).catch(() => {});
    apiGet<Retailer[]>('/retailers').then(res => setRetailers(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const generate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (siteId.trim()) params.site_id = siteId.trim();
      if (retailerId.trim()) params.retailer_id = retailerId.trim();
      const res = await apiGet<any[]>('/retailer-bills', params);
      setRows(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load report');
      notifyError('Failed to load purchase report');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, siteId, retailerId, notifyError]);

  const handleExportExcel = () => {
    exportToExcel(rows, 'purchase-report', 'Purchase Report', columns.map(c => ({ key: c.key, header: c.label })));
  };

  const handlePrint = () => {
    printReport('purchase-report-table', 'Purchase Report');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-shopping-cart-line"></i> Purchase Report</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleExportExcel} disabled={!rows.length}>
            <i className="ri-file-excel-2-line"></i> Export Excel
          </button>
          <button className="btn-secondary" onClick={handlePrint} disabled={!rows.length}>
            <i className="ri-printer-line"></i> Print
          </button>
        </div>
      </div>

      {rows.length > 0 && <SummaryCards cards={summaryCards} />}

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <label>From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Site</label>
            <select value={siteId} onChange={e => setSiteId(e.target.value)}>
              <option value="">All Sites</option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Retailer</label>
            <select value={retailerId} onChange={e => setRetailerId(e.target.value)}>
              <option value="">All Retailers</option>
              {retailers.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 15 }}>
          <button className="btn-primary" onClick={generate} disabled={loading}>
            {loading ? 'Loading...' : <><i className="ri-bar-chart-line"></i> Generate Report</>}
          </button>
        </div>
        {error && <p className="error-text" style={{ color: 'red', marginTop: 8 }}>{error}</p>}
      </div>

      <div id="purchase-report-table">
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          fileName="purchase-report"
          emptyMessage="Select filters and generate report."
        />
      </div>
    </div>
  );
}
