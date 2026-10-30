'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';

interface TagRecord {
  id: number;
  employee_id?: string;
  employee_name?: string;
  from_site_id?: string;
  from_site_name?: string;
  to_site_id?: string;
  to_site_name?: string;
  tagged_date?: string;
  status?: string;
}

interface EmployeeItem {
  id: string;
  name: string;
  display_id?: string;
  current_site_id?: string;
  site_name?: string;
}

export default function SiteTaggingPage() {
  const { apiGet, apiPost } = useApi();
  const { success, error: notifyError } = useNotification();
  const { isAdmin } = useRole();
  const { confirm } = useConfirmDialog();

  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [siteItems, setSiteItems] = useState<DropdownItem[]>([]);
  const [records, setRecords] = useState<TagRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Tagging form
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [newSiteId, setNewSiteId] = useState<string | null>(null);
  const [tagDate, setTagDate] = useState(() => new Date().toISOString().split('T')[0]);

  const employeeItems = useMemo<DropdownItem[]>(() =>
    employees.map(e => ({ value: String(e.id), label: `${e.display_id || e.id} - ${e.name}` })),
  [employees]);

  const selectedEmpData = useMemo(() =>
    employees.find(e => String(e.id) === selectedEmployee),
  [employees, selectedEmployee]);

  const currentSiteName = useMemo(() => {
    if (!selectedEmpData) return '--';
    return selectedEmpData.site_name || 'Unassigned';
  }, [selectedEmpData]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, sites, tags] = await Promise.all([
        apiGet<EmployeeItem[]>('/api/employees'),
        apiGet<any[]>('/api/sites'),
        apiGet<TagRecord[]>('/api/site-tagging'),
      ]);
      setEmployees(emps);
      setSiteItems(sites.map((s: any) => ({ value: String(s.id), label: s.name })));
      setRecords(tags);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async () => {
    if (!selectedEmployee || !newSiteId || !tagDate) {
      notifyError('Please select employee, target site, and date');
      return;
    }
    if (selectedEmpData?.current_site_id && String(selectedEmpData.current_site_id) === newSiteId) {
      notifyError('Employee is already at the selected site');
      return;
    }
    setSubmitting(true);
    try {
      await apiPost('/api/site-tagging', {
        employee_id: selectedEmployee,
        from_site_id: selectedEmpData?.current_site_id || null,
        to_site_id: newSiteId,
        tagged_date: tagDate,
      });
      success('Employee site tagging completed successfully');
      setSelectedEmployee(null);
      setNewSiteId(null);
      setTagDate(new Date().toISOString().split('T')[0]);
      loadData();
    } catch (err: any) {
      notifyError(err.message || 'Failed to tag employee');
    } finally {
      setSubmitting(false);
    }
  };

  const historyColumns: TableColumn[] = [
    { key: 'employee_name', label: 'Employee', sortable: true },
    { key: 'from_site_name', label: 'From Site', sortable: true },
    { key: 'to_site_name', label: 'To Site', sortable: true },
    { key: 'tagged_date', label: 'Date', type: 'date', sortable: true },
    { key: 'status', label: 'Status', type: 'badge', sortable: true, badgeMap: {
      completed: 'success',
      pending: 'warning',
      reverted: 'danger',
    }},
  ];

  return (
    <div className="page-container">
      <PageHeader title="Employee Site Tagging" icon="ri-map-pin-line" />

      {/* Tagging Form */}
      <div className="card-container">
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
          <i className="ri-map-pin-add-line"></i> Assign Employee to Site
        </h3>
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={employeeItems}
              value={selectedEmployee}
              onChange={setSelectedEmployee}
              placeholder="Search Employee..."
              label="Select Employee"
              required
            />
          </div>
          <div className="form-group">
            <label>Current Site</label>
            <input
              type="text"
              value={currentSiteName}
              readOnly
              style={{ background: 'var(--bg-tertiary)', cursor: 'not-allowed' }}
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '1.5rem' }}>
            <i className="ri-arrow-right-line" style={{ fontSize: 24, color: 'var(--accent)' }}></i>
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={newSiteId}
              onChange={setNewSiteId}
              placeholder="Select Target Site..."
              label="New Site"
              required
            />
          </div>
          <div className="form-group">
            <label>Tag Date <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="date" value={tagDate} onChange={e => setTagDate(e.target.value)} required />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitting || !selectedEmployee || !newSiteId || !tagDate}
          >
            <i className="ri-map-pin-line"></i> {submitting ? 'Tagging...' : 'Tag Employee to Site'}
          </button>
        </div>
      </div>

      {/* History Table */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
          <i className="ri-history-line"></i> Tagging History
        </h3>
        <DataTable
          columns={historyColumns}
          data={records}
          loading={loading}
          fileName="Site_Tagging_History"
          emptyMessage="No tagging records found."
        />
      </div>
    </div>
  );
}
