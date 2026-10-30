'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useRole } from '@/hooks/useRole';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';

interface EmployeeCategory {
  id: string | number;
  display_id?: string;
  name: string;
  description?: string;
  status?: string;
}

interface CategoryForm {
  name: string;
  description: string;
}

const emptyForm: CategoryForm = { name: '', description: '' };

const columns: TableColumn[] = [
  { key: 'display_id', label: 'Display ID', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'description', label: 'Description', sortable: false },
  {
    key: 'status', label: 'Status', sortable: true, type: 'badge',
    badgeMap: { active: 'success', inactive: 'danger' },
  },
];

const actions: TableAction[] = [
  { label: 'Edit', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary btn-sm' },
  { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger btn-sm' },
];

export default function EmployeeCategoriesPage() {
  const { apiGet, apiPost, apiPut, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const { isAdmin } = useRole();

  const [categories, setCategories] = useState<EmployeeCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EmployeeCategory | null>(null);
  const [formData, setFormData] = useState<CategoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<EmployeeCategory[]>('/api/employee-categories');
      setCategories(data);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openAddModal = () => {
    setEditingCategory(null);
    setFormData(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (category: EmployeeCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || '',
      description: category.description || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCategory(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      notifyError('Category name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingCategory) {
        await apiPut(`/api/employee-categories/${editingCategory.id}`, formData);
        success('Category updated successfully');
      } else {
        await apiPost('/api/employee-categories', formData);
        success('Category added successfully');
      }
      closeModal();
      loadCategories();
    } catch (err: any) {
      notifyError(err.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: EmployeeCategory) => {
    const confirmed = await confirm({
      title: 'Delete Category',
      message: `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!confirmed) return;
    try {
      await apiDelete(`/api/employee-categories/${category.id}`);
      success('Category deleted successfully');
      loadCategories();
    } catch (err: any) {
      notifyError(err.message || 'Failed to delete category');
    }
  };

  const handleActionClick = ({ action, row }: { action: string; row: any }) => {
    if (action === 'edit') openEditModal(row);
    if (action === 'delete') handleDelete(row);
  };

  const updateField = (field: keyof CategoryForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const modalFooter = (
    <>
      <button className="btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
      <button className="btn-primary" onClick={handleSave} disabled={saving || !formData.name.trim()}>
        {saving ? 'Saving...' : editingCategory ? 'Update Category' : 'Add Category'}
      </button>
    </>
  );

  return (
    <div className="page-container">
      <PageHeader title="Employee Categories" icon="ri-award-line">
        {isAdmin && (
          <button className="btn-primary" onClick={openAddModal}>
            <i className="ri-add-line"></i> Add Category
          </button>
        )}
      </PageHeader>

      <div className="card-container">
        <DataTable
          columns={columns}
          data={categories}
          loading={loading}
          actions={isAdmin ? actions : []}
          onActionClick={handleActionClick}
          fileName="Employee_Categories"
          emptyMessage="No categories found."
        />
      </div>

      <ModalDialog
        isOpen={modalOpen}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        size="sm"
        onClose={closeModal}
        footer={modalFooter}
      >
        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Category Name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="text"
                value={formData.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="e.g. Mason, Helper, Electrician"
                required
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={e => updateField('description', e.target.value)}
                placeholder="Category description"
                rows={3}
              />
            </div>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
