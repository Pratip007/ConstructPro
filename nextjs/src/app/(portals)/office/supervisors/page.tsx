'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';

interface Supervisor {
  id: string | number; display_id?: string; name: string; contact?: string; address?: string;
  site_id?: string | number; site_name?: string; employee_id?: string; status?: string;
}

const emptyForm = { name: '', contact: '', address: '', siteId: '', password: '', employee_id: '' };

export default function OfficeSupervisorsPage() {
  const { apiGet, apiPost } = useApi();
  const { success, error: notifyError } = useNotification();

  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [siteItems, setSiteItems] = useState<DropdownItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editingSupervisor, setEditingSupervisor] = useState<Supervisor | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sups, sites] = await Promise.all([apiGet<Supervisor[]>('/api/supervisors'), apiGet<any[]>('/api/sites')]);
      setSupervisors(sups);
      setSiteItems(sites.map(s => ({ value: String(s.id), label: s.name })));
    } catch (err: any) { notifyError(err.message || 'Failed to load data'); }
    finally { setLoading(false); }
  }, [apiGet, notifyError]);

  useEffect(() => { loadData(); }, [loadData]);

  const columns: TableColumn[] = [
    { key: 'display_id', label: 'Display ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'contact', label: 'Contact', sortable: false },
    { key: 'site_name', label: 'Assigned Site', sortable: true },
    { key: 'status', label: 'Status', sortable: true, type: 'badge', badgeMap: { active: 'success', inactive: 'danger' } },
  ];

  const actions: TableAction[] = [
    { label: 'Edit', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary btn-sm' },
    { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger btn-sm' },
  ];

  const openAdd = () => { setEditingId(null); setEditingSupervisor(null); setForm({ ...emptyForm }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingId(null); setEditingSupervisor(null); setForm({ ...emptyForm }); };

  const handleAction = async (event: { action: string; row: any }) => {
    const sup = event.row as Supervisor;
    if (event.action === 'edit') {
      setEditingId(sup.id); setEditingSupervisor(sup);
      setForm({ name: sup.name || '', contact: sup.contact || '', address: sup.address || '', siteId: sup.site_id ? String(sup.site_id) : '', password: '', employee_id: sup.employee_id || '' });
      setModalOpen(true);
    } else if (event.action === 'delete') {
      if (!confirm(`Submit delete request for "${sup.name}"?`)) return;
      try {
        await apiPost('/api/approvals', {
          source: 'office', module: 'supervisor', action_type: 'delete',
          entity_id: sup.id, new_data: null, old_data: { name: sup.name },
          remarks: `Delete supervisor: ${sup.name}`,
        });
        success('Delete request submitted');
      } catch (err: any) { notifyError(err.message || 'Failed'); }
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { notifyError('Name is required'); return; }
    setSaving(true);
    try {
      const body: any = { name: form.name, contact: form.contact, address: form.address, site_id: form.siteId || null, employee_id: form.employee_id || null };
      if (form.password) body.password = form.password;
      await apiPost('/api/approvals', {
        source: 'office', module: 'supervisor',
        action_type: editingId ? 'update' : 'create',
        entity_id: editingId || null, new_data: body,
        old_data: editingSupervisor ? { name: editingSupervisor.name, contact: editingSupervisor.contact } : null,
        remarks: editingId ? `Updated supervisor: ${form.name}` : `Created supervisor: ${form.name}`,
      });
      success('Request submitted for admin approval');
      closeModal();
    } catch (err: any) { notifyError(err.message || 'Failed to submit'); }
    finally { setSaving(false); }
  };

  const updateField = (field: string, value: string) => { setForm(prev => ({ ...prev, [field]: value })); };

  return (
    <div className="page-container">
      <PageHeader title="Supervisors" icon="ri-user-star-line">
        <button className="btn-primary" onClick={openAdd}><i className="ri-add-line"></i> Add Supervisor</button>
      </PageHeader>

      <div className="card-container">
        <DataTable columns={columns} data={supervisors} actions={actions} onActionClick={handleAction} loading={loading} fileName="Supervisors" emptyMessage="No supervisors found." />
      </div>

      <ModalDialog isOpen={modalOpen} title={editingId ? 'Edit Supervisor' : 'Add Supervisor'} size="md" onClose={closeModal}
        footer={<><button className="btn-secondary" onClick={closeModal}>Cancel</button><button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Submitting...' : 'Submit for Approval'}</button></>}>
        <div className="form-grid">
          <div className="form-group"><label>Name <span style={{ color: 'var(--danger)' }}>*</span></label><input type="text" value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="Supervisor name" required /></div>
          <div className="form-group"><label>Contact</label><input type="tel" value={form.contact} onChange={e => updateField('contact', e.target.value)} placeholder="Phone" maxLength={10} /></div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Address</label><textarea value={form.address} onChange={e => updateField('address', e.target.value)} placeholder="Address" rows={2} /></div>
          <div className="form-group"><SearchableDropdown items={siteItems} value={form.siteId} onChange={(val: any) => updateField('siteId', val ?? '')} placeholder="Select site..." label="Assigned Site" /></div>
          <div className="form-group"><label>Password {editingId && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(leave blank to keep)</span>}</label><input type="password" value={form.password} onChange={e => updateField('password', e.target.value)} placeholder={editingId ? 'Leave blank' : 'Set password'} autoComplete="new-password" /></div>
          <div className="form-group"><label>Employee ID <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(optional)</span></label><input type="text" value={form.employee_id} onChange={e => updateField('employee_id', e.target.value)} placeholder="Link to employee" /></div>
        </div>
      </ModalDialog>
    </div>
  );
}
