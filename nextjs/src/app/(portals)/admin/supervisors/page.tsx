'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';
import PageHeader from '@/components/PageHeader';

interface Supervisor {
  id: string | number;
  display_id?: string;
  name: string;
  contact?: string;
  address?: string;
  site_id?: string | number;
  site_name?: string;
  employee_id?: string;
  status?: string;
}

interface FormData {
  name: string;
  contact: string;
  address: string;
  siteId: string;
  password: string;
  employee_id: string;
}

const emptyForm: FormData = {
  name: '',
  contact: '',
  address: '',
  siteId: '',
  password: '',
  employee_id: '',
};

const columns: TableColumn[] = [
  { key: 'display_id', label: 'Display ID', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'contact', label: 'Contact', sortable: false },
  { key: 'site_name', label: 'Assigned Site', sortable: true },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    type: 'badge',
    badgeMap: { active: 'success', inactive: 'danger' },
  },
];

const actions: TableAction[] = [
  { label: 'Edit', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary btn-sm' },
  { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger btn-sm' },
];

export default function SupervisorsPage() {
  const { apiGet, apiPost, apiPut, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const { isAdmin } = useRole();

  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [siteItems, setSiteItems] = useState<DropdownItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const loadSupervisors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Supervisor[]>('/api/supervisors');
      setSupervisors(data);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load supervisors');
    } finally {
      setLoading(false);
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

  useEffect(() => {
    loadSupervisors();
    loadSites();
  }, [loadSupervisors, loadSites]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (row: Supervisor) => {
    setEditingId(row.id);
    setForm({
      name: row.name || '',
      contact: row.contact || '',
      address: row.address || '',
      siteId: row.site_id ? String(row.site_id) : '',
      password: '',
      employee_id: row.employee_id || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      notifyError('Name is required');
      return;
    }
    if (!editingId && !form.password) {
      notifyError('Password is required for new supervisors');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, any> = {
        name: form.name.trim(),
        contact: form.contact.trim(),
        address: form.address.trim(),
        site_id: form.siteId || null,
        employee_id: form.employee_id.trim() || null,
      };
      if (form.password) {
        body.password = form.password;
      }

      if (editingId) {
        await apiPut(`/api/supervisors/${editingId}`, body);
        success('Supervisor updated successfully');
      } else {
        await apiPost('/api/supervisors', body);
        success('Supervisor created successfully');
      }
      closeModal();
      loadSupervisors();
    } catch (err: any) {
      notifyError(err.message || 'Failed to save supervisor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: Supervisor) => {
    const confirmed = await confirm({
      title: 'Delete Supervisor',
      message: `Are you sure you want to delete "${row.name}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!confirmed) return;
    try {
      await apiDelete(`/api/supervisors/${row.id}`);
      success('Supervisor deleted successfully');
      loadSupervisors();
    } catch (err: any) {
      notifyError(err.message || 'Failed to delete supervisor');
    }
  };

  const onActionClick = (event: { action: string; row: any }) => {
    if (event.action === 'edit') openEdit(event.row);
    if (event.action === 'delete') handleDelete(event.row);
  };

  const updateField = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const footer = (
    <>
      <button className="btn-secondary" onClick={closeModal}>Cancel</button>
      <button className="btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
      </button>
    </>
  );

  return (
    <div className="page-container">
      <PageHeader title="Supervisors" icon="ri-user-star-line">
        <button className="btn-primary" onClick={openAdd}>
          <i className="ri-add-line"></i> Add Supervisor
        </button>
      </PageHeader>

      <div className="card-container">
        <DataTable
          columns={columns}
          data={supervisors}
          actions={actions}
          onActionClick={onActionClick}
          loading={loading}
          fileName="Supervisors"
          emptyMessage="No supervisors found."
        />
      </div>

      <ModalDialog
        isOpen={modalOpen}
        title={editingId ? 'Edit Supervisor' : 'Add Supervisor'}
        size="md"
        onClose={closeModal}
        footer={footer}
      >
        <div className="form-grid">
          <div className="form-group">
            <label>Name <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={e => updateField('name', e.target.value)}
              placeholder="Supervisor name"
              required
            />
          </div>
          <div className="form-group">
            <label>Contact</label>
            <input
              type="tel"
              value={form.contact}
              onChange={e => updateField('contact', e.target.value)}
              placeholder="Phone number"
              maxLength={10}
            />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Address</label>
            <textarea
              value={form.address}
              onChange={e => updateField('address', e.target.value)}
              placeholder="Full address"
              rows={2}
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={form.siteId}
              onChange={(val: any) => updateField('siteId', val ?? '')}
              placeholder="Select site..."
              label="Assigned Site"
            />
          </div>
          <div className="form-group">
            <label>
              Password {!editingId && <span style={{ color: 'var(--danger)' }}>*</span>}
              {editingId && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}> (leave blank to keep current)</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => updateField('password', e.target.value)}
              placeholder={editingId ? 'Leave blank to keep current' : 'Set password'}
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label>Employee ID <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(optional link)</span></label>
            <input
              type="text"
              value={form.employee_id}
              onChange={e => updateField('employee_id', e.target.value)}
              placeholder="Link to existing employee"
            />
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
