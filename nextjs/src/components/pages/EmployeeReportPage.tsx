'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel, printReport } from '@/lib/export-utils';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';
import DataTable from '@/components/DataTable';
import styles from './EmployeeReportPage.module.scss';

interface Site { id: string; name: string; }

const columns = [
  { key: 'display_id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'designation', label: 'Designation' },
  { key: 'category', label: 'Category' },
  { key: 'site_name', label: 'Site' },
  { key: 'phone', label: 'Phone' },
  { key: 'status', label: 'Status' },
];

export default function EmployeeReportPage() {
  const { error: notifyError } = useNotification();

  const [categoryFilter, setCategoryFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [sites, setSites] = useState<Site[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    const active = rows.filter(r => r.status === 'active').length;
    const catsCount = new Set(rows.map(r => r.category).filter(Boolean)).size;
    return [
      { title: 'Total Employees', value: rows.length, icon: 'ri-group-line', color: 'primary' },
      { title: 'Active', value: active, icon: 'ri-checkbox-circle-line', color: 'success' },
      { title: 'Inactive', value: rows.length - active, icon: 'ri-close-circle-line', color: 'danger' },
      { title: 'Categories', value: catsCount, icon: 'ri-folder-line', color: 'info' },
    ];
  }, [rows]);

  useEffect(() => {
    apiGet<Site[]>('/sites').then(res => setSites(Array.isArray(res) ? res : [])).catch(() => {});
    load();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (categoryFilter.trim()) params.category = categoryFilter.trim();
      if (siteFilter.trim()) params.site_id = siteFilter.trim();
      if (statusFilter.trim()) params.status = statusFilter.trim();
      const res = await apiGet<any[]>('/employees', params);
      const data = Array.isArray(res) ? res : [];
      setRows(data);
      const cats = new Set<string>();
      data.forEach(r => { if (r.category) cats.add(r.category); });
      setCategories([...cats].sort());
    } catch (err: any) {
      setError(err.message ?? 'Failed to load employees');
      notifyError('Failed to load employee report');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, siteFilter, statusFilter, notifyError]);

  const handleExportExcel = () => {
    exportToExcel(rows, 'employee-report', 'Employee Report', columns.map(c => ({ key: c.key, header: c.label })));
  };

  const handlePrint = () => {
    printReport('employee-report-table', 'Employee Report');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-group-line"></i> Employee Report</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleExportExcel} disabled={!rows.length}>
            <i className="ri-file-excel-2-line"></i> Export Excel
          </button>
          <button className="btn-secondary" onClick={handlePrint} disabled={!rows.length}>
            <i className="ri-printer-line"></i> Print
          </button>
          <button className="btn-primary" onClick={load} disabled={loading}>
            <i className="ri-refresh-line"></i> Refresh
          </button>
        </div>
      </div>

      {rows.length > 0 && <SummaryCards cards={summaryCards} />}

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <label>Category</label>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Site</label>
            <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}>
              <option value="">All Sites</option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="form-group" style={{ alignSelf: 'end' }}>
            <button className="btn-primary" onClick={load} disabled={loading}>
              {loading ? 'Loading...' : <><i className="ri-search-line"></i> Search</>}
            </button>
          </div>
        </div>
      </div>

      <div id="employee-report-table">
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          fileName="employee-report"
          emptyMessage="No employees found."
        />
      </div>
    </div>
  );
}
