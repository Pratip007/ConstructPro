'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import DataTable, { type TableColumn } from '@/components/DataTable';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown from '@/components/SearchableDropdown';

export default function PayrollPage() {
  const { apiGet, apiPost } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [sites, setSites] = useState<any[]>([]);
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [siteId, setSiteId] = useState('');

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);

  useEffect(() => {
    apiGet<any[]>('/api/sites').then(d => setSites(Array.isArray(d) ? d : [])).catch(() => {});
  }, [apiGet]);

  const columns: TableColumn[] = [
    { key: 'employee_name', label: 'Employee' },
    { key: 'employee_id', label: 'Display ID' },
    { key: 'days_worked', label: 'Days Worked' },
    { key: 'daily_rate', label: 'Rate', type: 'currency' },
    { key: 'gross_pay', label: 'Gross Pay', type: 'currency' },
    { key: 'deductions', label: 'Deductions', type: 'currency' },
    { key: 'net_pay', label: 'Final Payment', type: 'currency' },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      badgeMap: {
        pending: 'warning',
        submitted: 'info',
        approved: 'success',
        held: 'danger',
      },
    },
  ];

  const bulkActions = [
    { label: 'Submit Selected', action: 'submit' },
    { label: 'Hold Selected', action: 'hold' },
  ];

  const handleGenerate = useCallback(async () => {
    if (!month) {
      notifyError('Please select a month.');
      return;
    }
    setGenerating(true);
    setLoading(true);
    try {
      const params: Record<string, string> = { month };
      if (siteId) params.site_id = siteId;
      const qs = '?' + new URLSearchParams(params).toString();
      const data = await apiGet<any[]>(`/api/payments/generate${qs}`);
      setPayrollData(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) {
        success(`Generated payroll for ${data.length} employees.`);
      } else {
        notifyError('No payroll records found for the selected criteria.');
      }
    } catch (err: any) {
      notifyError('Failed to generate payroll: ' + err.message);
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  }, [apiGet, month, siteId, success, notifyError]);

  const handleBulkAction = useCallback(async ({ action, rows }: { action: string; rows: any[] }) => {
    if (!rows.length) {
      notifyError('No rows selected.');
      return;
    }

    const ids = rows.map(r => r.id);
    const actionLabel = action === 'submit' ? 'Submit' : 'Hold';
    const ok = await confirm({
      title: `${actionLabel} Payroll`,
      message: `Are you sure you want to ${actionLabel.toLowerCase()} ${rows.length} selected payment(s)?`,
      type: action === 'hold' ? 'warning' : 'info',
      confirmText: actionLabel,
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const endpoint = action === 'submit' ? '/api/payments/submit' : '/api/payments/hold';
      await apiPost(endpoint, { payment_ids: ids });
      success(`${rows.length} payment(s) ${action === 'submit' ? 'submitted' : 'put on hold'} successfully.`);
      handleGenerate();
    } catch (err: any) {
      notifyError(`Failed to ${actionLabel.toLowerCase()}: ` + err.message);
    } finally {
      setSubmitting(false);
    }
  }, [apiPost, confirm, success, notifyError, handleGenerate]);

  const handleSelectionChange = useCallback((rows: any[]) => {
    setSelectedRows(rows);
  }, []);

  const totalGross = useMemo(() => payrollData.reduce((s, r) => s + (r.gross_pay || 0), 0), [payrollData]);
  const totalNet = useMemo(() => payrollData.reduce((s, r) => s + (r.net_pay || 0), 0), [payrollData]);
  const formatCurrency = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="page-container">
      <PageHeader title="Payroll Generation" icon="ri-wallet-3-line" />

      <div className="card-container" style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <label>Month <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={siteId}
              onChange={setSiteId}
              label="Site"
              placeholder="All Sites"
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="btn-primary"
              onClick={handleGenerate}
              disabled={generating || !month}
              style={{ height: 42 }}
            >
              <i className="ri-refresh-line"></i>
              {generating ? 'Generating...' : 'Generate Payroll'}
            </button>
          </div>
        </div>
      </div>

      {payrollData.length > 0 && (
        <div className="card-container" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Employees</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{payrollData.length}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Gross</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>{formatCurrency(totalGross)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Net Payable</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(totalNet)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Selected</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--warning)' }}>{selectedRows.length}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card-container">
        <DataTable
          columns={columns}
          data={payrollData}
          loading={loading}
          fileName="payroll"
          showFooterTotals
          selectable
          bulkActions={bulkActions}
          onBulkAction={handleBulkAction}
          onSelectionChange={handleSelectionChange}
          emptyMessage="Click Generate Payroll to load data."
        />
      </div>
    </div>
  );
}
