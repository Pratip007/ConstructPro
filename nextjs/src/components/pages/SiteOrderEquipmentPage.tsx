'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useRole } from '@/hooks/useRole';
import { useApproval } from '@/hooks/useApproval';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import ModalDialog from '@/components/ModalDialog';
import styles from './SiteOrderEquipmentPage.module.scss';

interface EquipmentAssignment {
  id: string;
  equipment_id: string;
  equipment_name?: string;
  site_id: string;
  site_name?: string;
  start_date: string;
  end_date: string;
  released_date: string | null;
  rate: number;
  rate_unit: string;
  purpose: string;
  status: string;
}

interface Equipment { id: string; name: string; }
interface Site { id: string; name: string; }

export default function SiteOrderEquipmentPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const role = useRole();
  const approval = useApproval();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState<EquipmentAssignment[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<Equipment[]>([]);
  const [siteOptions, setSiteOptions] = useState<Site[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [equipmentId, setEquipmentId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [rate, setRate] = useState(0);
  const [rateUnit, setRateUnit] = useState('per_day');
  const [purpose, setPurpose] = useState('');

  const equipmentItems = useMemo(() =>
    equipmentOptions.map(e => ({ value: e.id, label: e.name })), [equipmentOptions]
  );
  const siteItems = useMemo(() =>
    siteOptions.map(s => ({ value: s.id, label: s.name })), [siteOptions]
  );

  const activeAssignments = useMemo(() =>
    assignments.filter(a => a.status !== 'released'), [assignments]
  );
  const completedAssignments = useMemo(() =>
    assignments.filter(a => a.status === 'released'), [assignments]
  );

  const summaryCards = useMemo(() => [
    { title: 'Active', value: activeAssignments.length, icon: 'ri-check-line', color: 'success' as const },
    { title: 'Completed', value: completedAssignments.length, icon: 'ri-logout-box-line', color: 'info' as const },
    { title: 'Total Equipment', value: equipmentOptions.length, icon: 'ri-truck-line', color: 'primary' as const },
  ], [activeAssignments, completedAssignments, equipmentOptions]);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<EquipmentAssignment[]>('/equipment-site-assignments');
      setAssignments(data);
    } catch {
      notifyError('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    apiGet<Equipment[]>('/equipment').then(setEquipmentOptions).catch(() => {});
    apiGet<Site[]>('/sites').then(setSiteOptions).catch(() => {});
    loadAssignments();
  }, [loadAssignments]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setEquipmentId('');
    setSiteId('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setRate(0);
    setRateUnit('per_day');
    setPurpose('');
    setShowFormModal(false);
  }, []);

  const handleSubmit = async () => {
    if (!equipmentId || !siteId) {
      notifyError('Equipment and site are required.');
      return;
    }
    const payload = {
      equipment_id: equipmentId, site_id: siteId, start_date: startDate,
      end_date: endDate || undefined, rate, rate_unit: rateUnit, purpose,
    };
    setSaving(true);
    try {
      if (approval.requiresApproval()) {
        await approval.submitForApproval({
          module: 'equipment-orders',
          actionType: editingId ? 'update' : 'create',
          summary: editingId ? `Update equipment assignment` : `Assign equipment to site`,
          data: payload,
          referenceId: editingId || undefined,
        });
        success('Submitted for approval');
      } else if (editingId) {
        const updated = await apiPut<EquipmentAssignment>(`/equipment-site-assignments/${editingId}`, payload);
        setAssignments(list => list.map(a => a.id === updated.id ? updated : a));
        success('Assignment updated.');
      } else {
        const created = await apiPost<EquipmentAssignment>('/equipment-site-assignments', payload);
        setAssignments(list => [...list, created]);
        success('Equipment assigned to site.');
      }
      resetForm();
    } catch (err: any) {
      notifyError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const editAssignment = (a: EquipmentAssignment) => {
    setEditingId(a.id);
    setEquipmentId(a.equipment_id);
    setSiteId(a.site_id);
    setStartDate(a.start_date);
    setEndDate(a.end_date || '');
    setRate(a.rate);
    setRateUnit(a.rate_unit);
    setPurpose(a.purpose);
    setShowFormModal(true);
  };

  const releaseAssignment = async (a: EquipmentAssignment) => {
    const ok = await confirm({
      title: 'Release Equipment',
      message: `Release ${a.equipment_name} from ${a.site_name}?`,
      confirmText: 'Release',
      type: 'danger',
    });
    if (!ok) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      if (approval.requiresApproval()) {
        await approval.submitForApproval({
          module: 'equipment-orders',
          actionType: 'update',
          summary: `Release equipment: ${a.equipment_name} from ${a.site_name}`,
          data: { released_date: today, status: 'released' },
          referenceId: a.id,
        });
        success('Submitted for approval');
      } else {
        const updated = await apiPut<EquipmentAssignment>(`/equipment-site-assignments/${a.id}`, {
          released_date: today, status: 'released',
        });
        setAssignments(list => list.map(x => x.id === updated.id ? updated : x));
        success('Equipment released.');
      }
    } catch {
      notifyError('Failed to release equipment');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Site Order — Equipment</h1>
        <button className="btn-primary" onClick={() => { resetForm(); setShowFormModal(true); }}>
          <i className="ri-add-line" /> New Assignment
        </button>
      </div>

      <SummaryCards cards={summaryCards} />

      <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        <button className={activeTab === 'active' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('active')}>
          Active ({activeAssignments.length})
        </button>
        <button className={activeTab === 'completed' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('completed')}>
          Completed ({completedAssignments.length})
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Equipment</th>
                <th>Site</th>
                <th>Start Date</th>
                <th>{activeTab === 'active' ? 'Rate' : 'Released Date'}</th>
                <th>Purpose</th>
                {activeTab === 'active' && <th style={{ textAlign: 'center' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {(activeTab === 'active' ? activeAssignments : completedAssignments).length === 0 ? (
                <tr><td colSpan={7} className="empty-state">No {activeTab} assignments.</td></tr>
              ) : (
                (activeTab === 'active' ? activeAssignments : completedAssignments).map((a, i) => (
                  <tr key={a.id} style={activeTab === 'completed' ? { opacity: 0.85 } : undefined}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{a.equipment_name}</td>
                    <td>{a.site_name}</td>
                    <td>{a.start_date}</td>
                    <td>{activeTab === 'active' ? (a.rate ? `₹${a.rate}/${a.rate_unit === 'per_month' ? 'mo' : 'day'}` : '-') : a.released_date}</td>
                    <td>{a.purpose}</td>
                    {activeTab === 'active' && (
                      <td style={{ textAlign: 'center' }}>
                        <div className={styles.actionButtons}>
                          <button className={styles.btnIcon} onClick={() => editAssignment(a)} title="Edit"><i className="ri-edit-line" /></button>
                          <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => releaseAssignment(a)}>Release</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ModalDialog isOpen={showFormModal} title={editingId ? 'Edit Assignment' : 'New Equipment Assignment'} size="md" onClose={resetForm}>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="form-group">
            <SearchableDropdown items={equipmentItems} label="Equipment *" placeholder="Select equipment" value={equipmentId} onChange={(val: any) => setEquipmentId(val)} />
          </div>
          <div className="form-group">
            <SearchableDropdown items={siteItems} label="Site *" placeholder="Select site" value={siteId} onChange={(val: any) => setSiteId(val)} />
          </div>
          <div className="form-group">
            <label>Start Date *</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Rate (₹)</label>
            <input type="number" value={rate} onChange={e => setRate(Number(e.target.value))} min={0} />
          </div>
          <div className="form-group">
            <label>Rate Unit</label>
            <select value={rateUnit} onChange={e => setRateUnit(e.target.value)}>
              <option value="per_day">Per Day</option>
              <option value="per_month">Per Month</option>
            </select>
          </div>
          <div className="form-group">
            <label>Purpose</label>
            <input type="text" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g., Excavation, Loading" />
          </div>
        </div>
        <div data-modal-footer>
          <button className="btn-secondary" onClick={resetForm}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update' : 'Assign'}
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
