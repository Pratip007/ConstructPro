'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';

interface Contractor {
  id: number;
  display_id: string;
  name: string;
  phone: string;
  email: string;
  pan: string;
  gst_number: string;
  category: string;
  address: string;
  tds_applicable: boolean;
  tds_percent: number;
  photo: string;
  status: string;
}

const defaultForm = {
  name: '',
  phone: '',
  email: '',
  pan: '',
  gst_number: '',
  category: '',
  address: '',
  tds_applicable: false,
  tds_percent: 0,
};

export default function ContractorsPage() {
  const { apiGet, apiPost, apiPut, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirmWithPassword } = useConfirmDialog();
  const role = useRole();

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  const loadContractors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Contractor[]>('/api/contractors');
      setContractors(data);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load contractors');
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError]);

  useEffect(() => {
    loadContractors();
  }, [loadContractors]);

  const categories = useMemo(() => {
    const cats = new Set(contractors.map(c => c.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [contractors]);

  const filteredContractors = useMemo(() => {
    let result = contractors;
    if (filterStatus !== 'all') {
      result = result.filter(c => c.status === filterStatus);
    }
    if (filterCategory !== 'all') {
      result = result.filter(c => c.category === filterCategory);
    }
    return result;
  }, [contractors, filterStatus, filterCategory]);

  const columns: TableColumn[] = [
    { key: 'photo', label: 'Photo', sortable: false, type: 'image' },
    { key: 'display_id', label: 'Display ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'phone', label: 'Phone', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'pan', label: 'PAN', sortable: true },
    { key: 'gst_number', label: 'GST', sortable: true },
    { key: 'category', label: 'Category', sortable: true, type: 'badge', badgeMap: {} },
    { key: 'tds_percent', label: 'TDS%', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      type: 'badge',
      badgeMap: { active: 'success', inactive: 'danger' },
    },
  ];

  const tableActions: TableAction[] = [
    { label: 'Edit', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary btn-sm' },
    { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger btn-sm' },
  ];

  const handleAction = useCallback(async (event: { action: string; row: any }) => {
    const { action, row } = event;
    if (action === 'edit') {
      setEditingId(row.id);
      setForm({
        name: row.name ?? '',
        phone: row.phone ?? '',
        email: row.email ?? '',
        pan: row.pan ?? '',
        gst_number: row.gst_number ?? '',
        category: row.category ?? '',
        address: row.address ?? '',
        tds_applicable: row.tds_applicable ?? false,
        tds_percent: row.tds_percent ?? 0,
      });
      setAvatarFile(null);
      setModalOpen(true);
    } else if (action === 'delete') {
      const result = await confirmWithPassword({
        title: 'Delete Contractor',
        message: `Are you sure you want to delete "${row.name}"? Enter admin password to confirm.`,
        type: 'danger',
        confirmText: 'Delete',
        passwordRequired: true,
        passwordLabel: 'Admin Password',
      });
      if (!result.confirmed) return;
      try {
        await apiDelete(`/api/contractors/${row.id}`);
        success('Contractor deleted');
        loadContractors();
      } catch (err: any) {
        notifyError(err.message || 'Failed to delete contractor');
      }
    }
  }, [confirmWithPassword, apiDelete, success, notifyError, loadContractors]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(defaultForm);
    setAvatarFile(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(defaultForm);
    setAvatarFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      notifyError('Contractor name is required');
      return;
    }
    setSaving(true);
    try {
      const body: any = { ...form };
      if (avatarFile) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(avatarFile);
        });
        body.photo = base64;
      }

      if (editingId) {
        await apiPut(`/api/contractors/${editingId}`, body);
        success('Contractor updated');
      } else {
        await apiPost('/api/contractors', body);
        success('Contractor added');
      }
      closeModal();
      loadContractors();
    } catch (err: any) {
      notifyError(err.message || 'Failed to save contractor');
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const modalFooter = (
    <>
      <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
      <button type="button" className="btn-primary" disabled={saving} onClick={handleSubmit as any}>
        <i className={editingId ? 'ri-save-line' : 'ri-add-line'} />{' '}
        {saving ? 'Saving...' : editingId ? 'Update' : 'Add'} Contractor
      </button>
    </>
  );

  return (
    <div className="page-container">
      <PageHeader title="Contractors" icon="ri-group-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line" /> Add Contractor
        </button>
      </PageHeader>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <label>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="form-group">
            <label>Category</label>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable
          columns={columns}
          data={filteredContractors}
          loading={loading}
          actions={tableActions}
          onActionClick={handleAction}
          fileName="Contractors"
          emptyMessage="No contractors found."
        />
      </div>

      <ModalDialog
        isOpen={modalOpen}
        title={editingId ? 'Edit Contractor' : 'Add Contractor'}
        size="lg"
        onClose={closeModal}
        footer={modalFooter}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => updateForm('name', e.target.value)}
                placeholder="Contractor name"
                required
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => updateForm('phone', e.target.value)}
                placeholder="Phone number"
                maxLength={10}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => updateForm('email', e.target.value)}
                placeholder="Email address"
              />
            </div>
            <div className="form-group">
              <label>PAN</label>
              <input
                type="text"
                value={form.pan}
                onChange={e => updateForm('pan', e.target.value.toUpperCase())}
                placeholder="PAN number"
                maxLength={10}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div className="form-group">
              <label>GST Number</label>
              <input
                type="text"
                value={form.gst_number}
                onChange={e => updateForm('gst_number', e.target.value.toUpperCase())}
                placeholder="GST number"
                maxLength={15}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <input
                type="text"
                value={form.category}
                onChange={e => updateForm('category', e.target.value)}
                placeholder="e.g. Civil, Electrical"
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Address</label>
              <textarea
                value={form.address}
                onChange={e => updateForm('address', e.target.value)}
                placeholder="Full address"
                rows={2}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.tds_applicable}
                  onChange={e => updateForm('tds_applicable', e.target.checked)}
                />
                TDS Applicable
              </label>
            </div>
            {form.tds_applicable && (
              <div className="form-group">
                <label>TDS Percentage (%)</label>
                <input
                  type="number"
                  value={form.tds_percent}
                  onChange={e => updateForm('tds_percent', parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 2"
                  min={0}
                  max={100}
                  step={0.1}
                />
              </div>
            )}
            <div className="form-group">
              <label>Photo / Avatar</label>
              <input
                type="file"
                accept="image/*"
                onChange={e => setAvatarFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
