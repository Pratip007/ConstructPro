'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel, printReport } from '@/lib/export-utils';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';

interface Company { id: string; name: string; }
interface MonthlySales {
  month: string;
  invoices: number;
  total_gross: number;
  total_base: number;
  total_gst: number;
}

export default function SalesReportPage() {
  const { error: notifyError } = useNotification();

  const [companyId, setCompanyId] = useState('');
  const [fiscalYear, setFiscalYear] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [monthlyData, setMonthlyData] = useState<MonthlySales[]>([]);
  const [grandTotal, setGrandTotal] = useState<any>(null);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    if (!grandTotal) return [];
    return [
      { title: 'Total Invoices', value: grandTotal.invoices ?? 0, icon: 'ri-file-text-line', color: 'primary' },
      { title: 'Base Amount', value: grandTotal.total_base ?? 0, icon: 'ri-money-rupee-circle-line', color: 'info', prefix: '₹' },
      { title: 'Total GST', value: grandTotal.total_gst ?? 0, icon: 'ri-percent-line', color: 'warning', prefix: '₹' },
      { title: 'Gross Amount', value: grandTotal.total_gross ?? 0, icon: 'ri-wallet-line', color: 'success', prefix: '₹' },
    ];
  }, [grandTotal]);

  useEffect(() => {
    apiGet<Company[]>('/companies').then(res => setCompanies(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const generate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (companyId.trim()) params.company_id = companyId.trim();
      if (fiscalYear.trim()) params.fy = fiscalYear.trim();
      const res = await apiGet<any>('/reports/sales', params);
      if (res && res.monthly) {
        setMonthlyData(res.monthly);
        setGrandTotal(res.grandTotal ?? null);
      } else if (Array.isArray(res)) {
        setMonthlyData(res as any);
        setGrandTotal(null);
      } else {
        setMonthlyData([]);
        setGrandTotal(null);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to load report');
      notifyError('Failed to load sales report');
    } finally {
      setLoading(false);
    }
  }, [companyId, fiscalYear, notifyError]);

  const handleExportExcel = () => {
    const data = monthlyData.map(m => ({
      month: m.month,
      invoices: m.invoices,
      total_base: m.total_base,
      total_gst: m.total_gst,
      total_gross: m.total_gross,
    }));
    exportToExcel(data, 'sales-report', 'Sales Report', [
      { key: 'month', header: 'Month' },
      { key: 'invoices', header: 'Invoices' },
      { key: 'total_base', header: 'Base Amount' },
      { key: 'total_gst', header: 'GST' },
      { key: 'total_gross', header: 'Gross Amount' },
    ]);
  };

  const handlePrint = () => {
    printReport('sales-report-table', 'Sales Report');
  };

  const fmt = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-line-chart-line"></i> Sales Report</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleExportExcel} disabled={!monthlyData.length}>
            <i className="ri-file-excel-2-line"></i> Export Excel
          </button>
          <button className="btn-secondary" onClick={handlePrint} disabled={!monthlyData.length}>
            <i className="ri-printer-line"></i> Print
          </button>
        </div>
      </div>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <label>Company</label>
            <select value={companyId} onChange={e => setCompanyId(e.target.value)}>
              <option value="">All Companies</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Fiscal Year (e.g. 2024-25)</label>
            <input type="text" value={fiscalYear} onChange={e => setFiscalYear(e.target.value)} placeholder="2024-25" />
          </div>
          <div className="form-group" style={{ alignSelf: 'end' }}>
            <button className="btn-primary" onClick={generate} disabled={loading}>
              {loading ? 'Loading...' : <><i className="ri-bar-chart-line"></i> Generate Report</>}
            </button>
          </div>
        </div>
        {error && <p className="error-text" style={{ color: 'red', marginTop: 8 }}>{error}</p>}
      </div>

      {grandTotal && <SummaryCards cards={summaryCards} />}

      {monthlyData.length > 0 ? (
        <div className="card-container" id="sales-report-table">
          <h3 style={{ margin: '0 0 12px', color: 'var(--text-main)' }}>Monthly Breakdown</h3>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th style={{ textAlign: 'right' }}>Invoices</th>
                  <th style={{ textAlign: 'right' }}>Base Amount</th>
                  <th style={{ textAlign: 'right' }}>GST</th>
                  <th style={{ textAlign: 'right' }}>Gross Amount</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map(row => (
                  <tr key={row.month}>
                    <td>{row.month}</td>
                    <td style={{ textAlign: 'right' }}>{row.invoices}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(row.total_base)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(row.total_gst)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(row.total_gross)}</td>
                  </tr>
                ))}
              </tbody>
              {grandTotal && (
                <tfoot>
                  <tr style={{ fontWeight: 800, background: 'var(--bg-card)', borderTop: '2px solid var(--border-color)' }}>
                    <td>Grand Total</td>
                    <td style={{ textAlign: 'right' }}>{grandTotal.invoices}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(grandTotal.total_base)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(grandTotal.total_gst)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(grandTotal.total_gross)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : !loading ? (
        <div className="card-container">
          <p className="empty-state">Select a company and fiscal year, then generate the report.</p>
        </div>
      ) : null}
    </div>
  );
}
