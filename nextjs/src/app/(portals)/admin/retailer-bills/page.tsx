'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import DataTable, { type TableColumn, type TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown from '@/components/SearchableDropdown';

interface BillItem {
  item_name: string;
  qty: number;
  unit: string;
  price: number;
  gst_percent: number;
  line_total: number;
  line_gst: number;
  final_total: number;
}

interface RetailerBill {
  id: string;
  bill_number?: string;
  display_id?: string;
  date: string;
  inv_type: string;
  inv_no: string;
  retailer_id: string;
  retailer_name?: string;
  site_id: string;
  site_name?: string;
  category_id?: string;
  gst_applicable: boolean | string;
  gst_number?: string;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  status: string;
  items?: BillItem[];
}

interface Site { id: string; name: string; }
interface Retailer { id: string; name: string; }
interface Category { id: string; name: string; }

const UNITS = ['nos', 'kg', 'ltr', 'mtr', 'sqft', 'bag', 'box', 'set'];
const GST_RATES = [0, 5, 12, 18, 28];

const emptyItem = (): BillItem => ({
  item_name: '', qty: 0, unit: 'nos', price: 0, gst_percent: 18,
  line_total: 0, line_gst: 0, final_total: 0,
});

const emptyForm = () => ({
  date: new Date().toISOString().split('T')[0],
  inv_type: 'with_invoice',
  inv_no: '',
  category_id: '',
  retailer_id: '',
  site_id: '',
  gst_applicable: false,
  gst_number: '',
  paid_amount: 0,
  items: [emptyItem()],
});

export default function RetailerBillsPage() {
  const { apiGet, apiPost, apiPut, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [bills, setBills] = useState<RetailerBill[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterSiteId, setFilterSiteId] = useState('');
  const [filterRetailerId, setFilterRetailerId] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterGst, setFilterGst] = useState('all');

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // View modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewBill, setViewBill] = useState<RetailerBill | null>(null);

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);
  const retailerItems = useMemo(() => retailers.map(r => ({ value: r.id, label: r.name })), [retailers]);
  const categoryItems = useMemo(() => categories.map(c => ({ value: c.id, label: c.name })), [categories]);

  // Computed totals
  const subtotal = useMemo(() => form.items.reduce((s, it) => s + it.line_total, 0), [form.items]);
  const totalGst = useMemo(() => form.items.reduce((s, it) => s + it.line_gst, 0), [form.items]);
  const grandTotal = useMemo(() => Math.round((subtotal + totalGst) * 100) / 100, [subtotal, totalGst]);
  const dueAmount = useMemo(() => Math.max(0, grandTotal - (form.paid_amount || 0)), [grandTotal, form.paid_amount]);

  const columns: TableColumn[] = useMemo(() => [
    { key: 'bill_number', label: 'Display ID', sortable: true },
    { key: 'date', label: 'Date', type: 'date', sortable: true },
    { key: 'inv_type', label: 'Inv Type', sortable: true },
    { key: 'inv_no', label: 'Inv No', sortable: true },
    { key: 'retailer_name', label: 'Retailer', sortable: true },
    { key: 'site_name', label: 'Site', sortable: true },
    { key: 'gst_display', label: 'GST?', type: 'badge', sortable: true, badgeMap: { YES: 'success', NO: 'warning' } },
    { key: 'total_amount', label: 'Total', type: 'currency', sortable: true },
    { key: 'paid_amount', label: 'Paid', type: 'currency', sortable: true },
    { key: 'due_amount', label: 'Due', type: 'currency', sortable: true },
    { key: 'status', label: 'Status', type: 'badge', sortable: true, badgeMap: { DUE: 'warning', PAID: 'success', CANCELLED: 'danger' } },
  ], []);

  const actions: TableAction[] = useMemo(() => [
    { label: '', icon: 'ri-eye-line', action: 'view', class: 'btn-secondary' },
    { label: '', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary' },
    { label: '', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger' },
  ], []);

  const loadMasters = useCallback(async () => {
    try {
      const [s, r, c] = await Promise.all([
        apiGet<Site[]>('/api/sites'),
        apiGet<Retailer[]>('/api/retailers'),
        apiGet<Category[]>('/api/retailer-categories'),
      ]);
      setSites(Array.isArray(s) ? s : []);
      setRetailers(Array.isArray(r) ? r : []);
      setCategories(Array.isArray(c) ? c : []);
    } catch { }
  }, [apiGet]);

  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/retailer-bills';
      const params: string[] = [];
      if (filterSiteId) params.push(`site_id=${filterSiteId}`);
      if (filterRetailerId) params.push(`retailer_id=${filterRetailerId}`);
      if (filterStatus !== 'all') params.push(`status=${filterStatus}`);
      if (filterGst !== 'all') params.push(`gst_applicable=${filterGst}`);
      if (params.length) url += `?${params.join('&')}`;
      const data = await apiGet<RetailerBill[]>(url);
      setBills(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load bills: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [apiGet, filterSiteId, filterRetailerId, filterStatus, filterGst, notifyError]);

  useEffect(() => { loadMasters(); }, [loadMasters]);
  useEffect(() => { loadBills(); }, [loadBills]);

  const tableData = useMemo(() =>
    bills.map(b => ({
      ...b,
      bill_number: b.bill_number || b.display_id || b.id,
      gst_display: (b.gst_applicable === true || b.gst_applicable === 'true' || b.gst_applicable === 'yes') ? 'YES' : 'NO',
    })),
    [bills]
  );

  const updateItem = (index: number, field: keyof BillItem, value: any) => {
    setForm(prev => {
      const items = [...prev.items];
      const item = { ...items[index], [field]: value };
      item.line_total = Math.round(item.qty * item.price * 100) / 100;
      item.line_gst = Math.round(item.line_total * item.gst_percent / 100 * 100) / 100;
      item.final_total = Math.round((item.line_total + item.line_gst) * 100) / 100;
      items[index] = item;
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setForm(prev => ({ ...prev, items: [...prev.items, emptyItem()] }));
  };

  const removeItem = (index: number) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (bill: RetailerBill) => {
    setEditingId(bill.id);
    setForm({
      date: bill.date?.split('T')[0] || '',
      inv_type: bill.inv_type || 'with_invoice',
      inv_no: bill.inv_no || '',
      category_id: bill.category_id || '',
      retailer_id: bill.retailer_id || '',
      site_id: bill.site_id || '',
      gst_applicable: bill.gst_applicable === true || bill.gst_applicable === 'true' || bill.gst_applicable === 'yes',
      gst_number: bill.gst_number || '',
      paid_amount: bill.paid_amount || 0,
      items: bill.items?.length ? bill.items : [emptyItem()],
    });
    setShowModal(true);
  };

  const openView = async (bill: RetailerBill) => {
    try {
      const detail = await apiGet<RetailerBill>(`/api/retailer-bills/${bill.id}`);
      setViewBill(detail);
    } catch {
      setViewBill(bill);
    }
    setShowViewModal(true);
  };

  const handleSave = async () => {
    if (!form.retailer_id || !form.site_id) {
      notifyError('Retailer and Site are required.');
      return;
    }
    const validItems = form.items.filter(it => it.item_name && it.qty > 0);
    if (validItems.length === 0) {
      notifyError('Add at least one item with name and quantity.');
      return;
    }
    setSaving(true);
    const payload = {
      date: form.date,
      inv_type: form.inv_type,
      inv_no: form.inv_no || null,
      category_id: form.category_id || null,
      retailer_id: form.retailer_id,
      site_id: form.site_id,
      gst_applicable: form.gst_applicable,
      gst_number: form.gst_applicable ? form.gst_number : null,
      items: validItems,
      total_amount: grandTotal,
      paid_amount: form.paid_amount || 0,
      due_amount: dueAmount,
      status: dueAmount <= 0 ? 'PAID' : 'DUE',
    };
    try {
      if (editingId) {
        await apiPut(`/api/retailer-bills/${editingId}`, payload);
        success('Bill updated successfully.');
      } else {
        await apiPost('/api/retailer-bills', payload);
        success('Bill added successfully.');
      }
      setShowModal(false);
      loadBills();
    } catch (err: any) {
      notifyError('Failed to save bill: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bill: RetailerBill) => {
    const ok = await confirm({
      title: 'Delete Bill',
      message: `Are you sure you want to delete bill "${bill.bill_number || bill.id}"?`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/retailer-bills/${bill.id}`);
      success('Bill deleted.');
      loadBills();
    } catch (err: any) {
      notifyError('Delete failed: ' + err.message);
    }
  };

  const handleAction = (event: { action: string; row: any }) => {
    if (event.action === 'view') openView(event.row);
    else if (event.action === 'edit') openEdit(event.row);
    else if (event.action === 'delete') handleDelete(event.row);
  };

  const formatCurrency = (val: number) =>
    '₹' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="page-container">
      <PageHeader title="Retailer Bills" icon="ri-bill-line">
        <button className="btn-primary" onClick={openAdd}>
          <i className="ri-add-line"></i> Add Bill
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={filterSiteId}
              onChange={(val: any) => setFilterSiteId(val || '')}
              placeholder="All Sites"
              label="Site"
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={retailerItems}
              value={filterRetailerId}
              onChange={(val: any) => setFilterRetailerId(val || '')}
              placeholder="All Retailers"
              label="Retailer"
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="DUE">DUE</option>
              <option value="PAID">PAID</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
          <div className="form-group">
            <label>GST Applicable</label>
            <select value={filterGst} onChange={e => setFilterGst(e.target.value)}>
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bills Table */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable
          columns={columns}
          data={tableData}
          loading={loading}
          actions={actions}
          onActionClick={handleAction}
          fileName="retailer-bills"
          showFooterTotals
          emptyMessage="No retailer bills found."
        />
      </div>

      {/* Add/Edit Modal */}
      <ModalDialog
        isOpen={showModal}
        title={editingId ? 'Edit Retailer Bill' : 'Add Retailer Bill'}
        size="xl"
        onClose={() => setShowModal(false)}
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
              {saving ? 'Saving...' : editingId ? 'Update Bill' : 'Add Bill'}
            </button>
          </div>
        }
      >
        {/* Header Fields */}
        <div className="form-grid">
          <div className="form-group">
            <label>Date <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>Invoice Type</label>
            <select value={form.inv_type} onChange={e => setForm(f => ({ ...f, inv_type: e.target.value }))}>
              <option value="with_invoice">With Invoice</option>
              <option value="without_invoice">Without Invoice</option>
            </select>
          </div>
          <div className="form-group">
            <label>Invoice No</label>
            <input type="text" value={form.inv_no} onChange={e => setForm(f => ({ ...f, inv_no: e.target.value }))} placeholder="Invoice number" />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={categoryItems}
              value={form.category_id}
              onChange={(val: any) => setForm(f => ({ ...f, category_id: val || '' }))}
              placeholder="Select Category..."
              label="Category"
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={retailerItems}
              value={form.retailer_id}
              onChange={(val: any) => setForm(f => ({ ...f, retailer_id: val || '' }))}
              placeholder="Select Retailer..."
              label="Retailer"
              required
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={form.site_id}
              onChange={(val: any) => setForm(f => ({ ...f, site_id: val || '' }))}
              placeholder="Select Site..."
              label="Site"
              required
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={form.gst_applicable}
                onChange={e => setForm(f => ({ ...f, gst_applicable: e.target.checked }))}
                style={{ width: 'auto' }}
              />
              GST Applicable
            </label>
          </div>
          {form.gst_applicable && (
            <div className="form-group">
              <label>GST Number</label>
              <input type="text" value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} placeholder="GST Number" />
            </div>
          )}
        </div>

        {/* Items Table */}
        <h4 style={{ margin: '20px 0 12px', fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>Bill Items</h4>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item Name</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>GST %</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>GST</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>
                    <input type="text" value={item.item_name} onChange={e => updateItem(idx, 'item_name', e.target.value)} placeholder="Item name" style={{ minWidth: 150 }} />
                  </td>
                  <td>
                    <input type="number" value={item.qty || ''} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} style={{ width: 70, textAlign: 'right' }} min={0} />
                  </td>
                  <td>
                    <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} style={{ width: 80 }}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td>
                    <input type="number" value={item.price || ''} onChange={e => updateItem(idx, 'price', Number(e.target.value))} style={{ width: 90, textAlign: 'right' }} min={0} step={0.01} />
                  </td>
                  <td>
                    <select value={item.gst_percent} onChange={e => updateItem(idx, 'gst_percent', Number(e.target.value))} style={{ width: 70 }}>
                      {GST_RATES.map(g => <option key={g} value={g}>{g}%</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.line_total)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{formatCurrency(item.line_gst)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.final_total)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      disabled={form.items.length <= 1}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }}
                      title="Remove item"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                <td colSpan={6} style={{ textAlign: 'right' }}>Subtotal</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(subtotal)}</td>
                <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{formatCurrency(totalGst)}</td>
                <td style={{ textAlign: 'right', fontSize: 15, color: 'var(--success)' }}>{formatCurrency(grandTotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
          <button type="button" className="btn-secondary" onClick={addItem}>
            <i className="ri-add-line"></i> Add Item
          </button>
        </div>

        {/* Paid / Due */}
        <div className="form-grid" style={{ marginTop: 16 }}>
          <div className="form-group">
            <label>Paid Amount</label>
            <input
              type="number"
              value={form.paid_amount || ''}
              onChange={e => setForm(f => ({ ...f, paid_amount: Number(e.target.value) }))}
              placeholder="0.00"
              min={0}
              step={0.01}
            />
          </div>
          <div className="form-group">
            <label>Due Amount</label>
            <input
              type="text"
              value={formatCurrency(dueAmount)}
              readOnly
              style={{ fontWeight: 700, color: dueAmount > 0 ? 'var(--danger)' : 'var(--success)' }}
            />
          </div>
          <div className="form-group">
            <label>Grand Total</label>
            <input
              type="text"
              value={formatCurrency(grandTotal)}
              readOnly
              style={{ fontWeight: 700, color: 'var(--success)' }}
            />
          </div>
        </div>
      </ModalDialog>

      {/* View Modal */}
      <ModalDialog
        isOpen={showViewModal}
        title={`Bill Details - ${viewBill?.bill_number || viewBill?.display_id || ''}`}
        size="lg"
        onClose={() => setShowViewModal(false)}
      >
        {viewBill && (
          <>
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date</label>
                <div>{viewBill.date?.split('T')[0] || '--'}</div>
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoice Type</label>
                <div>{viewBill.inv_type || '--'}</div>
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoice No</label>
                <div>{viewBill.inv_no || '--'}</div>
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Retailer</label>
                <div style={{ fontWeight: 600 }}>{viewBill.retailer_name || '--'}</div>
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Site</label>
                <div>{viewBill.site_name || '--'}</div>
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</label>
                <div>
                  <span className={`badge ${viewBill.status === 'PAID' ? 'badge-success' : viewBill.status === 'CANCELLED' ? 'badge-danger' : 'badge-warning'}`}>
                    {viewBill.status}
                  </span>
                </div>
              </div>
            </div>

            {viewBill.items && viewBill.items.length > 0 && (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th>Unit</th>
                      <th style={{ textAlign: 'right' }}>Price</th>
                      <th style={{ textAlign: 'right' }}>GST %</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th style={{ textAlign: 'right' }}>GST</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewBill.items.map((item, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{item.item_name}</td>
                        <td style={{ textAlign: 'right' }}>{item.qty}</td>
                        <td>{item.unit}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                        <td style={{ textAlign: 'right' }}>{item.gst_percent}%</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.line_total)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.line_gst)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.final_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, marginTop: 16, padding: '12px 0', borderTop: '2px solid var(--border-color)' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(viewBill.total_amount)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Paid</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(viewBill.paid_amount)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Due</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(viewBill.due_amount)}</div>
              </div>
            </div>
          </>
        )}
      </ModalDialog>
    </div>
  );
}
