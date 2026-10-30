'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';
import DataTable, { type TableColumn, type TableAction } from '@/components/DataTable';

interface Assignment {
  id: string;
  display_id?: string;
  equipment_party_id?: string;
  site_id?: string;
  assigned_date?: string;
  released_date?: string;
  rate?: number;
  rate_unit?: string;
  status?: string;
  remarks?: string;
}

interface EquipmentParty { id: string; name: string; }
interface Site { id: string; name: string; }

const RATE_UNITS = ['per_day', 'per_hour', 'per_trip', 'per_month', 'lump_sum'];
const STATUS_OPTIONS = ['active', 'released', 'pending'];

export default function EquipmentAssignmentsPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [equipment, setEquipment] = useState<EquipmentParty[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterEquipment, setFilterEquipment] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal form
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formEquipmentId, setFormEquipmentId] = useState('');
  const [formSiteId, setFormSiteId] = useState('');
  const [formAssignedDate, setFormAssignedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formReleasedDate, setFormReleasedDate] = useState('');
  const [formRate, setFormRate] = useState('');
  const [formRateUnit, setFormRateUnit] = useState('per_day');
  const [formRemarks, setFormRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const loadMasters = useCallback(async () => {
    try {
      const [eq, st] = await Promise.all([
        apiGet<EquipmentParty[]>('/equipment'),
        apiGet<Site[]>('/sites'),
      ]);
      setEquipment(Array.isArray(eq) ? eq : []);
      setSites(Array.isArray(st) ? st : []);
    } catch (err: any) {
      notifyError('Failed to load master data: ' + err.message);
    }
  }, [notifyError]);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Assignment[]>('/equipment-assignments');
      setAssignments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load assignments: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadMasters();
    loadAssignments();
  }, [loadMasters, loadAssignments]);

  const equipmentItems = useMemo(() => equipment.map(e => ({ value: e.id, label: e.name })), [equipment]);
  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);

  const getEquipmentName = (id?: string) => equipment.find(e => e.id === id)?.name ?? '--';
  const getSiteName = (id?: string) => sites.find(s => s.id === id)?.name ?? '--';

  const filteredAssignments = useMemo(() => {
    let result = assignments;
    if (filterEquipment) result = result.filter(a => a.equipment_party_id === filterEquipment);
    if (filterSite) result = result.filter(a => a.site_id === filterSite);
    if (filterStatus) result = result.filter(a => a.status === filterStatus);
    return result.map(a => ({
      ...a,
      equipment_name: getEquipmentName(a.equipment_party_id),
      site_name: getSiteName(a.site_id),
      assigned_date_display: a.assigned_date?.split('T')[0] ?? '--',
      released_date_display: a.released_date?.split('T')[0] ?? '--',
      rate_display: a.rate != null ? `₹${a.rate.toLocaleString('en-IN')}` : '--',
    }));
  }, [assignments, filterEquipment, filterSite, filterStatus, equipment, sites]);

  const columns: TableColumn[] = [
    { key: 'display_id', label: 'Display ID', sortable: true },
    { key: 'equipment_name', label: 'Equipment Party', sortable: true },
    { key: 'site_name', label: 'Site', sortable: true },
    { key: 'assigned_date_display', label: 'Assigned Date', sortable: true },
    { key: 'released_date_display', label: 'Released Date', sortable: true },
    { key: 'rate_display', label: 'Rate' },
    { key: 'rate_unit', label: 'Rate Unit' },
    { key: 'status', label: 'Status', type: 'badge', badgeMap: { active: 'success', released: 'info', pending: 'warning' } },
  ];

  const tableActions: TableAction[] = [
    { label: 'Edit', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary' },
    { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger' },
  ];

  const openAddModal = () => {
    setEditingId(null);
    setFormEquipmentId('');
    setFormSiteId('');
    setFormAssignedDate(new Date().toISOString().split('T')[0]);
    setFormReleasedDate('');
    setFormRate('');
    setFormRateUnit('per_day');
    setFormRemarks('');
    setModalOpen(true);
  };

  const openEditModal = (a: Assignment) => {
    setEditingId(a.id);
    setFormEquipmentId(a.equipment_party_id ?? '');
    setFormSiteId(a.site_id ?? '');
    setFormAssignedDate(a.assigned_date?.split('T')[0] ?? '');
    setFormReleasedDate(a.released_date?.split('T')[0] ?? '');
    setFormRate(String(a.rate ?? ''));
    setFormRateUnit(a.rate_unit ?? 'per_day');
    setFormRemarks(a.remarks ?? '');
    setModalOpen(true);
  };

  const saveAssignment = async () => {
    if (!formEquipmentId || !formSiteId) return;
    setSaving(true);
    const body = {
      equipment_party_id: formEquipmentId,
      site_id: formSiteId,
      assigned_date: formAssignedDate || null,
      released_date: formReleasedDate || null,
      rate: formRate ? parseFloat(formRate) : null,
      rate_unit: formRateUnit,
      remarks: formRemarks.trim() || null,
    };
    try {
      if (editingId) {
        await apiPut(`/equipment-assignments/${editingId}`, body);
        success('Assignment updated');
      } else {
        await apiPost('/equipment-assignments', body);
        success('Assignment created');
      }
      setModalOpen(false);
      loadAssignments();
    } catch (err: any) {
      notifyError('Failed to save assignment: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAssignment = async (a: Assignment) => {
    const ok = await confirm({ title: 'Delete Assignment', message: 'Delete this assignment?', type: 'danger', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await apiDelete(`/equipment-assignments/${a.id}`);
      success('Assignment deleted');
      loadAssignments();
    } catch (err: any) {
      notifyError('Delete failed: ' + err.message);
    }
  };

  const handleAction = (event: { action: string; row: any }) => {
    if (event.action === 'edit') openEditModal(event.row);
    if (event.action === 'delete') deleteAssignment(event.row);
  };

  const clearFilters = () => {
    setFilterEquipment('');
    setFilterSite('');
    setFilterStatus('');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-map-pin-line" /> Equipment Site Assignments</h1>
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line" /> Add Assignment
        </button>
      </div>

      {/* Filters */}
      <div className="card-container">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
            <SearchableDropdown
              items={equipmentItems}
              label="Equipment Party"
              placeholder="All"
              value={filterEquipment}
              onChange={setFilterEquipment}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
            <SearchableDropdown
              items={siteItems}
              label="Site"
              placeholder="All Sites"
              value={filterSite}
              onChange={setFilterSite}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
            <label>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
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
          data={filteredAssignments}
          loading={loading}
          actions={tableActions}
          onActionClick={handleAction}
          fileName="equipment-assignments"
          emptyMessage="No assignments found."
        />
      </div>

      {/* Add/Edit Modal */}
      <ModalDialog
        isOpen={modalOpen}
        title={editingId ? 'Edit Assignment' : 'New Assignment'}
        size="lg"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveAssignment} disabled={saving || !formEquipmentId || !formSiteId}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'} />
              {saving ? ' Saving...' : editingId ? ' Update' : ' Create'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={equipmentItems}
              label="Equipment Party *"
              placeholder="Select equipment..."
              value={formEquipmentId}
              onChange={setFormEquipmentId}
              required
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              label="Site *"
              placeholder="Select site..."
              value={formSiteId}
              onChange={setFormSiteId}
              required
            />
          </div>
          <div className="form-group">
            <label>Assigned Date</label>
            <input type="date" value={formAssignedDate} onChange={e => setFormAssignedDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Released Date</label>
            <input type="date" value={formReleasedDate} onChange={e => setFormReleasedDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Rate</label>
            <input type="number" value={formRate} onChange={e => setFormRate(e.target.value)} placeholder="0.00" min="0" step="0.01" />
          </div>
          <div className="form-group">
            <label>Rate Unit</label>
            <select value={formRateUnit} onChange={e => setFormRateUnit(e.target.value)}>
              {RATE_UNITS.map(u => (
                <option key={u} value={u}>{u.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Remarks</label>
            <textarea value={formRemarks} onChange={e => setFormRemarks(e.target.value)} placeholder="Optional remarks" rows={2} />
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
