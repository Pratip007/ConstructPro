'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';
import PageHeader from '@/components/PageHeader';

interface SiteLeave {
  id: number;
  employee_id: string;
  employee_name: string;
  site_id: string;
  site_name: string;
  date: string;
  type: string;
  reason: string;
}

const LEAVE_TYPES = ['casual', 'sick', 'earned', 'unpaid'];

const defaultForm = {
  employee_id: '',
  site_id: '',
  date: '',
  type: 'casual',
  reason: '',
};

export default function SiteLeavesPage() {
  const { apiGet, apiPost, apiPut, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const role = useRole();

  const [leaves, setLeaves] = useState<SiteLeave[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(defaultForm);

  // Filters
  const [filterSite, setFilterSite] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Dropdown data
  const [siteItems, setSiteItems] = useState<DropdownItem[]>([]);
  const [employeeItems, setEmployeeItems] = useState<DropdownItem[]>([]);

  const loadDropdowns = useCallback(async () => {
    try {
      const [sites, employees] = await Promise.all([
        apiGet<any[]>('/api/sites'),
        apiGet<any[]>('/api/employees'),
      ]);
      setSiteItems(sites.map((s: any) => ({ value: String(s.id), label: s.name })));
      setEmployeeItems(employees.map((e: any) => ({ value: String(e.id), label: e.name })));
    } catch (err: any) {
      notifyError(err.message || 'Failed to load dropdown data');
    }
  }, [apiGet, notifyError]);

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSite) params.set('site_id', filterSite);
      if (filterEmployee) params.set('employee_id', filterEmployee);
      if (filterMonth) params.set('month', filterMonth);
      const qs = params.toString();
      const url = `/api/site-leaves${qs ? `?${qs}` : ''}`;
      const data = await apiGet<SiteLeave[]>(url);
      setLeaves(data);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load site leaves');
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError, filterSite, filterEmployee, filterMonth]);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  const columns: TableColumn[] = [
    { key: 'employee_name', label: 'Employee', sortable: true },
    { key: 'site_name', label: 'Site', sortable: true },
    { key: 'date', label: 'Date', sortable: true, type: 'date' },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      type: 'badge',
      badgeMap: { casual: 'info', sick: 'warning', earned: 'success', unpaid: 'danger' },
    },
    { key: 'reason', label: 'Reason', sortable: false },
  ];

  const actions: TableAction[] = [
    { label: 'Edit', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary btn-sm' },
    { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger btn-sm' },
  ];

  const handleAction = useCallback(async (event: { action: string; row: any }) => {
    const { action, row } = event;
    if (action === 'edit') {
      setEditingId(row.id);
      setForm({
        employee_id: String(row.employee_id),
        site_id: String(row.site_id),
        date: row.date ?? '',
        type: row.type ?? 'casual',
        reason: row.reason ?? '',
      });
      setModalOpen(true);
    } else if (action === 'delete') {
      const ok = await confirm({
        title: 'Delete Leave Record',
        message: 'Are you sure you want to delete this leave record?',
        type: 'danger',
        confirmText: 'Delete',
      });
      if (!ok) return;
      try {
        await apiDelete(`/api/site-leaves/${row.id}`);
        success('Leave record deleted');
        loadLeaves();
      } catch (err: any) {
        notifyError(err.message || 'Failed to delete leave record');
      }
    }
  }, [confirm, apiDelete, success, notifyError, loadLeaves]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(defaultForm);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(defaultForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id || !form.site_id || !form.date) {
      notifyError('Please fill in all required fields');
      return;
    }
    try {
      if (editingId) {
        await apiPut(`/api/site-leaves/${editingId}`, form);
        success('Leave record updated');
      } else {
        await apiPost('/api/site-leaves', form);
        success('Leave record added');
      }
      closeModal();
      loadLeaves();
    } catch (err: any) {
      notifyError(err.message || 'Failed to save leave record');
    }
  };

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const modalFooter = (
    <>
      <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
      <button type="button" className="btn-primary" onClick={handleSubmit as any}>
        <i className={editingId ? 'ri-save-line' : 'ri-add-line'} />{' '}
        {editingId ? 'Update' : 'Add'} Leave
      </button>
    </>
  );

  return (
    <div className="page-container">
      <PageHeader title="Site Leaves" icon="ri-calendar-close-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line" /> Add Leave
        </button>
      </PageHeader>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={filterSite}
              onChange={(val: any) => setFilterSite(val ?? '')}
              placeholder="All Sites"
              label="Site"
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={employeeItems}
              value={filterEmployee}
              onChange={(val: any) => setFilterEmployee(val ?? '')}
              placeholder="All Employees"
              label="Employee"
            />
          </div>
          <div className="form-group">
            <label>Month</label>
            <input
              type="month"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable
          columns={columns}
          data={leaves}
          loading={loading}
          actions={actions}
          onActionClick={handleAction}
          fileName="Site_Leaves"
          emptyMessage="No leave records found."
        />
      </div>

      <ModalDialog
        isOpen={modalOpen}
        title={editingId ? 'Edit Leave Record' : 'Add Leave Record'}
        size="md"
        onClose={closeModal}
        footer={modalFooter}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <SearchableDropdown
                items={employeeItems}
                value={form.employee_id}
                onChange={(val: any) => updateForm('employee_id', val ?? '')}
                placeholder="Select Employee"
                label="Employee"
                required
              />
            </div>
            <div className="form-group">
              <SearchableDropdown
                items={siteItems}
                value={form.site_id}
                onChange={(val: any) => updateForm('site_id', val ?? '')}
                placeholder="Select Site"
                label="Site"
                required
              />
            </div>
            <div className="form-group">
              <label>Date <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="date"
                value={form.date}
                onChange={e => updateForm('date', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Leave Type</label>
              <select value={form.type} onChange={e => updateForm('type', e.target.value)}>
                {LEAVE_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Reason</label>
              <textarea
                value={form.reason}
                onChange={e => updateForm('reason', e.target.value)}
                placeholder="Leave reason"
                rows={3}
              />
            </div>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
