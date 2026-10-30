'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import DataTable, { type TableColumn } from '@/components/DataTable';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';

interface Site { id: string; name: string; }
interface Party { id: string; name: string; }

interface MobilizationRow {
  id?: string;
  display_id?: string;
  party_name?: string;
  party_id?: string;
  site_name?: string;
  site_id?: string;
  assigned_date?: string;
  released_date?: string;
  duration_days?: number;
  rate?: number;
  total_cost?: number;
}

export default function MobilizationReportPage() {
  const { error: notifyError } = useNotification();

  const [sites, setSites] = useState<Site[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [rows, setRows] = useState<MobilizationRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterSite, setFilterSite] = useState('');
  const [filterParty, setFilterParty] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    apiGet<Site[]>('/sites').then(res => setSites(Array.isArray(res) ? res : [])).catch(() => {});
    apiGet<Party[]>('/equipment').then(res => setParties(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);
  const partyItems = useMemo(() => parties.map(p => ({ value: p.id, label: p.name })), [parties]);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterSite) params.site_id = filterSite;
      if (filterParty) params.party_id = filterParty;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const data = await apiGet<MobilizationRow[]>('/reports/mobilization', params);
      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to fetch report: ' + err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filterSite, filterParty, dateFrom, dateTo, notifyError]);

  useEffect(() => {
    generate();
  }, [generate]);

  const totalDuration = useMemo(() => rows.reduce((s, r) => s + (r.duration_days ?? 0), 0), [rows]);
  const totalCost = useMemo(() => rows.reduce((s, r) => s + (r.total_cost ?? 0), 0), [rows]);
  const avgRate = useMemo(() => {
    if (!rows.length) return 0;
    return rows.reduce((s, r) => s + (r.rate ?? 0), 0) / rows.length;
  }, [rows]);

  const summaryCards = useMemo<SummaryCard[]>(() => [
    { title: 'Total Records', value: rows.length, icon: 'ri-file-list-3-line', color: 'primary' },
    { title: 'Total Days', value: totalDuration, icon: 'ri-time-line', color: 'info' },
    { title: 'Total Cost', value: `₹${totalCost.toLocaleString('en-IN')}`, icon: 'ri-money-rupee-circle-line', color: 'success' },
    { title: 'Avg Rate', value: `₹${Math.round(avgRate).toLocaleString('en-IN')}`, icon: 'ri-bar-chart-line', color: 'warning' },
  ], [rows.length, totalDuration, totalCost, avgRate]);

  const tableData = useMemo(() => rows.map(r => ({
    ...r,
    assigned_display: r.assigned_date?.split('T')[0] ?? '--',
    released_display: r.released_date?.split('T')[0] ?? '--',
  })), [rows]);

  const columns: TableColumn[] = [
    { key: 'display_id', label: 'Display ID', sortable: true },
    { key: 'party_name', label: 'Party', sortable: true },
    { key: 'site_name', label: 'Site', sortable: true },
    { key: 'assigned_display', label: 'Assigned', sortable: true },
    { key: 'released_display', label: 'Released', sortable: true },
    { key: 'duration_days', label: 'Duration (days)', sortable: true },
    { key: 'rate', label: 'Rate', type: 'currency', sortable: true },
    { key: 'total_cost', label: 'Total Cost', type: 'currency', sortable: true },
  ];

  const clearFilters = () => {
    setFilterSite('');
    setFilterParty('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-bar-chart-box-line" /> Mobilization Report</h1>
      </div>

      <SummaryCards cards={summaryCards} />

      {/* Filters */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
            <SearchableDropdown
              items={siteItems}
              label="Site"
              placeholder="All Sites"
              value={filterSite}
              onChange={setFilterSite}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
            <SearchableDropdown
              items={partyItems}
              label="Party"
              placeholder="All Parties"
              value={filterParty}
              onChange={setFilterParty}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={generate}>
            <i className="ri-search-line" /> Generate
          </button>
          <button className="btn-secondary" onClick={clearFilters}>
            <i className="ri-filter-off-line" /> Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable
          columns={columns}
          data={tableData}
          loading={loading}
          fileName="mobilization-report"
          emptyMessage="No mobilization data found. Adjust filters and generate."
          showFooterTotals
        />
      </div>
    </div>
  );
}
