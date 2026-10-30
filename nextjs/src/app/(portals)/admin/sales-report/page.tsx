'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';

interface Company { id: string; name: string; }
interface MonthlySales {
  month: string;
  invoices: number;
  total_base: number;
  total_gst: number;
  total_gross: number;
}

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

function buildFiscalYears(): string[] {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let y = currentYear + 1; y >= currentYear - 10; y--) {
    years.push(String(y));
  }
  return years;
}

export default function SalesReportPage() {
  const { error: notifyError } = useNotification();

  const [companyId, setCompanyId] = useState('');
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear()));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [monthlyData, setMonthlyData] = useState<MonthlySales[]>([]);
  const [grandTotal, setGrandTotal] = useState<any>(null);

  const companyItems = useMemo(() => companies.map(c => ({ value: c.id, label: c.name })), [companies]);
  const fiscalYears = useMemo(() => buildFiscalYears(), []);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    if (!grandTotal) return [];
    return [
      { title: 'Total Invoices', value: grandTotal.invoices ?? 0, icon: 'ri-file-text-line', color: 'primary' },
      { title: 'Base Amount', value: grandTotal.total_base ?? 0, icon: 'ri-money-rupee-circle-line', color: 'info', prefix: '₹' },
      { title: 'Total GST', value: grandTotal.total_gst ?? 0, icon: 'ri-percent-line', color: 'warning', prefix: '₹' },
      { title: 'Gross Amount', value: grandTotal.total_gross ?? 0, icon: 'ri-wallet-line', color: 'success', prefix: '₹' },
    ];
  }, [grandTotal]);

  const maxGross = useMemo(() => {
    if (!monthlyData.length) return 0;
    return Math.max(...monthlyData.map(m => m.total_gross ?? 0), 1);
  }, [monthlyData]);

  useEffect(() => {
    apiGet<Company[]>('/companies').then(res => setCompanies(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (companyId) params.company_id = companyId;
      if (fiscalYear) params.fy = fiscalYear;
      const res = await apiGet<any>('/reports/sales', params);
      if (res && res.monthly) {
        setMonthlyData(res.monthly);
        setGrandTotal(res.grandTotal ?? null);
      } else if (Array.isArray(res)) {
        setMonthlyData(res as any);
        const totals = (res as MonthlySales[]).reduce(
          (acc, r) => ({
            invoices: acc.invoices + (r.invoices ?? 0),
            total_base: acc.total_base + (r.total_base ?? 0),
            total_gst: acc.total_gst + (r.total_gst ?? 0),
            total_gross: acc.total_gross + (r.total_gross ?? 0),
          }),
          { invoices: 0, total_base: 0, total_gst: 0, total_gross: 0 }
        );
        setGrandTotal(totals);
      } else {
        setMonthlyData([]);
        setGrandTotal(null);
      }
    } catch (err: any) {
      notifyError('Failed to load sales report: ' + (err.message ?? ''));
      setMonthlyData([]);
      setGrandTotal(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, fiscalYear, notifyError]);

  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleExportExcel = useCallback(async () => {
    if (!monthlyData.length) return;
    const XLSX = await import('xlsx');
    const wsData = [['Month', 'Invoices', 'Base Amount', 'GST', 'Gross Amount']];
    monthlyData.forEach(r => wsData.push([r.month, String(r.invoices ?? 0), String(r.total_base ?? 0), String(r.total_gst ?? 0), String(r.total_gross ?? 0)]));
    if (grandTotal) {
      wsData.push(['Grand Total', String(grandTotal.invoices ?? 0), String(grandTotal.total_base ?? 0), String(grandTotal.total_gst ?? 0), String(grandTotal.total_gross ?? 0)]);
    }
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
    XLSX.writeFile(wb, `sales-report-${fiscalYear}.xlsx`);
  }, [monthlyData, grandTotal, fiscalYear]);

  const handlePrint = useCallback(() => {
    if (!monthlyData.length) return;
    let html = `<h1>Sales Report - FY ${fiscalYear}</h1>`;
    html += `<table><thead><tr><th>Month</th><th>Invoices</th><th style="text-align:right">Base Amount</th><th style="text-align:right">GST</th><th style="text-align:right">Gross Amount</th></tr></thead><tbody>`;
    monthlyData.forEach(r => {
      html += `<tr><td>${r.month}</td><td>${r.invoices ?? 0}</td><td style="text-align:right">${formatCurrency(r.total_base ?? 0)}</td><td style="text-align:right">${formatCurrency(r.total_gst ?? 0)}</td><td style="text-align:right">${formatCurrency(r.total_gross ?? 0)}</td></tr>`;
    });
    if (grandTotal) {
      html += `<tr style="font-weight:bold;background:#f0f0f0"><td>Grand Total</td><td>${grandTotal.invoices ?? 0}</td><td style="text-align:right">${formatCurrency(grandTotal.total_base ?? 0)}</td><td style="text-align:right">${formatCurrency(grandTotal.total_gst ?? 0)}</td><td style="text-align:right">${formatCurrency(grandTotal.total_gross ?? 0)}</td></tr>`;
    }
    html += `</tbody></table>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<html><head><title>Sales Report</title><style>
        body{font-family:'Segoe UI',sans-serif;padding:20px}
        table{width:100%;border-collapse:collapse;margin:12px 0}
        th,td{border:1px solid #ddd;padding:8px;font-size:13px;text-align:left}
        th{background:#2c3e50;color:#fff}
        tr:nth-child(even){background:#f5f5f5}
      </style></head><body>${html}</body></html>`);
      w.document.close();
      w.onload = () => { w.print(); w.close(); };
    }
  }, [monthlyData, grandTotal, fiscalYear]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-line-chart-line"></i> Sales Report</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-export" onClick={handleExportExcel} disabled={!monthlyData.length}><i className="ri-file-excel-2-line"></i> Excel</button>
          <button className="btn-export" onClick={handlePrint} disabled={!monthlyData.length}><i className="ri-printer-line"></i> Print</button>
        </div>
      </div>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown items={companyItems} label="Company" placeholder="All Companies..." value={companyId} onChange={setCompanyId} />
          </div>
          <div className="form-group">
            <label>Fiscal Year</label>
            <select value={fiscalYear} onChange={e => setFiscalYear(e.target.value)}>
              {fiscalYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn-primary" onClick={generate} disabled={loading}>
              {loading ? <><i className="ri-loader-4-line"></i> Loading...</> : <><i className="ri-search-line"></i> Generate</>}
            </button>
          </div>
        </div>
      </div>

      {summaryCards.length > 0 && <SummaryCards cards={summaryCards} />}

      {/* Monthly Sales Chart */}
      {monthlyData.length > 0 && (
        <div className="card-container" style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
            <i className="ri-bar-chart-grouped-line" style={{ marginRight: 6 }}></i>
            Monthly Sales Visualization
          </h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 220, padding: '0 10px' }}>
            {monthlyData.map((m, i) => {
              const pct = maxGross > 0 ? ((m.total_gross ?? 0) / maxGross) * 100 : 0;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {formatCurrency(m.total_gross ?? 0).replace(/₹/, '₹')}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 50,
                      height: `${Math.max(pct, 2)}%`,
                      background: 'linear-gradient(180deg, var(--accent) 0%, rgba(59,130,246,0.5) 100%)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                      minHeight: 4,
                    }}
                    title={`${m.month}: ${formatCurrency(m.total_gross ?? 0)}`}
                  />
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                    {m.month?.substring(0, 3) ?? MONTHS[i] ?? ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly Breakdown Table */}
      {monthlyData.length > 0 && (
        <div className="card-container" style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>
            Monthly Breakdown
          </h3>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th style={{ textAlign: 'center' }}>Invoice Count</th>
                  <th style={{ textAlign: 'right' }}>Base Amount</th>
                  <th style={{ textAlign: 'right' }}>GST</th>
                  <th style={{ textAlign: 'right' }}>Gross Amount</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{r.month}</td>
                    <td style={{ textAlign: 'center' }}>{r.invoices ?? 0}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(r.total_base ?? 0)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(r.total_gst ?? 0)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(r.total_gross ?? 0)}</td>
                  </tr>
                ))}
                {grandTotal && (
                  <tr style={{ fontWeight: 700, background: 'var(--bg-secondary)' }}>
                    <td>Grand Total</td>
                    <td style={{ textAlign: 'center' }}>{grandTotal.invoices ?? 0}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(grandTotal.total_base ?? 0)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(grandTotal.total_gst ?? 0)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(grandTotal.total_gross ?? 0)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !monthlyData.length && (
        <div className="card-container" style={{ marginTop: 20 }}>
          <p className="empty-state"><i className="ri-bar-chart-line"></i> Select filters and click Generate to view the sales report.</p>
        </div>
      )}
    </div>
  );
}
