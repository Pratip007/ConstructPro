'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { exportToExcel } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards, { type SummaryCard } from '@/components/SummaryCards';

interface Site { id: string; name: string; }
interface Product { id: string; name: string; }

export default function CurrentStockPage() {
  const { error: notifyError } = useNotification();

  const [siteId, setSiteId] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);
  const productItems = useMemo(() => products.map(p => ({ value: p.id, label: p.name })), [products]);

  const filteredRows = useMemo(() => {
    if (!productFilter) return rows;
    return rows.filter(r => r.product_id === productFilter || (r.product_name || '').toLowerCase().includes(productFilter.toLowerCase()));
  }, [rows, productFilter]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    const totalItems = filteredRows.length;
    const cats = new Set(filteredRows.map(r => r.category).filter(Boolean)).size;
    const lowStock = filteredRows.filter(r => (r.qty_available ?? 0) <= (r.min_stock ?? 5)).length;
    return [
      { title: 'Total Items', value: totalItems, icon: 'ri-archive-line', color: 'primary' },
      { title: 'Categories', value: cats, icon: 'ri-folder-line', color: 'info' },
      { title: 'Low Stock', value: lowStock, icon: 'ri-alert-line', color: lowStock > 0 ? 'danger' : 'success' },
    ];
  }, [filteredRows]);

  useEffect(() => {
    apiGet<Site[]>('/sites').then(res => setSites(Array.isArray(res) ? res : [])).catch(() => {});
    apiGet<Product[]>('/products').then(res => setProducts(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const loadStock = useCallback(async () => {
    if (!siteId) { notifyError('Please select a site'); return; }
    setLoading(true);
    try {
      const params: Record<string, string> = { site_id: siteId };
      const res = await apiGet<any[]>('/stock/current', params);
      setRows(Array.isArray(res) ? res : []);
    } catch {
      notifyError('Failed to load current stock');
    } finally {
      setLoading(false);
    }
  }, [siteId, notifyError]);

  const handleExportExcel = () => {
    exportToExcel(filteredRows, 'current-stock', 'Current Stock', [
      { key: 'product_name', header: 'Product' },
      { key: 'unit', header: 'Unit' },
      { key: 'qty_available', header: 'Qty Available' },
      { key: 'last_updated', header: 'Last Updated' },
    ]);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-stack-line"></i> Current Stock</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleExportExcel} disabled={!filteredRows.length}>
            <i className="ri-file-excel-2-line"></i> Export
          </button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <label>Site *</label>
            <SearchableDropdown items={siteItems} value={siteId} onChange={setSiteId} placeholder="Select Site" />
          </div>
          <div className="form-group">
            <label>Filter Product</label>
            <SearchableDropdown items={productItems} value={productFilter} onChange={setProductFilter} placeholder="All Products" />
          </div>
          <div className="form-group" style={{ alignSelf: 'end' }}>
            <button className="btn-primary" onClick={loadStock} disabled={loading}>
              {loading ? 'Loading...' : 'Load Stock'}
            </button>
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
                <th>#</th><th>Product</th><th>Unit</th><th style={{ textAlign: 'right' }}>Qty Available</th><th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr><td colSpan={5} className="empty-state">No stock data. Select a site and load.</td></tr>
              ) : filteredRows.map((row, i) => (
                <tr key={i} style={(row.qty_available ?? 0) <= (row.min_stock ?? 5) ? { background: 'rgba(231,76,60,0.05)' } : undefined}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{row.product_name ?? '-'}</td>
                  <td>{row.unit ?? '-'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: (row.qty_available ?? 0) <= (row.min_stock ?? 5) ? 'var(--danger)' : 'var(--success)' }}>
                    {row.qty_available ?? 0}
                  </td>
                  <td style={{ fontSize: 12 }}>{row.last_updated ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
