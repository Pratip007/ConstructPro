'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { exportToExcel } from '@/lib/export-utils';
import styles from './ProductEntryPage.module.scss';

const GST_SLABS = [0, 5, 12, 18, 28];

interface StockProduct {
  id: number;
  name: string;
  unit: string;
  hsn: string;
  category: string;
  gst_percent: number;
  price: number;
}

export default function ProductEntryPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [searchQuery, setSearchQuery] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [hsn, setHsn] = useState('');
  const [category, setCategory] = useState('');
  const [gstPercent, setGstPercent] = useState(18);
  const [price, setPrice] = useState(0);

  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.hsn.toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<StockProduct[]>('/stock-products');
      setProducts(data);
    } catch (err: any) {
      notifyError('Failed to load products: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName('');
    setUnit('');
    setHsn('');
    setCategory('');
    setGstPercent(18);
    setPrice(0);
  }, []);

  const addProduct = useCallback(async () => {
    if (!name || !unit) {
      notifyError('Name and unit are required.');
      return;
    }

    if (!editingId) {
      const dup = products.find(
        p => p.name.toLowerCase() === name.toLowerCase() &&
          p.unit.toLowerCase() === unit.toLowerCase() &&
          p.price === price
      );
      if (dup) {
        notifyError(`Duplicate product: "${dup.name}" with same unit and price already exists.`);
        return;
      }
    }

    const body = { name, unit, hsn, category, gst_percent: gstPercent, price };
    setSaving(true);
    try {
      if (editingId !== null) {
        const updated = await apiPut<StockProduct>(`/stock-products/${editingId}`, body);
        setProducts(list => list.map(p => (p.id === updated.id ? updated : p)));
        success('Product updated.');
      } else {
        const created = await apiPost<StockProduct>('/stock-products', body);
        setProducts(list => [...list, created]);
        success('Product added successfully!');
      }
      resetForm();
    } catch (err: any) {
      notifyError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [name, unit, hsn, category, gstPercent, price, editingId, products, success, notifyError, resetForm]);

  const editProduct = useCallback((p: StockProduct) => {
    setEditingId(p.id);
    setName(p.name);
    setUnit(p.unit);
    setHsn(p.hsn);
    setCategory(p.category);
    setGstPercent(p.gst_percent);
    setPrice(p.price || 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const deleteProduct = useCallback(async (p: StockProduct) => {
    const ok = await confirm({
      title: 'Delete Product',
      message: `Delete "${p.name}"? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;

    try {
      await apiDelete(`/stock-products/${p.id}`);
      setProducts(list => list.filter(x => x.id !== p.id));
      success('Product deleted.');
    } catch (err: any) {
      notifyError('Failed to delete: ' + err.message);
    }
  }, [confirm, success, notifyError]);

  const handleExportExcel = useCallback(() => {
    exportToExcel(filteredProducts as any, 'products', 'Products', [
      { key: 'name', header: 'Name' },
      { key: 'unit', header: 'Unit' },
      { key: 'hsn', header: 'HSN' },
      { key: 'category', header: 'Category' },
      { key: 'price', header: 'Price (₹)' },
      { key: 'gst_percent', header: 'GST %' },
    ]);
  }, [filteredProducts]);

  const formatCurrency = (val: number) => {
    if (!val) return '--';
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{editingId ? 'Edit Product' : 'Product Entry'}</h1>
      </div>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <label>Product Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter product name" required />
          </div>
          <div className="form-group">
            <label>Unit *</label>
            <input type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="e.g., Kg, Bag, Pcs, Cft" list="unitList" required />
            <datalist id="unitList">
              <option value="Nos" />
              <option value="Kg" />
              <option value="Bag" />
              <option value="Pcs" />
              <option value="Cft" />
              <option value="Sqft" />
              <option value="MT" />
              <option value="Litre" />
              <option value="%" />
            </datalist>
          </div>
          <div className="form-group">
            <label>HSN Code</label>
            <input type="text" value={hsn} onChange={e => setHsn(e.target.value)} placeholder="HSN code" />
          </div>
          <div className="form-group">
            <label>Category</label>
            <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g., Cement, Steel" />
          </div>
          <div className="form-group">
            <label>Base Price (₹)</label>
            <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} placeholder="0.00" min={0} step={0.01} />
          </div>
          <div className="form-group">
            <label>GST %</label>
            <select value={gstPercent} onChange={e => setGstPercent(Number(e.target.value))}>
              {GST_SLABS.map(slab => (
                <option key={slab} value={slab}>{slab}%</option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.formActions} style={{ marginTop: 20 }}>
          <button className="btn-primary" onClick={addProduct} disabled={saving}>
            <i className={editingId ? 'ri-save-line' : 'ri-add-line'} />
            {saving ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
          </button>
          {editingId && (
            <button className="btn-secondary" onClick={resetForm}><i className="ri-close-line" /> Cancel</button>
          )}
          <button className="btn-secondary" onClick={handleExportExcel} style={{ marginLeft: 'auto' }}>
            <i className="ri-file-excel-2-line" /> Export Excel
          </button>
        </div>
      </div>

      <div className="card-container" style={{ marginTop: 16 }}>
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by name, category, HSN..." style={{ width: '100%' }} />
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, marginTop: 16 }} />
      ) : (
        <div className="table-responsive" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Unit</th>
                <th>HSN</th>
                <th>Category</th>
                <th className={styles.textRight}>Price (₹)</th>
                <th>GST %</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">No products found.</td></tr>
              ) : (
                filteredProducts.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.unit}</td>
                    <td><span className={styles.mono}>{p.hsn || '--'}</span></td>
                    <td>{p.category || '--'}</td>
                    <td className={`${styles.textRight} ${styles.priceCol}`}>{formatCurrency(p.price)}</td>
                    <td>{p.gst_percent}%</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className={styles.actionButtons}>
                        <button className={styles.btnIcon} onClick={() => editProduct(p)} title="Edit">
                          <i className="ri-edit-line" />
                        </button>
                        <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => deleteProduct(p)} title="Delete">
                          <i className="ri-delete-bin-line" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
