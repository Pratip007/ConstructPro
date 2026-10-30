'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useAuth } from '@/contexts/AuthContext';
import { isSiteLocked, getSupervisorSiteId } from '@/lib/role-utils';
import { exportToExcel, exportToCSV, exportToPDF } from '@/lib/export-utils';
import SummaryCards, { SummaryCard } from '@/components/SummaryCards';
import ModalDialog from '@/components/ModalDialog';
import styles from './RegisteredEmployeesPage.module.scss';

interface ApiEmployee {
  id: string;
  display_id?: string;
  name: string;
  designation?: string;
  working_positions?: string;
  position_type?: string;
  aadhaar?: string;
  phone?: string;
  address?: string;
  current_site_id?: string;
  site_name?: string;
  created_at?: string;
  status?: string;
  category_id?: string;
  category_name?: string;
  photo_url?: string;
  employee_categories?: { name?: string };
  father_name?: string;
  dob?: string;
  bank_name?: string;
  account_no?: string;
  ifsc?: string;
}

interface Employee {
  id: string;
  displayId: string;
  name: string;
  position: string;
  positionType: string;
  aadhaar: string;
  contact: string;
  address: string;
  site: string;
  siteId: string;
  joinDate: string;
  status: string;
  categoryId: string;
  categoryName: string;
  photoUrl: string;
  fatherName: string;
  dob: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
}

function mapEmployee(e: ApiEmployee): Employee {
  return {
    id: e.id,
    displayId: e.display_id ?? e.id,
    name: e.name,
    position: e.designation ?? '',
    positionType: e.position_type ?? e.working_positions ?? '',
    aadhaar: e.aadhaar ?? '',
    contact: e.phone ?? '',
    address: e.address ?? '',
    site: e.site_name ?? e.current_site_id ?? '',
    siteId: e.current_site_id ?? '',
    joinDate: e.created_at ? e.created_at.split('T')[0] : '',
    status: e.status ?? 'Active',
    categoryId: e.category_id ?? '',
    categoryName: e.employee_categories?.name ?? e.category_name ?? '',
    photoUrl: e.photo_url ?? '',
    fatherName: e.father_name ?? '',
    dob: e.dob ?? '',
    bankName: e.bank_name ?? '',
    accountNo: e.account_no ?? '',
    ifsc: e.ifsc ?? '',
  };
}

export default function RegisteredEmployeesPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const { currentUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [siteFilterValue, setSiteFilterValue] = useState('');
  const [activeTab, setActiveTab] = useState<'Active' | 'Inactive'>('Active');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const uniqueCategories = useMemo(() => {
    const cats = [...new Set(employees.map((e) => e.categoryName).filter(Boolean))];
    return cats.sort();
  }, [employees]);

  const uniqueSites = useMemo(() => {
    const sites = [...new Set(employees.map((e) => e.site).filter(Boolean))];
    return sites.sort();
  }, [employees]);

  const activeCount = useMemo(() => employees.filter((e) => e.status === 'Active').length, [employees]);
  const inactiveCount = useMemo(() => employees.filter((e) => e.status !== 'Active').length, [employees]);

  const filteredEmployees = useMemo(() => {
    let result = employees;
    result = result.filter((e) => (activeTab === 'Active' ? e.status === 'Active' : e.status !== 'Active'));
    const q = searchQuery.toLowerCase();
    if (q) {
      result = result.filter(
        (e) =>
          e.displayId.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q) ||
          e.contact.toLowerCase().includes(q) ||
          e.position.toLowerCase().includes(q) ||
          e.site.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) result = result.filter((e) => e.categoryName === categoryFilter);
    if (siteFilterValue) result = result.filter((e) => e.site === siteFilterValue);
    if (isSiteLocked(currentUser)) {
      const lockedSite = getSupervisorSiteId(currentUser);
      if (lockedSite) result = result.filter((e) => e.siteId === String(lockedSite));
    }
    return result;
  }, [employees, activeTab, searchQuery, categoryFilter, siteFilterValue, currentUser]);

  const employeeCount = filteredEmployees.length;

  const summaryCards = useMemo<SummaryCard[]>(
    () => [
      { title: 'Total Employees', value: employees.length, icon: 'ri-team-line', color: 'primary' },
      { title: 'Active', value: activeCount, icon: 'ri-user-follow-line', color: 'success' },
      { title: 'Inactive', value: inactiveCount, icon: 'ri-user-unfollow-line', color: 'danger' },
      { title: 'Showing', value: employeeCount, icon: 'ri-filter-line', color: 'info' },
    ],
    [employees.length, activeCount, inactiveCount, employeeCount]
  );

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const emps = await apiGet<ApiEmployee[]>('/employees');
      setEmployees(emps.map(mapEmployee));
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to load employees');
    }
    setLoading(false);
  }, [notifyError]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const viewProfile = (emp: Employee) => setViewingEmployee(emp);
  const closeProfile = () => setViewingEmployee(null);

  const editEmployee = (emp: Employee) => setEditingEmployee({ ...emp });

  const saveEmployee = async () => {
    if (!editingEmployee) return;
    try {
      await apiPut(`/employees/${editingEmployee.id}`, {
        name: editingEmployee.name,
        designation: editingEmployee.position,
        phone: editingEmployee.contact,
        address: editingEmployee.address,
      });
      success('Employee updated');
      setEditingEmployee(null);
      loadEmployees();
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to update employee');
    }
  };

  const cancelEdit = () => setEditingEmployee(null);

  const deleteEmployee = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Employee',
      message: 'This will permanently delete the employee record. Continue?',
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await apiDelete(`/employees/${id}`);
      success('Employee deleted');
      loadEmployees();
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to delete employee');
    }
  };

  const toggleStatus = async (emp: Employee) => {
    const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
    const confirmed = await confirm({
      title: `${newStatus === 'Active' ? 'Activate' : 'Deactivate'} Employee`,
      message: `Set ${emp.name} as ${newStatus}?`,
      type: newStatus === 'Active' ? 'info' : 'warning',
    });
    if (!confirmed) return;
    try {
      await apiPut(`/employees/${emp.id}`, { status: newStatus });
      success(`Employee ${newStatus === 'Active' ? 'activated' : 'deactivated'}`);
      loadEmployees();
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to update status');
    }
  };

  const handleExportCSV = () => {
    setShowExportMenu(false);
    exportToCSV(
      [
        { key: 'displayId', header: 'Employee ID' },
        { key: 'name', header: 'Name' },
        { key: 'position', header: 'Position' },
        { key: 'contact', header: 'Contact' },
        { key: 'categoryName', header: 'Category' },
        { key: 'site', header: 'Site' },
        { key: 'joinDate', header: 'Join Date' },
        { key: 'status', header: 'Status' },
      ],
      filteredEmployees as unknown as Record<string, unknown>[],
      'employee-records'
    );
  };

  const handleExportExcel = () => {
    setShowExportMenu(false);
    exportToExcel(
      [
        { key: 'displayId', header: 'Employee ID' },
        { key: 'name', header: 'Name' },
        { key: 'position', header: 'Position' },
        { key: 'positionType', header: 'Position Type' },
        { key: 'categoryName', header: 'Category' },
        { key: 'aadhaar', header: 'Aadhaar' },
        { key: 'contact', header: 'Contact' },
        { key: 'address', header: 'Address' },
        { key: 'site', header: 'Site' },
        { key: 'joinDate', header: 'Join Date' },
        { key: 'status', header: 'Status' },
      ],
      filteredEmployees as unknown as Record<string, unknown>[],
      'Employee_Records'
    );
  };

  const handleExportPDF = () => {
    setShowExportMenu(false);
    exportToPDF({
      title: 'Registered Employee Records',
      companyName: 'ATR Construction Pvt. Ltd.',
      data: filteredEmployees as unknown as Record<string, unknown>[],
      columns: [
        { key: 'displayId', header: 'ID' },
        { key: 'name', header: 'Name' },
        { key: 'position', header: 'Position' },
        { key: 'categoryName', header: 'Category' },
        { key: 'site', header: 'Site' },
        { key: 'status', header: 'Status' },
      ],
      fileName: 'Employee_Records',
    });
  };

  const downloadTemplate = () => {
    exportToExcel(
      [
        { key: 'Name', header: 'Name' },
        { key: 'Designation', header: 'Designation' },
        { key: 'Aadhaar', header: 'Aadhaar' },
        { key: 'Phone', header: 'Phone' },
        { key: 'Address', header: 'Address' },
        { key: 'Category', header: 'Category' },
        { key: 'Father Name', header: 'Father Name' },
        { key: 'DOB', header: 'DOB' },
        { key: 'Bank Name', header: 'Bank Name' },
        { key: 'Account No', header: 'Account No' },
        { key: 'IFSC', header: 'IFSC' },
      ],
      [{}] as Record<string, unknown>[],
      'Employee_Import_Template'
    );
  };

  const onImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await apiPost('/employees/import', formData);
      success('Employees imported successfully');
      loadEmployees();
    } catch (err: any) {
      notifyError(err.message ?? 'Import failed');
    }
    event.target.value = '';
  };

  const updateEditField = (field: keyof Employee, value: string) => {
    if (!editingEmployee) return;
    setEditingEmployee({ ...editingEmployee, [field]: value });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <i className="ri-file-list-3-line" /> Employee Records{' '}
          <span className={styles.recordCount}>({employeeCount})</span>
        </h1>
        <div className={styles.headerActions}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by name, ID, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className={styles.filterSelect}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            className={styles.filterSelect}
            value={siteFilterValue}
            onChange={(e) => setSiteFilterValue(e.target.value)}
          >
            <option value="">All Sites</option>
            {uniqueSites.map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </select>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'Active' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('Active')}
        >
          <i className="ri-user-follow-line" /> Active ({activeCount})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'Inactive' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('Inactive')}
        >
          <i className="ri-user-unfollow-line" /> Inactive ({inactiveCount})
        </button>
        <div className={styles.tabSpacer} />
        <a href="/admin/employee/employee-joining" className="btn-primary">
          <i className="ri-add-line" /> Add Employee
        </a>
        <button className="btn-secondary" onClick={downloadTemplate}>
          <i className="ri-download-line" /> Template
        </button>
        <label className="btn-secondary" style={{ cursor: 'pointer' }}>
          <i className="ri-upload-line" /> Import
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onImportExcel}
            style={{ display: 'none' }}
          />
        </label>
        <div className={styles.exportDropdown}>
          <button className="btn-outline" onClick={() => setShowExportMenu((v) => !v)}>
            <i className="ri-download-line" /> Export
          </button>
          {showExportMenu && (
            <div className={styles.dropdownMenu}>
              <button onClick={handleExportExcel}>
                <i className="ri-file-excel-line" /> Excel
              </button>
              <button onClick={handleExportPDF}>
                <i className="ri-file-pdf-line" /> PDF
              </button>
              <button onClick={handleExportCSV}>
                <i className="ri-file-text-line" /> CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {loading && <p className="loading-text">Loading employees...</p>}

      {editingEmployee && (
        <div className="card-container" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>
            <i className="ri-edit-line" /> Edit Employee
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={editingEmployee.name}
                onChange={(e) => updateEditField('name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Position</label>
              <input
                type="text"
                value={editingEmployee.position}
                onChange={(e) => updateEditField('position', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Contact</label>
              <input
                type="text"
                value={editingEmployee.contact}
                onChange={(e) => updateEditField('contact', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Address</label>
              <input
                type="text"
                value={editingEmployee.address}
                onChange={(e) => updateEditField('address', e.target.value)}
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button className="btn-primary" onClick={saveEmployee}>
              <i className="ri-save-line" /> Save
            </button>
            <button className="btn-secondary" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th style={{ width: '50px' }}></th>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Position</th>
              <th>Type</th>
              <th>Category</th>
              <th>Contact</th>
              <th>Site</th>
              <th>Join Date</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={11} className="empty-state">
                  No employee records found.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    {emp.photoUrl ? (
                      <img src={emp.photoUrl} alt="" className={styles.avatarImg} />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        <i className="ri-user-line" />
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{emp.displayId}</td>
                  <td style={{ fontWeight: 600 }}>{emp.name}</td>
                  <td>{emp.position}</td>
                  <td>
                    {emp.positionType && (
                      <span
                        className={`badge ${
                          emp.positionType === 'Erection'
                            ? 'badge-info'
                            : emp.positionType === 'Sheeting'
                              ? 'badge-warning'
                              : emp.positionType === 'Both'
                                ? 'badge-success'
                                : ''
                        }`}
                      >
                        {emp.positionType}
                      </span>
                    )}
                  </td>
                  <td>{emp.categoryName}</td>
                  <td>{emp.contact}</td>
                  <td>{emp.site}</td>
                  <td>{emp.joinDate}</td>
                  <td>
                    <span className={`badge ${emp.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                      {emp.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button
                      className="btn-outline btn-sm"
                      onClick={() => viewProfile(emp)}
                      title="View Profile"
                      style={{ marginRight: '0.25rem' }}
                    >
                      <i className="ri-eye-line" />
                    </button>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => editEmployee(emp)}
                      title="Edit"
                      style={{ marginRight: '0.25rem' }}
                    >
                      <i className="ri-edit-line" />
                    </button>
                    <button
                      className={`btn-sm ${emp.status === 'Active' ? styles.btnWarning : styles.btnSuccess}`}
                      onClick={() => toggleStatus(emp)}
                      title={emp.status === 'Active' ? 'Deactivate' : 'Activate'}
                      style={{ marginRight: '0.25rem' }}
                    >
                      <i className={emp.status === 'Active' ? 'ri-user-unfollow-line' : 'ri-user-follow-line'} />
                    </button>
                    <button className="btn-danger btn-sm" onClick={() => deleteEmployee(emp.id)} title="Delete">
                      <i className="ri-delete-bin-line" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ModalDialog
        isOpen={!!viewingEmployee}
        onClose={closeProfile}
        title={viewingEmployee ? `Employee Profile - ${viewingEmployee.name}` : ''}
        size="lg"
      >
        {viewingEmployee && (
          <div className={styles.profileModal}>
            <div className={styles.profileHeader}>
              {viewingEmployee.photoUrl ? (
                <img src={viewingEmployee.photoUrl} alt="" className={styles.profileAvatar} />
              ) : (
                <div className={styles.profileAvatarPlaceholder}>
                  <i className="ri-user-3-line" />
                </div>
              )}
              <div>
                <h3>{viewingEmployee.name}</h3>
                <p className={styles.profileHeaderMuted}>
                  {viewingEmployee.displayId} | {viewingEmployee.position}
                </p>
              </div>
            </div>
            <div>
              <div className={styles.detailSection}>
                <h4>
                  <i className="ri-user-line" /> Personal Information
                </h4>
                <div className={styles.detailGrid}>
                  <div>
                    <strong>Father&apos;s Name:</strong> {viewingEmployee.fatherName || 'N/A'}
                  </div>
                  <div>
                    <strong>DOB:</strong> {viewingEmployee.dob || 'N/A'}
                  </div>
                  <div>
                    <strong>Aadhaar:</strong> {viewingEmployee.aadhaar || 'N/A'}
                  </div>
                  <div>
                    <strong>Contact:</strong> {viewingEmployee.contact || 'N/A'}
                  </div>
                  <div>
                    <strong>Address:</strong> {viewingEmployee.address || 'N/A'}
                  </div>
                </div>
              </div>
              <div className={styles.detailSection}>
                <h4>
                  <i className="ri-briefcase-line" /> Employment Details
                </h4>
                <div className={styles.detailGrid}>
                  <div>
                    <strong>Category:</strong> {viewingEmployee.categoryName || 'N/A'}
                  </div>
                  <div>
                    <strong>Position Type:</strong> {viewingEmployee.positionType || 'N/A'}
                  </div>
                  <div>
                    <strong>Current Site:</strong> {viewingEmployee.site || 'N/A'}
                  </div>
                  <div>
                    <strong>Join Date:</strong> {viewingEmployee.joinDate || 'N/A'}
                  </div>
                  <div>
                    <strong>Status:</strong>{' '}
                    <span
                      className={`badge ${viewingEmployee.status === 'Active' ? 'badge-success' : 'badge-danger'}`}
                    >
                      {viewingEmployee.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.detailSection}>
                <h4>
                  <i className="ri-bank-line" /> Bank Details
                </h4>
                <div className={styles.detailGrid}>
                  <div>
                    <strong>Bank:</strong> {viewingEmployee.bankName || 'N/A'}
                  </div>
                  <div>
                    <strong>Account No:</strong> {viewingEmployee.accountNo || 'N/A'}
                  </div>
                  <div>
                    <strong>IFSC:</strong> {viewingEmployee.ifsc || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
