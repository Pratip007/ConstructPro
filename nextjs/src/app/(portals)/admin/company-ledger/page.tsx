'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import DataTable, { type TableColumn } from '@/components/DataTable';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown from '@/components/SearchableDropdown';

interface LedgerEntry {
  id?: string;
  date: string;
  particulars: string;
  debit: number;
  credit: number;
  balance: number;
}

interface Company {
  id: string;
  name: string;
}

export default function CompanyLedgerPage() {
  const { apiGet } = useApi();
  const { error: notifyError } = useNotification();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const companyItems = useMemo(
    () => companies.map(c => ({ value: c.id, label: c.name })),
    [companies]
  );

  const selectedCompanyName = useMemo(
    () => companies.find(c => c.id === selectedCompanyId)?.name || '',
    [companies, selectedCompanyId]
  );

  const columns: TableColumn[] = useMemo(() => [
    { key: 'date', label: 'Date', type: 'date', sortable: true },
    { key: 'particulars', label: 'Particulars', sortable: true },
    { key: 'debit', label: 'Debit', type: 'currency', sortable: true },
    { key: 'credit', label: 'Credit', type: 'currency', sortable: true },
    { key: 'balance', label: 'Balance', type: 'currency', sortable: true },
  ], []);

  useEffect(() => {
    apiGet<Company[]>('/api/companies')
      .then(data => setCompanies(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [apiGet]);

  const fetchLedger = useCallback(async () => {
    if (!selectedCompanyId) {
      setLedgerData([]);
      return;
    }
    setLoading(true);
    try {
      let url = `/api/ledger/company/${selectedCompanyId}`;
      const params: string[] = [];
      if (fromDate) params.push(`from=${fromDate}`);
      if (toDate) params.push(`to=${toDate}`);
      if (params.length) url += `?${params.join('&')}`;
      const data = await apiGet<LedgerEntry[]>(url);
      setLedgerData(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load ledger: ' + err.message);
      setLedgerData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, fromDate, toDate, apiGet, notifyError]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  return (
    <div className="page-container">
      <PageHeader
        title={selectedCompanyName ? `Company Ledger - ${selectedCompanyName}` : 'Company Ledger'}
        icon="ri-book-2-line"
      />

      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={companyItems}
              value={selectedCompanyId}
              onChange={(val: any) => setSelectedCompanyId(val || '')}
              placeholder="Select Company..."
              label="Company"
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

      <div className="card-container" style={{ marginTop: 16 }}>
        {!selectedCompanyId ? (
          <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
            <i className="ri-building-2-line" style={{ fontSize: 48, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }}></i>
            <p style={{ color: 'var(--text-muted)' }}>Select a company to view its ledger</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={ledgerData}
            loading={loading}
            fileName={`company-ledger-${selectedCompanyName}`}
            showFooterTotals
            emptyMessage="No ledger entries found for the selected filters."
          />
        )}
      </div>
    </div>
  );
}
