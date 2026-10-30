'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import { exportToExcel } from '@/lib/export-utils';
import styles from './RetailSiteInvoicePage.module.scss';

interface BillItem {
  item: string;
  qty: number;
  unit: string;
  price: number;
  gst_percent: number;
  add_to_stock: boolean;
  amount: number;
  gst_amount: number;
}

const EMPTY_ITEM: BillItem = { item: '', qty: 0, unit: '', price: 0, gst_percent: 18, add_to_stock: false, amount: 0, gst_amount: 0 };

const UNITS = ['nos', 'kg', 'ltr', 'mtr', 'sqft', 'bag', 'box', 'set', 'trip', 'percentage'];

function formatINR(val: number): string {
  return val.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
}

export default function RetailSiteInvoicePage() {
  const { success, error: showError } = useNotification();

  const [retailerId, setRetailerId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [date, setDate] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [invoiceType, setInvoiceType] = useState<'with_invoice' | 'without_invoice'>('with_invoice');
  const [isGst, setIsGst] = useState(true);
  const [paidAmount, setPaidAmount] = useState(0);
  const [gstNumber, setGstNumber] = useState('');
  const [items, setItems] = useState<BillItem[]>([{ ...EMPTY_ITEM }]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [retailers, setRetailers] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSiteId, setFilterSiteId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const retailerItems = useMemo(() => retailers.map(r => ({ value: r.id, label: r.name })), [retailers]);
  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);

  const filtered = useMemo(() => {
    let list = bills;
    if (filterSiteId) list = list.filter(b => b.site_id === filterSiteId);
    if (filterDateFrom) list = list.filter(b => b.date >= filterDateFrom);
    if (filterDateTo) list = list.filter(b => b.date <= filterDateTo);
    const q = searchQuery.toLowerCase();
    if (q) list = list.filter(b => (b.bill_number ?? '').toLowerCase().includes(q) || (b.retailer_name ?? '').toLowerCase().includes(q));
    return list;
  }, [bills, filterSiteId, filterDateFrom, filterDateTo, searchQuery]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items]);
  const totalGst = useMemo(() => items.reduce((s, i) => s + i.gst_amount, 0), [items]);
  const grandTotal = subtotal + totalGst;
  const dueAmount = grandTotal - paidAmount;

  const summaryCards = useMemo(() => {
    const totalBill = filtered.reduce((s, b) => s + (b.total_amount ?? 0), 0);
    const totalPaid = filtered.reduce((s, b) => s + (b.paid_amount ?? 0), 0);
    const totalDue = filtered.reduce((s, b) => s + (b.due_amount ?? 0), 0);
    return [
      { title: 'Total Bill Amount', value: totalBill, color: 'primary' as const, prefix: '₹', icon: 'ri-money-rupee-circle-line' },
      { title: 'Total Paid', value: totalPaid, color: 'success' as const, prefix: '₹', icon: 'ri-checkbox-circle-line' },
      { title: 'Total Due', value: totalDue, color: (totalDue > 0 ? 'danger' : 'success') as any, prefix: '₹', icon: 'ri-error-warning-line' },
    ];
  }, [filtered]);

  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<any[]>('/retailer-bills');
      setBills(data);
    } catch { showError('Failed to load bills'); }
    setLoading(false);
  }, [showError]);

  useEffect(() => {
    apiGet<any[]>('/retailers').then(d => setRetailers(d)).catch(() => {});
    apiGet<any[]>('/sites').then(d => setSites(d)).catch(() => {});
    loadBills();
  }, [loadBills]);

  const onRetailerChange = (id: string) => {
    setRetailerId(id);
    const retailer = retailers.find(r => r.id === id);
    if (retailer) {
      setGstNumber(retailer.gst_number ?? '');
      if (retailer.gst_status === true || retailer.gst_status === 'GST YES') setIsGst(true);
    }
  };

  const onInvoiceTypeChange = (val: string) => {
    setInvoiceType(val as any);
    if (val === 'without_invoice') { setBillNumber(''); setIsGst(false); }
  };

  const addItem = () => setItems(l => [...l, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => setItems(l => l.filter((_, i) => i !== idx));

  const calculateAmount = (idx: number) => {
    setItems(l => {
      const u = [...l];
      const cur = { ...u[idx] };
      const baseAmount = (cur.unit === 'percentage' || cur.unit === '%') ? cur.price * cur.qty / 100 : cur.qty * cur.price;
      cur.amount = baseAmount;
      cur.gst_amount = isGst ? baseAmount * cur.gst_percent / 100 : 0;
      u[idx] = cur;
      return u;
    });
  };

  const updateItem = (idx: number, field: keyof BillItem, value: any) => {
    setItems(l => {
      const u = [...l];
      u[idx] = { ...u[idx], [field]: value };
      const cur = u[idx];
      const baseAmount = (cur.unit === 'percentage' || cur.unit === '%') ? cur.price * cur.qty / 100 : cur.qty * cur.price;
      u[idx].amount = baseAmount;
      u[idx].gst_amount = isGst ? baseAmount * cur.gst_percent / 100 : 0;
      return u;
    });
  };

  const resetForm = () => {
    setEditingId(null); setRetailerId(''); setSiteId(''); setDate('');
    setBillNumber(''); setInvoiceType('with_invoice'); setIsGst(true);
    setPaidAmount(0); setGstNumber('');
    setItems([{ ...EMPTY_ITEM }]);
  };

  const editBill = (bill: any) => {
    setEditingId(bill.id);
    setRetailerId(bill.retailer_id ?? '');
    setSiteId(bill.site_id ?? '');
    setDate(bill.date ?? '');
    setBillNumber(bill.bill_number ?? '');
    setInvoiceType(bill.bill_number ? 'with_invoice' : 'without_invoice');
    setIsGst(bill.is_gst ?? true);
    setPaidAmount(bill.paid_amount ?? 0);
    setGstNumber(bill.gst_number ?? '');
    if (bill.items?.length) {
      setItems(bill.items.map((it: any) => ({
        item: it.item ?? '', qty: it.qty ?? 0, unit: it.unit ?? '',
        price: it.price ?? 0, gst_percent: it.gst_percent ?? 0,
        add_to_stock: it.add_to_stock ?? false,
        amount: (it.qty ?? 0) * (it.price ?? 0),
        gst_amount: it.gst_amount ?? 0,
      })));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteBill = async (id: string) => {
    try {
      await apiDelete(`/retailer-bills/${id}`);
      success('Bill deleted');
      loadBills();
    } catch { showError('Failed to delete bill'); }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      retailer_id: retailerId || null, site_id: siteId || null, date,
      bill_number: invoiceType === 'with_invoice' ? billNumber : null,
      invoice_type: invoiceType, is_gst: isGst, gst_number: gstNumber || null,
      items, subtotal, gst_amount: totalGst, total_amount: grandTotal,
      paid_amount: paidAmount, due_amount: dueAmount,
      status: dueAmount <= 0 ? 'PAID' : 'DUE',
    };
    try {
      if (editingId) {
        await apiPut(`/retailer-bills/${editingId}`, body);
        success('Bill updated');
      } else {
        await apiPost('/retailer-bills', body);
        success('Bill created');
      }
      resetForm();
      loadBills();
    } catch { showError(editingId ? 'Failed to update bill' : 'Failed to create bill'); }
  };

  const exportBills = () => {
    exportToExcel(filtered as any[], 'Retailer_Bills', 'Retailer Bills', [
      { key: 'bill_number', header: 'Bill No' }, { key: 'retailer_name', header: 'Retailer' },
      { key: 'site_name', header: 'Site' }, { key: 'date', header: 'Date' },
      { key: 'invoice_type', header: 'Type' }, { key: 'subtotal', header: 'Subtotal' },
      { key: 'gst_amount', header: 'GST' }, { key: 'total_amount', header: 'Total' },
      { key: 'paid_amount', header: 'Paid' }, { key: 'due_amount', header: 'Due' },
      { key: 'status', header: 'Status' },
    ]);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{editingId ? 'Edit Retail Bill' : 'Retail Site Invoice'}</h1>
        <button className="btn-export" onClick={exportBills}><i className="ri-file-excel-2-line" /> Export XLSX</button>
      </div>

      <div className="card-container">
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Retailer *</label>
              <SearchableDropdown items={retailerItems} value={retailerId} onChange={onRetailerChange} placeholder="Search retailer..." />
            </div>
            <div className="form-group">
              <label>Site *</label>
              <SearchableDropdown items={siteItems} value={siteId} onChange={setSiteId} placeholder="Search site..." />
            </div>
            <div className="form-group">
              <label>Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Invoice Type *</label>
              <select value={invoiceType} onChange={e => onInvoiceTypeChange(e.target.value)}>
                <option value="with_invoice">With Invoice</option>
                <option value="without_invoice">Without Invoice</option>
              </select>
            </div>
            {invoiceType === 'with_invoice' && (
              <div className="form-group">
                <label>Bill / Invoice Number *</label>
                <input type="text" value={billNumber} onChange={e => setBillNumber(e.target.value)} required placeholder="e.g., INV-001" />
              </div>
            )}
            <div className="form-group">
              <label>GST Bill?</label>
              <select value={String(isGst)} onChange={e => setIsGst(e.target.value === 'true')}>
                <option value="true">Yes (GST)</option>
                <option value="false">No (Non-GST)</option>
              </select>
            </div>
            {isGst && gstNumber && (
              <div className="form-group">
                <label>GSTIN</label>
                <input type="text" value={gstNumber} readOnly style={{ textTransform: 'uppercase', background: 'rgba(255,255,255,0.03)', color: 'var(--accent)' }} />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 10px' }}>
            <h3 style={{ fontSize: 15, color: 'var(--accent)', fontWeight: 700 }}>Bill Items</h3>
            <button type="button" className="btn-secondary" onClick={addItem} style={{ padding: '6px 14px', fontSize: 12 }}>+ Add Item</button>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Item Name</th><th>Qty</th><th>Unit</th><th>Price</th>
                  {isGst && <th>GST %</th>}
                  <th>Stock</th><th>Amount</th>
                  {isGst && <th>GST Amt</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td><input type="text" value={item.item} onChange={e => updateItem(idx, 'item', e.target.value)} placeholder="Item name" style={{ width: '100%', padding: 6 }} /></td>
                    <td><input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', +e.target.value)} style={{ width: 70, padding: 6 }} min={0} /></td>
                    <td>
                      <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} style={{ width: 90, padding: 6 }}>
                        <option value="">--</option>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td><input type="number" value={item.price} onChange={e => updateItem(idx, 'price', +e.target.value)} style={{ width: 100, padding: 6 }} min={0} /></td>
                    {isGst && <td><input type="number" value={item.gst_percent} onChange={e => updateItem(idx, 'gst_percent', +e.target.value)} style={{ width: 60, padding: 6 }} min={0} max={28} /></td>}
                    <td style={{ textAlign: 'center' }}><input type="checkbox" checked={item.add_to_stock} onChange={e => updateItem(idx, 'add_to_stock', e.target.checked)} /></td>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatINR(item.amount)}</td>
                    {isGst && <td style={{ fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--accent)' }}>{formatINR(item.gst_amount)}</td>}
                    <td><button type="button" className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => removeItem(idx)}><i className="ri-delete-bin-line" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.cartSummary}>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <div className="form-group">
                <label className={styles.summaryLabel}>Subtotal</label>
                <div className={styles.summaryValue}>{formatINR(subtotal)}</div>
              </div>
              {isGst && (
                <div className="form-group">
                  <label className={styles.summaryLabel}>GST Amount</label>
                  <div className={styles.summaryValueAccent}>{formatINR(totalGst)}</div>
                </div>
              )}
              <div className="form-group">
                <label className={styles.summaryLabel}>Grand Total</label>
                <div className={styles.grandTotal}>{formatINR(grandTotal)}</div>
              </div>
              <div className="form-group">
                <label>Paid Amount</label>
                <input type="number" value={paidAmount} onChange={e => setPaidAmount(+e.target.value)} min={0} style={{ fontWeight: 700 }} />
              </div>
              <div className="form-group">
                <label className={styles.summaryLabel}>Due Amount</label>
                <div style={{ fontSize: 20, fontWeight: 800, color: dueAmount > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatINR(dueAmount)}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button type="submit" className="btn-primary" style={{ padding: '10px 28px' }}>{editingId ? 'Update Bill' : 'Save Bill'}</button>
            {editingId && <button type="button" className="btn-secondary" style={{ padding: '10px 28px' }} onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>

      <div style={{ marginTop: 20 }}>
        <SummaryCards cards={summaryCards} />
      </div>

      <div className="card-container" style={{ marginTop: 20 }}>
        <div className="form-grid">
          <div className="form-group">
            <label>Site</label>
            <SearchableDropdown items={siteItems} value={filterSiteId} onChange={setFilterSiteId} placeholder="All Sites" />
          </div>
          <div className="form-group">
            <label>Date From</label>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Date To</label>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Search</label>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Bill no, retailer..." />
          </div>
        </div>
      </div>

      {loading ? <div className="skeleton" style={{ height: 300, marginTop: 20 }} /> : (
        <div className="card-container" style={{ marginTop: 20, padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Bill No</th><th>Retailer</th><th>Site</th><th>Date</th><th>Type</th>
                  <th>Subtotal</th><th>GST</th><th>Total</th><th>Paid</th><th>Due</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={13} className="empty-state">No bills found.</td></tr>
                ) : filtered.map((b, idx) => (
                  <tr key={b.id}>
                    <td>{idx + 1}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 700 }}>{b.bill_number ?? '-'}</td>
                    <td style={{ fontWeight: 600 }}>{b.retailer_name ?? '-'}</td>
                    <td>{b.site_name ?? '-'}</td>
                    <td>{b.date}</td>
                    <td>{b.invoice_type === 'with_invoice' ? 'Invoice' : 'No Invoice'}</td>
                    <td>{(b.subtotal ?? 0).toLocaleString('en-IN')}</td>
                    <td>{(b.gst_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 700 }}>{(b.total_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--success)' }}>{(b.paid_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td style={{ color: (b.due_amount ?? 0) > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>{(b.due_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td>{b.status === 'PAID' ? <span className="badge badge-success">PAID</span> : <span className="badge badge-danger">DUE</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => editBill(b)}>Edit</button>
                        <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => deleteBill(b.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
