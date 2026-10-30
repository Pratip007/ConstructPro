'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { exportToExcel } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import styles from './PurchaseOrderEntryPage.module.scss';

interface PoItem {
  product: string;
  hsn: string;
  unit: string;
  qty: number;
  rate: number;
  gst_percent: number;
  amount: number;
  gst_amount: number;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  company_id: string;
  company_name?: string;
  retailer_id: string;
  retailer_name?: string;
  site_id: string;
  site_name?: string;
  date: string;
  tc_option: string;
  status: string;
  reminder_date?: string;
  items: PoItem[];
  total_base: number;
  total_gst: number;
  grand_total: number;
}

interface Product {
  id: string;
  name: string;
  unit: string;
  hsn: string;
  gst_percent: number;
  price: number;
}

const emptyItem = (): PoItem => ({
  product: '', hsn: '', unit: '', qty: 0, rate: 0, gst_percent: 18, amount: 0, gst_amount: 0,
});

export default function PurchaseOrderEntryPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tcOptions, setTcOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form
  const [poNumber, setPoNumber] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [retailerId, setRetailerId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [tcOption, setTcOption] = useState('');
  const [status, setStatus] = useState('Active');
  const [reminderDate, setReminderDate] = useState('');
  const [items, setItems] = useState<PoItem[]>([emptyItem()]);

  const companyItems = useMemo(() => companies.map(c => ({ value: String(c.id), label: c.name })), [companies]);
  const retailerItems = useMemo(() => retailers.map(r => ({ value: String(r.id), label: r.name })), [retailers]);
  const siteItems = useMemo(() => sites.map(s => ({ value: String(s.id), label: s.name })), [sites]);
  const productItems = useMemo(() => products.map(p => ({ value: p.name, label: `${p.name} (${p.unit})` })), [products]);
  const tcItems = useMemo(() => tcOptions.map(t => ({ value: String(t.id), label: t.name })), [tcOptions]);

  const totalBase = useMemo(() => items.reduce((s, it) => s + it.amount, 0), [items]);
  const totalGst = useMemo(() => items.reduce((s, it) => s + it.gst_amount, 0), [items]);
  const grandTotal = useMemo(() => Math.round((totalBase + totalGst) * 100) / 100, [totalBase, totalGst]);

  const filteredPOs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return purchaseOrders;
    return purchaseOrders.filter(po =>
      po.po_number.toLowerCase().includes(q) ||
      (po.company_name || '').toLowerCase().includes(q) ||
      (po.retailer_name || '').toLowerCase().includes(q) ||
      (po.site_name || '').toLowerCase().includes(q)
    );
  }, [purchaseOrders, searchQuery]);

  const summaryCards = useMemo(() => {
    const total = purchaseOrders.length;
    const totalVal = purchaseOrders.reduce((s, po) => s + (po.grand_total ?? 0), 0);
    const active = purchaseOrders.filter(po => po.status === 'Active').length;
    return [
      { title: 'Total POs', value: total, icon: 'ri-file-list-3-line', color: 'primary' as const },
      { title: 'Total Value', value: totalVal, prefix: '₹', icon: 'ri-money-rupee-circle-line', color: 'info' as const },
      { title: 'Active', value: active, icon: 'ri-checkbox-circle-line', color: 'success' as const },
    ];
  }, [purchaseOrders]);

  const loadPOs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<PurchaseOrder[]>('/purchase-orders');
      setPurchaseOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load POs: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadPOs();
    apiGet<any[]>('/companies').then(d => setCompanies(d ?? [])).catch(() => {});
    apiGet<any[]>('/retailers').then(d => setRetailers(d ?? [])).catch(() => {});
    apiGet<any[]>('/sites').then(d => setSites(d ?? [])).catch(() => {});
    apiGet<Product[]>('/stock-products').then(d => setProducts(d ?? [])).catch(() => {});
    apiGet<any[]>('/terms-conditions').then(d => setTcOptions(d ?? [])).catch(() => {});
  }, [loadPOs]);

  const updateItem = (index: number, field: keyof PoItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'product') {
        const prod = products.find(p => p.name === value);
        if (prod) {
          item.hsn = prod.hsn || '';
          item.unit = prod.unit || '';
          item.gst_percent = prod.gst_percent ?? 18;
          item.rate = prod.price ?? 0;
        }
      }

      item.amount = Math.round(item.qty * item.rate * 100) / 100;
      item.gst_amount = Math.round(item.amount * item.gst_percent / 100 * 100) / 100;
      updated[index] = item;
      return updated;
    });
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setEditingId(null);
    setPoNumber('');
    setCompanyId('');
    setRetailerId('');
    setSiteId('');
    setDate(new Date().toISOString().split('T')[0]);
    setTcOption('');
    setStatus('Active');
    setReminderDate('');
    setItems([emptyItem()]);
  };

  const handleSave = async () => {
    if (!companyId || !siteId) {
      notifyError('Company and Site are required.');
      return;
    }
    const validItems = items.filter(it => it.product && it.qty > 0);
    if (validItems.length === 0) {
      notifyError('Add at least one item with product and quantity.');
      return;
    }

    const payload = {
      po_number: poNumber || undefined,
      company_id: companyId,
      retailer_id: retailerId || undefined,
      site_id: siteId,
      date,
      tc_option: tcOption || undefined,
      status,
      reminder_date: reminderDate || undefined,
      items: validItems,
      total_base: totalBase,
      total_gst: totalGst,
      grand_total: grandTotal,
    };

    setSaving(true);
    try {
      if (editingId) {
        const updated = await apiPut<PurchaseOrder>(`/purchase-orders/${editingId}`, payload);
        setPurchaseOrders(prev => prev.map(po => (po.id === updated.id ? updated : po)));
        success('Purchase order updated.');
      } else {
        const created = await apiPost<PurchaseOrder>('/purchase-orders', payload);
        setPurchaseOrders(prev => [...prev, created]);
        success('Purchase order created.');
      }
      resetForm();
    } catch (err: any) {
      notifyError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const editPO = (po: PurchaseOrder) => {
    setEditingId(po.id);
    setPoNumber(po.po_number || '');
    setCompanyId(po.company_id || '');
    setRetailerId(po.retailer_id || '');
    setSiteId(po.site_id || '');
    setDate(po.date || '');
    setTcOption(po.tc_option || '');
    setStatus(po.status || 'Active');
    setReminderDate(po.reminder_date || '');
    setItems(po.items?.length ? po.items : [emptyItem()]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deletePO = async (po: PurchaseOrder) => {
    const confirmed = await confirm({
      title: 'Delete Purchase Order',
      message: `Delete PO "${po.po_number}"? This cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await apiDelete(`/purchase-orders/${po.id}`);
      setPurchaseOrders(prev => prev.filter(x => x.id !== po.id));
      success('Purchase order deleted.');
    } catch (err: any) {
      notifyError('Failed to delete: ' + err.message);
    }
  };

  const handleExportExcel = () => {
    exportToExcel(filteredPOs as any, 'purchase-orders', 'Purchase Orders', [
      { key: 'po_number', header: 'PO Number' },
      { key: 'company_name', header: 'Company' },
      { key: 'retailer_name', header: 'Retailer' },
      { key: 'site_name', header: 'Site' },
      { key: 'date', header: 'Date' },
      { key: 'grand_total', header: 'Total' },
      { key: 'status', header: 'Status' },
    ]);
  };

  const formatCurrency = (val: number) => {
    if (!val) return '--';
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{editingId ? 'Edit Purchase Order' : 'Purchase Order Entry'}</h1>
      </div>

      <SummaryCards cards={summaryCards} />

      {/* PO Form */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <label>PO Number</label>
            <input type="text" value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="Auto-generated if empty" />
          </div>
          <div className="form-group">
            <label>Company *</label>
            <SearchableDropdown items={companyItems} value={companyId} onChange={val => setCompanyId(val as string)} placeholder="Select company" />
          </div>
          <div className="form-group">
            <label>Retailer / Vendor</label>
            <SearchableDropdown items={retailerItems} value={retailerId} onChange={val => setRetailerId(val as string)} placeholder="Select retailer" />
          </div>
          <div className="form-group">
            <label>Site *</label>
            <SearchableDropdown items={siteItems} value={siteId} onChange={val => setSiteId(val as string)} placeholder="Select site" />
          </div>
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>T&amp;C Option</label>
            <SearchableDropdown items={tcItems} value={tcOption} onChange={val => setTcOption(val as string)} placeholder="Select T&C" />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="form-group">
            <label>Reminder Date</label>
            <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} />
          </div>
        </div>

        {/* Line Items */}
        <h3 style={{ margin: '20px 0 12px' }}>Line Items</h3>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>HSN</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Rate</th>
                <th style={{ textAlign: 'right' }}>GST %</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>GST Amt</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td style={{ minWidth: 180 }}>
                    <SearchableDropdown
                      items={productItems}
                      value={item.product}
                      onChange={val => updateItem(idx, 'product', val)}
                      placeholder="Select product"
                    />
                  </td>
                  <td><input type="text" value={item.hsn} onChange={e => updateItem(idx, 'hsn', e.target.value)} style={{ width: 80 }} /></td>
                  <td><input type="text" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} style={{ width: 60 }} /></td>
                  <td><input type="number" value={item.qty || ''} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} style={{ width: 70, textAlign: 'right' }} min={0} /></td>
                  <td><input type="number" value={item.rate || ''} onChange={e => updateItem(idx, 'rate', Number(e.target.value))} style={{ width: 90, textAlign: 'right' }} min={0} step={0.01} /></td>
                  <td>
                    <select value={item.gst_percent} onChange={e => updateItem(idx, 'gst_percent', Number(e.target.value))} style={{ width: 70 }}>
                      {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.amount)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{formatCurrency(item.gst_amount)}</td>
                  <td>
                    <button className="btn-icon" onClick={() => removeItem(idx)} title="Remove" disabled={items.length <= 1} style={{ color: 'var(--danger)' }}>
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, background: 'var(--bg-card)', borderTop: '2px solid var(--border-color)' }}>
                <td colSpan={7}>Total</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(totalBase)}</td>
                <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{formatCurrency(totalGst)}</td>
                <td></td>
              </tr>
              <tr style={{ fontWeight: 800 }}>
                <td colSpan={7}>Grand Total</td>
                <td colSpan={2} style={{ textAlign: 'right', fontSize: 16, color: 'var(--success)' }}>{formatCurrency(grandTotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn-secondary" onClick={addItem}>
            <i className="ri-add-line"></i> Add Item
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ marginLeft: 'auto' }}>
            <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
            {saving ? 'Saving...' : editingId ? 'Update PO' : 'Create PO'}
          </button>
          {editingId && (
            <button className="btn-secondary" onClick={resetForm}>
              <i className="ri-close-line"></i> Cancel
            </button>
          )}
        </div>
      </div>

      {/* PO List */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <div className={styles.toolbarRow}>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search POs..." className={styles.searchInput} />
          <button className="btn-secondary" onClick={handleExportExcel}>
            <i className="ri-file-excel-2-line"></i> Export
          </button>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, marginTop: 16 }} />
      ) : (
        <div className="table-responsive" style={{ marginTop: 8 }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>PO Number</th>
                <th>Company</th>
                <th>Retailer</th>
                <th>Site</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPOs.length === 0 ? (
                <tr><td colSpan={9} className="empty-state">No purchase orders found.</td></tr>
              ) : (
                filteredPOs.map((po, i) => (
                  <tr key={po.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{po.po_number}</td>
                    <td>{po.company_name || '--'}</td>
                    <td>{po.retailer_name || '--'}</td>
                    <td>{po.site_name || '--'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{po.date}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(po.grand_total)}</td>
                    <td>
                      <span className={`badge ${po.status === 'Active' ? 'badge-success' : po.status === 'Cancelled' ? 'badge-danger' : 'badge-info'}`}>
                        {po.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className={styles.actionButtons}>
                        <button className={styles.btnIcon} onClick={() => editPO(po)} title="Edit">
                          <i className="ri-edit-line"></i>
                        </button>
                        <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => deletePO(po)} title="Delete">
                          <i className="ri-delete-bin-line"></i>
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
