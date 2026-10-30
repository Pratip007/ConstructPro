'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';

interface SiteLeave {
  id: number;
  employee_id?: string;
  employee_name?: string;
  site_id?: string;
  site_name?: string;
  from_date?: string;
  to_date?: string;
  days?: number;
  reason?: string;
  status?: string;
}

const emptyForm = { employee_id: '', site_id: '', from_date: '', to_date: '', reason: '' };

export default function OfficeSiteLeavesPage() {
  const { apiGet, apiPost } = useApi();
  const { success, error: notifyError } = useNotification();

  const [leaves, setLeaves] = useState<SiteLeave[]>([]);
  const [loading, setLoading] = useState(false);
  const [employeeItems, setEmployeeItems] = useState<DropdownItem[]>([]);
  const [siteItems, setSiteItems] = useState<DropdownItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterSiteId, setFilterSiteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leavesData, emps, sites] = await Promise.all([
        apiGet<SiteLeave[]>('/api/site-leaves'),
        apiGet<any[]>('/api/employees'),
        apiGet<any[]>('/api/sites'),
      ]);
      setLeaves(leavesData);
      setEmployeeItems(emps.map((e: any) => ({ value: String(e.id), label: `${e.display_id || e.id} - ${e.name}` })));
      setSiteItems(sites.map((s: any) => ({ value: String(s.id), label: s.name })));
    } catch (err: any) { notifyError(err.message || 'Failed to load data'); }
    finally { setLoading(false); }
  }, [apiGet, notifyError]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredLeaves = useMemo(() => {
    if (!filterSiteId) return leaves;
    return leaves.filter(l => String(l.site_id) === filterSiteId);
  }, [leaves, filterSiteId]);

  const columns: TableColumn[] = [
    { key: 'employee_name', label: 'Employee', sortable: true },
    { key: 'site_name', label: 'Site', sortable: true },
    { key: 'from_date', label: 'From', type: 'date', sortable: true },
    { key: 'to_date', label: 'To', type: 'date', sortable: true },
    { key: 'days', label: 'Days', sortable: true },
    { key: 'reason', label: 'Reason', sortable: false },
    { key: 'status', label: 'Status', type: 'badge', sortable: true, badgeMap: { approved: 'success', pending: 'warning', rejected: 'danger' } },
  ];

  const tableActions: TableAction[] = [
    { label: '', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger btn-sm' },
  ];

  const handleSave = async () => {
    if (!form.employee_id || !form.from_date || !form.to_date) { notifyError('Employee and dates are required'); return; }
    setSaving(true);
    try {
      await apiPost('/api/approvals', {
        source: 'office', module: 'site_leave', action_type: 'create',
        entity_id: null, new_data: form, old_data: null,
        remarks: `Site leave request for employee`,
      });
      success('Leave request submitted for approval');
      setModalOpen(false); setForm(emptyForm); loadData();
    } catch (err: any) { notifyError(err.message || 'Failed to submit'); }
    finally { setSaving(false); }
  };

  const handleAction = async (event: { action: string; row: any }) => {
    if (event.action === 'delete') {
      if (!confirm('Submit delete request for this leave?')) return;
      try {
        await apiPost('/api/approvals', {
          source: 'office', module: 'site_leave', action_type: 'delete',
          entity_id: event.row.id, new_data: null, old_data: { employee_name: event.row.employee_name },
          remarks: `Delete site leave: ${event.row.employee_name}`,
        });
        success('Delete request submitted');
      } catch (err: any) { notifyError(err.message || 'Failed'); }
    }
  };

  return (
    <div className="page-container">
      <PageHeader title="Site Leaves" icon="ri-rest-time-line">
        <button className="btn-primary" onClick={() => { setForm(emptyForm); setModalOpen(true); }}>
          <i className="ri-add-line"></i> Add Leave
        </button>
      </PageHeader>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown items={siteItems} value={filterSiteId} onChange={setFilterSiteId} placeholder="All Sites" label="Filter by Site" />
          </div>
        </div>
      </div>

      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable columns={columns} data={filteredLeaves} actions={tableActions} onActionClick={handleAction} loading={loading} fileName="Site_Leaves" emptyMessage="No leave records found." />
      </div>

      <ModalDialog isOpen={modalOpen} title="Add Site Leave" size="md" onClose={() => setModalOpen(false)}
        footer={<>
          <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !form.employee_id}>
            {saving ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </>}>
        <div className="form-grid">
          <div className="form-group"><SearchableDropdown items={employeeItems} value={form.employee_id || null} onChange={(val: any) => setForm(f => ({ ...f, employee_id: val || '' }))} placeholder="Select Employee" label="Employee" required /></div>
          <div className="form-group"><SearchableDropdown items={siteItems} value={form.site_id || null} onChange={(val: any) => setForm(f => ({ ...f, site_id: val || '' }))} placeholder="Select Site" label="Site" /></div>
          <div className="form-group"><label>From Date <span style={{ color: 'var(--danger)' }}>*</span></label><input type="date" value={form.from_date} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))} required /></div>
          <div className="form-group"><label>To Date <span style={{ color: 'var(--danger)' }}>*</span></label><input type="date" value={form.to_date} onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))} required /></div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Reason</label><textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason for leave" rows={2} /></div>
        </div>
      </ModalDialog>
    </div>
  );
}
