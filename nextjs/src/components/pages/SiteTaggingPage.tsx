'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin, isSiteLocked, getSupervisorSiteId } from '@/lib/role-utils';
import { exportToExcel } from '@/lib/export-utils';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';
import styles from './SiteTaggingPage.module.scss';

interface ApiTagRecord {
  id: number;
  employee_ids?: string[];
  employee_names?: string[];
  employee_id?: string;
  employee_name?: string;
  from_site_id?: string;
  from_site_name?: string;
  to_site_id?: string;
  to_site_name?: string;
  site_id?: string;
  site_name?: string;
  tagged_date?: string;
  status?: string;
  created_by?: string;
}

interface TagRecord {
  id: number;
  employees: string;
  employeeCount: number;
  fromSite: string;
  toSite: string;
  date: string;
  status: string;
  createdBy: string;
}

function mapTagRecord(r: ApiTagRecord): TagRecord {
  const names = r.employee_names ?? (r.employee_name ? [r.employee_name] : []);
  return {
    id: r.id,
    employees: names.join(', ') || r.employee_id || '',
    employeeCount: names.length || (r.employee_id ? 1 : 0),
    fromSite: r.from_site_name ?? '',
    toSite: r.to_site_name ?? r.site_name ?? r.site_id ?? '',
    date: r.tagged_date ?? '',
    status: r.status ?? 'completed',
    createdBy: r.created_by ?? '',
  };
}

interface EmployeeCheckItem {
  id: string;
  name: string;
  displayId: string;
}

export default function SiteTaggingPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const { currentUser } = useAuth();

  const [siteFrom, setSiteFrom] = useState('');
  const [siteTo, setSiteTo] = useState('');
  const [tagDate, setTagDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [records, setRecords] = useState<TagRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [siteDropdownItems, setSiteDropdownItems] = useState<DropdownItem[]>([]);
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
    return filteredEmployeeList.length > 0 && filteredEmployeeList.every((e) => selectedEmployeeIds.has(e.id));
  }, [filteredEmployeeList, selectedEmployeeIds]);

  const selectedCount = selectedEmployeeIds.size;

  const filteredRecords = useMemo(() => {
    const q = historySearch.toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.employees.toLowerCase().includes(q) ||
        r.fromSite.toLowerCase().includes(q) ||
        r.toSite.toLowerCase().includes(q)
    );
  }, [records, historySearch]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const recs = await apiGet<ApiTagRecord[]>('/site-tagging');
      setRecords(recs.map(mapTagRecord));
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to load tagging records');
    }
    setLoading(false);
  }, [notifyError]);

  const loadEmployeesForSite = useCallback(
    async (siteId: string) => {
      try {
        const emps = await apiGet<{ id: string | number; name: string; display_id?: string }[]>('/employees', {
          site_id: siteId,
        });
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
    const loadSites = async () => {
      try {
        const sites = await apiGet<{ id: string | number; name: string }[]>('/sites');
        setSiteDropdownItems(sites.map((s) => ({ value: String(s.id), label: s.name })));
        if (isSiteLocked(currentUser)) {
          const lockedSite = getSupervisorSiteId(currentUser);
          if (lockedSite) {
            setSiteFrom(String(lockedSite));
            loadEmployeesForSite(String(lockedSite));
          }
        }
      } catch (err: any) {
        notifyError(err.message ?? 'Failed to load sites');
      }
    };
    loadSites();
    loadRecords();
  }, [currentUser, loadEmployeesForSite, loadRecords, notifyError]);

  const onSiteFromChange = (siteId: string) => {
    setSiteFrom(siteId);
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
      setSelectedEmployeeIds(new Set(filteredEmployeeList.map((e) => e.id)));
    }
  };

  const submitTagging = async () => {
    if (selectedCount === 0 || !siteTo || !tagDate) {
      notifyError('Select employees, target site, and date');
      return;
    }
    if (siteFrom === siteTo) {
      notifyError('From and To sites cannot be the same');
      return;
    }
    try {
      await apiPost('/site-tagging', {
        employee_ids: Array.from(selectedEmployeeIds),
        from_site_id: siteFrom || null,
        to_site_id: siteTo,
        tagged_date: tagDate,
      });
      success(`${selectedCount} employee(s) transferred successfully`);
      setSiteTo('');
      setTagDate('');
      setSelectedEmployeeIds(new Set());
      loadRecords();
      if (siteFrom) loadEmployeesForSite(siteFrom);
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to submit tagging');
    }
  };

  const revertTagging = async (id: number) => {
    const confirmed = await confirm({
      title: 'Revert Transfer',
      message: 'This will move employees back to their original site. Continue?',
      type: 'warning',
    });
    if (!confirmed) return;
    try {
      await apiPut(`/site-tagging/${id}/revert`, {});
      success('Transfer reverted');
      loadRecords();
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to revert');
    }
  };

  const deleteTagging = async (id: number) => {
    const confirmed = await confirm({
      title: 'Delete Transfer Record',
      message: 'Are you sure you want to permanently delete this record?',
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await apiDelete(`/site-tagging/${id}`);
      success('Record deleted');
      loadRecords();
    } catch {
      setRecords((prev) => prev.filter((x) => x.id !== id));
      success('Record removed');
    }
  };

  const exportData = () => {
    exportToExcel(
      [
        { key: 'employees', header: 'Employees' },
        { key: 'employeeCount', header: 'Count' },
        { key: 'fromSite', header: 'From Site' },
        { key: 'toSite', header: 'To Site' },
        { key: 'date', header: 'Date' },
        { key: 'status', header: 'Status' },
      ],
      filteredRecords as unknown as Record<string, unknown>[],
      'Site_Tagging_Records'
    );
  };

  const adminView = isAdmin(currentUser);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <i className="ri-map-pin-line" /> Employee Site Tagging
        </h1>
        <div className="header-actions">
          <button className="btn-outline" onClick={exportData} disabled={!records.length}>
            <i className="ri-file-excel-line" /> Export
          </button>
        </div>
      </div>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={siteDropdownItems}
              placeholder="Transfer FROM Site"
              label="From Site"
              required
              disabled={isSiteLocked(currentUser)}
              value={siteFrom}
              onChange={onSiteFromChange}
            />
          </div>
          <div
            className="form-group"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '1.5rem' }}
          >
            <i className="ri-arrow-right-line" style={{ fontSize: '24px', color: 'var(--accent)' }} />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteDropdownItems}
              placeholder="Transfer TO Site"
              label="To Site"
              required
              value={siteTo}
              onChange={setSiteTo}
            />
          </div>
          <div className="form-group">
            <label>Transfer Date</label>
            <input type="date" value={tagDate} onChange={(e) => setTagDate(e.target.value)} required />
          </div>
        </div>

        {siteFrom && (
          <div className={styles.employeeSelectSection}>
            <div className={styles.employeeSelectHeader}>
              <h4>
                <i className="ri-team-line" /> Employees at Site ({selectedCount} selected)
              </h4>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ maxWidth: '250px' }}
              />
            </div>
            <div className={`${styles.checkboxRow} ${styles.selectAll}`}>
              <label>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                <strong>Select All ({employeeList.length})</strong>
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
          <button className="btn-primary" onClick={submitTagging} disabled={selectedCount === 0 || !siteTo || !tagDate}>
            <i className="ri-map-pin-line" /> Transfer {selectedCount} Employee(s)
          </button>
        </div>
      </div>

      <div className={styles.sectionHeader}>
        <h3>
          <i className="ri-history-line" /> Transfer History
        </h3>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search history..."
          value={historySearch}
          onChange={(e) => setHistorySearch(e.target.value)}
          style={{ maxWidth: '250px' }}
        />
      </div>

      {loading && <p className="loading-text">Loading records...</p>}

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Employees</th>
              <th>From Site</th>
              <th></th>
              <th>To Site</th>
              <th>Date</th>
              <th>Status</th>
              {adminView && <th style={{ textAlign: 'center' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={adminView ? 8 : 7} className="empty-state">
                  No tagging records found.
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec, i) => (
                <tr key={rec.id}>
                  <td>{i + 1}</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{rec.employees}</span>
                    {rec.employeeCount > 1 && (
                      <span className="badge badge-info" style={{ marginLeft: '0.5rem' }}>
                        {rec.employeeCount}
                      </span>
                    )}
                  </td>
                  <td>{rec.fromSite}</td>
                  <td style={{ textAlign: 'center' }}>
                    <i className="ri-arrow-right-line" style={{ color: 'var(--accent)' }} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{rec.toSite}</td>
                  <td>{rec.date}</td>
                  <td>
                    <span
                      className={`badge ${
                        rec.status === 'completed'
                          ? 'badge-success'
                          : rec.status === 'pending'
                            ? 'badge-warning'
                            : rec.status === 'reverted'
                              ? 'badge-danger'
                              : ''
                      }`}
                    >
                      {rec.status}
                    </span>
                  </td>
                  {adminView && (
                    <td style={{ textAlign: 'center' }}>
                      {rec.status === 'completed' && (
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => revertTagging(rec.id)}
                          style={{ marginRight: '0.25rem' }}
                          title="Revert Transfer"
                        >
                          <i className="ri-arrow-go-back-line" />
                        </button>
                      )}
                      <button className="btn-danger btn-sm" onClick={() => deleteTagging(rec.id)} title="Delete Record">
                        <i className="ri-delete-bin-line" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
