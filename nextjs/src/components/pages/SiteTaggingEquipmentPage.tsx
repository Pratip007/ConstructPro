'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPut, apiPost } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import { useApproval } from '@/hooks/useApproval';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import ModalDialog from '@/components/ModalDialog';
import styles from './SiteTaggingEquipmentPage.module.scss';

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
  condition?: string;
  pending_status?: string | null;
}

interface Equipment { id: string; name: string; }
interface Site { id: string; name: string; }

export default function SiteTaggingEquipmentPage() {
  const { success, error: notifyError } = useNotification();
  const role = useRole();
  const approval = useApproval();

  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<EquipmentAssignment[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<Equipment[]>([]);
  const [siteOptions, setSiteOptions] = useState<Site[]>([]);

  const [filterSite, setFilterSite] = useState('');
  const [filterEquipment, setFilterEquipment] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'released'>('active');

  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [reassigningSiteId, setReassigningSiteId] = useState('');

  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<EquipmentAssignment | null>(null);
  const [releaseDate, setReleaseDate] = useState('');
  const [releaseCondition, setReleaseCondition] = useState('Good');
  const [releaseRemarks, setReleaseRemarks] = useState('');

  const activeAssignments = useMemo(() =>
    assignments.filter(a => a.status !== 'released'), [assignments]
  );
  const completedAssignments = useMemo(() =>
    assignments.filter(a => a.status === 'released'), [assignments]
  );

  const equipmentItems = useMemo(() =>
    equipmentOptions.map(e => ({ value: e.id, label: e.name })), [equipmentOptions]
  );
  const siteItems = useMemo(() =>
    siteOptions.map(s => ({ value: s.id, label: s.name })), [siteOptions]
  );

  const summaryCards = useMemo(() => [
    { title: 'Active', value: activeAssignments.length, icon: 'ri-check-line', color: 'success' as const },
    { title: 'Released', value: completedAssignments.length, icon: 'ri-logout-box-line', color: 'info' as const },
    { title: 'Total Equipment', value: equipmentOptions.length, icon: 'ri-truck-line', color: 'primary' as const },
  ], [activeAssignments, completedAssignments, equipmentOptions]);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (filterSite) params['site_id'] = filterSite;
    if (filterEquipment) params['equipment_id'] = filterEquipment;
    try {
      const data = await apiGet<EquipmentAssignment[]>('/equipment-site-assignments', params);
      setAssignments(data);
    } catch {
      notifyError('Failed to load tagging records');
    } finally {
      setLoading(false);
    }
  }, [filterSite, filterEquipment, notifyError]);

  useEffect(() => {
    apiGet<Equipment[]>('/equipment').then(setEquipmentOptions).catch(() => {});
    apiGet<Site[]>('/sites').then(setSiteOptions).catch(() => {});
    loadAssignments();
  }, [loadAssignments]);

  const startReassign = (assignment: EquipmentAssignment) => {
    setReassigningId(assignment.id);
    setReassigningSiteId('');
  };

  const cancelReassign = () => {
    setReassigningId(null);
    setReassigningSiteId('');
  };

  const confirmReassign = async (assignment: EquipmentAssignment) => {
    if (!reassigningSiteId) { notifyError('Please select a new site'); return; }
    if (reassigningSiteId === assignment.site_id) { notifyError('Equipment is already at this site'); return; }
    const today = new Date().toISOString().split('T')[0];
    try {
      if (approval.requiresApproval()) {
        await approval.submitForApproval({
          module: 'equipment-tagging',
          actionType: 'update',
          summary: `Reassign equipment: ${assignment.equipment_name} from ${assignment.site_name}`,
          data: {
            assignmentId: assignment.id,
            releasePayload: { released_date: today, status: 'released' },
            newAssignment: {
              equipment_id: assignment.equipment_id, site_id: reassigningSiteId,
              start_date: today, rate: assignment.rate, rate_unit: assignment.rate_unit, purpose: assignment.purpose,
            },
          },
          referenceId: assignment.id,
        });
        success('Submitted for approval');
      } else {
        await apiPut(`/equipment-site-assignments/${assignment.id}`, {
          released_date: today, status: 'released',
        });
        await apiPost('/equipment-site-assignments', {
          equipment_id: assignment.equipment_id, site_id: reassigningSiteId,
          start_date: today, rate: assignment.rate, rate_unit: assignment.rate_unit, purpose: assignment.purpose,
        });
        success('Equipment reassigned');
      }
      cancelReassign();
      loadAssignments();
    } catch {
      notifyError('Failed to reassign equipment');
    }
  };

  const openReleaseModal = (a: EquipmentAssignment) => {
    setReleaseTarget(a);
    setReleaseDate(new Date().toISOString().split('T')[0]);
    setReleaseCondition('Good');
    setReleaseRemarks('');
    setShowReleaseModal(true);
  };

  const confirmRelease = async () => {
    const a = releaseTarget;
    if (!a) return;
    try {
      const releasePayload = {
        released_date: releaseDate, status: 'released',
        condition: releaseCondition, remarks: releaseRemarks,
      };
      if (approval.requiresApproval()) {
        await approval.submitForApproval({
          module: 'equipment-tagging',
          actionType: 'update',
          summary: `Release equipment: ${a.equipment_name} from ${a.site_name}`,
          data: releasePayload,
          referenceId: a.id,
        });
        success('Submitted for approval');
      } else {
        const updated = await apiPut<EquipmentAssignment>(`/equipment-site-assignments/${a.id}`, releasePayload);
        setAssignments(list => list.map(x => x.id === updated.id ? updated : x));
        success('Equipment released');
      }
      setShowReleaseModal(false);
    } catch {
      notifyError('Failed to release equipment');
    }
  };

  const siteName = (id: string) =>
    siteOptions.find(s => s.id === id)?.name ?? id;

  const getConditionClass = (condition: string) => {
    switch (condition) {
      case 'Good': return 'badge badge-success';
      case 'Needs Repair': return 'badge badge-warning';
      case 'Damaged': return 'badge badge-danger';
      default: return 'badge badge-info';
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Site Tagging — Equipment</h1>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <label>Filter by Equipment</label>
            <SearchableDropdown items={equipmentItems} value={filterEquipment} onChange={(val: any) => setFilterEquipment(val)} placeholder="All Equipment" />
          </div>
          <div className="form-group">
            <label>Filter by Site</label>
            <SearchableDropdown items={siteItems} value={filterSite} onChange={(val: any) => setFilterSite(val)} placeholder="All Sites" />
          </div>
          <div className="form-group" style={{ alignSelf: 'end' }}>
            <button className="btn-primary" onClick={loadAssignments}>Search</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        <button className={activeTab === 'active' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('active')}>
          Active ({activeAssignments.length})
        </button>
        <button className={activeTab === 'released' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('released')}>
          Released ({completedAssignments.length})
        </button>
      </div>

      {loading && <div className="skeleton" style={{ height: 200 }} />}

      {activeTab === 'active' && (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Equipment</th><th>Current Site</th><th>Since</th>
                <th>Rate</th><th>Purpose</th><th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeAssignments.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">No active equipment assignments.</td></tr>
              ) : (
                activeAssignments.map((a, i) => (
                  <tr key={a.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{a.equipment_name}</td>
                    <td>{a.site_name}</td>
                    <td>{a.start_date}</td>
                    <td>{a.rate ? `₹${a.rate}/${a.rate_unit === 'per_month' ? 'mo' : 'day'}` : '-'}</td>
                    <td>{a.purpose}</td>
                    <td>
                      {a.pending_status ? (
                        <span className="badge badge-warning">{a.pending_status}</span>
                      ) : (
                        <span className="badge badge-success">Active</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {reassigningId === a.id ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 180 }}>
                            <SearchableDropdown items={siteItems} value={reassigningSiteId}
                              onChange={(val: any) => setReassigningSiteId(val)} placeholder="New Site" />
                          </div>
                          <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => confirmReassign(a)}>Confirm</button>
                          <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={cancelReassign}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => startReassign(a)}>Reassign</button>
                          <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openReleaseModal(a)}>Release</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'released' && (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Equipment</th><th>Site</th><th>Start Date</th>
                <th>Released Date</th><th>Condition</th><th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {completedAssignments.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">No released equipment records.</td></tr>
              ) : (
                completedAssignments.map((a, i) => (
                  <tr key={a.id} style={{ opacity: 0.85 }}>
                    <td>{i + 1}</td>
                    <td>{a.equipment_name}</td>
                    <td>{a.site_name}</td>
                    <td>{a.start_date}</td>
                    <td>{a.released_date}</td>
                    <td><span className={getConditionClass(a.condition ?? 'Good')}>{a.condition ?? 'Good'}</span></td>
                    <td>{a.purpose ?? '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Release Modal */}
      <ModalDialog isOpen={showReleaseModal} title="Release Equipment" size="md" onClose={() => setShowReleaseModal(false)}>
        {releaseTarget && (
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="form-group">
              <label>Equipment</label>
              <input type="text" value={releaseTarget.equipment_name || ''} disabled />
            </div>
            <div className="form-group">
              <label>Current Site</label>
              <input type="text" value={releaseTarget.site_name || ''} disabled />
            </div>
            <div className="form-group">
              <label>Release Date *</label>
              <input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Condition *</label>
              <select value={releaseCondition} onChange={e => setReleaseCondition(e.target.value)}>
                <option value="Good">Good</option>
                <option value="Needs Repair">Needs Repair</option>
                <option value="Damaged">Damaged</option>
              </select>
            </div>
            <div className="form-group">
              <label>Remarks</label>
              <textarea value={releaseRemarks} onChange={e => setReleaseRemarks(e.target.value)} rows={2} placeholder="Release notes..." />
            </div>
          </div>
        )}
        <div data-modal-footer>
          <button className="btn-secondary" onClick={() => setShowReleaseModal(false)}>Cancel</button>
          <button className="btn-danger" onClick={confirmRelease}>Confirm Release</button>
        </div>
      </ModalDialog>
    </div>
  );
}
