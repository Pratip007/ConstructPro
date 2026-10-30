'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { exportToExcel } from '@/lib/export-utils';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';
import styles from './StockViewPage.module.scss';

interface Product {
  id: string;
  name: string;
  unit: string;
  category: string;
  description: string;
  display_id?: string;
  hsn_code?: string;
  gst_rate?: number;
}

export default function StockViewPage() {
  const { success: notifySuccess, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formHsn, setFormHsn] = useState('');
  const [formGstRate, setFormGstRate] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return [...cats].sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = products;
    const q = searchQuery.toLowerCase();
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q) || (p.hsn_code || '').toLowerCase().includes(q));
    if (categoryFilter) list = list.filter(p => p.category === categoryFilter);
    return list;
  }, [products, searchQuery, categoryFilter]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    const all = products;
    const catsCount = new Set(all.map(p => p.category).filter(Boolean)).size;
    const withHsn = all.filter(p => p.hsn_code).length;
    return [
      { title: 'Total Products', value: all.length, icon: 'ri-archive-line', color: 'primary' },
      { title: 'Categories', value: catsCount, icon: 'ri-folder-line', color: 'info' },
      { title: 'With HSN', value: withHsn, icon: 'ri-barcode-line', color: 'success' },
    ];
  }, [products]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<Product[]>('/products');
      setProducts(Array.isArray(res) ? res : []);
    } catch {
      notifyError('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName(''); setFormUnit(''); setFormCategory(''); setFormDescription(''); setFormHsn(''); setFormGstRate(null);
    setShowFormModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name); setFormUnit(p.unit); setFormCategory(p.category); setFormDescription(p.description); setFormHsn(p.hsn_code ?? ''); setFormGstRate(p.gst_rate ?? null);
    setShowFormModal(true);
  };

  const saveProduct = async () => {
    if (!formName.trim() || !formUnit.trim()) { notifyError('Name and unit are required'); return; }
    setSaving(true);
    const body = { name: formName, unit: formUnit, category: formCategory, description: formDescription, hsn_code: formHsn, gst_rate: formGstRate };
    try {
      if (editingProduct) {
        const updated = await apiPut<Product>(`/products/${editingProduct.id}`, body);
        setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
        notifySuccess('Product updated');
      } else {
        const created = await apiPost<Product>('/products', body);
        setProducts(prev => [...prev, created]);
        notifySuccess('Product added');
      }
      setShowFormModal(false);
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (p: Product) => {
    const ok = await confirm({ title: 'Delete Product', message: `Delete "${p.name}"? This cannot be undone.`, confirmText: 'Delete', type: 'danger' });
    if (!ok) return;
    try {
      await apiDelete(`/products/${p.id}`);
      setProducts(prev => prev.filter(x => x.id !== p.id));
      notifySuccess('Product deleted');
    } catch {
      notifyError('Failed to delete product');
    }
  };

  const handleExportExcel = () => {
    exportToExcel(filteredProducts as any[], 'products', 'Products', [
      { key: 'name', header: 'Name' },
      { key: 'unit', header: 'Unit' },
      { key: 'category', header: 'Category' },
      { key: 'hsn_code', header: 'HSN' },
      { key: 'gst_rate', header: 'GST %' },
    ]);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-archive-line"></i> Stock / Product View</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleExportExcel} disabled={!filteredProducts.length}>
            <i className="ri-file-excel-2-line"></i> Export
          </button>
          <button className="btn-primary" onClick={openAddModal}>
            <i className="ri-add-line"></i> Add Product
          </button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <label>Search</label>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, category, HSN..." />
          </div>
          <div className="form-group">
            <label>Category</label>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, marginTop: 16 }}></div>
      ) : (
        <div className="table-responsive" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Name</th><th>Unit</th><th>Category</th><th>HSN</th><th>GST %</th><th>Description</th><th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">No products found.</td></tr>
              ) : filteredProducts.map((p, i) => (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.unit}</td>
                  <td>{p.category || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.hsn_code || '-'}</td>
                  <td>{p.gst_rate != null ? `${p.gst_rate}%` : '-'}</td>
                  <td>{p.description || '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div className={styles.actionButtons}>
                      <button className={styles.btnIcon} onClick={() => openEditModal(p)} title="Edit">
                        <i className="ri-edit-line"></i>
                      </button>
                      <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => deleteProduct(p)} title="Delete">
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ModalDialog isOpen={showFormModal} title={editingProduct ? 'Edit Product' : 'Add Product'} size="md" onClose={() => setShowFormModal(false)}>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="form-group">
            <label>Product Name *</label>
            <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Product name" />
          </div>
          <div className="form-group">
            <label>Unit *</label>
            <input type="text" value={formUnit} onChange={e => setFormUnit(e.target.value)} placeholder="e.g., Kg, Bag, Pcs" />
          </div>
          <div className="form-group">
            <label>Category</label>
            <input type="text" value={formCategory} onChange={e => setFormCategory(e.target.value)} placeholder="e.g., Cement, Steel" />
          </div>
          <div className="form-group">
            <label>HSN Code</label>
            <input type="text" value={formHsn} onChange={e => setFormHsn(e.target.value)} placeholder="HSN code" />
          </div>
          <div className="form-group">
            <label>GST Rate (%)</label>
            <input type="number" value={formGstRate ?? ''} onChange={e => setFormGstRate(e.target.value ? Number(e.target.value) : null)} placeholder="GST %" min={0} max={100} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2} placeholder="Product description" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setShowFormModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={saveProduct} disabled={saving}>
            {saving ? 'Saving...' : editingProduct ? 'Update' : 'Add Product'}
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
