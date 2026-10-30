'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import PageHeader from '@/components/PageHeader';
import DataTable, { TableColumn } from '@/components/DataTable';
import SearchableDropdown from '@/components/SearchableDropdown';

export default function SiteInventoryPage() {
  const { apiGet } = useApi();
  const { error: notifyError } = useNotification();

  const [inventory, setInventory] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterSiteId, setFilterSiteId] = useState('');
  const [filterProductId, setFilterProductId] = useState('');

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);
  const productItems = useMemo(() => products.map(p => ({ value: p.id, label: p.name })), [products]);

  const loadMasters = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        apiGet<any[]>('/api/sites'),
        apiGet<any[]>('/api/stock-products'),
      ]);
      setSites(Array.isArray(s) ? s : []);
      setProducts(Array.isArray(p) ? p : []);
    } catch (err: any) {
      notifyError('Failed to load masters: ' + err.message);
    }
  }, [apiGet, notifyError]);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSiteId) params.append('site_id', filterSiteId);
      if (filterProductId) params.append('product_id', filterProductId);
      const qs = params.toString();
      const url = `/api/site-inventory${qs ? `?${qs}` : ''}`;
      const data = await apiGet<any[]>(url);
      setInventory(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load inventory: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError, filterSiteId, filterProductId]);

  useEffect(() => { loadMasters(); }, [loadMasters]);
  useEffect(() => { loadInventory(); }, [loadInventory]);

  const columns: TableColumn[] = useMemo(() => [
    { key: 'product_name', label: 'Product', sortable: true },
    { key: 'site_name', label: 'Site', sortable: true },
    { key: 'quantity', label: 'Quantity', sortable: true },
    { key: 'updated_at', label: 'Last Updated', sortable: true, type: 'date' },
  ], []);

  return (
    <div className="page-container">
      <PageHeader title="Site Inventory" icon="ri-archive-line" />

      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid" style={{ marginBottom: 0 }}>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={filterSiteId}
              onChange={(val: any) => setFilterSiteId(val ?? '')}
              label="Filter by Site"
              placeholder="All Sites"
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={productItems}
              value={filterProductId}
              onChange={(val: any) => setFilterProductId(val ?? '')}
              label="Filter by Product"
              placeholder="All Products"
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => { setFilterSiteId(''); setFilterProductId(''); }}>
              <i className="ri-refresh-line"></i> Reset
            </button>
          </div>
        </div>
      </div>

      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable
          columns={columns}
          data={inventory}
          loading={loading}
          fileName="site-inventory"
          showFooterTotals={true}
          emptyMessage="No inventory records found."
        />
      </div>
    </div>
  );
}
