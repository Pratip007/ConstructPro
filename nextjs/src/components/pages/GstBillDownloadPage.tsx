'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel, printReport } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';
import DataTable from '@/components/DataTable';

const columns = [
  { key: 'bill_no', label: 'Bill No' },
  { key: 'retailer_name', label: 'Retailer' },
  { key: 'gst_no', label: 'GST No' },
  { key: 'bill_date', label: 'Date' },
  { key: 'base_amount', label: 'Base Amount' },
  { key: 'cgst', label: 'CGST' },
  { key: 'sgst', label: 'SGST' },
  { key: 'igst', label: 'IGST' },
  { key: 'total_amount', label: 'Total Amount' },
];

export default function GstBillDownloadPage() {
  const { error: notifyError } = useNotification();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');

  const [companies, setCompanies] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  const companyItems = useMemo(() => companies.map(c => ({ value: String(c.id), label: c.name })), [companies]);
  const siteItems = useMemo(() => sites.map(s => ({ value: String(s.id), label: s.name })), [sites]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    const totalBase = rows.reduce((s, r) => s + (r.base_amount ?? 0), 0);
    const totalGst = rows.reduce((s, r) => s + (r.cgst ?? 0) + (r.sgst ?? 0) + (r.igst ?? 0), 0);
    const totalAmount = rows.reduce((s, r) => s + (r.total_amount ?? 0), 0);
    return [
      { title: 'Total Bills', value: rows.length, icon: 'ri-file-text-line', color: 'primary' },
      { title: 'Base Amount', value: totalBase, icon: 'ri-money-rupee-circle-line', color: 'info', prefix: '₹' },
      { title: 'Total GST', value: totalGst, icon: 'ri-percent-line', color: 'warning', prefix: '₹' },
      { title: 'Grand Total', value: totalAmount, icon: 'ri-wallet-line', color: 'success', prefix: '₹' },
    ];
  }, [rows]);

  useEffect(() => {
    apiGet<any[]>('/companies').then(d => setCompanies(d ?? [])).catch(() => {});
    apiGet<any[]>('/sites').then(d => setSites(d ?? [])).catch(() => {});
  }, []);

  const generate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (companyFilter) params.company_id = companyFilter;
      if (siteFilter) params.site_id = siteFilter;
      const res = await apiGet<any[]>('/retailer-bills/gst-report', params);
      const data = Array.isArray(res) ? res : [];
      const enriched = data.map(b => ({
        ...b,
        base_amount: b.base_amount ?? b.taxable_amount ?? 0,
        cgst: b.cgst ?? 0,
        sgst: b.sgst ?? 0,
        igst: b.igst ?? 0,
      }));
      setRows(enriched);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load GST report');
      notifyError('Failed to load GST bill report');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, companyFilter, siteFilter, notifyError]);

  const handleExportExcel = () => {
    exportToExcel(rows as any[], 'gst-bills', 'GST Bill Report', columns.map(c => ({ key: c.key, header: c.label })));
  };

  const handlePrint = () => {
    printReport('gst-report-table', 'GST Bill Report');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-file-text-line"></i> GST Bill Download</h1>
        <div className="header-actions">
          <button className="btn-export" onClick={handleExportExcel} disabled={!rows.length}>
            <i className="ri-file-excel-2-line"></i> Export Excel
          </button>
          <button className="btn-secondary" onClick={handlePrint} disabled={!rows.length}>
            <i className="ri-printer-line"></i> Print
          </button>
        </div>
      </div>

      {rows.length > 0 && <SummaryCards cards={summaryCards} />}

      <div className="card-container">
        <div className="table-toolbar">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
              <label>Company</label>
              <SearchableDropdown items={companyItems} value={companyFilter} onChange={setCompanyFilter} placeholder="All Companies" />
            </div>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
              <label>Site</label>
              <SearchableDropdown items={siteItems} value={siteFilter} onChange={setSiteFilter} placeholder="All Sites" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={generate} disabled={loading} style={{ height: 38 }}>
              {loading ? 'Loading...' : <><i className="ri-search-line"></i> Generate</>}
            </button>
          </div>
        </div>
        {error && <p style={{ color: 'var(--danger)', marginTop: 8 }}>{error}</p>}
      </div>

      <div id="gst-report-table">
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          fileName="gst-bill-download"
          emptyMessage="Select filters and generate report."
        />
      </div>
    </div>
  );
}
