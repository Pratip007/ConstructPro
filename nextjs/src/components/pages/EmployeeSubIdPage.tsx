'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { exportToExcel } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';

interface ApiSubId {
  id: number;
  employee_id?: string;
  employee_name?: string;
  site_id?: string;
  site_name?: string;
  type?: string;
  rate?: number;
  salary_basis?: string;
  status?: string;
  position_type?: string;
}

interface SubId {
  id: number;
  employee: string;
  subIdName: string;
  siteName: string;
  rate: number;
  salaryBasis: string;
  status: string;
  positionType: string;
}

interface DropdownItem {
  value: string;
  label: string;
}

export default function EmployeeSubIdPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedSite, setSelectedSite] = useState('');
  const [subIdType, setSubIdType] = useState('');
  const [rate, setRate] = useState(0);
  const [salaryBasis, setSalaryBasis] = useState('daily');
  const [positionType, setPositionType] = useState('Erection');
  const [subIds, setSubIds] = useState<SubId[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [employeeDropdownItems, setEmployeeDropdownItems] = useState<DropdownItem[]>([]);
  const [siteDropdownItems, setSiteDropdownItems] = useState<DropdownItem[]>([]);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const emps = await apiGet<{ id: string | number; name: string }[]>('/employees');
        setEmployeeDropdownItems(emps.map(e => ({ value: String(e.id), label: e.name })));
      } catch (err: any) {
        notifyError(err.message ?? 'Failed to load employees');
      }
    })();
    (async () => {
      try {
        const sites = await apiGet<{ id: string | number; name: string }[]>('/sites');
        setSiteDropdownItems(sites.map(s => ({ value: String(s.id), label: s.name })));
      } catch (err: any) {
        notifyError(err.message ?? 'Failed to load sites');
      }
    })();
  }, [notifyError]);

  const loadSubIds = useCallback(async (empId: string) => {
    setLoading(true);
    try {
      const subs = await apiGet<ApiSubId[]>(`/employees/${empId}/sub-ids`);
      setSubIds(subs.map(s => ({
        id: s.id,
        employee: s.employee_name ?? selectedEmployeeName,
        subIdName: s.type ?? '',
        siteName: s.site_name ?? s.site_id ?? '',
        rate: s.rate ?? 0,
        salaryBasis: s.salary_basis ?? 'daily',
        status: s.status ?? 'active',
        positionType: s.position_type ?? '',
      })));
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to load sub IDs');
    }
    setLoading(false);
  }, [notifyError, selectedEmployeeName]);

  const onEmployeeChange = (empId: string) => {
    setSelectedEmployee(empId);
    const emp = employeeDropdownItems.find(e => e.value === empId);
    setSelectedEmployeeName(emp?.label ?? '');
    if (empId) loadSubIds(empId);
    else setSubIds([]);
  };

  const resetForm = () => {
    setSubIdType('');
    setRate(0);
    setSalaryBasis('daily');
    setPositionType('Erection');
    setSelectedSite('');
    setEditingId(null);
  };

  const addSubId = async () => {
    if (!selectedEmployee || !subIdType) return;
    const body = {
      site_id: selectedSite || null,
      type: subIdType,
      rate,
      salary_basis: salaryBasis,
      position_type: positionType,
    };
    try {
      if (editingId !== null) {
        await apiPut(`/employees/${selectedEmployee}/sub-ids/${editingId}`, body);
        success('Sub ID updated');
      } else {
        await apiPost(`/employees/${selectedEmployee}/sub-ids`, body);
        success('Sub ID created');
      }
      resetForm();
      loadSubIds(selectedEmployee);
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to save sub ID');
    }
  };

  const editSubId = (sub: SubId) => {
    setEditingId(sub.id);
    setSubIdType(sub.subIdName);
    setRate(sub.rate);
    setSalaryBasis(sub.salaryBasis);
    setPositionType(sub.positionType || 'Erection');
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const deleteSubId = async (id: number) => {
    const confirmed = await confirm({
      title: 'Delete Sub ID',
      message: 'Are you sure you want to delete this sub ID?',
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await apiDelete(`/employees/${selectedEmployee}/sub-ids/${id}`);
      success('Sub ID deleted');
      loadSubIds(selectedEmployee);
    } catch {
      setSubIds(prev => prev.filter(x => x.id !== id));
      success('Sub ID removed');
    }
  };

  const exportData = () => {
    exportToExcel(
      [
        { header: 'Employee', key: 'employee' },
        { header: 'Sub ID', key: 'subIdName' },
        { header: 'Site', key: 'siteName' },
        { header: 'Rate', key: 'rate' },
        { header: 'Salary Basis', key: 'salaryBasis' },
        { header: 'Position', key: 'positionType' },
        { header: 'Status', key: 'status' },
      ],
      subIds as unknown as Record<string, unknown>[],
      `SubIDs_${selectedEmployeeName}`
    );
  };

  const formatNumber = (n: number) => n.toLocaleString('en-IN');

  const positionBadgeClass = (pt: string) => {
    if (pt === 'Erection') return 'badge badge-info';
    if (pt === 'Sheeting') return 'badge badge-warning';
    if (pt === 'Both') return 'badge badge-success';
    return 'badge';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-id-card-line" /> Sub ID Allotment</h1>
        <div className="header-actions">
          <button className="btn-outline" onClick={exportData} disabled={!subIds.length}>
            <i className="ri-file-excel-line" /> Export
          </button>
        </div>
      </div>

      <div className="card-container">
        <form onSubmit={(e) => { e.preventDefault(); addSubId(); }} className="form-grid">
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <SearchableDropdown
              items={employeeDropdownItems}
              placeholder="Search & Select Employee"
              label="Select Employee"
              required
              value={selectedEmployee}
              onChange={onEmployeeChange}
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteDropdownItems}
              placeholder="Select Site"
              label="Site"
              value={selectedSite}
              onChange={setSelectedSite}
            />
          </div>
          <div className="form-group">
            <label>Type / Sub ID Name</label>
            <input type="text" value={subIdType} onChange={(e) => setSubIdType(e.target.value)}
              placeholder="e.g. Night Shift" required />
          </div>
          <div className="form-group">
            <label>Rate (Rs.)</label>
            <input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))}
              min={0} placeholder="0" />
          </div>
          <div className="form-group">
            <label>Salary Basis</label>
            <select value={salaryBasis} onChange={(e) => setSalaryBasis(e.target.value)}>
              <option value="daily">Per Day Basis</option>
              <option value="monthly">Monthly Basis</option>
            </select>
          </div>
          <div className="form-group">
            <label>Position Type</label>
            <select value={positionType} onChange={(e) => setPositionType(e.target.value)}>
              <option value="Erection">Erection</option>
              <option value="Sheeting">Sheeting</option>
              <option value="Both">Both (Erection &amp; Sheeting)</option>
            </select>
          </div>
          <div className="form-group" style={{ justifyContent: 'flex-end', display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <button type="submit" className="btn-primary">
              <i className="ri-add-line" /> {editingId !== null ? 'Update Sub ID' : 'Create Sub ID'}
            </button>
            {editingId !== null && (
              <button type="button" className="btn-secondary" onClick={cancelEdit}>Cancel</button>
            )}
          </div>
        </form>
      </div>

      {loading && <p className="loading-text">Loading sub IDs...</p>}

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Employee</th>
              <th>Sub ID</th>
              <th>Site</th>
              <th>Rate (Rs.)</th>
              <th>Salary Basis</th>
              <th>Position Type</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subIds.length === 0 ? (
              <tr><td colSpan={9} className="empty-state">No sub IDs created yet. Select an employee to view or create sub IDs.</td></tr>
            ) : subIds.map((sub, i) => (
              <tr key={sub.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{sub.employee}</td>
                <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{sub.subIdName}</td>
                <td>{sub.siteName}</td>
                <td style={{ fontWeight: 700 }}>{formatNumber(sub.rate)}</td>
                <td><span className="badge">{sub.salaryBasis}</span></td>
                <td>
                  <span className={positionBadgeClass(sub.positionType)}>
                    {sub.positionType || 'N/A'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${sub.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                    {sub.status}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button className="btn-secondary btn-sm" onClick={() => editSubId(sub)} style={{ marginRight: '0.25rem' }}>
                    <i className="ri-edit-line" />
                  </button>
                  <button className="btn-danger btn-sm" onClick={() => deleteSubId(sub.id)}>
                    <i className="ri-delete-bin-line" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
