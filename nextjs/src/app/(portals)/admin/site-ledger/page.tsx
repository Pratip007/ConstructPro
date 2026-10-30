'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';

interface Site { id: string; name: string; }
interface Company { id: string; name: string; }
interface SectionData {
  label: string;
  key: string;
  items: any[];
  total: number;
}

const SECTION_META: Record<string, { label: string; icon: string; color: 'primary' | 'info' | 'warning' | 'success' | 'danger' }> = {
  employee:      { label: 'Employee',      icon: 'ri-user-line',       color: 'primary' },
  mobilization:  { label: 'Mobilization',  icon: 'ri-truck-line',      color: 'info' },
  retailer:      { label: 'Retailer',      icon: 'ri-store-2-line',    color: 'warning' },
  contractor:    { label: 'Contractor',    icon: 'ri-building-line',   color: 'danger' },
};

export default function SiteLedgerPage() {
  const { error: notifyError } = useNotification();

  const [companyId, setCompanyId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);

  const companyItems = useMemo(() => companies.map(c => ({ value: c.id, label: c.name })), [companies]);
  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    if (!sections.length) return [];
    const cards: SummaryCard[] = sections.map(s => {
      const meta = SECTION_META[s.key] ?? { label: s.label, icon: 'ri-folder-line', color: 'info' as const };
      return {
        title: meta.label,
        value: s.total,
        icon: meta.icon,
        color: meta.color,
        prefix: '₹',
      };
    });
    cards.push({ title: 'Grand Total', value: grandTotal, icon: 'ri-wallet-line', color: 'success', prefix: '₹' });
    return cards;
  }, [sections, grandTotal]);

  useEffect(() => {
    apiGet<Company[]>('/companies').then(res => setCompanies(Array.isArray(res) ? res : [])).catch(() => {});
    apiGet<Site[]>('/sites').then(res => setSites(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const generate = useCallback(async () => {
    if (!siteId) { notifyError('Please select a site'); return; }
    setLoading(true);
    try {
      const params: Record<string, string> = { site_id: siteId };
      if (companyId) params.company_id = companyId;
      const res = await apiGet<any>('/reports/site-ledger', params);
      if (res?.sections) {
        const sectionKeys = ['employee', 'mobilization', 'retailer', 'contractor'];
        const parsed: SectionData[] = sectionKeys
          .filter(k => res.sections[k])
          .map(k => {
            const items = Array.isArray(res.sections[k]) ? res.sections[k] : [];
            const total = items.reduce((s: number, item: any) => s + (item.amount ?? item.total ?? 0), 0);
            const meta = SECTION_META[k];
            return { label: meta?.label ?? k, key: k, items, total };
          });
        setSections(parsed);
        setGrandTotal(res.grandTotal ?? parsed.reduce((s, sec) => s + sec.total, 0));
      } else {
        setSections([]);
        setGrandTotal(0);
      }
    } catch (err: any) {
      notifyError('Failed to load site ledger: ' + (err.message ?? ''));
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [siteId, companyId, notifyError]);

  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleExportExcel = useCallback(async () => {
    if (!sections.length) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    sections.forEach(sec => {
      const wsData: (string | number)[][] = [['Month', 'Amount']];
      sec.items.forEach((item: any) => {
        wsData.push([item.month ?? item.label ?? '', item.amount ?? item.total ?? 0]);
      });
      wsData.push(['Total', sec.total]);
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 20 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws, sec.label.substring(0, 31));
    });
    XLSX.writeFile(wb, 'site-ledger.xlsx');
  }, [sections]);

  const handleExportPDF = useCallback(async () => {
    if (!sections.length) return;
    const { jsPDF } = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    let y = 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Site Ledger Report', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
    y += 10;

    sections.forEach(sec => {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(sec.label, 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Month', 'Amount']],
        body: [
          ...sec.items.map((item: any) => [item.month ?? item.label ?? '', formatCurrency(item.amount ?? item.total ?? 0)]),
          ['Total', formatCurrency(sec.total)],
        ],
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [44, 62, 80], textColor: 255 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable?.finalY + 8 || y + 30;
      if (y > 170) { doc.addPage(); y = 15; }
    });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: ${formatCurrency(grandTotal)}`, 14, y);
    doc.save('site-ledger.pdf');
  }, [sections, grandTotal]);

  const handlePrint = useCallback(() => {
    if (!sections.length) return;
    let html = `<h1>Site Ledger Report</h1>`;
    sections.forEach(sec => {
      html += `<h2>${sec.label}</h2>`;
      html += `<table><thead><tr><th>Month</th><th style="text-align:right">Amount</th></tr></thead><tbody>`;
      sec.items.forEach((item: any) => {
        html += `<tr><td>${item.month ?? item.label ?? ''}</td><td style="text-align:right">${formatCurrency(item.amount ?? item.total ?? 0)}</td></tr>`;
      });
      html += `<tr style="font-weight:bold"><td>Total</td><td style="text-align:right">${formatCurrency(sec.total)}</td></tr>`;
      html += `</tbody></table>`;
    });
    html += `<h2>Grand Total: ${formatCurrency(grandTotal)}</h2>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<html><head><title>Site Ledger</title><style>
        body{font-family:'Segoe UI',sans-serif;padding:20px}
        table{width:100%;border-collapse:collapse;margin:12px 0}
        th,td{border:1px solid #ddd;padding:8px;font-size:13px;text-align:left}
        th{background:#2c3e50;color:#fff}
        tr:nth-child(even){background:#f5f5f5}
      </style></head><body>${html}</body></html>`);
      w.document.close();
      w.onload = () => { w.print(); w.close(); };
    }
  }, [sections, grandTotal]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-book-read-line"></i> Site Ledger Report</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-export" onClick={handleExportExcel} disabled={!sections.length}><i className="ri-file-excel-2-line"></i> Excel</button>
          <button className="btn-export" onClick={handleExportPDF} disabled={!sections.length}><i className="ri-file-pdf-2-line"></i> PDF</button>
          <button className="btn-export" onClick={handlePrint} disabled={!sections.length}><i className="ri-printer-line"></i> Print</button>
        </div>
      </div>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown items={companyItems} label="Company" placeholder="Select Company..." value={companyId} onChange={setCompanyId} />
          </div>
          <div className="form-group">
            <SearchableDropdown items={siteItems} label="Site *" placeholder="Select Site..." value={siteId} onChange={setSiteId} />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn-primary" onClick={generate} disabled={loading || !siteId}>
              {loading ? <><i className="ri-loader-4-line"></i> Loading...</> : <><i className="ri-search-line"></i> Generate</>}
            </button>
          </div>
        </div>
      </div>

      {sections.length > 0 && (
        <>
          <SummaryCards cards={summaryCards} />

          {sections.map(sec => {
            const meta = SECTION_META[sec.key];
            return (
              <div className="card-container" key={sec.key} style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>
                  {meta && <i className={meta.icon} style={{ marginRight: 6 }}></i>}
                  {sec.label}
                </h3>
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sec.items.length === 0 ? (
                        <tr><td colSpan={2} className="empty-state">No data for this section.</td></tr>
                      ) : (
                        sec.items.map((item: any, i: number) => (
                          <tr key={i}>
                            <td>{item.month ?? item.label ?? `Row ${i + 1}`}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.amount ?? item.total ?? 0)}</td>
                          </tr>
                        ))
                      )}
                      {sec.items.length > 0 && (
                        <tr style={{ fontWeight: 700, background: 'var(--bg-secondary)' }}>
                          <td>Section Total</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(sec.total)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          <div className="card-container" style={{ marginTop: 20, textAlign: 'right' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>
              Grand Total: {formatCurrency(grandTotal)}
            </h2>
          </div>
        </>
      )}

      {!loading && !sections.length && (
        <div className="card-container" style={{ marginTop: 20 }}>
          <p className="empty-state"><i className="ri-file-search-line"></i> Select a site and click Generate to view the ledger report.</p>
        </div>
      )}
    </div>
  );
}
