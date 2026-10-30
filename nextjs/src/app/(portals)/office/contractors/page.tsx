'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';

interface Contractor {
  id: number; display_id: string; name: string; phone: string; email: string;
  pan: string; gst_number: string; category: string; address: string;
  tds_applicable: boolean; tds_percent: number; status: string;
}

const defaultForm = { name: '', phone: '', email: '', pan: '', gst_number: '', category: '', address: '', tds_applicable: false, tds_percent: 0 };

export default function OfficeContractorsPage() {
  const { apiGet, apiPost } = useApi();
  const { success, error: notifyError } = useNotification();

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  const loadContractors = useCallback(async () => {
    setLoading(true);
    try { const data = await apiGet<Contractor[]>('/api/contractors'); setContractors(data); }
    catch (err: any) { notifyError(err.message || 'Failed to load contractors'); }
    finally { setLoading(false); }
  }, [apiGet, notifyError]);

  useEffect(() => { loadContractors(); }, [loadContractors]);

  const categories = useMemo(() => Array.from(new Set(contractors.map(c => c.category).filter(Boolean))).sort(), [contractors]);

  const filteredContractors = useMemo(() => {
    let result = contractors;
    if (filterStatus !== 'all') result = result.filter(c => c.status === filterStatus);
    if (filterCategory !== 'all') result = result.filter(c => c.category === filterCategory);
    return result;
  }, [contractors, filterStatus, filterCategory]);

  const columns: TableColumn[] = [
    { key: 'display_id', label: 'Display ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'phone', label: 'Phone', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'pan', label: 'PAN', sortable: true },
    { key: 'gst_number', label: 'GST', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'tds_percent', label: 'TDS%', sortable: true },
    { key: 'status', label: 'Status', sortable: true, type: 'badge', badgeMap: { active: 'success', inactive: 'danger' } },
  ];

  const tableActions: TableAction[] = [
    { label: 'Edit', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary btn-sm' },
    { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger btn-sm' },
  ];

  const handleAction = useCallback(async (event: { action: string; row: any }) => {
    const c = event.row as Contractor;
    if (event.action === 'edit') {
      setEditingId(c.id); setEditingContractor(c);
      setForm({ name: c.name ?? '', phone: c.phone ?? '', email: c.email ?? '', pan: c.pan ?? '', gst_number: c.gst_number ?? '', category: c.category ?? '', address: c.address ?? '', tds_applicable: c.tds_applicable ?? false, tds_percent: c.tds_percent ?? 0 });
      setModalOpen(true);
    } else if (event.action === 'delete') {
      if (!confirm(`Submit delete request for "${c.name}"?`)) return;
      try {
        await apiPost('/api/approvals', {
          source: 'office', module: 'contractor', action_type: 'delete',
          entity_id: c.id, new_data: null, old_data: { name: c.name },
          remarks: `Delete contractor: ${c.name}`,
        });
        success('Delete request submitted');
      } catch (err: any) { notifyError(err.message || 'Failed'); }
    }
  }, [apiPost, success, notifyError]);

  const openAddModal = () => { setEditingId(null); setEditingContractor(null); setForm(defaultForm); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingId(null); setEditingContractor(null); setForm(defaultForm); };

  const handleSave = async () => {
    if (!form.name.trim()) { notifyError('Contractor name is required'); return; }
    setSaving(true);
    try {
      await apiPost('/api/approvals', {
        source: 'office', module: 'contractor',
        action_type: editingId ? 'update' : 'create',
        entity_id: editingId || null, new_data: form,
        old_data: editingContractor ? { name: editingContractor.name, phone: editingContractor.phone } : null,
        remarks: editingId ? `Updated contractor: ${form.name}` : `Created contractor: ${form.name}`,
      });
      success('Request submitted for admin approval');
      closeModal();
    } catch (err: any) { notifyError(err.message || 'Failed to submit'); }
    finally { setSaving(false); }
  };

  const updateForm = (field: string, value: any) => { setForm(prev => ({ ...prev, [field]: value })); };

  return (
    <div className="page-container">
      <PageHeader title="Contractors" icon="ri-group-line">
        <button className="btn-primary" onClick={openAddModal}><i className="ri-add-line" /> Add Contractor</button>
      </PageHeader>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group"><label>Status</label><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
          <div className="form-group"><label>Category</label><select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}><option value="all">All</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        </div>
      </div>

      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable columns={columns} data={filteredContractors} loading={loading} actions={tableActions} onActionClick={handleAction} fileName="Contractors" emptyMessage="No contractors found." />
      </div>

      <ModalDialog isOpen={modalOpen} title={editingId ? 'Edit Contractor' : 'Add Contractor'} size="lg" onClose={closeModal}
        footer={<><button className="btn-secondary" onClick={closeModal}>Cancel</button><button className="btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Submitting...' : 'Submit for Approval'}</button></>}>
        <div className="form-grid">
          <div className="form-group"><label>Name <span style={{ color: 'var(--danger)' }}>*</span></label><input type="text" value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="Name" required /></div>
          <div className="form-group"><label>Phone</label><input type="tel" value={form.phone} onChange={e => updateForm('phone', e.target.value)} placeholder="Phone" maxLength={10} /></div>
          <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} placeholder="Email" /></div>
          <div className="form-group"><label>PAN</label><input type="text" value={form.pan} onChange={e => updateForm('pan', e.target.value.toUpperCase())} placeholder="PAN" maxLength={10} style={{ textTransform: 'uppercase' }} /></div>
          <div className="form-group"><label>GST Number</label><input type="text" value={form.gst_number} onChange={e => updateForm('gst_number', e.target.value.toUpperCase())} placeholder="GST" maxLength={15} style={{ textTransform: 'uppercase' }} /></div>
          <div className="form-group"><label>Category</label><input type="text" value={form.category} onChange={e => updateForm('category', e.target.value)} placeholder="e.g. Civil, Electrical" /></div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Address</label><textarea value={form.address} onChange={e => updateForm('address', e.target.value)} placeholder="Address" rows={2} /></div>
          <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={form.tds_applicable} onChange={e => updateForm('tds_applicable', e.target.checked)} />TDS Applicable</label></div>
          {form.tds_applicable && <div className="form-group"><label>TDS %</label><input type="number" value={form.tds_percent} onChange={e => updateForm('tds_percent', parseFloat(e.target.value) || 0)} min={0} max={100} step={0.1} /></div>}
        </div>
      </ModalDialog>
    </div>
  );
}
