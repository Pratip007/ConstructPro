'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import PageHeader from '@/components/PageHeader';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import SearchableDropdown from '@/components/SearchableDropdown';

interface TransferItem {
  product_id: string;
  product_name?: string;
  qty: number;
}

const emptyItem = (): TransferItem => ({ product_id: '', qty: 0 });

export default function StockTransfersPage() {
  const { apiGet, apiPost, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [transfers, setTransfers] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterFromSite, setFilterFromSite] = useState('');
  const [filterToSite, setFilterToSite] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromSiteId, setFromSiteId] = useState('');
  const [toSiteId, setToSiteId] = useState('');
  const [items, setItems] = useState<TransferItem[]>([emptyItem()]);
  const [remarks, setRemarks] = useState('');

  // View modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewTransfer, setViewTransfer] = useState<any>(null);

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

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterFromSite) params.append('from_site', filterFromSite);
      if (filterToSite) params.append('to_site', filterToSite);
      if (filterStatus) params.append('status', filterStatus);
      const qs = params.toString();
      const url = `/api/stock-transfers${qs ? `?${qs}` : ''}`;
      const data = await apiGet<any[]>(url);
      setTransfers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load transfers: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError, filterFromSite, filterToSite, filterStatus]);

  useEffect(() => { loadMasters(); }, [loadMasters]);
  useEffect(() => { loadTransfers(); }, [loadTransfers]);

  const columns: TableColumn[] = useMemo(() => [
    { key: 'transfer_number', label: 'Display ID', sortable: true },
    { key: 'date', label: 'Date', sortable: true, type: 'date' },
    { key: 'from_site_name', label: 'From Site', sortable: true },
    { key: 'to_site_name', label: 'To Site', sortable: true },
    { key: 'status', label: 'Status', sortable: true, type: 'badge', badgeMap: { pending: 'warning', completed: 'success', cancelled: 'danger' } },
    { key: 'remarks', label: 'Remarks' },
  ], []);

  const actions: TableAction[] = useMemo(() => [
    { label: '', icon: 'ri-eye-line', action: 'view' },
    { label: '', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger', show: (row: any) => row.status === 'pending' },
  ], []);

  const getProductName = useCallback((id: string) => products.find(p => p.id === id)?.name ?? '--', [products]);
  const getSiteName = useCallback((id: string) => sites.find(s => s.id === id)?.name ?? '--', [sites]);

  const handleAction = useCallback(async (event: { action: string; row: any }) => {
    const { action, row } = event;
    if (action === 'view') {
      setViewTransfer(row);
      setShowViewModal(true);
    } else if (action === 'delete') {
      const ok = await confirm({
        title: 'Delete Transfer',
        message: `Delete transfer "${row.transfer_number}"? This cannot be undone.`,
        confirmText: 'Delete',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await apiDelete(`/api/stock-transfers/${row.id}`);
        success('Transfer deleted');
        loadTransfers();
      } catch (err: any) {
        notifyError('Delete failed: ' + err.message);
      }
    }
  }, [confirm, apiDelete, success, notifyError, loadTransfers]);

  // Item management
  const updateItem = (index: number, field: keyof TransferItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const resetAddForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setFromSiteId('');
    setToSiteId('');
    setItems([emptyItem()]);
    setRemarks('');
  };

  const openAddModal = () => {
    resetAddForm();
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!fromSiteId || !toSiteId) {
      notifyError('From Site and To Site are required.');
      return;
    }
    if (fromSiteId === toSiteId) {
      notifyError('From Site and To Site must be different.');
      return;
    }
    const validItems = items.filter(it => it.product_id && it.qty > 0);
    if (validItems.length === 0) {
      notifyError('Add at least one item with product and quantity.');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/api/stock-transfers', {
        date,
        from_site_id: fromSiteId,
        to_site_id: toSiteId,
        items: validItems.map(it => ({ product_id: it.product_id, qty: it.qty })),
        remarks,
      });
      success('Transfer created successfully');
      setShowAddModal(false);
      loadTransfers();
    } catch (err: any) {
      notifyError('Failed to create transfer: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <PageHeader title="Stock Transfers" icon="ri-swap-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line"></i> Add Transfer
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid" style={{ marginBottom: 0 }}>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={filterFromSite}
              onChange={(val: any) => setFilterFromSite(val ?? '')}
              label="From Site"
              placeholder="All Sites"
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={filterToSite}
              onChange={(val: any) => setFilterToSite(val ?? '')}
              label="To Site"
              placeholder="All Sites"
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => { setFilterFromSite(''); setFilterToSite(''); setFilterStatus(''); }}>
              <i className="ri-refresh-line"></i> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable
          columns={columns}
          data={transfers}
          loading={loading}
          fileName="stock-transfers"
          actions={actions}
          onActionClick={handleAction}
          emptyMessage="No stock transfers found."
        />
      </div>

      {/* Add Transfer Modal */}
      <ModalDialog isOpen={showAddModal} title="New Stock Transfer" size="lg" onClose={() => setShowAddModal(false)}>
        <div className="form-grid">
          <div className="form-group">
            <label>Date <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={fromSiteId}
              onChange={(val: any) => setFromSiteId(val ?? '')}
              label="From Site"
              placeholder="Select source site"
              required
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={toSiteId}
              onChange={(val: any) => setToSiteId(val ?? '')}
              label="To Site"
              placeholder="Select destination site"
              required
            />
          </div>
        </div>

        <h4 style={{ margin: '20px 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Transfer Items</h4>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th style={{ textAlign: 'right' }}>Quantity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td style={{ minWidth: 220 }}>
                    <SearchableDropdown
                      items={productItems}
                      value={item.product_id}
                      onChange={(val: any) => updateItem(idx, 'product_id', val ?? '')}
                      placeholder="Select product"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={item.qty || ''}
                      onChange={e => updateItem(idx, 'qty', Number(e.target.value))}
                      min={0}
                      step={1}
                      style={{ width: 100, textAlign: 'right' }}
                    />
                  </td>
                  <td>
                    <button
                      className="btn-danger"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => removeItem(idx)}
                      disabled={items.length <= 1}
                      title="Remove"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button className="btn-secondary" onClick={addItem} style={{ marginTop: 10 }}>
          <i className="ri-add-line"></i> Add Item
        </button>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label>Remarks</label>
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional remarks" rows={2} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <i className="ri-save-line"></i> {saving ? 'Saving...' : 'Create Transfer'}
          </button>
        </div>
      </ModalDialog>

      {/* View Transfer Modal */}
      <ModalDialog isOpen={showViewModal} title="Transfer Details" size="lg" onClose={() => setShowViewModal(false)}>
        {viewTransfer && (
          <>
            <div className="form-grid">
              <div className="form-group">
                <label>Transfer ID</label>
                <p style={{ fontWeight: 700, fontFamily: 'monospace' }}>{viewTransfer.transfer_number ?? '--'}</p>
              </div>
              <div className="form-group">
                <label>Date</label>
                <p>{viewTransfer.date?.split?.('T')?.[0] ?? viewTransfer.date ?? '--'}</p>
              </div>
              <div className="form-group">
                <label>From Site</label>
                <p>{viewTransfer.from_site_name ?? getSiteName(viewTransfer.from_site_id) ?? '--'}</p>
              </div>
              <div className="form-group">
                <label>To Site</label>
                <p>{viewTransfer.to_site_name ?? getSiteName(viewTransfer.to_site_id) ?? '--'}</p>
              </div>
              <div className="form-group">
                <label>Status</label>
                <p>
                  <span className={`badge ${viewTransfer.status === 'completed' ? 'badge-success' : viewTransfer.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                    {viewTransfer.status}
                  </span>
                </p>
              </div>
              {viewTransfer.remarks && (
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Remarks</label>
                  <p>{viewTransfer.remarks}</p>
                </div>
              )}
            </div>

            <h4 style={{ margin: '20px 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Items</h4>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th style={{ textAlign: 'right' }}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewTransfer.items ?? []).length === 0 ? (
                    <tr><td colSpan={3} className="empty-state">No items found.</td></tr>
                  ) : (viewTransfer.items ?? []).map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{item.product_name ?? getProductName(item.product_id)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.qty ?? item.quantity ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ModalDialog>
    </div>
  );
}
