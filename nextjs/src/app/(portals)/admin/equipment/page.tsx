'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';
import DataTable, { type TableColumn, type TableAction } from '@/components/DataTable';

interface EquipmentParty {
  id: string;
  display_id?: string;
  name: string;
  contact?: string;
  address?: string;
  category_id?: string;
  status?: string;
}

interface EquipmentCategory {
  id: string;
  name: string;
  description?: string;
}

export default function EquipmentPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [parties, setParties] = useState<EquipmentParty[]>([]);
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Party form modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [saving, setSaving] = useState(false);

  // Category form
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'parties' | 'categories'>('parties');

  const loadCategories = useCallback(async () => {
    try {
      const data = await apiGet<EquipmentCategory[]>('/equipment-categories');
      setCategories(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load categories: ' + err.message);
    }
  }, [notifyError]);

  const loadParties = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<EquipmentParty[]>('/equipment');
      setParties(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load equipment parties: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadCategories();
    loadParties();
  }, [loadCategories, loadParties]);

  const categoryItems = useMemo(() => categories.map(c => ({ value: c.id, label: c.name })), [categories]);

  const getCategoryName = (id?: string) => {
    if (!id) return '--';
    return categories.find(c => c.id === id)?.name ?? '--';
  };

  // Filtered data for parties
  const filteredParties = useMemo(() => {
    let result = parties;
    if (filterStatus) result = result.filter(p => p.status === filterStatus);
    if (filterCategory) result = result.filter(p => p.category_id === filterCategory);
    return result.map(p => ({
      ...p,
      category_name: getCategoryName(p.category_id),
    }));
  }, [parties, filterStatus, filterCategory, categories]);

  const columns: TableColumn[] = [
    { key: 'display_id', label: 'Display ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'contact', label: 'Contact' },
    { key: 'address', label: 'Address' },
    { key: 'category_name', label: 'Category', sortable: true },
    { key: 'status', label: 'Status', type: 'badge', badgeMap: { active: 'success', inactive: 'danger' } },
  ];

  const actions: TableAction[] = [
    { label: 'Edit', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary' },
    { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger' },
  ];

  // Party CRUD
  const openAddModal = () => {
    setEditingId(null);
    setFormName('');
    setFormContact('');
    setFormAddress('');
    setFormCategoryId('');
    setModalOpen(true);
  };

  const openEditModal = (p: EquipmentParty) => {
    setEditingId(p.id);
    setFormName(p.name);
    setFormContact(p.contact ?? '');
    setFormAddress(p.address ?? '');
    setFormCategoryId(p.category_id ?? '');
    setModalOpen(true);
  };

  const saveParty = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    const body = {
      name: formName.trim(),
      contact: formContact.trim() || null,
      address: formAddress.trim() || null,
      category_id: formCategoryId || null,
    };
    try {
      if (editingId) {
        await apiPut(`/equipment/${editingId}`, body);
        success('Equipment party updated');
      } else {
        await apiPost('/equipment', body);
        success('Equipment party added');
      }
      setModalOpen(false);
      loadParties();
    } catch (err: any) {
      notifyError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteParty = async (p: EquipmentParty) => {
    const ok = await confirm({ title: 'Delete Equipment Party', message: `Delete "${p.name}"?`, type: 'danger', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await apiDelete(`/equipment/${p.id}`);
      success('Equipment party deleted');
      loadParties();
    } catch (err: any) {
      notifyError('Delete failed: ' + err.message);
    }
  };

  const handleAction = (event: { action: string; row: any }) => {
    if (event.action === 'edit') openEditModal(event.row);
    if (event.action === 'delete') deleteParty(event.row);
  };

  // Category CRUD
  const resetCatForm = () => {
    setEditingCatId(null);
    setCatName('');
    setCatDescription('');
  };

  const saveCategory = async () => {
    if (!catName.trim()) return;
    const body = { name: catName.trim(), description: catDescription.trim() || null };
    try {
      if (editingCatId) {
        await apiPut(`/equipment-categories/${editingCatId}`, body);
        success('Category updated');
      } else {
        await apiPost('/equipment-categories', body);
        success('Category added');
      }
      resetCatForm();
      loadCategories();
    } catch (err: any) {
      notifyError('Failed to save category: ' + err.message);
    }
  };

  const editCategory = (cat: EquipmentCategory) => {
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setCatDescription(cat.description ?? '');
  };

  const deleteCategory = async (cat: EquipmentCategory) => {
    const ok = await confirm({ title: 'Delete Category', message: `Delete category "${cat.name}"?`, type: 'danger' });
    if (!ok) return;
    try {
      await apiDelete(`/equipment-categories/${cat.id}`);
      success('Category deleted');
      loadCategories();
    } catch (err: any) {
      notifyError('Delete failed: ' + err.message);
    }
  };

  const clearFilters = () => {
    setFilterStatus('');
    setFilterCategory('');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-truck-line" /> Equipment Parties</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`btn-secondary ${activeTab === 'parties' ? '' : 'btn-primary'}`}
            onClick={() => setActiveTab(activeTab === 'parties' ? 'categories' : 'parties')}
          >
            <i className={activeTab === 'parties' ? 'ri-list-check' : 'ri-truck-line'} />
            {activeTab === 'parties' ? ' Categories' : ' Parties'}
          </button>
          {activeTab === 'parties' && (
            <button className="btn-primary" onClick={openAddModal}>
              <i className="ri-add-line" /> Add Equipment Party
            </button>
          )}
        </div>
      </div>

      {activeTab === 'parties' && (
        <>
          {/* Filters */}
          <div className="card-container">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
                <label>Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
                <SearchableDropdown
                  items={categoryItems}
                  label="Category"
                  placeholder="All Categories"
                  value={filterCategory}
                  onChange={setFilterCategory}
                />
              </div>
              <button className="btn-secondary" onClick={clearFilters}>
                <i className="ri-filter-off-line" /> Clear
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="card-container" style={{ marginTop: 16 }}>
            <DataTable
              columns={columns}
              data={filteredParties}
              loading={loading}
              actions={actions}
              onActionClick={handleAction}
              fileName="equipment-parties"
              emptyMessage="No equipment parties found."
            />
          </div>
        </>
      )}

      {activeTab === 'categories' && (
        <div className="card-container">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
            {editingCatId ? 'Edit Category' : 'Add Category'}
          </h3>
          <form onSubmit={e => { e.preventDefault(); saveCategory(); }}>
            <div className="form-grid">
              <div className="form-group">
                <label>Category Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  placeholder="Category name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  value={catDescription}
                  onChange={e => setCatDescription(e.target.value)}
                  placeholder="Description"
                />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <button type="submit" className="btn-primary">
                  <i className={editingCatId ? 'ri-save-line' : 'ri-add-line'} />
                  {editingCatId ? ' Update' : ' Add'}
                </button>
                {editingCatId && (
                  <button type="button" className="btn-secondary" onClick={resetCatForm}>Cancel</button>
                )}
              </div>
            </div>
          </form>

          <div className="table-responsive" style={{ marginTop: 20 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-state">No categories added yet.</td>
                  </tr>
                ) : categories.map((cat, i) => (
                  <tr key={cat.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{cat.name}</td>
                    <td>{cat.description ?? '--'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => editCategory(cat)} title="Edit">
                          <i className="ri-pencil-line" />
                        </button>
                        <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteCategory(cat)} title="Delete">
                          <i className="ri-delete-bin-line" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Party Modal */}
      <ModalDialog
        isOpen={modalOpen}
        title={editingId ? 'Edit Equipment Party' : 'Add Equipment Party'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveParty} disabled={saving || !formName.trim()}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'} />
              {saving ? ' Saving...' : editingId ? ' Update' : ' Add'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label>Name <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Equipment party name" required />
        </div>
        <div className="form-group">
          <label>Contact</label>
          <input type="text" value={formContact} onChange={e => setFormContact(e.target.value)} placeholder="Phone / Email" />
        </div>
        <div className="form-group">
          <label>Address</label>
          <textarea value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Address" rows={2} />
        </div>
        <div className="form-group">
          <SearchableDropdown
            items={categoryItems}
            label="Category"
            placeholder="Select category..."
            value={formCategoryId}
            onChange={setFormCategoryId}
          />
        </div>
      </ModalDialog>
    </div>
  );
}
