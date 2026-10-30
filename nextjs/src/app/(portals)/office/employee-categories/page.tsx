'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';

interface Category {
  id: string | number;
  name: string;
  description?: string;
  status?: string;
}

const emptyForm = { name: '', description: '' };

export default function OfficeEmployeeCategoriesPage() {
  const { apiGet, apiPost } = useApi();
  const { success, error: notifyError } = useNotification();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Category[]>('/api/employee-categories');
      setCategories(data);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const columns: TableColumn[] = [
    { key: 'name', label: 'Category Name', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
    { key: 'status', label: 'Status', sortable: true, type: 'badge', badgeMap: { active: 'success', inactive: 'danger' } },
  ];

  const actions: TableAction[] = [
    { label: 'Edit', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary btn-sm' },
    { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger btn-sm' },
  ];

  const openAddModal = () => { setEditingCat(null); setFormData(emptyForm); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingCat(null); setFormData(emptyForm); };

  const openEditModal = (cat: Category) => {
    setEditingCat(cat);
    setFormData({ name: cat.name || '', description: cat.description || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { notifyError('Category name is required'); return; }
    setSaving(true);
    try {
      await apiPost('/api/approvals', {
        source: 'office', module: 'employee_category',
        action_type: editingCat ? 'update' : 'create',
        entity_id: editingCat?.id || null,
        new_data: formData,
        old_data: editingCat ? { name: editingCat.name, description: editingCat.description } : null,
        remarks: editingCat ? `Updated category: ${formData.name}` : `Created category: ${formData.name}`,
      });
      success('Request submitted for admin approval');
      closeModal();
    } catch (err: any) {
      notifyError(err.message || 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Submit delete request for "${cat.name}"?`)) return;
    try {
      await apiPost('/api/approvals', {
        source: 'office', module: 'employee_category', action_type: 'delete',
        entity_id: cat.id, new_data: null, old_data: { name: cat.name },
        remarks: `Delete category: ${cat.name}`,
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

  return (
    <div className="page-container">
      <PageHeader title="Employee Categories" icon="ri-group-line">
        <button className="btn-primary" onClick={openAddModal}><i className="ri-add-line"></i> Add Category</button>
      </PageHeader>

      <div className="card-container">
        <DataTable columns={columns} data={categories} loading={loading} actions={actions} onActionClick={handleActionClick} fileName="Employee_Categories" emptyMessage="No categories found." />
      </div>

      <ModalDialog isOpen={modalOpen} title={editingCat ? 'Edit Category' : 'Add Category'} size="sm" onClose={closeModal}
        footer={<>
          <button className="btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !formData.name.trim()}>
            {saving ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </>}>
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Category Name <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="Category name" required />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Description</label>
            <textarea value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="Description" rows={2} />
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
