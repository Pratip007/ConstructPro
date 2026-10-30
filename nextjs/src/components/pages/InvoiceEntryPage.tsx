'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { exportToExcel, exportToPDF } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import styles from './InvoiceEntryPage.module.scss';

interface InvoiceItem {
  description: string;
  hsn: string;
  qty: number;
  rate: number;
  amount: number;
  gst_percent: number;
  gst_amount: number;
}

interface Invoice {
  id: string;
  invoice_no: string;
  company_id: string;
  company_name?: string;
  site_id: string;
  site_name?: string;
  date: string;
  due_date?: string;
  items: InvoiceItem[];
  subtotal: number;
  total_gst: number;
  tds_percent: number;
  tds_amount: number;
  grand_total: number;
  status: string;
}

const emptyItem = (): InvoiceItem => ({
  description: '', hsn: '', qty: 0, rate: 0, amount: 0, gst_percent: 18, gst_amount: 0,
});

export default function InvoiceEntryPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form
  const [invoiceNo, setInvoiceNo] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [tdsPercent, setTdsPercent] = useState(0);
  const [invoiceStatus, setInvoiceStatus] = useState('draft');
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);

  const companyItems = useMemo(() => companies.map(c => ({ value: String(c.id), label: c.name })), [companies]);
  const siteItems = useMemo(() => sites.map(s => ({ value: String(s.id), label: s.name })), [sites]);

  const subtotal = useMemo(() => items.reduce((s, it) => s + it.amount, 0), [items]);
  const totalGst = useMemo(() => items.reduce((s, it) => s + it.gst_amount, 0), [items]);
  const tdsAmount = useMemo(() => Math.round(subtotal * tdsPercent / 100 * 100) / 100, [subtotal, tdsPercent]);
  const grandTotal = useMemo(() => Math.round((subtotal + totalGst - tdsAmount) * 100) / 100, [subtotal, totalGst, tdsAmount]);

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return invoices;
    return invoices.filter(inv =>
      inv.invoice_no.toLowerCase().includes(q) ||
      (inv.company_name || '').toLowerCase().includes(q) ||
      (inv.site_name || '').toLowerCase().includes(q)
    );
  }, [invoices, searchQuery]);

  const summaryCards = useMemo(() => {
    const total = invoices.length;
    const totalVal = invoices.reduce((s, inv) => s + (inv.grand_total ?? 0), 0);
    const paid = invoices.filter(inv => inv.status === 'paid').length;
    const draft = invoices.filter(inv => inv.status === 'draft').length;
    return [
      { title: 'Total Invoices', value: total, icon: 'ri-file-text-line', color: 'primary' as const },
      { title: 'Total Value', value: totalVal, prefix: '₹', icon: 'ri-money-rupee-circle-line', color: 'info' as const },
      { title: 'Paid', value: paid, icon: 'ri-checkbox-circle-line', color: 'success' as const },
      { title: 'Draft', value: draft, icon: 'ri-draft-line', color: 'warning' as const },
    ];
  }, [invoices]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Invoice[]>('/invoices');
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load invoices: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadInvoices();
    apiGet<any[]>('/companies').then(d => setCompanies(d ?? [])).catch(() => {});
    apiGet<any[]>('/sites').then(d => setSites(d ?? [])).catch(() => {});
  }, [loadInvoices]);

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
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
    setInvoiceNo('');
    setCompanyId('');
    setSiteId('');
    setDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setTdsPercent(0);
    setInvoiceStatus('draft');
    setItems([emptyItem()]);
  };

  const handleSave = async () => {
    if (!companyId || !siteId) {
      notifyError('Company and Site are required.');
      return;
    }
    const validItems = items.filter(it => it.description && it.qty > 0);
    if (validItems.length === 0) {
      notifyError('Add at least one item.');
      return;
    }

    const payload = {
      invoice_no: invoiceNo || undefined,
      company_id: companyId,
      site_id: siteId,
      date,
      due_date: dueDate || undefined,
      items: validItems,
      subtotal,
      total_gst: totalGst,
      tds_percent: tdsPercent,
      tds_amount: tdsAmount,
      grand_total: grandTotal,
      status: invoiceStatus,
    };

    setSaving(true);
    try {
      if (editingId) {
        const updated = await apiPut<Invoice>(`/invoices/${editingId}`, payload);
        setInvoices(prev => prev.map(inv => (inv.id === updated.id ? updated : inv)));
        success('Invoice updated.');
      } else {
        const created = await apiPost<Invoice>('/invoices', payload);
        setInvoices(prev => [...prev, created]);
        success('Invoice created.');
      }
      resetForm();
    } catch (err: any) {
      notifyError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const editInvoice = (inv: Invoice) => {
    setEditingId(inv.id);
    setInvoiceNo(inv.invoice_no || '');
    setCompanyId(inv.company_id || '');
    setSiteId(inv.site_id || '');
    setDate(inv.date || '');
    setDueDate(inv.due_date || '');
    setTdsPercent(inv.tds_percent ?? 0);
    setInvoiceStatus(inv.status || 'draft');
    setItems(inv.items?.length ? inv.items : [emptyItem()]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteInvoice = async (inv: Invoice) => {
    const confirmed = await confirm({
      title: 'Delete Invoice',
      message: `Delete invoice "${inv.invoice_no}"?`,
      confirmText: 'Delete',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await apiDelete(`/invoices/${inv.id}`);
      setInvoices(prev => prev.filter(x => x.id !== inv.id));
      success('Invoice deleted.');
    } catch (err: any) {
      notifyError('Failed to delete: ' + err.message);
    }
  };

  const handleExportExcel = () => {
    exportToExcel(filteredInvoices as any, 'invoices', 'Invoices', [
      { key: 'invoice_no', header: 'Invoice No' },
      { key: 'company_name', header: 'Company' },
      { key: 'site_name', header: 'Site' },
      { key: 'date', header: 'Date' },
      { key: 'subtotal', header: 'Subtotal' },
      { key: 'total_gst', header: 'GST' },
      { key: 'tds_amount', header: 'TDS' },
      { key: 'grand_total', header: 'Grand Total' },
      { key: 'status', header: 'Status' },
    ]);
  };

  const handleExportPdf = (inv: Invoice) => {
    exportToPDF({
      title: `Invoice - ${inv.invoice_no}`,
      fileName: `invoice_${inv.invoice_no}`,
      data: inv.items as any,
      columns: [
        { key: 'description', header: 'Description' },
        { key: 'hsn', header: 'HSN' },
        { key: 'qty', header: 'Qty', align: 'right' },
        { key: 'rate', header: 'Rate', format: 'currency', align: 'right' },
        { key: 'amount', header: 'Amount', format: 'currency', align: 'right' },
        { key: 'gst_percent', header: 'GST %', align: 'right' },
        { key: 'gst_amount', header: 'GST Amt', format: 'currency', align: 'right' },
      ],
      summaryRow: {
        description: 'TOTAL', hsn: '', qty: '', rate: '',
        amount: inv.subtotal, gst_percent: '', gst_amount: inv.total_gst,
      },
    });
  };

  const formatCurrency = (val: number) => {
    if (!val) return '--';
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return 'badge badge-success';
      case 'sent': return 'badge badge-info';
      case 'draft': return 'badge badge-warning';
      case 'overdue': return 'badge badge-danger';
      default: return 'badge badge-info';
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{editingId ? 'Edit Invoice' : 'Invoice Entry'}</h1>
      </div>

      <SummaryCards cards={summaryCards} />

      {/* Invoice Form */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <label>Invoice Number</label>
            <input type="text" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="Auto-generated if empty" />
          </div>
          <div className="form-group">
            <label>Company *</label>
            <SearchableDropdown items={companyItems} value={companyId} onChange={val => setCompanyId(val as string)} placeholder="Select company" />
          </div>
          <div className="form-group">
            <label>Site *</label>
            <SearchableDropdown items={siteItems} value={siteId} onChange={val => setSiteId(val as string)} placeholder="Select site" />
          </div>
          <div className="form-group">
            <label>Invoice Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>TDS %</label>
            <input type="number" value={tdsPercent} onChange={e => setTdsPercent(Number(e.target.value))} min={0} max={100} step={0.1} />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={invoiceStatus} onChange={e => setInvoiceStatus(e.target.value)}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {/* Line Items */}
        <h3 style={{ margin: '20px 0 12px' }}>Invoice Items</h3>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>HSN</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Rate</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>GST %</th>
                <th style={{ textAlign: 'right' }}>GST Amt</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td><input type="text" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Item description" style={{ minWidth: 180 }} /></td>
                  <td><input type="text" value={item.hsn} onChange={e => updateItem(idx, 'hsn', e.target.value)} style={{ width: 80 }} /></td>
                  <td><input type="number" value={item.qty || ''} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} style={{ width: 70, textAlign: 'right' }} min={0} /></td>
                  <td><input type="number" value={item.rate || ''} onChange={e => updateItem(idx, 'rate', Number(e.target.value))} style={{ width: 90, textAlign: 'right' }} min={0} step={0.01} /></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.amount)}</td>
                  <td>
                    <select value={item.gst_percent} onChange={e => updateItem(idx, 'gst_percent', Number(e.target.value))} style={{ width: 70 }}>
                      {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--warning)' }}>{formatCurrency(item.gst_amount)}</td>
                  <td>
                    <button className="btn-icon" onClick={() => removeItem(idx)} disabled={items.length <= 1} style={{ color: 'var(--danger)' }}>
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className={styles.invoiceSummary}>
          <div className={styles.summaryLine}>
            <span>Subtotal:</span>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>
          <div className={styles.summaryLine}>
            <span>Total GST:</span>
            <strong style={{ color: 'var(--warning)' }}>{formatCurrency(totalGst)}</strong>
          </div>
          {tdsPercent > 0 && (
            <div className={styles.summaryLine}>
              <span>TDS ({tdsPercent}%):</span>
              <strong style={{ color: 'var(--danger)' }}>-{formatCurrency(tdsAmount)}</strong>
            </div>
          )}
          <div className={`${styles.summaryLine} ${styles.grandTotal}`}>
            <span>Grand Total:</span>
            <strong>{formatCurrency(grandTotal)}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn-secondary" onClick={addItem}>
            <i className="ri-add-line"></i> Add Item
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ marginLeft: 'auto' }}>
            <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
            {saving ? 'Saving...' : editingId ? 'Update Invoice' : 'Create Invoice'}
          </button>
          {editingId && (
            <button className="btn-secondary" onClick={resetForm}>
              <i className="ri-close-line"></i> Cancel
            </button>
          )}
        </div>
      </div>

      {/* Invoice List */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <div className={styles.toolbarRow}>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search invoices..." className={styles.searchInput} />
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
                <th>Invoice No</th>
                <th>Company</th>
                <th>Site</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Grand Total</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">No invoices found.</td></tr>
              ) : (
                filteredInvoices.map((inv, i) => (
                  <tr key={inv.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{inv.invoice_no}</td>
                    <td>{inv.company_name || '--'}</td>
                    <td>{inv.site_name || '--'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{inv.date}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(inv.grand_total)}</td>
                    <td><span className={getStatusBadge(inv.status)}>{inv.status}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <div className={styles.actionButtons}>
                        <button className={styles.btnIcon} onClick={() => handleExportPdf(inv)} title="PDF">
                          <i className="ri-file-pdf-line"></i>
                        </button>
                        <button className={styles.btnIcon} onClick={() => editInvoice(inv)} title="Edit">
                          <i className="ri-edit-line"></i>
                        </button>
                        <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => deleteInvoice(inv)} title="Delete">
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
