'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import DataTable, { type TableColumn } from '@/components/DataTable';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown from '@/components/SearchableDropdown';

export default function RetailerLedgerPage() {
  const { apiGet } = useApi();
  const { error: notifyError } = useNotification();

  const [retailers, setRetailers] = useState<any[]>([]);
  const [selectedRetailerId, setSelectedRetailerId] = useState<string>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const retailerItems = useMemo(
    () => retailers.map((r: any) => ({ value: r.id, label: r.name })),
    [retailers]
  );

  const selectedRetailerName = useMemo(
    () => retailers.find((r: any) => r.id === selectedRetailerId)?.name ?? '',
    [retailers, selectedRetailerId]
  );

  useEffect(() => {
    apiGet<any[]>('/api/retailers')
      .then(data => setRetailers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [apiGet]);

  const loadLedger = useCallback(async () => {
    if (!selectedRetailerId) {
      setLedgerData([]);
      return;
    }
    setLoading(true);
    try {
      let url = `/api/ledger/retailer/${selectedRetailerId}`;
      const params: string[] = [];
      if (fromDate) params.push(`from=${fromDate}`);
      if (toDate) params.push(`to=${toDate}`);
      if (params.length) url += `?${params.join('&')}`;
      const data = await apiGet<any[]>(url);
      setLedgerData(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load ledger: ' + err.message);
      setLedgerData([]);
    } finally {
      setLoading(false);
    }
  }, [apiGet, selectedRetailerId, fromDate, toDate, notifyError]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const columns: TableColumn[] = [
    { key: 'date', label: 'Date', type: 'date', sortable: true },
    { key: 'particulars', label: 'Particulars', sortable: true },
    { key: 'debit', label: 'Debit', type: 'currency', sortable: true },
    { key: 'credit', label: 'Credit', type: 'currency', sortable: true },
    { key: 'balance', label: 'Balance', type: 'currency', sortable: true },
  ];

  return (
    <div className="page-container">
      <PageHeader
        title={selectedRetailerName ? `Retailer Ledger - ${selectedRetailerName}` : 'Retailer Ledger'}
        icon="ri-book-2-line"
      />

      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={retailerItems}
              value={selectedRetailerId}
              onChange={(val: any) => setSelectedRetailerId(val ?? '')}
              placeholder="Select Retailer..."
              label="Retailer"
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
        {!selectedRetailerId ? (
          <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
            <i className="ri-user-search-line" style={{ fontSize: 48, color: 'var(--text-muted)' }} />
            <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Select a retailer to view their ledger</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={ledgerData}
            loading={loading}
            fileName={`retailer-ledger-${selectedRetailerName || 'export'}`}
            showFooterTotals
            emptyMessage="No ledger entries found."
          />
        )}
      </div>
    </div>
  );
}
