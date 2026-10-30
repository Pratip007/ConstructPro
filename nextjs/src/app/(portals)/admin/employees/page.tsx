'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';

interface Employee {
  id: string;
  display_id?: string;
  name: string;
  father_name?: string;
  dob?: string;
  religion?: string;
  village?: string;
  post?: string;
  ps?: string;
  district?: string;
  pin?: string;
  phone?: string;
  whatsapp?: string;
  emergency_contact?: string;
  aadhaar?: string;
  uan?: string;
  bank_name?: string;
  account_holder?: string;
  account_number?: string;
  ifsc_code?: string;
  designation?: string;
  category_id?: string;
  category_name?: string;
  working_positions?: string;
  current_site_id?: string;
  site_name?: string;
  photo?: string;
  status?: string;
}

const emptyForm: Omit<Employee, 'id'> = {
  name: '',
  father_name: '',
  dob: '',
  religion: '',
  village: '',
  post: '',
  ps: '',
  district: '',
  pin: '',
  phone: '',
  whatsapp: '',
  emergency_contact: '',
  aadhaar: '',
  uan: '',
  bank_name: '',
  account_holder: '',
  account_number: '',
  ifsc_code: '',
  designation: '',
  category_id: '',
  working_positions: '',
  current_site_id: '',
  photo: '',
  status: 'active',
};

export default function EmployeesPage() {
  const { apiGet, apiPost, apiPut, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { isAdmin } = useRole();
  const { confirm, confirmWithPassword } = useConfirmDialog();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [siteFilter, setSiteFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // Dropdown items
  const [siteItems, setSiteItems] = useState<DropdownItem[]>([]);
  const [categoryItems, setCategoryItems] = useState<DropdownItem[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);

  // Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, sites, cats] = await Promise.all([
        apiGet<Employee[]>('/api/employees'),
        apiGet<any[]>('/api/sites'),
        apiGet<any[]>('/api/employee-categories'),
      ]);
      setEmployees(emps);
      setSiteItems(sites.map((s: any) => ({ value: String(s.id), label: s.name })));
      setCategoryItems(cats.map((c: any) => ({ value: String(c.id), label: c.name })));
    } catch (err: any) {
      notifyError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEmployees = useMemo(() => {
    let result = employees;
    if (siteFilter) {
      result = result.filter(e => String(e.current_site_id) === siteFilter);
    }
    if (categoryFilter) {
      result = result.filter(e => String(e.category_id) === categoryFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter(e => e.status === statusFilter);
    }
    return result;
  }, [employees, siteFilter, categoryFilter, statusFilter]);

  const columns: TableColumn[] = [
    { key: 'photo', label: 'Photo', type: 'image', sortable: false },
    { key: 'display_id', label: 'Display ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'phone', label: 'Phone', sortable: false },
    { key: 'designation', label: 'Designation', sortable: true },
    { key: 'site_name', label: 'Site', sortable: true },
    { key: 'category_name', label: 'Category', sortable: true },
    { key: 'status', label: 'Status', type: 'badge', sortable: true, badgeMap: { active: 'success', inactive: 'danger' } },
  ];

  const actions: TableAction[] = [
    { label: '', icon: 'ri-eye-line', action: 'view', class: 'btn-secondary btn-sm' },
    { label: '', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary btn-sm' },
    { label: '', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger btn-sm' },
  ];

  const handleAction = useCallback(async (event: { action: string; row: any }) => {
    const emp = event.row as Employee;
    if (event.action === 'view') {
      setViewEmployee(emp);
      setViewModalOpen(true);
    } else if (event.action === 'edit') {
      setModalMode('edit');
      setEditingId(emp.id);
      setForm({
        name: emp.name || '',
        father_name: emp.father_name || '',
        dob: emp.dob || '',
        religion: emp.religion || '',
        village: emp.village || '',
        post: emp.post || '',
        ps: emp.ps || '',
        district: emp.district || '',
        pin: emp.pin || '',
        phone: emp.phone || '',
        whatsapp: emp.whatsapp || '',
        emergency_contact: emp.emergency_contact || '',
        aadhaar: emp.aadhaar || '',
        uan: emp.uan || '',
        bank_name: emp.bank_name || '',
        account_holder: emp.account_holder || '',
        account_number: emp.account_number || '',
        ifsc_code: emp.ifsc_code || '',
        designation: emp.designation || '',
        category_id: emp.category_id || '',
        working_positions: emp.working_positions || '',
        current_site_id: emp.current_site_id || '',
        photo: emp.photo || '',
        status: emp.status || 'active',
      });
      setModalOpen(true);
    } else if (event.action === 'delete') {
      const result = await confirmWithPassword({
        title: 'Delete Employee',
        message: `Are you sure you want to delete "${emp.name}"? This action cannot be undone.`,
        type: 'danger',
        confirmText: 'Delete',
        passwordRequired: true,
        passwordLabel: 'Admin Password',
      });
      if (!result.confirmed) return;
      try {
        await apiDelete(`/api/employees/${emp.id}`, { password: result.password });
        setEmployees(prev => prev.filter(e => e.id !== emp.id));
        success('Employee deleted successfully');
      } catch (err: any) {
        notifyError(err.message || 'Failed to delete employee');
      }
    }
  }, [apiDelete, confirmWithPassword, success, notifyError]);

  const openAddModal = () => {
    setModalMode('add');
    setEditingId(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const updateForm = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      notifyError('Employee name is required');
      return;
    }
    setSaving(true);
    try {
      if (modalMode === 'edit' && editingId) {
        const updated = await apiPut<Employee>(`/api/employees/${editingId}`, form);
        setEmployees(prev => prev.map(e => e.id === editingId ? { ...e, ...updated } : e));
        success('Employee updated successfully');
      } else {
        const created = await apiPost<Employee>('/api/employees', form);
        setEmployees(prev => [created, ...prev]);
        success('Employee added successfully');
      }
      setModalOpen(false);
      setForm({ ...emptyForm });
    } catch (err: any) {
      notifyError(err.message || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('atr_access_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/employees/import', {
        method: 'POST',
        headers,
        body: formData,
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Import failed');
      success(`Imported ${result.data?.count || 0} employees`);
      loadData();
    } catch (err: any) {
      notifyError(err.message || 'Import failed');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const modalFooter = (
    <>
      <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
      <button className="btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
        {saving ? 'Saving...' : modalMode === 'edit' ? 'Update Employee' : 'Add Employee'}
      </button>
    </>
  );

  return (
    <div className="page-container">
      <PageHeader title="Employees" icon="ri-team-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line"></i> Add Employee
        </button>
        <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
          <i className="ri-upload-2-line"></i> Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </PageHeader>

      {/* Filters */}
      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={siteFilter}
              onChange={setSiteFilter}
              placeholder="All Sites"
              label="Filter by Site"
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={categoryItems}
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder="All Categories"
              label="Filter by Category"
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable
          columns={columns}
          data={filteredEmployees}
          actions={actions}
          onActionClick={handleAction}
          loading={loading}
          fileName="Employees"
          emptyMessage="No employees found."
        />
      </div>

      {/* Add/Edit Modal */}
      <ModalDialog
        isOpen={modalOpen}
        title={modalMode === 'edit' ? 'Edit Employee' : 'Add Employee'}
        size="xl"
        onClose={() => setModalOpen(false)}
        footer={modalFooter}
      >
        <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '0 4px' }}>
          {/* Personal Info */}
          <h4 style={{ marginBottom: 12, color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}>
            <i className="ri-user-line"></i> Personal Information
          </h4>
          <div className="form-grid">
            <div className="form-group">
              <label>Name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="Full Name" required />
            </div>
            <div className="form-group">
              <label>Father&apos;s Name</label>
              <input type="text" value={form.father_name} onChange={e => updateForm('father_name', e.target.value)} placeholder="Father's Name" />
            </div>
            <div className="form-group">
              <label>Date of Birth</label>
              <input type="date" value={form.dob} onChange={e => updateForm('dob', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Religion</label>
              <input type="text" value={form.religion} onChange={e => updateForm('religion', e.target.value)} placeholder="Religion" />
            </div>
            <div className="form-group">
              <label>Village</label>
              <input type="text" value={form.village} onChange={e => updateForm('village', e.target.value)} placeholder="Village" />
            </div>
            <div className="form-group">
              <label>Post</label>
              <input type="text" value={form.post} onChange={e => updateForm('post', e.target.value)} placeholder="Post Office" />
            </div>
            <div className="form-group">
              <label>P.S.</label>
              <input type="text" value={form.ps} onChange={e => updateForm('ps', e.target.value)} placeholder="Police Station" />
            </div>
            <div className="form-group">
              <label>District</label>
              <input type="text" value={form.district} onChange={e => updateForm('district', e.target.value)} placeholder="District" />
            </div>
            <div className="form-group">
              <label>PIN</label>
              <input type="text" value={form.pin} onChange={e => updateForm('pin', e.target.value)} placeholder="PIN Code" maxLength={6} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input type="tel" value={form.phone} onChange={e => updateForm('phone', e.target.value)} placeholder="Phone Number" maxLength={10} />
            </div>
            <div className="form-group">
              <label>WhatsApp</label>
              <input type="tel" value={form.whatsapp} onChange={e => updateForm('whatsapp', e.target.value)} placeholder="WhatsApp Number" maxLength={10} />
            </div>
            <div className="form-group">
              <label>Emergency Contact</label>
              <input type="tel" value={form.emergency_contact} onChange={e => updateForm('emergency_contact', e.target.value)} placeholder="Emergency Contact" maxLength={10} />
            </div>
          </div>

          {/* ID Section */}
          <h4 style={{ marginTop: 20, marginBottom: 12, color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}>
            <i className="ri-bank-card-line"></i> Identity Documents
          </h4>
          <div className="form-grid">
            <div className="form-group">
              <label>Aadhaar Number</label>
              <input type="password" value={form.aadhaar} onChange={e => updateForm('aadhaar', e.target.value)} placeholder="Aadhaar Number" maxLength={12} autoComplete="off" />
            </div>
            <div className="form-group">
              <label>UAN</label>
              <input type="text" value={form.uan} onChange={e => updateForm('uan', e.target.value)} placeholder="Universal Account Number" />
            </div>
          </div>

          {/* Bank Section */}
          <h4 style={{ marginTop: 20, marginBottom: 12, color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}>
            <i className="ri-bank-line"></i> Bank Details
          </h4>
          <div className="form-grid">
            <div className="form-group">
              <label>Bank Name</label>
              <input type="text" value={form.bank_name} onChange={e => updateForm('bank_name', e.target.value)} placeholder="Bank Name" />
            </div>
            <div className="form-group">
              <label>Account Holder</label>
              <input type="text" value={form.account_holder} onChange={e => updateForm('account_holder', e.target.value)} placeholder="Account Holder Name" />
            </div>
            <div className="form-group">
              <label>Account Number</label>
              <input type="text" value={form.account_number} onChange={e => updateForm('account_number', e.target.value)} placeholder="Account Number" />
            </div>
            <div className="form-group">
              <label>IFSC Code</label>
              <input type="text" value={form.ifsc_code} onChange={e => updateForm('ifsc_code', e.target.value)} placeholder="IFSC Code" style={{ textTransform: 'uppercase' }} />
            </div>
          </div>

          {/* Work Section */}
          <h4 style={{ marginTop: 20, marginBottom: 12, color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}>
            <i className="ri-briefcase-line"></i> Work Details
          </h4>
          <div className="form-grid">
            <div className="form-group">
              <label>Designation</label>
              <input type="text" value={form.designation} onChange={e => updateForm('designation', e.target.value)} placeholder="Designation" />
            </div>
            <div className="form-group">
              <SearchableDropdown
                items={categoryItems}
                value={form.category_id || null}
                onChange={(val: any) => updateForm('category_id', val || '')}
                placeholder="Select Category"
                label="Category"
              />
            </div>
            <div className="form-group">
              <label>Working Positions</label>
              <input type="text" value={form.working_positions} onChange={e => updateForm('working_positions', e.target.value)} placeholder="Working Positions" />
            </div>
            <div className="form-group">
              <SearchableDropdown
                items={siteItems}
                value={form.current_site_id || null}
                onChange={(val: any) => updateForm('current_site_id', val || '')}
                placeholder="Select Site"
                label="Current Site"
              />
            </div>
          </div>

          {/* Photo Upload */}
          <h4 style={{ marginTop: 20, marginBottom: 12, color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}>
            <i className="ri-camera-line"></i> Photo
          </h4>
          <div className="form-grid">
            <div className="form-group">
              <label>Photo URL</label>
              <input type="text" value={form.photo} onChange={e => updateForm('photo', e.target.value)} placeholder="Photo URL or upload path" />
            </div>
            {form.photo && (
              <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
                <img src={form.photo} alt="Preview" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} />
              </div>
            )}
          </div>
        </div>
      </ModalDialog>

      {/* View Modal */}
      <ModalDialog
        isOpen={viewModalOpen}
        title="Employee Details"
        size="lg"
        onClose={() => { setViewModalOpen(false); setViewEmployee(null); }}
        footer={
          <button className="btn-secondary" onClick={() => { setViewModalOpen(false); setViewEmployee(null); }}>Close</button>
        }
      >
        {viewEmployee && (
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              {viewEmployee.photo ? (
                <img src={viewEmployee.photo} alt={viewEmployee.name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'var(--text-muted)' }}>
                  <i className="ri-user-line"></i>
                </div>
              )}
              <h3 style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>{viewEmployee.name}</h3>
              <span className={`badge ${viewEmployee.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                {viewEmployee.status}
              </span>
            </div>
            <div className="form-grid">
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Display ID</label><div style={{ fontWeight: 600 }}>{viewEmployee.display_id || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Father&apos;s Name</label><div>{viewEmployee.father_name || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Date of Birth</label><div>{viewEmployee.dob || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Religion</label><div>{viewEmployee.religion || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Village</label><div>{viewEmployee.village || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Post</label><div>{viewEmployee.post || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>P.S.</label><div>{viewEmployee.ps || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>District</label><div>{viewEmployee.district || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>PIN</label><div>{viewEmployee.pin || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Phone</label><div>{viewEmployee.phone || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>WhatsApp</label><div>{viewEmployee.whatsapp || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Emergency Contact</label><div>{viewEmployee.emergency_contact || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Aadhaar</label><div>{viewEmployee.aadhaar ? '****' + viewEmployee.aadhaar.slice(-4) : '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>UAN</label><div>{viewEmployee.uan || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bank Name</label><div>{viewEmployee.bank_name || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Account Holder</label><div>{viewEmployee.account_holder || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Account Number</label><div>{viewEmployee.account_number || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>IFSC Code</label><div>{viewEmployee.ifsc_code || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Designation</label><div>{viewEmployee.designation || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Category</label><div>{viewEmployee.category_name || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Working Positions</label><div>{viewEmployee.working_positions || '--'}</div></div>
              <div className="form-group"><label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Current Site</label><div>{viewEmployee.site_name || '--'}</div></div>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
