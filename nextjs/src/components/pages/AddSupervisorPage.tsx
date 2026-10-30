'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { exportToExcel } from '@/lib/export-utils';
import { useRole } from '@/hooks/useRole';
import { useApproval } from '@/hooks/useApproval';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards from '@/components/SummaryCards';
import styles from './AddSupervisorPage.module.scss';

interface Supervisor {
  id: number;
  name: string;
  contact: string;
  address: string;
  employee_id: number | null;
  assigned_site_id: number | null;
  site_name?: string;
  employee_name?: string;
  status?: string;
  pending_status?: string | null;
}

interface Employee {
  id: number;
  name: string;
  contact?: string;
}

interface Site {
  id: number;
  name: string;
}

export default function AddSupervisorPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const role = useRole();
  const approval = useApproval();

  const [searchQuery, setSearchQuery] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [assignedSiteId, setAssignedSiteId] = useState<number | null>(null);

  const filteredSupervisors = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return supervisors;
    return supervisors.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        (s.contact || '').includes(q) ||
        (s.site_name || '').toLowerCase().includes(q) ||
        (s.employee_name || '').toLowerCase().includes(q)
    );
  }, [supervisors, searchQuery]);

  const summaryCards = useMemo(() => {
    const total = supervisors.length;
    const active = supervisors.filter(s => s.status !== 'inactive').length;
    const assigned = supervisors.filter(s => s.assigned_site_id).length;
    return [
      { title: 'Total Supervisors', value: total, icon: 'ri-shield-user-line', color: 'primary' as const },
      { title: 'Active', value: active, icon: 'ri-checkbox-circle-line', color: 'success' as const },
      { title: 'Assigned to Sites', value: assigned, icon: 'ri-map-pin-line', color: 'info' as const },
    ];
  }, [supervisors]);

  const employeeItems = useMemo(
    () => employees.map(e => ({ value: e.id, label: e.name })),
    [employees]
  );

  const siteItems = useMemo(
    () => sites.map(s => ({ value: s.id, label: s.name })),
    [sites]
  );

  const loadSupervisors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Supervisor[]>('/supervisors');
      setSupervisors(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load supervisors: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadSupervisors();
    apiGet<Employee[]>('/employees').then(d => setEmployees(Array.isArray(d) ? d : [])).catch(() => {});
    apiGet<Site[]>('/sites').then(d => setSites(Array.isArray(d) ? d : [])).catch(() => {});
  }, [loadSupervisors]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setContact('');
    setAddress('');
    setEmployeeId(null);
    setAssignedSiteId(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = (s: Supervisor) => {
    setEditingId(s.id);
    setName(s.name);
    setContact(s.contact || '');
    setAddress(s.address || '');
    setEmployeeId(s.employee_id);
    setAssignedSiteId(s.assigned_site_id);
    setShowFormModal(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !contact.trim()) {
      notifyError('Name and contact are required.');
      return;
    }

    const payload = {
      name: name.trim(),
      contact: contact.trim(),
      address: address.trim(),
      employee_id: employeeId,
      assigned_site_id: assignedSiteId,
    };

    setSaving(true);
    try {
      if (editingId !== null) {
        if (approval.requiresApproval()) {
          await approval.submitForApproval({
            module: 'supervisors',
            actionType: 'update',
            summary: `Update supervisor: ${payload.name}`,
            data: payload,
            referenceId: editingId,
          });
          success('Submitted for approval');
        } else {
          const updated = await apiPut<Supervisor>(`/supervisors/${editingId}`, payload);
          setSupervisors(prev => prev.map(s => (s.id === updated.id ? updated : s)));
          success('Supervisor updated.');
        }
      } else {
        if (approval.requiresApproval()) {
          await approval.submitForApproval({
            module: 'supervisors',
            actionType: 'create',
            summary: `Add supervisor: ${payload.name}`,
            data: payload,
          });
          success('Submitted for approval');
        } else {
          const created = await apiPost<Supervisor>('/supervisors', payload);
          setSupervisors(prev => [...prev, created]);
          success('Supervisor added.');
        }
      }
      setShowFormModal(false);
      resetForm();
    } catch (err: any) {
      notifyError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Supervisor) => {
    const confirmed = await confirm({
      title: 'Delete Supervisor',
      message: `Delete "${s.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      if (approval.requiresApproval()) {
        await approval.submitForApproval({
          module: 'supervisors',
          actionType: 'delete',
          summary: `Delete supervisor: ${s.name}`,
          data: s,
          referenceId: s.id,
        });
        success('Submitted for approval');
      } else {
        await apiDelete(`/supervisors/${s.id}`);
        setSupervisors(prev => prev.filter(x => x.id !== s.id));
        success('Supervisor deleted.');
      }
    } catch (err: any) {
      notifyError('Failed to delete: ' + err.message);
    }
  };

  const handleExportExcel = () => {
    exportToExcel(filteredSupervisors as any, 'supervisors', 'Supervisors', [
      { key: 'name', header: 'Name' },
      { key: 'contact', header: 'Contact' },
      { key: 'address', header: 'Address' },
      { key: 'site_name', header: 'Assigned Site' },
      { key: 'employee_name', header: 'Employee' },
      { key: 'status', header: 'Status' },
    ]);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Supervisors</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={handleExportExcel}>
            <i className="ri-file-excel-2-line"></i> Export
          </button>
          <button className="btn-primary" onClick={openAddModal}>
            <i className="ri-add-line"></i> Add Supervisor
          </button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 16 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by name, contact, site..."
          style={{ width: '100%' }}
        />
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
                <th>Contact</th>
                <th>Address</th>
                <th>Linked Employee</th>
                <th>Assigned Site</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSupervisors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state">No supervisors found.</td>
                </tr>
              ) : (
                filteredSupervisors.map((s, i) => (
                  <tr key={s.id} className={s.pending_status ? styles.pendingRow : ''}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.contact}</td>
                    <td>{s.address || '--'}</td>
                    <td>{s.employee_name || '--'}</td>
                    <td>
                      {s.site_name ? (
                        <span className="badge badge-info">{s.site_name}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      {s.pending_status ? (
                        <span className="badge badge-warning">{s.pending_status}</span>
                      ) : s.status === 'inactive' ? (
                        <span className="badge badge-danger">Inactive</span>
                      ) : (
                        <span className="badge badge-success">Active</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className={styles.actionButtons}>
                        <button className={styles.btnIcon} onClick={() => openEditModal(s)} title="Edit">
                          <i className="ri-edit-line"></i>
                        </button>
                        <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => handleDelete(s)} title="Delete">
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ModalDialog
        isOpen={showFormModal}
        title={editingId ? 'Edit Supervisor' : 'Add Supervisor'}
        size="md"
        onClose={() => { setShowFormModal(false); resetForm(); }}
      >
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="form-group">
            <label>Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Supervisor name" required />
          </div>
          <div className="form-group">
            <label>Contact *</label>
            <input type="tel" value={contact} onChange={e => setContact(e.target.value)} placeholder="Phone number" maxLength={10} required />
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address" rows={2} />
          </div>
          <div className="form-group">
            <label>Link Employee</label>
            <SearchableDropdown
              items={employeeItems}
              value={employeeId}
              onChange={val => setEmployeeId(val as number | null)}
              placeholder="Select employee (optional)"
            />
          </div>
          <div className="form-group">
            <label>Assigned Site</label>
            <SearchableDropdown
              items={siteItems}
              value={assignedSiteId}
              onChange={val => setAssignedSiteId(val as number | null)}
              placeholder="Select site (optional)"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => { setShowFormModal(false); resetForm(); }}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update' : 'Add Supervisor'}
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
