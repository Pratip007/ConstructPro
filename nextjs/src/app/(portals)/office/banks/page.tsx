'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import DataTable, { TableColumn } from '@/components/DataTable';
import PageHeader from '@/components/PageHeader';

interface Bank {
  id: string | number;
  bank_name: string;
  branch_name?: string;
  account_number?: string;
  ifsc_code?: string;
  account_type?: string;
  holder_name?: string;
  opening_balance?: number;
}

const columns: TableColumn[] = [
  { key: 'bank_name', label: 'Bank Name', sortable: true },
  { key: 'branch_name', label: 'Branch', sortable: true },
  { key: 'account_number', label: 'Account Number', sortable: true },
  { key: 'ifsc_code', label: 'IFSC', sortable: true },
  { key: 'account_type', label: 'Account Type', sortable: true, type: 'badge', badgeMap: { savings: 'info', current: 'success' } },
  { key: 'holder_name', label: 'Holder', sortable: true },
  { key: 'opening_balance', label: 'Opening Balance', sortable: true, type: 'currency' },
];

export default function OfficeBanksPage() {
  const { apiGet } = useApi();
  const { error: notifyError } = useNotification();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBanks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Bank[]>('/api/banks');
      setBanks(data);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load banks');
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError]);

  useEffect(() => { loadBanks(); }, [loadBanks]);

  return (
    <div className="page-container">
      <PageHeader title="Banks" icon="ri-bank-line" />
      <div className="card-container">
        <DataTable columns={columns} data={banks} loading={loading} fileName="Banks" emptyMessage="No banks found. (Read-only view)" />
      </div>
    </div>
  );
}
