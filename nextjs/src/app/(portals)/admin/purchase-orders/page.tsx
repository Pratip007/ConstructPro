'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown from '@/components/SearchableDropdown';

interface PoItem {
  product: string;
  hsn: string;
  unit: string;
  qty: number;
  price: number;
  gst_percent: number;
  base_total: number;
  gst_amount: number;
  line_total: number;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  date: string;
  site_id: string;
  site_name?: string;
  retailer_id: string;
  retailer_name?: string;
  items: PoItem[];
  total_base: number;
  total_gst: number;
  grand_total: number;
  status: string;
}

const emptyItem = (): PoItem => ({
  product: '', hsn: '', unit: '', qty: 0, price: 0, gst_percent: 18,
  base_total: 0, gst_amount: 0, line_total: 0,
});

const GST_OPTIONS = [0, 5, 12, 18, 28];

function formatINR(val: number): string {
  if (!val) return '--';
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PurchaseOrdersPage() {
  const { apiGet, apiPost, apiPut, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterSiteId, setFilterSiteId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);

  // Form fields
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formSiteId, setFormSiteId] = useState('');
  const [formRetailerId, setFormRetailerId] = useState('');
  const [formItems, setFormItems] = useState<PoItem[]>([emptyItem()]);

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);
  const retailerItems = useMemo(() => retailers.map(r => ({ value: r.id, label: r.name })), [retailers]);
  const productItems = useMemo(() => products.map(p => ({ value: p.name, label: `${p.name} (${p.unit || ''})` })), [products]);

  const totalBase = useMemo(() => formItems.reduce((s, it) => s + it.base_total, 0), [formItems]);
  const totalGst = useMemo(() => formItems.reduce((s, it) => s + it.gst_amount, 0), [formItems]);
  const grandTotal = useMemo(() => Math.round((totalBase + totalGst) * 100) / 100, [totalBase, totalGst]);

  const loadMasters = useCallback(async () => {
    try {
      const [s, r, p] = await Promise.all([
        apiGet<any[]>('/api/sites'),
        apiGet<any[]>('/api/retailers'),
        apiGet<any[]>('/api/stock-products'),
      ]);
      setSites(Array.isArray(s) ? s : []);
      setRetailers(Array.isArray(r) ? r : []);
      setProducts(Array.isArray(p) ? p : []);
    } catch { /* ignore */ }
  }, [apiGet]);

  const loadPurchaseOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterSiteId) params.site_id = filterSiteId;
      if (filterStatus) params.status = filterStatus;
      const query = new URLSearchParams(params).toString();
      const url = query ? `/api/purchase-orders?${query}` : '/api/purchase-orders';
      const data = await apiGet<PurchaseOrder[]>(url);
      setPurchaseOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load purchase orders: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [apiGet, filterSiteId, filterStatus, notifyError]);

  useEffect(() => { loadMasters(); }, [loadMasters]);
  useEffect(() => { loadPurchaseOrders(); }, [loadPurchaseOrders]);

  const columns: TableColumn[] = [
    { key: 'po_number', label: 'Display ID', sortable: true },
    { key: 'date', label: 'Date', type: 'date', sortable: true },
    { key: 'site_name', label: 'Site', sortable: true },
    { key: 'retailer_name', label: 'Retailer', sortable: true },
    { key: 'total_base', label: 'Base Amount', type: 'currency' },
    { key: 'total_gst', label: 'GST', type: 'currency' },
    { key: 'grand_total', label: 'Net Amount', type: 'currency' },
    { key: 'status', label: 'Status', type: 'badge', badgeMap: { active: 'success', completed: 'info', cancelled: 'danger', Active: 'success', Completed: 'info', Cancelled: 'danger' } },
  ];

  const actions: TableAction[] = [
    { label: 'View', icon: 'ri-eye-line', action: 'view' },
    { label: 'Edit', icon: 'ri-edit-line', action: 'edit' },
    { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger' },
  ];

  const updateItem = (index: number, field: keyof PoItem, value: any) => {
    setFormItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'product') {
        const prod = products.find(p => p.name === value);
        if (prod) {
          item.hsn = prod.hsn || '';
          item.unit = prod.unit || '';
          item.gst_percent = prod.gst_percent ?? 18;
          if (prod.price) item.price = prod.price;
        }
      }

      item.base_total = Math.round(item.qty * item.price * 100) / 100;
      item.gst_amount = Math.round(item.base_total * item.gst_percent / 100 * 100) / 100;
      item.line_total = Math.round((item.base_total + item.gst_amount) * 100) / 100;
      updated[index] = item;
      return updated;
    });
  };

  const addItem = () => setFormItems(prev => [...prev, emptyItem()]);
  const removeItem = (index: number) => {
    if (formItems.length <= 1) return;
    setFormItems(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setEditingId(null);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormSiteId('');
    setFormRetailerId('');
    setFormItems([emptyItem()]);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (po: PurchaseOrder) => {
    setEditingId(po.id);
    setFormDate(po.date?.split('T')[0] || '');
    setFormSiteId(po.site_id || '');
    setFormRetailerId(po.retailer_id || '');
    setFormItems(po.items?.length ? po.items.map(it => ({
      ...it,
      base_total: it.base_total ?? (it.qty * it.price),
      gst_amount: it.gst_amount ?? ((it.qty * it.price) * it.gst_percent / 100),
      line_total: it.line_total ?? ((it.qty * it.price) * (1 + it.gst_percent / 100)),
    })) : [emptyItem()]);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formSiteId) { notifyError('Site is required.'); return; }
    const validItems = formItems.filter(it => it.product && it.qty > 0);
    if (validItems.length === 0) { notifyError('Add at least one item with product and quantity.'); return; }

    const payload = {
      date: formDate,
      site_id: formSiteId,
      retailer_id: formRetailerId || undefined,
      items: validItems,
      total_base: totalBase,
      total_gst: totalGst,
      grand_total: grandTotal,
    };

    setSaving(true);
    try {
      if (editingId) {
        await apiPut(`/api/purchase-orders/${editingId}`, payload);
        success('Purchase order updated.');
      } else {
        await apiPost('/api/purchase-orders', payload);
        success('Purchase order created.');
      }
      setShowModal(false);
      resetForm();
      loadPurchaseOrders();
    } catch (err: any) {
      notifyError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (po: PurchaseOrder) => {
    const ok = await confirm({
      title: 'Delete Purchase Order',
      message: `Delete PO "${po.po_number}"? This cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/purchase-orders/${po.id}`);
      success('Purchase order deleted.');
      loadPurchaseOrders();
    } catch (err: any) {
      notifyError('Failed to delete: ' + err.message);
    }
  };

  const handleActionClick = (event: { action: string; row: any }) => {
    const po = event.row as PurchaseOrder;
    switch (event.action) {
      case 'view':
        setViewingPO(po);
        setShowViewModal(true);
        break;
      case 'edit':
        openEditModal(po);
        break;
      case 'delete':
        handleDelete(po);
        break;
    }
  };

  return (
    <div className="page-container">
      <PageHeader title="Purchase Orders" icon="ri-file-list-3-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line"></i> Add Purchase Order
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="card-container" style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown items={siteItems} value={filterSiteId} onChange={setFilterSiteId} label="Filter by Site" placeholder="All Sites" />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={purchaseOrders}
        loading={loading}
        actions={actions}
        onActionClick={handleActionClick}
        fileName="purchase-orders"
        showFooterTotals
      />

      {/* Add/Edit PO Modal */}
      <ModalDialog isOpen={showModal} title={editingId ? 'Edit Purchase Order' : 'Add Purchase Order'} size="xl" onClose={() => setShowModal(false)}>
        <div className="form-grid">
          <div className="form-group">
            <label>Date <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} required />
          </div>
          <div className="form-group">
            <SearchableDropdown items={siteItems} value={formSiteId} onChange={setFormSiteId} label="Site" placeholder="Select Site..." required />
          </div>
          <div className="form-group">
            <SearchableDropdown items={retailerItems} value={formRetailerId} onChange={setFormRetailerId} label="Retailer" placeholder="Select Retailer..." />
          </div>
        </div>

        <h4 style={{ margin: '20px 0 12px', fontWeight: 700, fontSize: 14 }}>Line Items</h4>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>HSN</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th>GST %</th>
                <th style={{ textAlign: 'right' }}>Base Total</th>
                <th style={{ textAlign: 'right' }}>GST Amt</th>
                <th style={{ textAlign: 'right' }}>Line Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {formItems.map((item, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td style={{ minWidth: 180 }}>
                    <SearchableDropdown items={productItems} value={item.product} onChange={val => updateItem(idx, 'product', val)} placeholder="Select product" />
                  </td>
                  <td><input type="text" value={item.hsn} onChange={e => updateItem(idx, 'hsn', e.target.value)} style={{ width: 80 }} /></td>
                  <td><input type="text" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} style={{ width: 60 }} /></td>
                  <td><input type="number" value={item.qty || ''} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} style={{ width: 70, textAlign: 'right' }} min={0} /></td>
                  <td><input type="number" value={item.price || ''} onChange={e => updateItem(idx, 'price', Number(e.target.value))} style={{ width: 90, textAlign: 'right' }} min={0} step={0.01} /></td>
                  <td>
                    <select value={item.gst_percent} onChange={e => updateItem(idx, 'gst_percent', Number(e.target.value))} style={{ width: 70 }}>
                      {GST_OPTIONS.map(g => <option key={g} value={g}>{g}%</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatINR(item.base_total)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{formatINR(item.gst_amount)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{formatINR(item.line_total)}</td>
                  <td>
                    <button className="btn-danger" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => removeItem(idx)} disabled={formItems.length <= 1} title="Remove">
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, background: 'var(--bg-card)', borderTop: '2px solid var(--border-color)' }}>
                <td colSpan={7} style={{ textAlign: 'right' }}>Totals</td>
                <td style={{ textAlign: 'right' }}>{formatINR(totalBase)}</td>
                <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{formatINR(totalGst)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--success)', fontSize: 15 }}>{formatINR(grandTotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn-secondary" onClick={addItem}><i className="ri-add-line"></i> Add Item</button>
          <div style={{ flex: 1 }} />
          <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
            {saving ? 'Saving...' : editingId ? 'Update PO' : 'Create PO'}
          </button>
        </div>
      </ModalDialog>

      {/* View PO Detail Modal */}
      <ModalDialog isOpen={showViewModal} title={`Purchase Order: ${viewingPO?.po_number || ''}`} size="lg" onClose={() => setShowViewModal(false)}>
        {viewingPO && (
          <>
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date</label>
                <div>{viewingPO.date?.split('T')[0] || '--'}</div>
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Site</label>
                <div>{viewingPO.site_name || '--'}</div>
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Retailer</label>
                <div>{viewingPO.retailer_name || '--'}</div>
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</label>
                <div><span className={`badge ${viewingPO.status === 'active' || viewingPO.status === 'Active' ? 'badge-success' : viewingPO.status === 'cancelled' || viewingPO.status === 'Cancelled' ? 'badge-danger' : 'badge-info'}`}>{viewingPO.status}</span></div>
              </div>
            </div>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Product</th><th>HSN</th><th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>GST %</th><th style={{ textAlign: 'right' }}>Base</th>
                    <th style={{ textAlign: 'right' }}>GST</th><th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewingPO.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{item.product}</td>
                      <td>{item.hsn || '--'}</td>
                      <td>{item.unit || '--'}</td>
                      <td style={{ textAlign: 'right' }}>{item.qty}</td>
                      <td style={{ textAlign: 'right' }}>{formatINR(item.price)}</td>
                      <td style={{ textAlign: 'right' }}>{item.gst_percent}%</td>
                      <td style={{ textAlign: 'right' }}>{formatINR(item.base_total)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{formatINR(item.gst_amount)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatINR(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 800, borderTop: '2px solid var(--border-color)' }}>
                    <td colSpan={7} style={{ textAlign: 'right' }}>Grand Total</td>
                    <td style={{ textAlign: 'right' }}>{formatINR(viewingPO.total_base)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{formatINR(viewingPO.total_gst)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)', fontSize: 15 }}>{formatINR(viewingPO.grand_total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </ModalDialog>
    </div>
  );
}
