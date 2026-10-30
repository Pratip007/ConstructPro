'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';

interface Site { id: string; name: string; }
interface Product { id: string; name: string; }

export default function StockTransferPage() {
  const { success: notifySuccess, error: notifyError } = useNotification();

  const [productId, setProductId] = useState('');
  const [fromSiteId, setFromSiteId] = useState('');
  const [toSiteId, setToSiteId] = useState('');
  const [qty, setQty] = useState<number>(0);
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [availableQty, setAvailableQty] = useState<number | null>(null);

  const [sites, setSites] = useState<Site[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transfers, setTransfers] = useState<any[]>([]);

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);
  const productItems = useMemo(() => products.map(p => ({ value: p.id, label: p.name })), [products]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    const thisMonth = transfers.filter(t => {
      const d = new Date(t.date || t.transfer_date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return [
      { title: 'Total Transfers', value: transfers.length, icon: 'ri-swap-line', color: 'primary' },
      { title: 'This Month', value: thisMonth, icon: 'ri-calendar-line', color: 'info' },
    ];
  }, [transfers]);

  useEffect(() => {
    apiGet<Site[]>('/sites').then(res => setSites(Array.isArray(res) ? res : [])).catch(() => {});
    apiGet<Product[]>('/products').then(res => setProducts(Array.isArray(res) ? res : [])).catch(() => {});
    loadTransfers();
  }, []);

  useEffect(() => {
    if (productId && fromSiteId) {
      apiGet<any>('/stock/available', { product_id: productId, site_id: fromSiteId })
        .then(res => setAvailableQty(res?.qty ?? res?.qty_available ?? null))
        .catch(() => setAvailableQty(null));
    } else {
      setAvailableQty(null);
    }
  }, [productId, fromSiteId]);

  const loadTransfers = async () => {
    setLoading(true);
    try {
      const res = await apiGet<any[]>('/stock/transfers');
      setTransfers(Array.isArray(res) ? res : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!productId) { notifyError('Please select a product'); return; }
    if (!fromSiteId) { notifyError('Please select source site'); return; }
    if (!toSiteId) { notifyError('Please select destination site'); return; }
    if (fromSiteId === toSiteId) { notifyError('Source and destination cannot be same'); return; }
    if (qty <= 0) { notifyError('Quantity must be greater than 0'); return; }
    if (availableQty !== null && qty > availableQty) { notifyError('Quantity exceeds available stock'); return; }

    setSaving(true);
    try {
      await apiPost('/stock/transfers', {
        product_id: productId,
        from_site_id: fromSiteId,
        to_site_id: toSiteId,
        qty,
        date: transferDate,
        remarks,
      });
      notifySuccess('Stock transferred successfully');
      setProductId(''); setFromSiteId(''); setToSiteId(''); setQty(0); setRemarks('');
      loadTransfers();
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to transfer stock');
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    exportToExcel(transfers, 'stock-transfers', 'Stock Transfers', [
      { key: 'product_name', header: 'Product' },
      { key: 'from_site_name', header: 'From Site' },
      { key: 'to_site_name', header: 'To Site' },
      { key: 'qty', header: 'Qty' },
      { key: 'date', header: 'Date' },
      { key: 'remarks', header: 'Remarks' },
    ]);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-swap-line"></i> Stock Transfer</h1>
        <button className="btn-secondary" onClick={handleExportExcel} disabled={!transfers.length}>
          <i className="ri-file-excel-2-line"></i> Export
        </button>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 12px' }}>Transfer Stock</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Product *</label>
            <SearchableDropdown items={productItems} value={productId} onChange={setProductId} placeholder="Select Product" />
          </div>
          <div className="form-group">
            <label>From Site *</label>
            <SearchableDropdown items={siteItems} value={fromSiteId} onChange={setFromSiteId} placeholder="Source Site" />
          </div>
          <div className="form-group">
            <label>To Site *</label>
            <SearchableDropdown items={siteItems} value={toSiteId} onChange={setToSiteId} placeholder="Destination Site" />
          </div>
          <div className="form-group">
            <label>Quantity *{availableQty !== null ? ` (Available: ${availableQty})` : ''}</label>
            <input type="number" value={qty || ''} onChange={e => setQty(Number(e.target.value))} min={0} placeholder="0" />
          </div>
          <div className="form-group">
            <label>Transfer Date</label>
            <input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Remarks</label>
            <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional remarks" />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn-primary" onClick={handleTransfer} disabled={saving}>
            {saving ? 'Transferring...' : <><i className="ri-swap-line"></i> Transfer</>}
          </button>
        </div>
      </div>

      <div className="card-container" style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 12px' }}>Transfer History</h3>
        {loading ? (
          <div className="skeleton" style={{ height: 150 }}></div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Product</th><th>From Site</th><th>To Site</th><th style={{ textAlign: 'right' }}>Qty</th><th>Date</th><th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr><td colSpan={7} className="empty-state">No transfers yet.</td></tr>
                ) : transfers.map((t, i) => (
                  <tr key={t.id ?? i}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{t.product_name ?? '-'}</td>
                    <td>{t.from_site_name ?? '-'}</td>
                    <td>{t.to_site_name ?? '-'}</td>
                    <td style={{ textAlign: 'right' }}>{t.qty}</td>
                    <td>{t.date ?? t.transfer_date ?? '-'}</td>
                    <td>{t.remarks ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
