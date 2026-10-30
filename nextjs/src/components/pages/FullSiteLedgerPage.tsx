'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel, printReport } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';
import styles from './FullSiteLedgerPage.module.scss';

interface Site { id: string; name: string; }
interface Company { id: string; name: string; }
interface SectionData {
  label: string;
  key: string;
  items: any[];
  total: number;
}

export default function FullSiteLedgerPage() {
  const { error: notifyError } = useNotification();

  const [companyId, setCompanyId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [sitesLoading, setSitesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);

  const companyItems = useMemo(() => companies.map(c => ({ value: c.id, label: c.name })), [companies]);
  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    if (!sections.length) return [];
    const cards: SummaryCard[] = sections.map(s => ({
      title: s.label, value: s.total, icon: 'ri-folder-line', color: 'info' as const, prefix: '₹',
    }));
    cards.push({ title: 'Grand Total', value: grandTotal, icon: 'ri-wallet-line', color: 'success', prefix: '₹' });
    return cards;
  }, [sections, grandTotal]);

  useEffect(() => {
    setSitesLoading(true);
    apiGet<Site[]>('/sites').then(res => { setSites(Array.isArray(res) ? res : []); setSitesLoading(false); }).catch(() => setSitesLoading(false));
    apiGet<Company[]>('/companies').then(res => setCompanies(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const search = useCallback(async () => {
    if (!siteId) { notifyError('Please select a site'); return; }
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { site_id: siteId };
      if (companyId) params.company_id = companyId;
      const res = await apiGet<any>('/reports/site-ledger', params);
      if (res?.sections) {
        const sectionLabels: Record<string, string> = {
          employee: 'Employee', mobilization: 'Mobilization', retailer: 'Retailer', contractor: 'Contractor',
        };
        const parsedSections: SectionData[] = [];
        Object.entries(res.sections).forEach(([key, items]: [string, any]) => {
          const list = Array.isArray(items) ? items : [];
          const total = list.reduce((s: number, item: any) => s + (item.amount ?? item.total ?? 0), 0);
          parsedSections.push({ label: sectionLabels[key] ?? key, key, items: list, total });
        });
        setSections(parsedSections);
        setGrandTotal(typeof res.grandTotal === 'number' ? res.grandTotal : parsedSections.reduce((s, sec) => s + sec.total, 0));
      } else {
        setSections([]);
        setGrandTotal(0);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to load ledger');
      notifyError('Failed to load site ledger');
    } finally {
      setLoading(false);
    }
  }, [siteId, companyId, notifyError]);

  const handleExportExcel = () => {
    const allRows: any[] = [];
    sections.forEach(sec => {
      sec.items.forEach(item => { allRows.push({ section: sec.label, ...item }); });
    });
    exportToExcel(allRows as any[], 'full-site-ledger', 'Full Site Ledger', [
      { key: 'section', header: 'Section' },
      { key: 'month', header: 'Month' },
      { key: 'particulars', header: 'Particulars' },
      { key: 'debit', header: 'Debit' },
      { key: 'credit', header: 'Credit' },
      { key: 'amount', header: 'Amount' },
    ]);
  };

  const handlePrint = () => {
    printReport('site-ledger-table', 'Full Site Ledger');
  };

  const fmt = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-book-open-line"></i> Full Site Ledger</h1>
        <div className="header-actions">
          <button className="btn-export" onClick={handleExportExcel} disabled={!sections.length}>
            <i className="ri-file-excel-2-line"></i> Export Excel
          </button>
          <button className="btn-secondary" onClick={handlePrint} disabled={!sections.length}>
            <i className="ri-printer-line"></i> Print
          </button>
        </div>
      </div>

      {sections.length > 0 && <SummaryCards cards={summaryCards} />}

      <div className="card-container">
        <div className="table-toolbar">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
              <label>Company</label>
              <SearchableDropdown items={companyItems} value={companyId} onChange={setCompanyId} placeholder="All Companies" />
            </div>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
              <label>Site *</label>
              <SearchableDropdown items={siteItems} value={siteId} onChange={setSiteId} placeholder="Select Site" />
            </div>
            <button className="btn-primary" onClick={search} disabled={loading || sitesLoading} style={{ height: 38 }}>
              {loading ? 'Loading...' : <><i className="ri-search-line"></i> Search</>}
            </button>
          </div>
        </div>
        {error && <p style={{ color: 'var(--danger)', marginTop: 8 }}>{error}</p>}
      </div>

      {sections.length > 0 ? (
        <div id="site-ledger-table">
          {sections.map(sec => (
            <div className="card-container" style={{ marginTop: 16 }} key={sec.key}>
              <h3 style={{ margin: '0 0 12px', color: 'var(--text-main)' }}>
                <i className="ri-folder-line"></i> {sec.label}
              </h3>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr><th>#</th><th>Month</th><th>Particulars</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
                  </thead>
                  <tbody>
                    {sec.items.length === 0 ? (
                      <tr><td colSpan={4} className="empty-state">No entries in this section.</td></tr>
                    ) : sec.items.map((item, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{item.month ?? '-'}</td>
                        <td>{item.particulars ?? item.description ?? '-'}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(item.amount ?? item.total ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, background: 'var(--bg-card)', borderTop: '2px solid var(--border-color)' }}>
                      <td colSpan={3}>Section Total</td>
                      <td style={{ textAlign: 'right' }}>{fmt(sec.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}

          <div className={styles.grandTotalCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Grand Total</h3>
              <span style={{ fontSize: 24, fontWeight: 800 }}>{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>
      ) : !loading ? (
        <div className="card-container" style={{ marginTop: 16 }}>
          <p className="empty-state">Select a site and search to view the ledger.</p>
        </div>
      ) : null}
    </div>
  );
}
