'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import DataTable, { type TableColumn, type TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown from '@/components/SearchableDropdown';

interface Retailer {
  id: string;
  display_id?: string;
  retailer_id?: string;
  name: string;
  phone?: string;
  address?: string;
  gst_status: string;
  gst_number?: string;
  site_id?: string;
  site_name?: string;
  category_id?: string;
  category_name?: string;
  status?: string;
}

interface Site { id: string; name: string; }
interface Category { id: string; name: string; }

const emptyForm = {
  name: '',
  phone: '',
  address: '',
  gst_status: 'NO' as 'YES' | 'NO',
  gst_number: '',
  site_id: '',
  category_id: '',
};

export default function RetailersPage() {
  const { apiGet, apiPost, apiPut, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSiteId, setFilterSiteId] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);
  const categoryItems = useMemo(() => categories.map(c => ({ value: c.id, label: c.name })), [categories]);

  const columns: TableColumn[] = useMemo(() => [
    { key: 'display_id', label: 'Display ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'phone', label: 'Phone', sortable: false },
    { key: 'address', label: 'Address', sortable: false },
    { key: 'gst_status', label: 'GST Status', type: 'badge', sortable: true, badgeMap: { YES: 'success', NO: 'warning' } },
    { key: 'gst_number', label: 'GST Number', sortable: false },
    { key: 'site_name', label: 'Site', sortable: true },
    { key: 'status', label: 'Status', type: 'badge', sortable: true, badgeMap: { active: 'success', inactive: 'danger' } },
  ], []);

  const actions: TableAction[] = useMemo(() => [
    { label: '', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary' },
    { label: '', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger' },
  ], []);

  const loadMasters = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        apiGet<Site[]>('/api/sites'),
        apiGet<Category[]>('/api/retailer-categories'),
      ]);
      setSites(Array.isArray(s) ? s : []);
      setCategories(Array.isArray(c) ? c : []);
    } catch { }
  }, [apiGet]);

  const loadRetailers = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/retailers';
      const params: string[] = [];
      if (filterStatus !== 'all') params.push(`status=${filterStatus}`);
      if (filterSiteId) params.push(`site_id=${filterSiteId}`);
      if (filterCategoryId) params.push(`category_id=${filterCategoryId}`);
      if (params.length) url += `?${params.join('&')}`;
      const data = await apiGet<Retailer[]>(url);
      setRetailers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load retailers: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [apiGet, filterStatus, filterSiteId, filterCategoryId, notifyError]);

  useEffect(() => { loadMasters(); }, [loadMasters]);
  useEffect(() => { loadRetailers(); }, [loadRetailers]);

  const tableData = useMemo(() =>
    retailers.map(r => ({
      ...r,
      display_id: r.display_id || r.retailer_id || r.id,
      gst_status: r.gst_status === 'YES' || r.gst_status === 'true' || r.gst_status === true as any ? 'YES' : 'NO',
      status: r.status || 'active',
    })),
    [retailers]
  );

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (retailer: Retailer) => {
    setEditingId(retailer.id);
    setForm({
      name: retailer.name || '',
      phone: retailer.phone || '',
      address: retailer.address || '',
      gst_status: (retailer.gst_status === 'YES' || retailer.gst_status === 'true') ? 'YES' : 'NO',
      gst_number: retailer.gst_number || '',
      site_id: retailer.site_id || '',
      category_id: retailer.category_id || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      notifyError('Retailer name is required.');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      phone: form.phone || null,
      address: form.address || null,
      gst_status: form.gst_status,
      gst_number: form.gst_status === 'YES' ? form.gst_number : null,
      site_id: form.site_id || null,
      category_id: form.category_id || null,
    };
    try {
      if (editingId) {
        await apiPut(`/api/retailers/${editingId}`, payload);
        success('Retailer updated successfully.');
      } else {
        await apiPost('/api/retailers', payload);
        success('Retailer added successfully.');
      }
      setShowModal(false);
      loadRetailers();
    } catch (err: any) {
      notifyError('Failed to save retailer: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (retailer: Retailer) => {
    const ok = await confirm({
      title: 'Delete Retailer',
      message: `Are you sure you want to delete "${retailer.name}"?`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/retailers/${retailer.id}`);
      success('Retailer deleted.');
      loadRetailers();
    } catch (err: any) {
      notifyError('Delete failed: ' + err.message);
    }
  };

  const handleAction = (event: { action: string; row: any }) => {
    if (event.action === 'edit') openEdit(event.row);
    else if (event.action === 'delete') handleDelete(event.row);
  };

  return (
    <div className="page-container">
      <PageHeader title="Retailers" icon="ri-store-2-line">
        <button className="btn-primary" onClick={openAdd}>
          <i className="ri-add-line"></i> Add Retailer
        </button>
      </PageHeader>

      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <label>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
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
              items={categoryItems}
              value={filterCategoryId}
              onChange={(val: any) => setFilterCategoryId(val || '')}
              placeholder="All Categories"
              label="Category"
            />
          </div>
        </div>
      </div>

      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable
          columns={columns}
          data={tableData}
          loading={loading}
          actions={actions}
          onActionClick={handleAction}
          fileName="retailers"
          emptyMessage="No retailers found."
        />
      </div>

      <ModalDialog
        isOpen={showModal}
        title={editingId ? 'Edit Retailer' : 'Add Retailer'}
        size="md"
        onClose={() => setShowModal(false)}
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Add Retailer'}
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>Name <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Retailer name"
              required
            />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input
              type="text"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="Phone number"
            />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Address</label>
            <textarea
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Address"
              rows={2}
            />
          </div>
          <div className="form-group">
            <label>GST Status</label>
            <select
              value={form.gst_status}
              onChange={e => setForm(f => ({ ...f, gst_status: e.target.value as 'YES' | 'NO' }))}
            >
              <option value="NO">NO</option>
              <option value="YES">YES</option>
            </select>
          </div>
          {form.gst_status === 'YES' && (
            <div className="form-group">
              <label>GST Number</label>
              <input
                type="text"
                value={form.gst_number}
                onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))}
                placeholder="GST Number"
              />
            </div>
          )}
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={form.site_id}
              onChange={(val: any) => setForm(f => ({ ...f, site_id: val || '' }))}
              placeholder="Select Site..."
              label="Site"
            />
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
        </div>
      </ModalDialog>
    </div>
  );
}
