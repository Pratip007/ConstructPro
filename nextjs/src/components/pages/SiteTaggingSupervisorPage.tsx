'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPut } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import { useApproval } from '@/hooks/useApproval';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import styles from './SiteTaggingSupervisorPage.module.scss';

interface Supervisor {
  id: number;
  name: string;
  contact: string;
  assigned_site_id: number | null;
  site_name?: string;
  status?: string;
  pending_status?: string | null;
}

interface Site {
  id: number;
  name: string;
}

export default function SiteTaggingSupervisorPage() {
  const { success, error: notifyError } = useNotification();
  const role = useRole();
  const approval = useApproval();

  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterSiteId, setFilterSiteId] = useState<number | null>(null);

  const [reassigningId, setReassigningId] = useState<number | null>(null);
  const [reassignSiteId, setReassignSiteId] = useState<number | null>(null);

  const siteItems = useMemo(
    () => sites.map(s => ({ value: s.id, label: s.name })),
    [sites]
  );

  const filteredSupervisors = useMemo(() => {
    if (!filterSiteId) return supervisors;
    return supervisors.filter(s => s.assigned_site_id === filterSiteId);
  }, [supervisors, filterSiteId]);

  const summaryCards = useMemo(() => {
    const total = supervisors.length;
    const assigned = supervisors.filter(s => s.assigned_site_id).length;
    const unassigned = total - assigned;
    return [
      { title: 'Total Supervisors', value: total, icon: 'ri-shield-user-line', color: 'primary' as const },
      { title: 'Assigned', value: assigned, icon: 'ri-map-pin-line', color: 'success' as const },
      { title: 'Unassigned', value: unassigned, icon: 'ri-user-unfollow-line', color: 'warning' as const },
    ];
  }, [supervisors]);

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
    apiGet<Site[]>('/sites').then(d => setSites(Array.isArray(d) ? d : [])).catch(() => {});
  }, [loadSupervisors]);

  const startReassign = (s: Supervisor) => {
    setReassigningId(s.id);
    setReassignSiteId(null);
  };

  const cancelReassign = () => {
    setReassigningId(null);
    setReassignSiteId(null);
  };

  const confirmReassign = async (s: Supervisor) => {
    if (!reassignSiteId) {
      notifyError('Please select a site');
      return;
    }
    if (reassignSiteId === s.assigned_site_id) {
      notifyError('Supervisor is already at this site');
      return;
    }

    try {
      const payload = { assigned_site_id: reassignSiteId };
      if (approval.requiresApproval()) {
        await approval.submitForApproval({
          module: 'supervisor-tagging',
          actionType: 'update',
          summary: `Reassign supervisor "${s.name}" to site`,
          data: payload,
          oldData: { assigned_site_id: s.assigned_site_id },
          referenceId: s.id,
        });
        success('Submitted for approval');
      } else {
        const updated = await apiPut<Supervisor>(`/supervisors/${s.id}`, payload);
        setSupervisors(prev => prev.map(x => (x.id === updated.id ? updated : x)));
        success('Supervisor reassigned.');
      }
      cancelReassign();
    } catch (err: any) {
      notifyError('Failed to reassign: ' + err.message);
    }
  };

  const unassignSupervisor = async (s: Supervisor) => {
    try {
      const payload = { assigned_site_id: null };
      if (approval.requiresApproval()) {
        await approval.submitForApproval({
          module: 'supervisor-tagging',
          actionType: 'update',
          summary: `Unassign supervisor "${s.name}" from site`,
          data: payload,
          oldData: { assigned_site_id: s.assigned_site_id },
          referenceId: s.id,
        });
        success('Submitted for approval');
      } else {
        const updated = await apiPut<Supervisor>(`/supervisors/${s.id}`, payload);
        setSupervisors(prev => prev.map(x => (x.id === updated.id ? updated : x)));
        success('Supervisor unassigned from site.');
      }
    } catch (err: any) {
      notifyError('Failed to unassign: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Site Tagging &mdash; Supervisors</h1>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <label>Filter by Site</label>
            <SearchableDropdown
              items={siteItems}
              value={filterSiteId}
              onChange={val => setFilterSiteId(val as number | null)}
              placeholder="All Sites"
            />
          </div>
          <div className="form-group" style={{ alignSelf: 'end' }}>
            <button className="btn-primary" onClick={loadSupervisors}>
              Refresh
            </button>
          </div>
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
                <th>Contact</th>
                <th>Current Site</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSupervisors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-state">No supervisors found.</td>
                </tr>
              ) : (
                filteredSupervisors.map((s, i) => (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.contact}</td>
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
                      ) : (
                        <span className="badge badge-success">Active</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {reassigningId === s.id ? (
                        <div className={styles.reassignRow}>
                          <SearchableDropdown
                            items={siteItems}
                            value={reassignSiteId}
                            onChange={val => setReassignSiteId(val as number | null)}
                            placeholder="New Site"
                          />
                          <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => confirmReassign(s)}>
                            Confirm
                          </button>
                          <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={cancelReassign}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => startReassign(s)}>
                            {s.assigned_site_id ? 'Reassign' : 'Assign'}
                          </button>
                          {s.assigned_site_id && (
                            <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => unassignSupervisor(s)}>
                              Unassign
                            </button>
                          )}
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
    </div>
  );
}
