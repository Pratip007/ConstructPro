'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel, printReport } from '@/lib/export-utils';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';
import DataTable from '@/components/DataTable';

const columns = [
  { key: 'display_id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'site_name', label: 'Site' },
  { key: 'designation', label: 'Designation' },
  { key: 'fund_balance', label: 'Fund Balance' },
  { key: 'status', label: 'Status' },
];

export default function SupervisorReportPage() {
  const { error: notifyError } = useNotification();

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    const totalFund = rows.reduce((s, r) => s + (r.fund_balance ?? 0), 0);
    const active = rows.filter(r => r.status === 'active').length;
    return [
      { title: 'Supervisors', value: rows.length, icon: 'ri-shield-user-line', color: 'primary' },
      { title: 'Active', value: active, icon: 'ri-checkbox-circle-line', color: 'success' },
      { title: 'Inactive', value: rows.length - active, icon: 'ri-close-circle-line', color: 'danger' },
      { title: 'Total Fund', value: totalFund, icon: 'ri-wallet-line', color: 'info', prefix: '₹' },
    ];
  }, [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      const res = await apiGet<any[]>('/supervisors', params);
      const data = Array.isArray(res) ? res : [];
      const enriched = data.map(s => ({ ...s, fund_balance: s.fund_balance ?? 0 }));
      setRows(enriched);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load supervisors');
      notifyError('Failed to load supervisor report');
    } finally {
      setLoading(false);
    }
  }, [search, notifyError]);

  useEffect(() => { load(); }, []);

  const handleExportExcel = () => {
    exportToExcel(rows, 'supervisor-report', 'Supervisor Report', columns.map(c => ({ key: c.key, header: c.label })));
  };

  const handlePrint = () => {
    printReport('supervisor-report-table', 'Supervisor Report');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-shield-user-line"></i> Supervisor Report</h1>
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

      <div id="supervisor-report-table">
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          fileName="supervisor-report"
          emptyMessage="No supervisors found."
        />
      </div>
    </div>
  );
}
