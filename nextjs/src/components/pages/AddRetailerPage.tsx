'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards from '@/components/SummaryCards';
import { exportToExcel } from '@/lib/export-utils';
import styles from './AddRetailerPage.module.scss';

interface Retailer {
  id: string;
  name: string;
  shop_name?: string;
  shop?: string;
  phone?: string;
  contact?: string;
  address?: string;
  gst_status: boolean | string;
  gst_number?: string;
  gst?: string;
  category_id?: string;
  category_name?: string;
  site_id?: string;
  status?: string;
  pending_label?: string;
}

export default function AddRetailerPage() {
  const { success, error: showError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [retailerName, setRetailerName] = useState('');
  const [shopName, setShopName] = useState('');
  const [contact, setContact] = useState('');
  const [gstApplicable, setGstApplicable] = useState<'YES' | 'NO'>('NO');
  const [gstNo, setGstNo] = useState('');
  const [address, setAddress] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSite, setSelectedSite] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [categories, setCategories] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterGstStatus, setFilterGstStatus] = useState('');

  const categoryItems = useMemo(() =>
    categories.map(c => ({ value: c.id, label: c.name })), [categories]);

  const siteItems = useMemo(() =>
    sites.map(s => ({ value: s.id, label: s.name })), [sites]);

  const filteredRetailers = useMemo(() => {
    let list = retailers;
    list = list.filter(r => (activeTab === 'active' ? r.status !== 'inactive' : r.status === 'inactive'));
    if (filterCategory) list = list.filter(r => r.category_id === filterCategory || r.category_name === filterCategory);
    if (filterGstStatus === 'yes') list = list.filter(r => r.gst_status === true || r.gst_status === 'GST YES');
    else if (filterGstStatus === 'no') list = list.filter(r => !r.gst_status || r.gst_status === 'GST NO');
    const q = searchQuery.toLowerCase();
    if (q) {
      list = list.filter(r =>
        (r.name ?? '').toLowerCase().includes(q) ||
        (r.phone ?? r.contact ?? '').toLowerCase().includes(q) ||
        (r.gst_number ?? '').toLowerCase().includes(q) ||
        (r.category_name ?? '').toLowerCase().includes(q) ||
        (r.address ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [retailers, activeTab, filterCategory, filterGstStatus, searchQuery]);

  const activeCount = useMemo(() => retailers.filter(r => r.status !== 'inactive').length, [retailers]);
  const inactiveCount = useMemo(() => retailers.filter(r => r.status === 'inactive').length, [retailers]);

  const summaryCards = useMemo(() => [
    { title: 'Active Retailers', value: activeCount, color: 'success' as const, icon: 'ri-store-2-line' },
    { title: 'Inactive Retailers', value: inactiveCount, color: 'danger' as const, icon: 'ri-store-2-line' },
    { title: 'GST Registered', value: retailers.filter(r => r.gst_status === true || r.gst_status === 'GST YES').length, color: 'info' as const, icon: 'ri-file-list-3-line' },
    { title: 'Total Retailers', value: retailers.length, color: 'primary' as const, icon: 'ri-group-line' },
  ], [retailers, activeCount, inactiveCount]);

  const loadRetailers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Retailer[]>('/retailers');
      setRetailers(data);
    } catch { showError('Failed to load retailers'); }
    setLoading(false);
  }, [showError]);

  useEffect(() => {
    apiGet<any[]>('/retailer-categories').then(d => setCategories(d)).catch(() => {});
    apiGet<any[]>('/sites').then(d => setSites(d)).catch(() => {});
    loadRetailers();
  }, [loadRetailers]);

  const resetForm = () => {
    setEditingId(null);
    setRetailerName('');
    setShopName('');
    setContact('');
    setGstApplicable('NO');
    setGstNo('');
    setAddress('');
    setSelectedCategory('');
    setSelectedSite('');
  };

  const openAddModal = () => { resetForm(); setShowModal(true); };

  const editRetailer = (r: Retailer) => {
    setEditingId(r.id);
    setRetailerName(r.name ?? '');
    setShopName(r.shop_name ?? r.shop ?? '');
    setContact(r.phone ?? r.contact ?? '');
    setGstApplicable((r.gst_status === true || r.gst_status === 'GST YES') ? 'YES' : 'NO');
    setGstNo(r.gst_number ?? r.gst ?? '');
    setAddress(r.address ?? '');
    setSelectedCategory(r.category_id ?? '');
    setSelectedSite(r.site_id ?? '');
    setShowModal(true);
  };

  const deleteRetailer = async (r: Retailer) => {
    const ok = await confirm({ title: 'Delete Retailer', message: `Delete "${r.name}"?`, type: 'danger', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await apiDelete(`/retailers/${r.id}`);
      success('Retailer deleted');
      loadRetailers();
    } catch { showError('Failed to delete retailer'); }
  };

  const toggleStatus = async (r: Retailer) => {
    const newStatus = r.status === 'inactive' ? 'active' : 'inactive';
    try {
      await apiPut(`/retailers/${r.id}`, { status: newStatus });
      success(`Retailer ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      loadRetailers();
    } catch { showError('Failed to update status'); }
  };

  const onSubmit = async () => {
    const body = {
      name: retailerName,
      shop_name: shopName,
      phone: contact,
      address,
      gst_status: gstApplicable === 'YES',
      gst_number: gstApplicable === 'YES' ? gstNo.toUpperCase() : null,
      category_id: selectedCategory,
      site_id: selectedSite,
    };
    try {
      if (editingId) {
        await apiPut(`/retailers/${editingId}`, body);
        success('Retailer updated');
      } else {
        await apiPost('/retailers', body);
        success('Retailer added');
      }
      setShowModal(false);
      resetForm();
      loadRetailers();
    } catch { showError(editingId ? 'Failed to update retailer' : 'Failed to add retailer'); }
  };

  const exportRetailers = () => {
    exportToExcel(filteredRetailers as any[], 'retailers', 'Retailers', [
      { key: 'id', header: 'ID' },
      { key: 'category_name', header: 'Category' },
      { key: 'name', header: 'Retailer Name' },
      { key: 'shop_name', header: 'Shop Name' },
      { key: 'address', header: 'Address' },
      { key: 'phone', header: 'Phone' },
      { key: 'gst_status', header: 'GST Status' },
      { key: 'gst_number', header: 'GSTIN' },
      { key: 'status', header: 'Status' },
    ]);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Retailer Management</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={openAddModal}>+ Add Retailer</button>
          <button className="btn-export" onClick={exportRetailers}><i className="ri-file-excel-2-line" /> Export XLSX</button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 20 }}>
        <div className="form-grid">
          <div className="form-group">
            <label>Category</label>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>GST Status</label>
            <select value={filterGstStatus} onChange={e => setFilterGstStatus(e.target.value)}>
              <option value="">All GST Status</option>
              <option value="yes">GST Applicable (Yes)</option>
              <option value="no">Non-GST (No)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Search</label>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search name, phone, GST..." />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, margin: '20px 0 15px' }}>
        <button className={activeTab === 'active' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('active')}>
          Active Retailers ({activeCount})
        </button>
        <button className={activeTab === 'inactive' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('inactive')}>
          Deactivated ({inactiveCount})
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 300 }} />
      ) : (
        <div className="card-container" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Category</th><th>Retailer Name</th><th>Shop</th><th>Address</th>
                  <th>Phone</th><th>GST Status</th><th>GSTIN</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRetailers.length === 0 ? (
                  <tr><td colSpan={9} className="empty-state">No retailers found.</td></tr>
                ) : filteredRetailers.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.category_name ?? '-'}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 700 }}>{r.name}</td>
                    <td>{r.shop_name ?? r.shop ?? '-'}</td>
                    <td>{r.address ?? '-'}</td>
                    <td>{r.phone ?? r.contact}</td>
                    <td>
                      {(r.gst_status === true || r.gst_status === 'GST YES')
                        ? <span className="badge badge-success">GST YES</span>
                        : <span className="badge badge-danger">GST NO</span>}
                    </td>
                    <td>{r.gst_number ?? r.gst ?? 'N/A'}</td>
                    <td>
                      {r.status === 'inactive'
                        ? <span className="badge badge-warning">Inactive</span>
                        : <span className="badge badge-success">Active</span>}
                      {r.pending_label && <><br /><span className="badge badge-info" style={{ fontSize: 10, marginTop: 4 }}>{r.pending_label}</span></>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                        <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => editRetailer(r)}>Edit</button>
                        <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => deleteRetailer(r)}>Delete</button>
                        {r.status === 'inactive' ? (
                          <button className={styles.activateBtn} onClick={() => toggleStatus(r)}>Activate</button>
                        ) : (
                          <button className={styles.deactivateBtn} onClick={() => toggleStatus(r)}>Deactivate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ModalDialog isOpen={showModal} title={editingId ? 'Edit Retailer' : 'Add Retailer'} size="md" onClose={() => { setShowModal(false); resetForm(); }}>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="form-group">
            <label>Retailer Name *</label>
            <input type="text" value={retailerName} onChange={e => setRetailerName(e.target.value)} placeholder="Enter retailer name" required />
          </div>
          <div className="form-group">
            <label>Shop Name</label>
            <input type="text" value={shopName} onChange={e => setShopName(e.target.value)} placeholder="Shop / Firm name" />
          </div>
          <div className="form-group">
            <label>Contact</label>
            <input type="tel" value={contact} onChange={e => setContact(e.target.value)} placeholder="Phone number" maxLength={10} />
          </div>
          <div className="form-group">
            <label>Category</label>
            <SearchableDropdown items={categoryItems} value={selectedCategory} onChange={setSelectedCategory} placeholder="Select category" />
          </div>
          <div className="form-group">
            <label>Site</label>
            <SearchableDropdown items={siteItems} value={selectedSite} onChange={setSelectedSite} placeholder="Select site" />
          </div>
          <div className="form-group">
            <label>GST Applicable</label>
            <select value={gstApplicable} onChange={e => { setGstApplicable(e.target.value as 'YES' | 'NO'); if (e.target.value === 'NO') setGstNo(''); }}>
              <option value="NO">No</option>
              <option value="YES">Yes</option>
            </select>
          </div>
          {gstApplicable === 'YES' && (
            <div className="form-group">
              <label>GST Number</label>
              <input type="text" value={gstNo} onChange={e => setGstNo(e.target.value)} placeholder="GSTIN" maxLength={15} style={{ textTransform: 'uppercase' }} />
            </div>
          )}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Address</label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address" rows={2} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
          <button className="btn-primary" onClick={onSubmit}>{editingId ? 'Update Retailer' : 'Add Retailer'}</button>
        </div>
      </ModalDialog>
    </div>
  );
}
