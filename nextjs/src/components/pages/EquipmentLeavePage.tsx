'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPut, apiPost } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import { useApproval } from '@/hooks/useApproval';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import ModalDialog from '@/components/ModalDialog';
import styles from './EquipmentLeavePage.module.scss';

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
  remarks?: string;
}

interface Site { id: string; name: string; }

export default function EquipmentLeavePage() {
  const { success, error: notifyError } = useNotification();
  const role = useRole();
  const approval = useApproval();

  const [loading, setLoading] = useState(false);
  const [allAssignments, setAllAssignments] = useState<EquipmentAssignment[]>([]);
  const [siteOptions, setSiteOptions] = useState<Site[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'released'>('active');

  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<EquipmentAssignment | null>(null);
  const [releaseDate, setReleaseDate] = useState('');
  const [releaseCondition, setReleaseCondition] = useState('Good');
  const [releaseRemarks, setReleaseRemarks] = useState('');
  const [transferSiteId, setTransferSiteId] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [transferRemarks, setTransferRemarks] = useState('');

  const activeAssignments = useMemo(() =>
    allAssignments.filter(a => a.status !== 'released'), [allAssignments]
  );
  const releasedAssignments = useMemo(() =>
    allAssignments.filter(a => a.status === 'released'), [allAssignments]
  );

  const siteItems = useMemo(() =>
    siteOptions.map(s => ({ value: s.id, label: s.name })), [siteOptions]
  );

  const summaryCards = useMemo(() => [
    { title: 'Active', value: activeAssignments.length, icon: 'ri-truck-line', color: 'success' as const },
    { title: 'Released', value: releasedAssignments.length, icon: 'ri-logout-box-line', color: 'info' as const },
    { title: 'Needs Repair', value: releasedAssignments.filter(a => a.condition === 'Needs Repair').length, icon: 'ri-tools-line', color: 'warning' as const },
    { title: 'Damaged', value: releasedAssignments.filter(a => a.condition === 'Damaged').length, icon: 'ri-error-warning-line', color: 'danger' as const },
  ], [activeAssignments, releasedAssignments]);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<EquipmentAssignment[]>('/equipment-site-assignments');
      setAllAssignments(data);
    } catch {
      notifyError('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    apiGet<Site[]>('/sites').then(setSiteOptions).catch(() => {});
    loadAssignments();
  }, [loadAssignments]);

  const getDurationDays = (a: EquipmentAssignment) => {
    if (!a.start_date) return 0;
    const start = new Date(a.start_date).getTime();
    const end = a.released_date ? new Date(a.released_date).getTime() : Date.now();
    return Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  };

  const openReleaseModal = (a: EquipmentAssignment) => {
    setSelectedAssignment(a);
    setReleaseDate(new Date().toISOString().split('T')[0]);
    setReleaseCondition('Good');
    setReleaseRemarks('');
    setShowReleaseModal(true);
  };

  const openTransferModal = (a: EquipmentAssignment) => {
    setSelectedAssignment(a);
    setTransferSiteId('');
    setTransferDate(new Date().toISOString().split('T')[0]);
    setTransferRemarks('');
    setShowTransferModal(true);
  };

  const confirmRelease = async () => {
    const a = selectedAssignment;
    if (!a) return;
    try {
      const releasePayload = {
        released_date: releaseDate, status: 'released',
        condition: releaseCondition, remarks: releaseRemarks,
      };
      if (approval.requiresApproval()) {
        await approval.submitForApproval({
          module: 'equipment-leave',
          actionType: 'update',
          summary: `Release equipment: ${a.equipment_name} from ${a.site_name}`,
          data: releasePayload,
          referenceId: a.id,
        });
        success('Submitted for approval');
      } else {
        const updated = await apiPut<EquipmentAssignment>(`/equipment-site-assignments/${a.id}`, releasePayload);
        setAllAssignments(list => list.map(x => x.id === updated.id ? updated : x));
        success('Equipment released');
      }
      setShowReleaseModal(false);
    } catch {
      notifyError('Failed to release equipment');
    }
  };

  const confirmTransfer = async () => {
    const a = selectedAssignment;
    if (!a) return;
    if (!transferSiteId) { notifyError('Please select a destination site'); return; }
    if (transferSiteId === a.site_id) { notifyError('Equipment is already at this site'); return; }

    const today = transferDate || new Date().toISOString().split('T')[0];
    try {
      if (approval.requiresApproval()) {
        await approval.submitForApproval({
          module: 'equipment-leave',
          actionType: 'update',
          summary: `Transfer equipment: ${a.equipment_name} from ${a.site_name} to new site`,
          data: {
            assignmentId: a.id,
            releasePayload: {
              released_date: today, status: 'released',
              condition: 'Good', remarks: `Transferred to new site. ${transferRemarks}`.trim(),
            },
            newAssignment: {
              equipment_id: a.equipment_id, site_id: transferSiteId,
              start_date: today, rate: a.rate, rate_unit: a.rate_unit, purpose: a.purpose,
            },
          },
          referenceId: a.id,
        });
        success('Submitted for approval');
      } else {
        await apiPut(`/equipment-site-assignments/${a.id}`, {
          released_date: today, status: 'released',
          condition: 'Good', remarks: `Transferred to new site. ${transferRemarks}`.trim(),
        });
        await apiPost('/equipment-site-assignments', {
          equipment_id: a.equipment_id, site_id: transferSiteId,
          start_date: today, rate: a.rate, rate_unit: a.rate_unit, purpose: a.purpose,
        });
        success('Equipment transferred to new site');
      }
      setShowTransferModal(false);
      loadAssignments();
    } catch {
      notifyError('Failed to transfer equipment');
    }
  };

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
        <h1>Equipment Leave / Release</h1>
      </div>

      <SummaryCards cards={summaryCards} />

      <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        <button className={activeTab === 'active' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('active')}>
          Active ({activeAssignments.length})
        </button>
        <button className={activeTab === 'released' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('released')}>
          Released ({releasedAssignments.length})
        </button>
      </div>

      {loading && <div className="skeleton" style={{ height: 200 }} />}

      {activeTab === 'active' && (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Equipment</th><th>Site</th><th>Start Date</th>
                <th>Duration (Days)</th><th>Rate</th><th>Purpose</th>
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
                    <td>{getDurationDays(a)}</td>
                    <td>{a.rate ? `₹${a.rate}/${a.rate_unit === 'per_month' ? 'mo' : 'day'}` : '-'}</td>
                    <td>{a.purpose}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openReleaseModal(a)}>Release</button>
                        <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openTransferModal(a)}>Transfer</button>
                      </div>
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
                <th>Released Date</th><th>Duration</th><th>Condition</th><th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {releasedAssignments.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">No released equipment records.</td></tr>
              ) : (
                releasedAssignments.map((a, i) => (
                  <tr key={a.id} style={{ opacity: 0.85 }}>
                    <td>{i + 1}</td>
                    <td>{a.equipment_name}</td>
                    <td>{a.site_name}</td>
                    <td>{a.start_date}</td>
                    <td>{a.released_date}</td>
                    <td>{getDurationDays(a)} days</td>
                    <td><span className={getConditionClass(a.condition ?? 'Good')}>{a.condition ?? 'Good'}</span></td>
                    <td>{a.remarks ?? '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Release Modal */}
      <ModalDialog isOpen={showReleaseModal} title="Release Equipment" size="md" onClose={() => setShowReleaseModal(false)}>
        {selectedAssignment && (
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="form-group">
              <label>Equipment</label>
              <input type="text" value={selectedAssignment.equipment_name || ''} disabled />
            </div>
            <div className="form-group">
              <label>Current Site</label>
              <input type="text" value={selectedAssignment.site_name || ''} disabled />
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
              <textarea value={releaseRemarks} onChange={e => setReleaseRemarks(e.target.value)} rows={2} placeholder="Any notes about release..." />
            </div>
          </div>
        )}
        <div data-modal-footer>
          <button className="btn-secondary" onClick={() => setShowReleaseModal(false)}>Cancel</button>
          <button className="btn-danger" onClick={confirmRelease}>Confirm Release</button>
        </div>
      </ModalDialog>

      {/* Transfer Modal */}
      <ModalDialog isOpen={showTransferModal} title="Transfer Equipment" size="md" onClose={() => setShowTransferModal(false)}>
        {selectedAssignment && (
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="form-group">
              <label>Equipment</label>
              <input type="text" value={selectedAssignment.equipment_name || ''} disabled />
            </div>
            <div className="form-group">
              <label>Current Site</label>
              <input type="text" value={selectedAssignment.site_name || ''} disabled />
            </div>
            <div className="form-group">
              <SearchableDropdown items={siteItems} label="Transfer To Site *" placeholder="Select Destination Site"
                value={transferSiteId} onChange={(val: any) => setTransferSiteId(val)} />
            </div>
            <div className="form-group">
              <label>Transfer Date *</label>
              <input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Remarks</label>
              <textarea value={transferRemarks} onChange={e => setTransferRemarks(e.target.value)} rows={2} placeholder="Transfer notes..." />
            </div>
          </div>
        )}
        <div data-modal-footer>
          <button className="btn-secondary" onClick={() => setShowTransferModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={confirmTransfer}>Confirm Transfer</button>
        </div>
      </ModalDialog>
    </div>
  );
}
