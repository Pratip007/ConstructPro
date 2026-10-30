'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel, exportToPDF, printReport } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';
import styles from './MobilizationReportPage.module.scss';

interface Site { id: string; name: string; }
interface Contractor { id: string; name: string; }
interface Equipment { id: string; name: string; }

export default function MobilizationReportPage() {
  const { error: notifyError } = useNotification();

  const [siteId, setSiteId] = useState('');
  const [partyId, setPartyId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [sites, setSites] = useState<Site[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);
  const contractorItems = useMemo(() => contractors.map(c => ({ value: c.id, label: c.name })), [contractors]);
  const equipmentItems = useMemo(() => equipmentList.map(e => ({ value: e.id, label: e.name })), [equipmentList]);

  const totalDuration = useMemo(() => rows.reduce((s, r) => s + (r.duration_days ?? 0), 0), [rows]);
  const totalCost = useMemo(() => rows.reduce((s, r) => s + (r.total_cost ?? 0), 0), [rows]);
  const avgRate = useMemo(() => {
    if (!rows.length) return 0;
    return rows.reduce((s, r) => s + (r.rate ?? 0), 0) / rows.length;
  }, [rows]);

  const summaryCards = useMemo<SummaryCard[]>(() => [
    { title: 'Total Records', value: rows.length, icon: 'ri-file-list-3-line', color: 'primary' },
    { title: 'Total Days', value: totalDuration, icon: 'ri-time-line', color: 'info' },
    { title: 'Total Cost', value: totalCost, icon: 'ri-money-rupee-circle-line', color: 'success', prefix: '₹' },
    { title: 'Avg Rate', value: Math.round(avgRate), icon: 'ri-bar-chart-line', color: 'warning', prefix: '₹' },
  ], [rows.length, totalDuration, totalCost, avgRate]);

  useEffect(() => {
    apiGet<Site[]>('/sites').then(res => setSites(Array.isArray(res) ? res : [])).catch(() => {});
    apiGet<Contractor[]>('/contractors').then(res => setContractors(Array.isArray(res) ? res : [])).catch(() => {});
    apiGet<Equipment[]>('/equipment').then(res => setEquipmentList(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const generate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (siteId) params.site_id = siteId;
      if (partyId) params.party_id = partyId;
      if (equipmentId) params.equipment_id = equipmentId;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const res = await apiGet<any[]>('/reports/mobilization', params);
      setRows(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load report');
      notifyError('Failed to load mobilization report');
    } finally {
      setLoading(false);
    }
  }, [siteId, partyId, equipmentId, dateFrom, dateTo, notifyError]);

  const handleExportExcel = () => {
    exportToExcel(rows, 'mobilization-report', 'Mobilization Report', [
      { key: 'equipment_name', header: 'Equipment' },
      { key: 'party_name', header: 'Party' },
      { key: 'site_name', header: 'Site' },
      { key: 'from_date', header: 'From' },
      { key: 'to_date', header: 'To' },
      { key: 'duration_days', header: 'Days' },
      { key: 'rate', header: 'Rate' },
      { key: 'total_cost', header: 'Total Cost' },
    ]);
  };

  const handleExportPdf = () => {
    exportToPDF({
      data: rows,
      fileName: 'Mobilization_Report',
      title: 'Mobilization Report',
      columns: [
        { key: 'equipment_name', header: 'Equipment' },
        { key: 'party_name', header: 'Party' },
        { key: 'site_name', header: 'Site' },
        { key: 'from_date', header: 'From' },
        { key: 'to_date', header: 'To' },
        { key: 'duration_days', header: 'Days' },
        { key: 'rate', header: 'Rate' },
        { key: 'total_cost', header: 'Total Cost' },
      ],
    });
  };

  const handlePrint = () => {
    printReport('mobilization-report-table', 'Mobilization Report');
  };

  const fmt = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Mobilization Report</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={handleExportExcel} disabled={!rows.length}>Excel</button>
          <button className="btn-secondary" onClick={handleExportPdf} disabled={!rows.length}>PDF</button>
          <button className="btn-secondary" onClick={handlePrint} disabled={!rows.length}>Print</button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <label>Site</label>
            <SearchableDropdown items={siteItems} value={siteId} onChange={setSiteId} placeholder="All Sites" />
          </div>
          <div className="form-group">
            <label>Party / Contractor</label>
            <SearchableDropdown items={contractorItems} value={partyId} onChange={setPartyId} placeholder="All Parties" />
          </div>
          <div className="form-group">
            <label>Equipment</label>
            <SearchableDropdown items={equipmentItems} value={equipmentId} onChange={setEquipmentId} placeholder="All Equipment" />
          </div>
          <div className="form-group">
            <label>From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="form-group" style={{ alignSelf: 'end' }}>
            <button className="btn-primary" onClick={generate} disabled={loading}>
              {loading ? 'Loading...' : 'Generate Report'}
            </button>
          </div>
        </div>
        {error && <p style={{ color: 'var(--danger)', marginTop: 8 }}>{error}</p>}
      </div>

      {rows.length > 0 ? (
        <div className="card-container" style={{ marginTop: 16 }} id="mobilization-report-table">
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Equipment</th>
                  <th>Party</th>
                  <th>Site</th>
                  <th>From</th>
                  <th>To</th>
                  <th style={{ textAlign: 'right' }}>Days</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{row.equipment_name ?? row.name ?? '-'}</td>
                    <td>{row.party_name ?? '-'}</td>
                    <td>{row.site_name ?? '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{row.from_date ?? '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{row.to_date ?? '-'}</td>
                    <td style={{ textAlign: 'right' }}>{row.duration_days ?? '-'}</td>
                    <td style={{ textAlign: 'right' }}>{'₹'}{fmt(row.rate ?? 0)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>{'₹'}{fmt(row.total_cost ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 800, background: 'var(--bg-card)', borderTop: '2px solid var(--border-color)' }}>
                  <td colSpan={6}>Total</td>
                  <td style={{ textAlign: 'right' }}>{totalDuration}</td>
                  <td></td>
                  <td style={{ textAlign: 'right' }}>{'₹'}{fmt(totalCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : !loading ? (
        <div className="card-container" style={{ marginTop: 16 }}>
          <p className="empty-state">Select filters and generate report.</p>
        </div>
      ) : null}
    </div>
  );
}
