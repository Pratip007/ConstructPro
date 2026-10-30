'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import { useIndianNumber } from '@/hooks/useIndianNumber';
import DataTable, { TableColumn } from '@/components/DataTable';
import PageHeader from '@/components/PageHeader';

interface LedgerEntry {
  id?: number;
  date?: string;
  particulars?: string;
  debit?: number;
  credit?: number;
  running_balance?: number;
}

export default function SupervisorOwnLedgerPage() {
  const { apiGet } = useApi();
  const { error: notifyError } = useNotification();
  const { user } = useRole();
  const { formatCurrency } = useIndianNumber();

  const [records, setRecords] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Totals
  const totalDebit = records.reduce((sum, r) => sum + (r.debit || 0), 0);
  const totalCredit = records.reduce((sum, r) => sum + (r.credit || 0), 0);

  const loadLedger = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const qs = params.toString();
      const url = `/api/ledger/supervisor/${user.id}${qs ? `?${qs}` : ''}`;
      const data = await apiGet<LedgerEntry[]>(url);
      setRecords(data || []);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [apiGet, user?.id, fromDate, toDate, notifyError]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const columns: TableColumn[] = [
    { key: 'date', label: 'Date', type: 'date', sortable: true },
    { key: 'particulars', label: 'Particulars', sortable: true },
    { key: 'debit', label: 'Debit', type: 'currency', sortable: true },
    { key: 'credit', label: 'Credit', type: 'currency', sortable: true },
    { key: 'running_balance', label: 'Running Balance', type: 'currency', sortable: true },
  ];

  return (
    <div className="page-container">
      <PageHeader title="My Ledger" icon="ri-book-open-line" />

      {/* User Info Banner */}
      {user && (
        <div
          className="card-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 20px',
            marginBottom: 16,
            borderLeft: '4px solid var(--accent)',
          }}
        >
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--accent-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            color: 'var(--accent)',
            flexShrink: 0,
          }}>
            <i className="ri-user-line" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>{user.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              ID: {user.displayId} | Role: Supervisor
            </div>
          </div>
        </div>
      )}

      {/* Date Range Filters */}
      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <label>From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="btn-secondary"
              onClick={() => { setFromDate(''); setToDate(''); }}
              style={{ marginBottom: 0 }}
            >
              <i className="ri-refresh-line"></i> Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable
          columns={columns}
          data={records}
          loading={loading}
          fileName="Supervisor_Ledger"
          showFooterTotals
          emptyMessage="No ledger entries found."
        />

        {/* Footer Totals Summary */}
        {records.length > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 24,
            padding: '16px 20px',
            borderTop: '2px solid var(--border-color)',
            marginTop: 8,
          }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Total Debit
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                {formatCurrency(totalDebit)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Total Credit
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>
                {formatCurrency(totalCredit)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Balance
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
                {formatCurrency(totalDebit - totalCredit)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
