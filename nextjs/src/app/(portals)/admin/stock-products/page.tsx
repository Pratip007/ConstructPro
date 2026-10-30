'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import DataTable, { type TableColumn, type TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';

const UNITS = ['nos', 'kg', 'ltr', 'mtr', 'sqft', 'bag', 'box', 'set'];
const GST_OPTIONS = [0, 5, 12, 18, 28];

interface ProductForm {
  name: string;
  unit: string;
  hsn: string;
  category: string;
  gst_percent: number;
}

const emptyForm = (): ProductForm => ({
  name: '',
  unit: 'nos',
  hsn: '',
  category: '',
  gst_percent: 18,
});

export default function StockProductsPage() {
  const { apiGet, apiPost, apiPut, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm());

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<any[]>('/api/stock-products');
      setProducts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load products: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const columns: TableColumn[] = [
    { key: 'display_id', label: 'Display ID' },
    { key: 'name', label: 'Name' },
    { key: 'unit', label: 'Unit' },
    { key: 'hsn', label: 'HSN' },
    { key: 'category', label: 'Category' },
    { key: 'gst_percent', label: 'GST%' },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      badgeMap: {
        active: 'success',
        inactive: 'danger',
      },
    },
  ];

  const actions: TableAction[] = [
    { label: '', icon: 'ri-edit-line', action: 'edit', class: 'btn-primary' },
    { label: '', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger' },
  ];

  const updateForm = (field: keyof ProductForm, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEditModal = (row: any) => {
    setEditingId(row.id);
    setForm({
      name: row.name || '',
      unit: row.unit || 'nos',
      hsn: row.hsn || '',
      category: row.category || '',
      gst_percent: row.gst_percent ?? 18,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      notifyError('Product name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        unit: form.unit,
        hsn: form.hsn.trim(),
        category: form.category.trim(),
        gst_percent: form.gst_percent,
      };
      if (editingId) {
        await apiPut(`/api/stock-products/${editingId}`, payload);
        success('Product updated successfully.');
      } else {
        await apiPost('/api/stock-products', payload);
        success('Product created successfully.');
      }
      setModalOpen(false);
      loadProducts();
    } catch (err: any) {
      notifyError('Failed to save product: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: any) => {
    const ok = await confirm({
      title: 'Delete Product',
      message: `Are you sure you want to delete "${row.name}"?`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/stock-products/${row.id}`);
      success('Product deleted.');
      loadProducts();
    } catch (err: any) {
      notifyError('Failed to delete: ' + err.message);
    }
  };

  const handleAction = ({ action, row }: { action: string; row: any }) => {
    if (action === 'edit') openEditModal(row);
    if (action === 'delete') handleDelete(row);
  };

  return (
    <div className="page-container">
      <PageHeader title="Stock Products" icon="ri-store-3-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line"></i> Add Product
        </button>
      </PageHeader>

      <div className="card-container">
        <DataTable
          columns={columns}
          data={products}
          loading={loading}
          actions={actions}
          onActionClick={handleAction}
          fileName="stock-products"
        />
      </div>

      <ModalDialog
        isOpen={modalOpen}
        title={editingId ? 'Edit Product' : 'Add Product'}
        size="md"
        onClose={() => setModalOpen(false)}
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Product Name <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={e => updateForm('name', e.target.value)}
              placeholder="Enter product name"
              required
            />
          </div>
          <div className="form-group">
            <label>Unit</label>
            <select value={form.unit} onChange={e => updateForm('unit', e.target.value)}>
              {UNITS.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>HSN Code</label>
            <input
              type="text"
              value={form.hsn}
              onChange={e => updateForm('hsn', e.target.value)}
              placeholder="e.g. 7308"
            />
          </div>
          <div className="form-group">
            <label>Category</label>
            <input
              type="text"
              value={form.category}
              onChange={e => updateForm('category', e.target.value)}
              placeholder="e.g. Cement, Steel"
            />
          </div>
          <div className="form-group">
            <label>GST %</label>
            <select value={form.gst_percent} onChange={e => updateForm('gst_percent', Number(e.target.value))}>
              {GST_OPTIONS.map(g => (
                <option key={g} value={g}>{g}%</option>
              ))}
            </select>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
