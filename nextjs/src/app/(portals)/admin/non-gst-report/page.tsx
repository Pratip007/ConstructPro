'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import DataTable, { type TableColumn } from '@/components/DataTable';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown from '@/components/SearchableDropdown';

export default function NonGstReportPage() {
  const { apiGet } = useApi();
  const { error: notifyError } = useNotification();

  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const siteItems = useMemo(
    () => sites.map((s: any) => ({ value: s.id, label: s.name })),
    [sites]
  );

  useEffect(() => {
    apiGet<any[]>('/api/sites')
      .then(data => setSites(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [apiGet]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/retailer-bills/non-gst-report';
      const params: string[] = [];
      if (fromDate) params.push(`from=${fromDate}`);
      if (toDate) params.push(`to=${toDate}`);
      if (selectedSiteId) params.push(`site_id=${selectedSiteId}`);
      if (params.length) url += `?${params.join('&')}`;
      const data = await apiGet<any[]>(url);
      setReportData(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load Non-GST report: ' + err.message);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [apiGet, fromDate, toDate, selectedSiteId, notifyError]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const columns: TableColumn[] = [
    { key: 'bill_number', label: 'Bill No', sortable: true },
    { key: 'date', label: 'Date', type: 'date', sortable: true },
    { key: 'retailer_name', label: 'Retailer', sortable: true },
    { key: 'site_name', label: 'Site', sortable: true },
    { key: 'inv_type', label: 'Inv Type', sortable: true },
    { key: 'total_amount', label: 'Amount', type: 'currency', sortable: true },
    { key: 'paid_amount', label: 'Paid', type: 'currency', sortable: true },
    { key: 'due_amount', label: 'Due', type: 'currency', sortable: true },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: {
        DUE: 'warning',
        PAID: 'success',
        CANCELLED: 'danger',
      },
    },
  ];

  return (
    <div className="page-container">
      <PageHeader title="Non-GST Report" icon="ri-file-list-3-line" />

      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={selectedSiteId}
              onChange={(val: any) => setSelectedSiteId(val ?? '')}
              placeholder="All Sites"
              label="Site"
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
        <DataTable
          columns={columns}
          data={reportData}
          loading={loading}
          fileName="non-gst-report"
          showFooterTotals
          emptyMessage="No Non-GST bills found."
        />
      </div>
    </div>
  );
}
