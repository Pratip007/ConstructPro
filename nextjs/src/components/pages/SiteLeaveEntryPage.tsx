'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin, isSiteLocked, getSupervisorSiteId } from '@/lib/role-utils';
import { exportToExcel } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import styles from './SiteLeaveEntryPage.module.scss';

interface ApiLeaveRecord {
  id: number;
  employee_id?: string;
  employee_name?: string;
  site_id?: string;
  site_name?: string;
  date?: string;
  leave_type?: string;
  reason?: string;
  status?: string;
}

interface LeaveRecord {
  id: number;
  employeeId: string;
  employee: string;
  site: string;
  leaveDate: string;
  leaveType: string;
  reason: string;
  status: string;
}

function mapLeave(r: ApiLeaveRecord): LeaveRecord {
  return {
    id: r.id,
    employeeId: r.employee_id ?? '',
    employee: r.employee_name ?? r.employee_id ?? '',
    site: r.site_name ?? r.site_id ?? '',
    leaveDate: r.date ?? '',
    leaveType: r.leave_type ?? 'CL',
    reason: r.reason ?? '',
    status: r.status ?? 'approved',
  };
}

interface EmployeeCheckItem {
  id: string;
  name: string;
  displayId: string;
}

export default function SiteLeaveEntryPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const { currentUser } = useAuth();

  const [selectedSite, setSelectedSite] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveType, setLeaveType] = useState('CL');
  const [reason, setReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [siteItems, setSiteItems] = useState<{ value: string; label: string }[]>([]);
  const [employeeList, setEmployeeList] = useState<EmployeeCheckItem[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());

  const filteredEmployeeList = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return employeeList;
    return employeeList.filter(
      (e) => e.name.toLowerCase().includes(q) || e.displayId.toLowerCase().includes(q)
    );
  }, [employeeList, searchQuery]);

  const allSelected = useMemo(() => {
    return employeeList.length > 0 && employeeList.every((e) => selectedEmployeeIds.has(e.id));
  }, [employeeList, selectedEmployeeIds]);

  const selectedCount = selectedEmployeeIds.size;

  const filteredRecords = useMemo(() => {
    const q = historySearch.toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.employee.toLowerCase().includes(q) ||
        r.site.toLowerCase().includes(q) ||
        r.leaveType.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
    );
  }, [records, historySearch]);

  const summaryCards = useMemo(() => {
    const cl = records.filter((r) => r.leaveType === 'CL').length;
    const sl = records.filter((r) => r.leaveType === 'SL').length;
    const ul = records.filter((r) => r.leaveType === 'UL').length;
    return [
      { title: 'Total Leaves', value: records.length, icon: 'ri-calendar-line', color: 'primary' as const },
      { title: 'Casual Leave', value: cl, icon: 'ri-sun-line', color: 'info' as const },
      { title: 'Sick Leave', value: sl, icon: 'ri-heart-pulse-line', color: 'warning' as const },
      { title: 'Unpaid Leave', value: ul, icon: 'ri-close-circle-line', color: 'danger' as const },
    ];
  }, [records]);

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const recs = await apiGet<ApiLeaveRecord[]>('/site-leaves');
      setRecords(recs.map(mapLeave));
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to load leave records');
    }
    setLoading(false);
  }, [notifyError]);

  const loadEmployeesForSite = useCallback(
    async (siteId: string) => {
      try {
        const emps = await apiGet<{ id: string | number; name: string; display_id?: string }[]>(
          '/employees',
          { site_id: siteId }
        );
        setEmployeeList(
          emps.map((e) => ({
            id: String(e.id),
            name: e.name,
            displayId: e.display_id ?? String(e.id),
          }))
        );
      } catch (err: any) {
        notifyError(err.message ?? 'Failed to load employees');
      }
    },
    [notifyError]
  );

  useEffect(() => {
    apiGet<{ id: string | number; name: string }[]>('/sites')
      .then((sites) => {
        setSiteItems(sites.map((s) => ({ value: String(s.id), label: s.name })));
        if (isSiteLocked(currentUser)) {
          const lockedSite = getSupervisorSiteId(currentUser);
          if (lockedSite) {
            setSelectedSite(String(lockedSite));
            loadEmployeesForSite(String(lockedSite));
          }
        }
      })
      .catch((err: any) => notifyError(err.message ?? 'Failed to load sites'));
    loadLeaves();
  }, [currentUser, notifyError, loadLeaves, loadEmployeesForSite]);

  const onSiteChange = (siteId: string) => {
    setSelectedSite(siteId);
    setSelectedEmployeeIds(new Set());
    if (siteId) loadEmployeesForSite(siteId);
    else setEmployeeList([]);
  };

  const toggleEmployee = (empId: string) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedEmployeeIds(new Set());
    } else {
      setSelectedEmployeeIds(new Set(employeeList.map((e) => e.id)));
    }
  };

  const resetForm = () => {
    setLeaveDate('');
    setLeaveType('CL');
    setReason('');
    setSelectedEmployeeIds(new Set());
    setEditingId(null);
  };

  const addLeave = async () => {
    if (selectedEmployeeIds.size === 0 || !leaveDate) {
      notifyError('Select at least one employee and a date');
      return;
    }

    if (editingId !== null) {
      try {
        await apiPut(`/site-leaves/${editingId}`, {
          site_id: selectedSite || null,
          date: leaveDate,
          leave_type: leaveType,
          reason,
        });
        success('Leave record updated');
        resetForm();
        loadLeaves();
      } catch (err: any) {
        notifyError(err.message ?? 'Failed to update');
      }
      return;
    }

    const adminUser = isAdmin(currentUser);
    let completed = 0;
    const total = selectedEmployeeIds.size;
    const ids = Array.from(selectedEmployeeIds);

    for (const empId of ids) {
      try {
        await apiPost('/site-leaves', {
          employee_id: empId,
          site_id: selectedSite || null,
          date: leaveDate,
          leave_type: leaveType,
          reason,
          status: adminUser ? 'approved' : 'pending',
        });
        completed++;
      } catch (err: any) {
        completed++;
        notifyError(`Failed for employee: ${err.message ?? 'Unknown error'}`);
      }
    }

    if (completed === total) {
      success(`${total} leave record(s) added`);
      resetForm();
      loadLeaves();
    }
  };

  const editLeave = (rec: LeaveRecord) => {
    setEditingId(rec.id);
    setLeaveDate(rec.leaveDate);
    setLeaveType(rec.leaveType);
    setReason(rec.reason);
    setSelectedEmployeeIds(new Set([rec.employeeId]));
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const deleteLeave = async (id: number) => {
    const confirmed = await confirm({
      title: 'Delete Leave Record',
      message: 'Are you sure you want to delete this leave record?',
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await apiDelete(`/site-leaves/${id}`);
      success('Leave record deleted');
      loadLeaves();
    } catch {
      setRecords((r) => r.filter((x) => x.id !== id));
      success('Leave removed');
    }
  };

  const exportData = () => {
    exportToExcel(
      [
        { header: 'Employee', key: 'Employee' },
        { header: 'Site', key: 'Site' },
        { header: 'Date', key: 'Date' },
        { header: 'Leave Type', key: 'Leave Type' },
        { header: 'Reason', key: 'Reason' },
        { header: 'Status', key: 'Status' },
      ],
      filteredRecords.map((r) => ({
        Employee: r.employee,
        Site: r.site,
        Date: r.leaveDate,
        'Leave Type': r.leaveType,
        Reason: r.reason,
        Status: r.status,
      })),
      'Site_Leave_Records'
    );
  };

  const leaveTypeBadge = (type: string) => {
    if (type === 'CL') return 'badge badge-info';
    if (type === 'SL') return 'badge badge-warning';
    if (type === 'UL') return 'badge badge-danger';
    return 'badge';
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return 'badge badge-success';
    if (status === 'pending') return 'badge badge-warning';
    if (status === 'rejected') return 'badge badge-danger';
    return 'badge';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <i className="ri-door-open-line" /> Site Leave Entry
        </h1>
        <div className="header-actions">
          <button className="btn-outline" onClick={exportData} disabled={!records.length}>
            <i className="ri-file-excel-line" /> Export
          </button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addLeave();
          }}
          className="form-grid"
        >
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={selectedSite}
              onChange={onSiteChange}
              placeholder="Select Site"
              label="Site"
              required
              disabled={isSiteLocked(currentUser)}
            />
          </div>
          <div className="form-group">
            <label>Leave Date</label>
            <input
              type="date"
              value={leaveDate}
              onChange={(e) => setLeaveDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Leave Type</label>
            <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
              <option value="CL">CL - Casual Leave</option>
              <option value="SL">SL - Sick Leave</option>
              <option value="UL">UL - Unpaid Leave</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for leave"
            />
          </div>
        </form>

        {selectedSite && (
          <div className={styles.employeeSelectSection}>
            <div className={styles.employeeSelectHeader}>
              <h4>
                <i className="ri-team-line" /> Select Employees ({selectedCount} selected)
              </h4>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ maxWidth: 250 }}
              />
            </div>
            <div className={`${styles.checkboxRow} ${styles.selectAll}`}>
              <label>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                <strong>Select All</strong>
              </label>
            </div>
            <div className={styles.employeeCheckboxList}>
              {filteredEmployeeList.length === 0 ? (
                <p className="empty-state" style={{ padding: '0.75rem' }}>
                  No employees found at this site.
                </p>
              ) : (
                filteredEmployeeList.map((emp) => (
                  <div key={emp.id} className={styles.checkboxRow}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.has(emp.id)}
                        onChange={() => toggleEmployee(emp.id)}
                      />
                      <span className={styles.empName}>{emp.name}</span>
                      <span className={styles.empId}>{emp.displayId}</span>
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '1rem' }}>
          <button
            className="btn-primary"
            onClick={addLeave}
            disabled={selectedCount === 0 || !leaveDate}
          >
            <i className="ri-add-line" />{' '}
            {editingId !== null ? 'Update Leave' : `Submit Leave (${selectedCount})`}
          </button>
          {editingId !== null && (
            <button type="button" className="btn-secondary" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className={styles.sectionHeader}>
        <h3>
          <i className="ri-history-line" /> Leave History
        </h3>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search history..."
          value={historySearch}
          onChange={(e) => setHistorySearch(e.target.value)}
          style={{ maxWidth: 250 }}
        />
      </div>

      {loading && <p className="loading-text">Loading leave records...</p>}

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Employee</th>
              <th>Site</th>
              <th>Date</th>
              <th>Leave Type</th>
              <th>Reason</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  No leave records found.
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec, i) => (
                <tr key={rec.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{rec.employee}</td>
                  <td>{rec.site}</td>
                  <td>{rec.leaveDate}</td>
                  <td>
                    <span className={leaveTypeBadge(rec.leaveType)}>{rec.leaveType}</span>
                  </td>
                  <td>{rec.reason}</td>
                  <td>
                    <span className={statusBadge(rec.status)}>{rec.status}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => editLeave(rec)}
                      style={{ marginRight: '0.25rem' }}
                    >
                      <i className="ri-edit-line" />
                    </button>
                    <button className="btn-danger btn-sm" onClick={() => deleteLeave(rec.id)}>
                      <i className="ri-delete-bin-line" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
