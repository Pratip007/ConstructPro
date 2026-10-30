'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel, printReport } from '@/lib/export-utils';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';
import DataTable from '@/components/DataTable';

const columns = [
  { key: 'display_id', label: 'ID' },
  { key: 'name', label: 'Company Name' },
  { key: 'contact_person', label: 'Contact' },
  { key: 'phone', label: 'Phone' },
  { key: 'gst_no', label: 'GST No' },
  { key: 'total_invoices', label: 'Total Invoices' },
  { key: 'total_payments', label: 'Total Payments' },
  { key: 'balance', label: 'Balance' },
  { key: 'status', label: 'Status' },
];

export default function CompanyReportPage() {
  const { error: notifyError } = useNotification();

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    const totalInv = rows.reduce((s, r) => s + (r.total_invoices ?? 0), 0);
    const totalPay = rows.reduce((s, r) => s + (r.total_payments ?? 0), 0);
    const totalBal = rows.reduce((s, r) => s + (r.balance ?? 0), 0);
    return [
      { title: 'Companies', value: rows.length, icon: 'ri-building-line', color: 'primary' },
      { title: 'Total Invoiced', value: totalInv, icon: 'ri-file-text-line', color: 'info', prefix: '₹' },
      { title: 'Total Paid', value: totalPay, icon: 'ri-checkbox-circle-line', color: 'success', prefix: '₹' },
      { title: 'Balance Due', value: totalBal, icon: 'ri-money-rupee-circle-line', color: totalBal > 0 ? 'danger' : 'success', prefix: '₹' },
    ];
  }, [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      const res = await apiGet<any[]>('/companies', params);
      const data = Array.isArray(res) ? res : [];
      const enriched = data.map(c => ({
        ...c,
        total_invoices: c.total_invoices ?? 0,
        total_payments: c.total_payments ?? 0,
        balance: c.balance ?? (c.total_invoices ?? 0) - (c.total_payments ?? 0),
      }));
      setRows(enriched);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load companies');
      notifyError('Failed to load company report');
    } finally {
      setLoading(false);
    }
  }, [search, notifyError]);

  useEffect(() => { load(); }, []);

  const handleExportExcel = () => {
    exportToExcel(rows, 'company-report', 'Company Report', columns.map(c => ({ key: c.key, header: c.label })));
  };

  const handlePrint = () => {
    printReport('company-report-table', 'Company Report');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-building-line"></i> Company Report</h1>
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
            <label>Search</label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name..."
              onKeyDown={e => e.key === 'Enter' && load()}
            />
          </div>
          <div className="form-group" style={{ alignSelf: 'end' }}>
            <button className="btn-primary" onClick={load} disabled={loading}>
              {loading ? 'Loading...' : <><i className="ri-search-line"></i> Search</>}
            </button>
          </div>
        </div>
        {error && <p className="error-text" style={{ color: 'red', marginTop: 8 }}>{error}</p>}
      </div>

      <div id="company-report-table">
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          fileName="company-report"
          emptyMessage="No companies found."
        />
      </div>
    </div>
  );
}
