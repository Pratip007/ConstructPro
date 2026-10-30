'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import DataTable, { TableColumn } from '@/components/DataTable';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';
import PageHeader from '@/components/PageHeader';

interface Supervisor {
  id: string | number;
  name: string;
  site_id?: string | number;
  site_name?: string;
}

interface TagRecord {
  id: number;
  supervisor_name?: string;
  from_site_name?: string;
  to_site_name?: string;
  tagged_date?: string;
  status?: string;
}

const historyColumns: TableColumn[] = [
  { key: 'supervisor_name', label: 'Supervisor', sortable: true },
  { key: 'from_site_name', label: 'From Site', sortable: true },
  { key: 'to_site_name', label: 'To Site', sortable: true },
  { key: 'tagged_date', label: 'Date', sortable: true, type: 'date' },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    type: 'badge',
    badgeMap: { completed: 'success', pending: 'warning', reverted: 'danger' },
  },
];

export default function SupervisorTaggingPage() {
  const { apiGet, apiPost } = useApi();
  const { success, error: notifyError } = useNotification();
  const role = useRole();

  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [siteItems, setSiteItems] = useState<DropdownItem[]>([]);
  const [supervisorItems, setSupervisorItems] = useState<DropdownItem[]>([]);

  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('');
  const [newSiteId, setNewSiteId] = useState<string>('');
  const [tagDate, setTagDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [records, setRecords] = useState<TagRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const currentSite = useMemo(() => {
    if (!selectedSupervisor) return '';
    const sup = supervisors.find(s => String(s.id) === selectedSupervisor);
    return sup?.site_name || 'Not assigned';
  }, [selectedSupervisor, supervisors]);

  const loadSupervisors = useCallback(async () => {
    try {
      const data = await apiGet<Supervisor[]>('/api/supervisors');
      setSupervisors(data);
      setSupervisorItems(data.map(s => ({ value: String(s.id), label: s.name })));
    } catch (err: any) {
      notifyError(err.message || 'Failed to load supervisors');
    }
  }, [apiGet, notifyError]);

  const loadSites = useCallback(async () => {
    try {
      const sites = await apiGet<{ id: string | number; name: string }[]>('/api/sites');
      setSiteItems(sites.map(s => ({ value: String(s.id), label: s.name })));
    } catch {
      // silent
    }
  }, [apiGet]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await apiGet<TagRecord[]>('/api/supervisor-site-tagging');
      setRecords(data);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load tagging history');
    } finally {
      setLoadingHistory(false);
    }
  }, [apiGet, notifyError]);

  useEffect(() => {
    loadSupervisors();
    loadSites();
    loadHistory();
  }, [loadSupervisors, loadSites, loadHistory]);

  const handleSubmit = async () => {
    if (!selectedSupervisor) {
      notifyError('Please select a supervisor');
      return;
    }
    if (!newSiteId) {
      notifyError('Please select a new site');
      return;
    }
    if (!tagDate) {
      notifyError('Please select a date');
      return;
    }

    setSubmitting(true);
    try {
      await apiPost('/api/supervisor-site-tagging', {
        supervisor_id: selectedSupervisor,
        site_id: newSiteId,
        tagged_date: tagDate,
      });
      success('Supervisor site tagging completed successfully');
      setSelectedSupervisor('');
      setNewSiteId('');
      setTagDate('');
      loadSupervisors();
      loadHistory();
    } catch (err: any) {
      notifyError(err.message || 'Failed to tag supervisor');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <PageHeader title="Supervisor Site Tagging" icon="ri-map-pin-user-line" />

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
            <label>Current Site</label>
            <input
              type="text"
              value={currentSite}
              readOnly
              disabled
              style={{ background: 'var(--bg-secondary, #1a1f33)', cursor: 'not-allowed' }}
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={newSiteId}
              onChange={(val: any) => setNewSiteId(val ?? '')}
              placeholder="Select new site..."
              label="New Site"
              required
            />
          </div>
          <div className="form-group">
            <label>Tag Date <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="date"
              value={tagDate}
              onChange={e => setTagDate(e.target.value)}
              required
            />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitting || !selectedSupervisor || !newSiteId || !tagDate}
          >
            <i className="ri-map-pin-line"></i>{' '}
            {submitting ? 'Tagging...' : 'Assign Site'}
          </button>
        </div>
      </div>

      <div className="card-container" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
          <i className="ri-history-line"></i> Tagging History
        </h3>
        <DataTable
          columns={historyColumns}
          data={records}
          loading={loadingHistory}
          fileName="Supervisor_Site_Tagging"
          emptyMessage="No tagging records found."
        />
      </div>
    </div>
  );
}
