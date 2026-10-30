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

const columns: TableColumn[] = [
  { key: 'date', label: 'Date', sortable: true, type: 'date' },
  { key: 'particulars', label: 'Particulars', sortable: true },
  { key: 'debit', label: 'Debit', sortable: true, type: 'currency' },
  { key: 'credit', label: 'Credit', sortable: true, type: 'currency' },
  { key: 'running_balance', label: 'Running Balance', sortable: true, type: 'currency' },
];

export default function SupervisorLedgerPage() {
  const { apiGet } = useApi();
  const { error: notifyError } = useNotification();
  const role = useRole();

  const [supervisorItems, setSupervisorItems] = useState<DropdownItem[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSupervisors = useCallback(async () => {
    try {
      const data = await apiGet<{ id: string | number; name: string }[]>('/api/supervisors');
      setSupervisorItems(data.map(s => ({ value: String(s.id), label: s.name })));
    } catch (err: any) {
      notifyError(err.message || 'Failed to load supervisors');
    }
  }, [apiGet, notifyError]);

  useEffect(() => {
    loadSupervisors();
  }, [loadSupervisors]);

  const loadLedger = useCallback(async () => {
    if (!selectedSupervisor) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const qs = params.toString();
      const url = `/api/ledger/supervisor/${selectedSupervisor}${qs ? `?${qs}` : ''}`;
      const data = await apiGet<LedgerEntry[]>(url);
      setEntries(data);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load ledger');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [apiGet, selectedSupervisor, fromDate, toDate, notifyError]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  return (
    <div className="page-container">
      <PageHeader title="Supervisor Ledger" icon="ri-book-2-line" />

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={supervisorItems}
              value={selectedSupervisor}
              onChange={(val: any) => setSelectedSupervisor(val ?? '')}
              placeholder="Select supervisor..."
              label="Supervisor"
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

      <div className="card-container" style={{ marginTop: 20 }}>
        {selectedSupervisor ? (
          <DataTable
            columns={columns}
            data={entries}
            loading={loading}
            showFooterTotals={true}
            fileName="Supervisor_Ledger"
            emptyMessage="No ledger entries found for this supervisor."
          />
        ) : (
          <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <i className="ri-book-2-line" style={{ fontSize: 48, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }}></i>
            <p style={{ color: 'var(--text-muted)' }}>Select a supervisor to view their ledger</p>
          </div>
        )}
      </div>
    </div>
  );
}
