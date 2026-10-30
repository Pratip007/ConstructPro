'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useRole } from '@/hooks/useRole';
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

interface CompanyForm {
  name: string;
  pan: string;
  gst_number: string;
  address: string;
}

const emptyForm: CompanyForm = { name: '', pan: '', gst_number: '', address: '' };

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

export default function CompaniesPage() {
  const { apiGet, apiPost, apiPut, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirmWithPassword } = useConfirmDialog();
  const { isAdmin } = useRole();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState<CompanyForm>(emptyForm);
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

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const openAddModal = () => {
    setEditingCompany(null);
    setFormData(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name || '',
      pan: company.pan || '',
      gst_number: company.gst_number || '',
      address: company.address || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCompany(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      notifyError('Company name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingCompany) {
        await apiPut(`/api/companies/${editingCompany.id}`, formData);
        success('Company updated successfully');
      } else {
        await apiPost('/api/companies', formData);
        success('Company added successfully');
      }
      closeModal();
      loadCompanies();
    } catch (err: any) {
      notifyError(err.message || 'Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (company: Company) => {
    const result = await confirmWithPassword({
      title: 'Delete Company',
      message: `Are you sure you want to delete "${company.name}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
      passwordRequired: true,
      passwordLabel: 'Enter admin password to confirm',
    });
    if (!result.confirmed) return;
    try {
      await apiDelete(`/api/companies/${company.id}`, { password: result.password });
      success('Company deleted successfully');
      loadCompanies();
    } catch (err: any) {
      notifyError(err.message || 'Failed to delete company');
    }
  };

  const handleActionClick = ({ action, row }: { action: string; row: any }) => {
    if (action === 'edit') openEditModal(row);
    if (action === 'delete') handleDelete(row);
  };

  const updateField = (field: keyof CompanyForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const modalFooter = (
    <>
      <button className="btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
      <button className="btn-primary" onClick={handleSave} disabled={saving || !formData.name.trim()}>
        {saving ? 'Saving...' : editingCompany ? 'Update Company' : 'Add Company'}
      </button>
    </>
  );

  return (
    <div className="page-container">
      <PageHeader title="Companies" icon="ri-building-2-line">
        {isAdmin && (
          <button className="btn-primary" onClick={openAddModal}>
            <i className="ri-add-line"></i> Add Company
          </button>
        )}
      </PageHeader>

      <div className="card-container">
        <DataTable
          columns={columns}
          data={companies}
          loading={loading}
          actions={isAdmin ? actions : []}
          onActionClick={handleActionClick}
          fileName="Companies"
          emptyMessage="No companies found."
        />
      </div>

      <ModalDialog
        isOpen={modalOpen}
        title={editingCompany ? 'Edit Company' : 'Add Company'}
        size="md"
        onClose={closeModal}
        footer={modalFooter}
      >
        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <div className="form-grid">
            <div className="form-group">
              <label>Company Name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="text"
                value={formData.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="Enter company name"
                required
              />
            </div>
            <div className="form-group">
              <label>PAN</label>
              <input
                type="text"
                value={formData.pan}
                onChange={e => updateField('pan', e.target.value.toUpperCase())}
                placeholder="PAN Number"
                maxLength={10}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div className="form-group">
              <label>GST Number</label>
              <input
                type="text"
                value={formData.gst_number}
                onChange={e => updateField('gst_number', e.target.value.toUpperCase())}
                placeholder="GST Number"
                maxLength={15}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Address</label>
              <textarea
                value={formData.address}
                onChange={e => updateField('address', e.target.value)}
                placeholder="Company address"
                rows={3}
              />
            </div>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
