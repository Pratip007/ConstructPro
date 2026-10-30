'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { exportToExcel } from '@/lib/export-utils';
import { useRole } from '@/hooks/useRole';
import { useApproval } from '@/hooks/useApproval';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards from '@/components/SummaryCards';
import styles from './AddEquipmentPage.module.scss';

interface Equipment {
  id: string;
  name: string;
  category_id: string;
  category_name?: string;
  registration_no: string;
  owner: string;
  rent_rate: number;
  site_id?: string;
  site_name?: string;
  duty_days?: number;
  per_day_rate?: number;
  tds_applicable?: boolean;
  tds_percent?: number;
  pending_status?: string | null;
}

interface EquipmentCategory { id: string; name: string; }
interface Site { id: string; name: string; }

export default function AddEquipmentPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const role = useRole();
  const approval = useApproval();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [owner, setOwner] = useState('');
  const [rentRate, setRentRate] = useState(0);
  const [tdsApplicable, setTdsApplicable] = useState(false);
  const [tdsPercent, setTdsPercent] = useState(0);

  const [showFormModal, setShowFormModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const categoryItems = useMemo(() =>
    categories.map(c => ({ value: c.id, label: c.name })), [categories]
  );

  const filteredEquipment = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return equipment;
    return equipment.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.category_name || '').toLowerCase().includes(q) ||
      e.registration_no.toLowerCase().includes(q) ||
      e.owner.toLowerCase().includes(q)
    );
  }, [equipment, searchQuery]);

  const summaryCards = useMemo(() => {
    const active = equipment.filter(e => !e.pending_status).length;
    const catCount = new Set(equipment.map(e => e.category_name).filter(Boolean)).size;
    return [
      { title: 'Total Equipment', value: equipment.length, icon: 'ri-truck-line', color: 'primary' as const },
      { title: 'Active', value: active, icon: 'ri-checkbox-circle-line', color: 'success' as const },
      { title: 'Categories', value: catCount, icon: 'ri-folder-line', color: 'info' as const },
    ];
  }, [equipment]);

  const loadEquipment = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Equipment[]>('/equipment');
      setEquipment(data);
    } catch (err: any) {
      notifyError('Failed to load equipment: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadEquipment();
    apiGet<EquipmentCategory[]>('/equipment-categories').then(setCategories).catch(() => {});
    apiGet<Site[]>('/sites').then(setSites).catch(() => {});
  }, [loadEquipment]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName('');
    setCategoryId('');
    setRegistrationNo('');
    setOwner('');
    setRentRate(0);
    setTdsApplicable(false);
    setTdsPercent(0);
    setShowFormModal(false);
  }, []);

  const openAddForm = () => {
    resetForm();
    setShowFormModal(true);
  };

  const editEquipment = (eq: Equipment) => {
    setEditingId(eq.id);
    setName(eq.name);
    setCategoryId(eq.category_id);
    setRegistrationNo(eq.registration_no);
    setOwner(eq.owner);
    setRentRate(eq.rent_rate);
    setTdsApplicable(eq.tds_applicable || false);
    setTdsPercent(eq.tds_percent || 0);
    setShowFormModal(true);
  };

  const handleSubmit = async () => {
    if (!name) { notifyError('Name is required.'); return; }

    const payload = {
      name, category_id: categoryId, registration_no: registrationNo,
      owner, rent_rate: rentRate, tds_applicable: tdsApplicable,
      tds_percent: tdsApplicable ? tdsPercent : 0,
    };

    setSaving(true);
    try {
      if (approval.requiresApproval()) {
        await approval.submitForApproval({
          module: 'equipment',
          actionType: editingId ? 'update' : 'create',
          summary: editingId ? `Update equipment: ${name}` : `Add equipment: ${name}`,
          data: payload,
          referenceId: editingId || undefined,
        });
        success('Submitted for approval');
      } else if (editingId) {
        const updated = await apiPut<Equipment>(`/equipment/${editingId}`, payload);
        setEquipment(list => list.map(e => e.id === updated.id ? updated : e));
        success('Equipment updated.');
      } else {
        const created = await apiPost<Equipment>('/equipment', payload);
        setEquipment(list => [...list, created]);
        success('Equipment added.');
      }
      resetForm();
    } catch (err: any) {
      notifyError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteEquipment = async (eq: Equipment) => {
    const ok = await confirm({
      title: 'Delete Equipment',
      message: `Delete "${eq.name}"? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      if (approval.requiresApproval()) {
        await approval.submitForApproval({
          module: 'equipment',
          actionType: 'delete',
          summary: `Delete equipment: ${eq.name}`,
          data: { id: eq.id },
          referenceId: eq.id,
        });
        success('Submitted for approval');
      } else {
        await apiDelete(`/equipment/${eq.id}`);
        setEquipment(list => list.filter(x => x.id !== eq.id));
        success('Equipment deleted.');
      }
    } catch (err: any) {
      notifyError('Failed to delete: ' + err.message);
    }
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) { notifyError('Category name is required.'); return; }
    try {
      if (approval.requiresApproval()) {
        await approval.submitForApproval({
          module: 'equipment',
          actionType: 'create',
          summary: `Add equipment category: ${newCategoryName.trim()}`,
          data: { name: newCategoryName.trim() },
        });
        setNewCategoryName('');
        setShowCategoryModal(false);
        success('Submitted for approval');
      } else {
        const created = await apiPost<EquipmentCategory>('/equipment-categories', { name: newCategoryName.trim() });
        setCategories(list => [...list, created]);
        setNewCategoryName('');
        setShowCategoryModal(false);
        success('Category added.');
      }
    } catch (err: any) {
      notifyError('Failed to add category: ' + err.message);
    }
  };

  const handleExportExcel = useCallback(() => {
    exportToExcel(filteredEquipment as any, 'equipment', 'Equipment', [
      { key: 'name', header: 'Name' },
      { key: 'category_name', header: 'Category' },
      { key: 'registration_no', header: 'Reg No' },
      { key: 'owner', header: 'Owner' },
      { key: 'rent_rate', header: 'Rate' },
      { key: 'site_name', header: 'Current Site' },
    ]);
  }, [filteredEquipment]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Add Equipment</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" onClick={openAddForm}><i className="ri-add-line" /> Add Equipment</button>
          <button className="btn-secondary" onClick={() => setShowCategoryModal(true)}><i className="ri-folder-add-line" /> Add Category</button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 16 }}>
        <div className={styles.toolbarRow}>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search equipment..." className={styles.searchInput} />
          <button className="btn-secondary" onClick={handleExportExcel}><i className="ri-file-excel-2-line" /> Excel</button>
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
                <th>Name</th>
                <th>Category</th>
                <th>Reg No</th>
                <th>Owner</th>
                <th>Rate (₹)</th>
                <th>Site</th>
                <th>TDS</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipment.length === 0 ? (
                <tr><td colSpan={9} className="empty-state">No equipment found.</td></tr>
              ) : (
                filteredEquipment.map((eq, i) => (
                  <tr key={eq.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{eq.name}</td>
                    <td>{eq.category_name || '--'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{eq.registration_no || '--'}</td>
                    <td>{eq.owner || '--'}</td>
                    <td>₹{eq.rent_rate?.toLocaleString('en-IN') || '0'}</td>
                    <td>{eq.site_name ? <span className="badge badge-info">{eq.site_name}</span> : '--'}</td>
                    <td>{eq.tds_applicable ? <span className="badge badge-success">{eq.tds_percent}%</span> : <span className="badge badge-danger">No</span>}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className={styles.actionButtons}>
                        <button className={styles.btnIcon} onClick={() => editEquipment(eq)} title="Edit"><i className="ri-edit-line" /></button>
                        <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => deleteEquipment(eq)} title="Delete"><i className="ri-delete-bin-line" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Equipment Modal */}
      <ModalDialog isOpen={showFormModal} title={editingId ? 'Edit Equipment' : 'Add Equipment'} size="md" onClose={resetForm}>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="form-group">
            <label>Equipment Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., JCB 3DX" required />
          </div>
          <div className="form-group">
            <SearchableDropdown items={categoryItems} label="Category" placeholder="Select category" value={categoryId} onChange={(val: any) => setCategoryId(val)} />
          </div>
          <div className="form-group">
            <label>Registration No</label>
            <input type="text" value={registrationNo} onChange={e => setRegistrationNo(e.target.value)} placeholder="Vehicle/Equipment reg no" />
          </div>
          <div className="form-group">
            <label>Owner</label>
            <input type="text" value={owner} onChange={e => setOwner(e.target.value)} placeholder="Owner name" />
          </div>
          <div className="form-group">
            <label>Rent Rate (₹)</label>
            <input type="number" value={rentRate} onChange={e => setRentRate(Number(e.target.value))} min={0} step={0.01} />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={tdsApplicable} onChange={e => setTdsApplicable(e.target.checked)} />
              TDS Applicable
            </label>
          </div>
          {tdsApplicable && (
            <div className="form-group">
              <label>TDS %</label>
              <input type="number" value={tdsPercent} onChange={e => setTdsPercent(Number(e.target.value))} min={0} max={100} />
            </div>
          )}
        </div>
        <div data-modal-footer>
          <button className="btn-secondary" onClick={resetForm}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update' : 'Add Equipment'}
          </button>
        </div>
      </ModalDialog>

      {/* Add Category Modal */}
      <ModalDialog isOpen={showCategoryModal} title="Add Equipment Category" size="sm" onClose={() => setShowCategoryModal(false)}>
        <div className="form-group">
          <label>Category Name *</label>
          <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="e.g., Excavator, Crane" />
        </div>
        <div data-modal-footer>
          <button className="btn-secondary" onClick={() => setShowCategoryModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={addCategory}>Add Category</button>
        </div>
      </ModalDialog>
    </div>
  );
}
