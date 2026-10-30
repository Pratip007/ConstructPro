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
  { key: 'category', label: 'Category' },
  { key: 'phone', label: 'Phone' },
  { key: 'total_orders', label: 'Total Orders' },
  { key: 'total_paid', label: 'Total Paid' },
  { key: 'balance', label: 'Balance' },
  { key: 'status', label: 'Status' },
];

export default function ContractorReportPage() {
  const { error: notifyError } = useNotification();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    const totalOrders = rows.reduce((s, r) => s + (r.total_orders ?? 0), 0);
    const totalPaid = rows.reduce((s, r) => s + (r.total_paid ?? 0), 0);
    const totalBal = rows.reduce((s, r) => s + (r.balance ?? 0), 0);
    return [
      { title: 'Contractors', value: rows.length, icon: 'ri-user-settings-line', color: 'primary' },
      { title: 'Total Orders', value: totalOrders, icon: 'ri-file-list-line', color: 'info', prefix: '₹' },
      { title: 'Total Paid', value: totalPaid, icon: 'ri-checkbox-circle-line', color: 'success', prefix: '₹' },
      { title: 'Balance', value: totalBal, icon: 'ri-money-rupee-circle-line', color: totalBal > 0 ? 'danger' : 'success', prefix: '₹' },
    ];
  }, [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet<any[]>('/contractors');
      const data = Array.isArray(res) ? res : [];
      const enriched = data.map(c => ({
        ...c,
        total_orders: c.total_orders ?? 0,
        total_paid: c.total_paid ?? 0,
        balance: c.balance ?? (c.total_orders ?? 0) - (c.total_paid ?? 0),
      }));
      setRows(enriched);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load contractors');
      notifyError('Failed to load contractor report');
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { load(); }, [load]);

  const handleExportExcel = () => {
    exportToExcel(rows, 'contractor-report', 'Contractor Report', columns.map(c => ({ key: c.key, header: c.label })));
  };

  const handlePrint = () => {
    printReport('contractor-report-table', 'Contractor Report');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-user-settings-line"></i> Contractor Report</h1>
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

      {error && <p className="error-text" style={{ color: 'red', margin: '8px 0' }}>{error}</p>}

      <div id="contractor-report-table">
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          fileName="contractor-report"
          emptyMessage="No contractors found."
        />
      </div>
    </div>
  );
}
