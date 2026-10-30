'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';

interface Company {
  id: string | number;
  display_id?: string;
  name: string;
  pan?: string;
  gst_number?: string;
  address?: string;
  status?: string;
}

const emptyForm = { name: '', pan: '', gst_number: '', address: '' };

const columns: TableColumn[] = [
  { key: 'display_id', label: 'Display ID', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'pan', label: 'PAN', sortable: true },
  { key: 'gst_number', label: 'GST Number', sortable: true },
  { key: 'address', label: 'Address', sortable: false },
  { key: 'status', label: 'Status', sortable: true, type: 'badge', badgeMap: { active: 'success', inactive: 'danger' } },
];

const actions: TableAction[] = [
  { label: 'Edit', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary btn-sm' },
  { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger btn-sm' },
];

export default function OfficeCompaniesPage() {
  const { apiGet, apiPost } = useApi();
  const { success, error: notifyError } = useNotification();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Company[]>('/api/companies');
      setCompanies(data);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const openAddModal = () => { setEditingCompany(null); setFormData(emptyForm); setModalOpen(true); };

  const openEditModal = (company: Company) => {
    setEditingCompany(company);
    setFormData({ name: company.name || '', pan: company.pan || '', gst_number: company.gst_number || '', address: company.address || '' });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditingCompany(null); setFormData(emptyForm); };

  const handleSave = async () => {
    if (!formData.name.trim()) { notifyError('Company name is required'); return; }
    setSaving(true);
    try {
      await apiPost('/api/approvals', {
        source: 'office', module: 'company',
        action_type: editingCompany ? 'update' : 'create',
        entity_id: editingCompany?.id || null,
        new_data: formData,
        old_data: editingCompany ? { name: editingCompany.name, pan: editingCompany.pan, gst_number: editingCompany.gst_number, address: editingCompany.address } : null,
        remarks: editingCompany ? `Updated company: ${formData.name}` : `Created new company: ${formData.name}`,
      });
      success('Request submitted for admin approval');
      closeModal();
    } catch (err: any) {
      notifyError(err.message || 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (company: Company) => {
    if (!confirm(`Submit delete request for "${company.name}"?`)) return;
    try {
      await apiPost('/api/approvals', {
        source: 'office', module: 'company', action_type: 'delete',
        entity_id: company.id, new_data: null,
        old_data: { name: company.name, pan: company.pan, gst_number: company.gst_number },
        remarks: `Delete company: ${company.name}`,
      });
      success('Delete request submitted for admin approval');
    } catch (err: any) {
      notifyError(err.message || 'Failed to submit delete request');
    }
  };

  const handleActionClick = ({ action, row }: { action: string; row: any }) => {
    if (action === 'edit') openEditModal(row);
    if (action === 'delete') handleDelete(row);
  };

  const updateField = (field: string, value: string) => { setFormData(prev => ({ ...prev, [field]: value })); };

  return (
    <div className="page-container">
      <PageHeader title="Companies" icon="ri-building-2-line">
        <button className="btn-primary" onClick={openAddModal}><i className="ri-add-line"></i> Add Company</button>
      </PageHeader>

      <div className="card-container">
        <DataTable columns={columns} data={companies} loading={loading} actions={actions} onActionClick={handleActionClick} fileName="Companies" emptyMessage="No companies found." />
      </div>

      <ModalDialog isOpen={modalOpen} title={editingCompany ? 'Edit Company' : 'Add Company'} size="md" onClose={closeModal}
        footer={<>
          <button className="btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !formData.name.trim()}>
            {saving ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </>}>
        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <div className="form-grid">
            <div className="form-group">
              <label>Company Name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" value={formData.name} onChange={e => updateField('name', e.target.value)} placeholder="Enter company name" required />
            </div>
            <div className="form-group">
              <label>PAN</label>
              <input type="text" value={formData.pan} onChange={e => updateField('pan', e.target.value.toUpperCase())} placeholder="PAN Number" maxLength={10} style={{ textTransform: 'uppercase' }} />
            </div>
            <div className="form-group">
              <label>GST Number</label>
              <input type="text" value={formData.gst_number} onChange={e => updateField('gst_number', e.target.value.toUpperCase())} placeholder="GST Number" maxLength={15} style={{ textTransform: 'uppercase' }} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Address</label>
              <textarea value={formData.address} onChange={e => updateField('address', e.target.value)} placeholder="Company address" rows={3} />
            </div>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
