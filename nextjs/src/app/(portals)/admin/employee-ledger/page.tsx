'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import DataTable, { TableColumn } from '@/components/DataTable';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';
import PageHeader from '@/components/PageHeader';

interface LedgerEntry {
  date: string;
  particulars: string;
  debit: number;
  credit: number;
  running_balance: number;
}

export default function EmployeeLedgerPage() {
  const { apiGet } = useApi();
  const { error: notifyError } = useNotification();
  const role = useRole();

  const [employeeItems, setEmployeeItems] = useState<DropdownItem[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const employees = await apiGet<any[]>('/api/employees');
        setEmployeeItems(
          employees.map((e: any) => ({
            value: String(e.id),
            label: `${e.display_id ? e.display_id + ' - ' : ''}${e.name}`,
          }))
        );
      } catch (err: any) {
        notifyError(err.message || 'Failed to load employees');
      }
    })();
  }, [apiGet, notifyError]);

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
      setEntries(data);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError, selectedEmployee, fromDate, toDate]);

  useEffect(() => {
    if (selectedEmployee) {
      loadLedger();
    } else {
      setEntries([]);
    }
  }, [selectedEmployee, loadLedger]);

  const columns: TableColumn[] = [
    { key: 'date', label: 'Date', sortable: true, type: 'date' },
    { key: 'particulars', label: 'Particulars', sortable: true },
    { key: 'debit', label: 'Debit', sortable: true, type: 'currency' },
    { key: 'credit', label: 'Credit', sortable: true, type: 'currency' },
    { key: 'running_balance', label: 'Running Balance', sortable: true, type: 'currency' },
  ];

  const selectedLabel = employeeItems.find(e => e.value === selectedEmployee)?.label || '';

  return (
    <div className="page-container">
      <PageHeader title="Employee Ledger" icon="ri-book-2-line" />

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={employeeItems}
              value={selectedEmployee}
              onChange={(val: any) => setSelectedEmployee(val ?? '')}
              placeholder="Search employee..."
              label="Select Employee"
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
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="btn-primary"
              onClick={loadLedger}
              disabled={!selectedEmployee}
            >
              <i className="ri-search-line" /> Load Ledger
            </button>
          </div>
        </div>
      </div>

      {selectedEmployee && (
        <div className="card-container" style={{ marginTop: 16 }}>
          {selectedLabel && (
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>
              Ledger: {selectedLabel}
            </h3>
          )}
          <DataTable
            columns={columns}
            data={entries}
            loading={loading}
            showFooterTotals
            fileName="Employee_Ledger"
            emptyMessage="No ledger entries found for this employee."
          />
        </div>
      )}
    </div>
  );
}
