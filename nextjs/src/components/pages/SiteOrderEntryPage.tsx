'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { exportToExcel, printReport } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import styles from './SiteOrderEntryPage.module.scss';

interface Contractor { id: number; name: string; tds_applicable?: boolean; tds_percent?: number; }
interface Site { id: number; name: string; }
interface Product { id: number; name: string; unit: string; price: number; gst_percent: number; }

interface LineItem {
  product: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

interface SiteOrder {
  id: number;
  contractor_id: number;
  contractor_name?: string;
  site_id: number;
  site_name?: string;
  date: string;
  items: LineItem[];
  total_amount: number;
  tds_amount: number;
  net_payable: number;
  status?: string;
}

export default function SiteOrderEntryPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<SiteOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedContractorId, setSelectedContractorId] = useState<number | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [items, setItems] = useState<LineItem[]>([
    { product: '', description: '', qty: 1, rate: 0, amount: 0 },
  ]);

  const contractorItems = useMemo(() =>
    contractors.map(c => ({ value: c.id, label: c.name })), [contractors]
  );
  const siteItems = useMemo(() =>
    sites.map(s => ({ value: s.id, label: s.name })), [sites]
  );

  const selectedContractor = useMemo(() =>
    contractors.find(c => c.id === selectedContractorId) ?? null,
    [contractors, selectedContractorId]
  );

  const totalAmount = useMemo(() =>
    items.reduce((s, item) => s + item.amount, 0), [items]
  );

  const tdsAmount = useMemo(() => {
    if (!selectedContractor?.tds_applicable || !selectedContractor.tds_percent) return 0;
    return Math.round(totalAmount * selectedContractor.tds_percent / 100 * 100) / 100;
  }, [totalAmount, selectedContractor]);

  const netPayable = useMemo(() =>
    Math.round((totalAmount - tdsAmount) * 100) / 100, [totalAmount, tdsAmount]
  );

  const summaryCards = useMemo(() => [
    { title: 'Total Orders', value: orders.length, icon: 'ri-file-list-line', color: 'primary' as const },
    { title: 'Total Amount', value: orders.reduce((s, o) => s + o.total_amount, 0), prefix: '₹', icon: 'ri-money-rupee-circle-line', color: 'info' as const },
    { title: 'Net Payable', value: orders.reduce((s, o) => s + o.net_payable, 0), prefix: '₹', icon: 'ri-wallet-line', color: 'success' as const },
  ], [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return orders;
    return orders.filter(o =>
      (o.contractor_name || '').toLowerCase().includes(q) ||
      (o.site_name || '').toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  useEffect(() => {
    apiGet<Contractor[]>('/contractors').then(setContractors).catch(() => {});
    apiGet<Site[]>('/sites').then(setSites).catch(() => {});
    apiGet<Product[]>('/stock-products').then(setProducts).catch(() => {});
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await apiGet<SiteOrder[]>('/contractor-site-orders');
      setOrders(data);
    } catch (err: any) {
      notifyError('Failed to load orders: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'qty' || field === 'rate') {
        updated[index].amount = updated[index].qty * updated[index].rate;
      }
      return updated;
    });
  };

  const addItem = () => {
    setItems(prev => [...prev, { product: '', description: '', qty: 1, rate: 0, amount: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setEditingId(null);
    setSelectedContractorId(null);
    setSelectedSiteId(null);
    setOrderDate(new Date().toISOString().split('T')[0]);
    setItems([{ product: '', description: '', qty: 1, rate: 0, amount: 0 }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractorId || !selectedSiteId) {
      notifyError('Please select contractor and site.');
      return;
    }
    if (items.every(i => !i.product && !i.description)) {
      notifyError('Please add at least one line item.');
      return;
    }

    const payload = {
      contractor_id: selectedContractorId,
      site_id: selectedSiteId,
      date: orderDate,
      items: items.filter(i => i.product || i.description),
      total_amount: totalAmount,
      tds_amount: tdsAmount,
      net_payable: netPayable,
    };

    setSaving(true);
    try {
      if (editingId) {
        const updated = await apiPut<SiteOrder>(`/contractor-site-orders/${editingId}`, payload);
        setOrders(list => list.map(o => o.id === updated.id ? updated : o));
        success('Order updated.');
      } else {
        const created = await apiPost<SiteOrder>('/contractor-site-orders', payload);
        setOrders(list => [...list, created]);
        success('Order created.');
      }
      resetForm();
    } catch (err: any) {
      notifyError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const editOrder = (o: SiteOrder) => {
    setEditingId(o.id);
    setSelectedContractorId(o.contractor_id);
    setSelectedSiteId(o.site_id);
    setOrderDate(o.date);
    setItems(o.items.length > 0 ? o.items : [{ product: '', description: '', qty: 1, rate: 0, amount: 0 }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteOrder = async (o: SiteOrder) => {
    const ok = await confirm({
      title: 'Delete Order',
      message: `Delete this order? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await apiDelete(`/contractor-site-orders/${o.id}`);
      setOrders(list => list.filter(x => x.id !== o.id));
      success('Order deleted.');
    } catch (err: any) {
      notifyError('Failed to delete: ' + err.message);
    }
  };

  const formatCurrency = (val: number) => {
    if (!val) return '--';
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{editingId ? 'Edit Site Order' : 'Site Order Entry'}</h1>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 16 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <SearchableDropdown
                items={contractorItems}
                label="Select Contractor *"
                placeholder="Search contractor..."
                value={selectedContractorId}
                onChange={(val: any) => setSelectedContractorId(val)}
              />
            </div>
            <div className="form-group">
              <SearchableDropdown
                items={siteItems}
                label="Select Site *"
                placeholder="Search site..."
                value={selectedSiteId}
                onChange={(val: any) => setSelectedSiteId(val)}
              />
            </div>
            <div className="form-group">
              <label>Order Date *</label>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} required />
            </div>
          </div>

          <h3 style={{ margin: '20px 0 12px' }}>Line Items</h3>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product / Description</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <input type="text" value={item.product} onChange={e => updateItem(i, 'product', e.target.value)} placeholder="Product name" style={{ minWidth: 140 }} />
                    </td>
                    <td>
                      <input type="text" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Description" style={{ minWidth: 140 }} />
                    </td>
                    <td>
                      <input type="number" value={item.qty} onChange={e => updateItem(i, 'qty', Number(e.target.value))} min={0} step={0.01} style={{ width: 80 }} />
                    </td>
                    <td>
                      <input type="number" value={item.rate} onChange={e => updateItem(i, 'rate', Number(e.target.value))} min={0} step={0.01} style={{ width: 100 }} />
                    </td>
                    <td style={{ fontWeight: 600, textAlign: 'right' }}>{formatCurrency(item.amount)}</td>
                    <td>
                      <button type="button" className="btn-secondary" onClick={() => removeItem(i)} style={{ padding: '4px 8px', fontSize: 12 }} disabled={items.length <= 1}>
                        <i className="ri-delete-bin-line" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="btn-secondary" onClick={addItem} style={{ marginTop: 8 }}>
            <i className="ri-add-line" /> Add Item
          </button>

          <div className={styles.totalSection}>
            <div className={styles.totalRow}>
              <span>Total Amount:</span>
              <strong>{formatCurrency(totalAmount)}</strong>
            </div>
            {tdsAmount > 0 && (
              <div className={styles.totalRow}>
                <span>TDS Deduction ({selectedContractor?.tds_percent}%):</span>
                <strong style={{ color: 'var(--danger)' }}>-{formatCurrency(tdsAmount)}</strong>
              </div>
            )}
            <div className={styles.totalRow}>
              <span>Net Payable:</span>
              <strong style={{ color: 'var(--success)', fontSize: 18 }}>{formatCurrency(netPayable)}</strong>
            </div>
          </div>

          <div className={styles.formActions} style={{ marginTop: 16 }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'} />
              {saving ? 'Saving...' : editingId ? 'Update Order' : 'Create Order'}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                <i className="ri-close-line" /> Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card-container" style={{ marginTop: 16 }}>
        <div className={styles.toolbarRow}>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search orders..." className={styles.searchInput} />
          <button className="btn-secondary" onClick={() => exportToExcel(orders as any, 'site-orders', 'Site Orders', [
            { key: 'date', header: 'Date' }, { key: 'contractor_name', header: 'Contractor' },
            { key: 'site_name', header: 'Site' }, { key: 'total_amount', header: 'Total' },
            { key: 'tds_amount', header: 'TDS' }, { key: 'net_payable', header: 'Net Payable' },
          ])}>
            <i className="ri-file-excel-2-line" /> Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, marginTop: 16 }} />
      ) : (
        <div className="table-responsive" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Contractor</th>
                <th>Site</th>
                <th className={styles.textRight}>Total</th>
                <th className={styles.textRight}>TDS</th>
                <th className={styles.textRight}>Net Payable</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">No orders found.</td></tr>
              ) : (
                filteredOrders.map((o, i) => (
                  <tr key={o.id}>
                    <td>{i + 1}</td>
                    <td>{o.date}</td>
                    <td style={{ fontWeight: 600 }}>{o.contractor_name}</td>
                    <td>{o.site_name}</td>
                    <td className={styles.textRight}>{formatCurrency(o.total_amount)}</td>
                    <td className={`${styles.textRight} ${styles.textDanger}`}>{formatCurrency(o.tds_amount)}</td>
                    <td className={`${styles.textRight} ${styles.textSuccess}`}>{formatCurrency(o.net_payable)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className={styles.actionButtons}>
                        <button className={styles.btnIcon} onClick={() => editOrder(o)} title="Edit"><i className="ri-edit-line" /></button>
                        <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => deleteOrder(o)} title="Delete"><i className="ri-delete-bin-line" /></button>
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
