'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel } from '@/lib/export-utils';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards from '@/components/SummaryCards';
import styles from './ViewSitePage.module.scss';

interface Site {
  id: string;
  name: string;
  location?: string;
  company_name?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}

interface SiteSummary {
  employee_cost: number;
  contractor_cost: number;
  material_cost: number;
  mobilization_cost: number;
  total_income: number;
  total_expense: number;
  profit: number;
}

export default function ViewSitePage() {
  const { error: notifyError } = useNotification();

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [siteSummary, setSiteSummary] = useState<SiteSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const filteredSites = useMemo(() => {
    let list = sites;
    const q = searchQuery.toLowerCase();
    if (q) {
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.location || '').toLowerCase().includes(q) ||
        (s.company_name || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      list = list.filter(s => s.status === statusFilter);
    }
    return list;
  }, [sites, searchQuery, statusFilter]);

  const summaryCards = useMemo(() => {
    const total = sites.length;
    const active = sites.filter(s => s.status === 'active').length;
    const completed = sites.filter(s => s.status === 'completed').length;
    return [
      { title: 'Total Sites', value: total, icon: 'ri-building-4-line', color: 'primary' as const },
      { title: 'Active', value: active, icon: 'ri-checkbox-circle-line', color: 'success' as const },
      { title: 'Completed', value: completed, icon: 'ri-flag-line', color: 'info' as const },
    ];
  }, [sites]);

  const loadSites = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Site[]>('/sites');
      setSites(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load sites: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const viewDetails = async (site: Site) => {
    setSelectedSite(site);
    setDetailModalOpen(true);
    setLoadingSummary(true);
    setSiteSummary(null);
    try {
      const summary = await apiGet<SiteSummary>(`/sites/${site.id}/summary`);
      setSiteSummary(summary);
    } catch {
      setSiteSummary({
        employee_cost: 0, contractor_cost: 0, material_cost: 0,
        mobilization_cost: 0, total_income: 0, total_expense: 0, profit: 0,
      });
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleExportExcel = () => {
    exportToExcel(filteredSites as any, 'sites', 'Sites', [
      { key: 'name', header: 'Site Name' },
      { key: 'location', header: 'Location' },
      { key: 'company_name', header: 'Company' },
      { key: 'status', header: 'Status' },
      { key: 'start_date', header: 'Start Date' },
      { key: 'end_date', header: 'End Date' },
    ]);
  };

  const formatCurrency = (val: number) => {
    if (!val) return '₹0.00';
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-building-4-line"></i> View Sites</h1>
        <button className="btn-secondary" onClick={handleExportExcel}>
          <i className="ri-file-excel-2-line"></i> Export
        </button>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <label>Search</label>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, location, company..." />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, marginTop: 16 }} />
      ) : (
        <div className="table-responsive" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Site Name</th>
                <th>Location</th>
                <th>Company</th>
                <th>Start Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSites.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">No sites found.</td></tr>
              ) : (
                filteredSites.map((site, i) => (
                  <tr key={site.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{site.name}</td>
                    <td>{site.location || '--'}</td>
                    <td>{site.company_name || '--'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{site.start_date || '--'}</td>
                    <td>
                      <span className={`badge ${site.status === 'active' ? 'badge-success' : site.status === 'completed' ? 'badge-info' : 'badge-warning'}`}>
                        {site.status || 'active'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-primary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => viewDetails(site)}>
                        <i className="ri-eye-line"></i> Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ModalDialog
        isOpen={detailModalOpen}
        title={`Site Details - ${selectedSite?.name || ''}`}
        size="lg"
        onClose={() => setDetailModalOpen(false)}
      >
        {selectedSite && (
          <div>
            <div className={styles.siteInfo}>
              <div><strong>Location:</strong> {selectedSite.location || '--'}</div>
              <div><strong>Company:</strong> {selectedSite.company_name || '--'}</div>
              <div><strong>Status:</strong> {selectedSite.status || 'active'}</div>
              <div><strong>Start:</strong> {selectedSite.start_date || '--'}</div>
              <div><strong>End:</strong> {selectedSite.end_date || '--'}</div>
            </div>

            {loadingSummary ? (
              <div className="skeleton" style={{ height: 120, marginTop: 16 }} />
            ) : siteSummary && (
              <div className={styles.financialGrid}>
                <h3 style={{ gridColumn: '1 / -1', margin: '16px 0 8px' }}>Financial Overview</h3>
                <div className={styles.costCard}>
                  <span className={styles.costLabel}>Employee Cost</span>
                  <span className={styles.costValue}>{formatCurrency(siteSummary.employee_cost)}</span>
                </div>
                <div className={styles.costCard}>
                  <span className={styles.costLabel}>Contractor Cost</span>
                  <span className={styles.costValue}>{formatCurrency(siteSummary.contractor_cost)}</span>
                </div>
                <div className={styles.costCard}>
                  <span className={styles.costLabel}>Material Cost</span>
                  <span className={styles.costValue}>{formatCurrency(siteSummary.material_cost)}</span>
                </div>
                <div className={styles.costCard}>
                  <span className={styles.costLabel}>Mobilization Cost</span>
                  <span className={styles.costValue}>{formatCurrency(siteSummary.mobilization_cost)}</span>
                </div>
                <div className={`${styles.costCard} ${styles.totalCard}`}>
                  <span className={styles.costLabel}>Total Expense</span>
                  <span className={styles.costValue} style={{ color: 'var(--danger)' }}>{formatCurrency(siteSummary.total_expense)}</span>
                </div>
                <div className={`${styles.costCard} ${styles.totalCard}`}>
                  <span className={styles.costLabel}>Total Income</span>
                  <span className={styles.costValue} style={{ color: 'var(--success)' }}>{formatCurrency(siteSummary.total_income)}</span>
                </div>
                <div className={`${styles.costCard} ${styles.profitCard}`} style={{ gridColumn: '1 / -1' }}>
                  <span className={styles.costLabel}>Net Profit / Loss</span>
                  <span className={styles.costValue} style={{ color: siteSummary.profit >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: 20 }}>
                    {formatCurrency(siteSummary.profit)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setDetailModalOpen(false)}>Close</button>
        </div>
      </ModalDialog>
    </div>
  );
}
