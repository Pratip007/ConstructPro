'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import PageHeader from '@/components/PageHeader';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import SearchableDropdown from '@/components/SearchableDropdown';

const UNITS = ['nos', 'kg', 'ltr', 'mtr', 'sqft', 'bag', 'box', 'set'];

export default function DamagedStocksPage() {
  const { apiGet, apiPost, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [records, setRecords] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterSiteId, setFilterSiteId] = useState('');
  const [filterProductId, setFilterProductId] = useState('');

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [productId, setProductId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [unit, setUnit] = useState('nos');
  const [reason, setReason] = useState('');

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

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSiteId) params.append('site_id', filterSiteId);
      if (filterProductId) params.append('product_id', filterProductId);
      const qs = params.toString();
      const url = `/api/damaged-stocks${qs ? `?${qs}` : ''}`;
      const data = await apiGet<any[]>(url);
      setRecords(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load damaged stock records: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError, filterSiteId, filterProductId]);

  useEffect(() => { loadMasters(); }, [loadMasters]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const columns: TableColumn[] = useMemo(() => [
    { key: 'display_id', label: 'Display ID', sortable: true },
    { key: 'date', label: 'Date', sortable: true, type: 'date' },
    { key: 'product_name', label: 'Product', sortable: true },
    { key: 'site_name', label: 'Site', sortable: true },
    { key: 'quantity', label: 'Quantity', sortable: true },
    { key: 'unit', label: 'Unit' },
    { key: 'reason', label: 'Reason' },
  ], []);

  const actions: TableAction[] = useMemo(() => [
    { label: '', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger' },
  ], []);

  const handleAction = useCallback(async (event: { action: string; row: any }) => {
    if (event.action === 'delete') {
      const ok = await confirm({
        title: 'Delete Record',
        message: 'Are you sure you want to delete this damaged stock record?',
        confirmText: 'Delete',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await apiDelete(`/api/damaged-stocks/${event.row.id}`);
        success('Record deleted');
        loadRecords();
      } catch (err: any) {
        notifyError('Delete failed: ' + err.message);
      }
    }
  }, [confirm, apiDelete, success, notifyError, loadRecords]);

  const resetAddForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setProductId('');
    setSiteId('');
    setQuantity(0);
    setUnit('nos');
    setReason('');
  };

  const openAddModal = () => {
    resetAddForm();
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!productId || !siteId || quantity <= 0) {
      notifyError('Product, Site, and a valid Quantity are required.');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/api/damaged-stocks', {
        date,
        product_id: productId,
        site_id: siteId,
        quantity,
        unit,
        reason,
      });
      success('Damaged stock record added');
      setShowAddModal(false);
      loadRecords();
    } catch (err: any) {
      notifyError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <PageHeader title="Damaged Stocks" icon="ri-error-warning-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line"></i> Add Record
        </button>
      </PageHeader>

      {/* Filters */}
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

      {/* Table */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable
          columns={columns}
          data={records}
          loading={loading}
          fileName="damaged-stocks"
          actions={actions}
          onActionClick={handleAction}
          emptyMessage="No damaged stock records found."
        />
      </div>

      {/* Add Modal */}
      <ModalDialog isOpen={showAddModal} title="Report Damaged Stock" size="md" onClose={() => setShowAddModal(false)}>
        <div className="form-grid">
          <div className="form-group">
            <label>Date <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={productItems}
              value={productId}
              onChange={(val: any) => setProductId(val ?? '')}
              label="Product"
              placeholder="Select product"
              required
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={siteId}
              onChange={(val: any) => setSiteId(val ?? '')}
              label="Site"
              placeholder="Select site"
              required
            />
          </div>
          <div className="form-group">
            <label>Quantity <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="number" value={quantity || ''} onChange={e => setQuantity(Number(e.target.value))} min={0} step={1} placeholder="0" />
          </div>
          <div className="form-group">
            <label>Unit</label>
            <select value={unit} onChange={e => setUnit(e.target.value)}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe the reason for damage" rows={3} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <i className="ri-save-line"></i> {saving ? 'Saving...' : 'Add Record'}
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
