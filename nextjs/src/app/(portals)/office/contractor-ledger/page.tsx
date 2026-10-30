'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import DataTable, { TableColumn } from '@/components/DataTable';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';
import PageHeader from '@/components/PageHeader';

interface LedgerEntry { date: string; particulars: string; debit: number; credit: number; running_balance: number; }

export default function OfficeContractorLedgerPage() {
  const { apiGet } = useApi();
  const { error: notifyError } = useNotification();

  const [contractorItems, setContractorItems] = useState<DropdownItem[]>([]);
  const [selectedContractor, setSelectedContractor] = useState<string>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const contractors = await apiGet<any[]>('/api/contractors');
        setContractorItems(contractors.map((c: any) => ({ value: String(c.id), label: `${c.display_id ? c.display_id + ' - ' : ''}${c.name}` })));
      } catch (err: any) { notifyError(err.message || 'Failed to load contractors'); }
    })();
  }, [apiGet, notifyError]);

  const loadLedger = useCallback(async () => {
    if (!selectedContractor) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const qs = params.toString();
      const data = await apiGet<LedgerEntry[]>(`/api/ledger/contractor/${selectedContractor}${qs ? `?${qs}` : ''}`);
      setEntries(data);
    } catch (err: any) { notifyError(err.message || 'Failed to load ledger'); }
    finally { setLoading(false); }
  }, [apiGet, notifyError, selectedContractor, fromDate, toDate]);

  useEffect(() => { if (selectedContractor) loadLedger(); else setEntries([]); }, [selectedContractor, loadLedger]);

  const columns: TableColumn[] = [
    { key: 'date', label: 'Date', sortable: true, type: 'date' },
    { key: 'particulars', label: 'Particulars', sortable: true },
    { key: 'debit', label: 'Debit', sortable: true, type: 'currency' },
    { key: 'credit', label: 'Credit', sortable: true, type: 'currency' },
    { key: 'running_balance', label: 'Running Balance', sortable: true, type: 'currency' },
  ];

  return (
    <div className="page-container">
      <PageHeader title="Contractor Ledger" icon="ri-book-2-line" />
      <div className="card-container">
        <div className="form-grid">
          <div className="form-group"><SearchableDropdown items={contractorItems} value={selectedContractor} onChange={(val: any) => setSelectedContractor(val ?? '')} placeholder="Search contractor..." label="Select Contractor" required /></div>
          <div className="form-group"><label>From Date</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
          <div className="form-group"><label>To Date</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn-primary" onClick={loadLedger} disabled={!selectedContractor}><i className="ri-search-line" /> Load Ledger</button>
          </div>
        </div>
      </div>
      {selectedContractor && (
        <div className="card-container" style={{ marginTop: 16 }}>
          <DataTable columns={columns} data={entries} loading={loading} showFooterTotals fileName="Contractor_Ledger" emptyMessage="No ledger entries found." />
        </div>
      )}
    </div>
  );
}
