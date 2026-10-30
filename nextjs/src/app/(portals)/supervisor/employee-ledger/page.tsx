'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import { useIndianNumber } from '@/hooks/useIndianNumber';
import DataTable, { TableColumn } from '@/components/DataTable';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';

interface LedgerEntry {
  id?: number;
  date?: string;
  particulars?: string;
  debit?: number;
  credit?: number;
  running_balance?: number;
}

export default function SupervisorEmployeeLedgerPage() {
  const { apiGet } = useApi();
  const { error: notifyError } = useNotification();
  const { getSiteId } = useRole();
  const { formatCurrency } = useIndianNumber();

  const siteId = getSiteId();

  const [employeeItems, setEmployeeItems] = useState<DropdownItem[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [records, setRecords] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Totals
  const totalDebit = records.reduce((sum, r) => sum + (r.debit || 0), 0);
  const totalCredit = records.reduce((sum, r) => sum + (r.credit || 0), 0);

  const loadEmployees = useCallback(async () => {
    if (!siteId) return;
    try {
      const emps = await apiGet<any[]>(`/api/employees?site_id=${siteId}`);
      setEmployeeItems(
        (emps || []).map((e: any) => ({
          value: String(e.id),
          label: `${e.display_id || e.id} - ${e.name}`,
        }))
      );
    } catch (err: any) {
      notifyError(err.message || 'Failed to load employees');
    }
  }, [apiGet, siteId, notifyError]);

  const loadLedger = useCallback(async () => {
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const qs = params.toString();
      const url = `/api/ledger/employee/${selectedEmployee}${qs ? `?${qs}` : ''}`;
      const data = await apiGet<LedgerEntry[]>(url);
      setRecords(data || []);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [apiGet, selectedEmployee, fromDate, toDate, notifyError]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (selectedEmployee) {
      loadLedger();
    } else {
      setRecords([]);
    }
  }, [selectedEmployee, loadLedger]);

  const columns: TableColumn[] = [
    { key: 'date', label: 'Date', type: 'date', sortable: true },
    { key: 'particulars', label: 'Particulars', sortable: true },
    { key: 'debit', label: 'Debit', type: 'currency', sortable: true },
    { key: 'credit', label: 'Credit', type: 'currency', sortable: true },
    { key: 'running_balance', label: 'Running Balance', type: 'currency', sortable: true },
  ];

  return (
    <div className="page-container">
      <PageHeader title="Employee Ledger" icon="ri-file-list-3-line" />

      {/* Filters */}
      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={employeeItems}
              value={selectedEmployee}
              onChange={setSelectedEmployee}
              placeholder="Select Employee..."
              label="Employee"
              required
            />
          </div>
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
        </div>
      </div>

      {/* Data Table */}
      <div className="card-container" style={{ marginTop: 16 }}>
        {!selectedEmployee ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <i className="ri-user-search-line" style={{ fontSize: 40, color: 'var(--text-muted)' }} />
            <h3>Select an Employee</h3>
            <p>Choose an employee from the dropdown above to view their ledger.</p>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={records}
              loading={loading}
              fileName="Employee_Ledger"
              showFooterTotals
              emptyMessage="No ledger entries found for selected employee."
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
          </>
        )}
      </div>
    </div>
  );
}
