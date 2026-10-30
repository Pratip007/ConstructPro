'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
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
  name: '', father_name: '', dob: '', religion: '', village: '', post: '', ps: '', district: '', pin: '',
  phone: '', whatsapp: '', emergency_contact: '', aadhaar: '', uan: '',
  bank_name: '', account_holder: '', account_number: '', ifsc_code: '',
  designation: '', category_id: '', working_positions: '', current_site_id: '', photo: '', status: 'active',
};

export default function OfficeEmployeesPage() {
  const { apiGet, apiPost } = useApi();
  const { success, error: notifyError } = useNotification();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [siteFilter, setSiteFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [siteItems, setSiteItems] = useState<DropdownItem[]>([]);
  const [categoryItems, setCategoryItems] = useState<DropdownItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);

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

  useEffect(() => { loadData(); }, [loadData]);

  const filteredEmployees = useMemo(() => {
    let result = employees;
    if (siteFilter) result = result.filter(e => String(e.current_site_id) === siteFilter);
    if (categoryFilter) result = result.filter(e => String(e.category_id) === categoryFilter);
    if (statusFilter !== 'all') result = result.filter(e => e.status === statusFilter);
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

  const tableActions: TableAction[] = [
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
      setEditingEmployee(emp);
      setForm({
        name: emp.name || '', father_name: emp.father_name || '', dob: emp.dob || '', religion: emp.religion || '',
        village: emp.village || '', post: emp.post || '', ps: emp.ps || '', district: emp.district || '', pin: emp.pin || '',
        phone: emp.phone || '', whatsapp: emp.whatsapp || '', emergency_contact: emp.emergency_contact || '',
        aadhaar: emp.aadhaar || '', uan: emp.uan || '', bank_name: emp.bank_name || '',
        account_holder: emp.account_holder || '', account_number: emp.account_number || '', ifsc_code: emp.ifsc_code || '',
        designation: emp.designation || '', category_id: emp.category_id || '', working_positions: emp.working_positions || '',
        current_site_id: emp.current_site_id || '', photo: emp.photo || '', status: emp.status || 'active',
      });
      setModalOpen(true);
    } else if (event.action === 'delete') {
      if (!confirm(`Submit delete request for "${emp.name}"?`)) return;
      try {
        await apiPost('/api/approvals', {
          source: 'office', module: 'employee', action_type: 'delete',
          entity_id: emp.id, new_data: null, old_data: { name: emp.name, phone: emp.phone },
          remarks: `Delete employee: ${emp.name}`,
        });
        success('Delete request submitted for admin approval');
      } catch (err: any) {
        notifyError(err.message || 'Failed to submit delete request');
      }
    }
  }, [apiPost, success, notifyError]);

  const openAddModal = () => {
    setModalMode('add'); setEditingId(null); setEditingEmployee(null);
    setForm({ ...emptyForm }); setModalOpen(true);
  };

  const updateForm = (field: string, value: any) => { setForm(prev => ({ ...prev, [field]: value })); };

  const handleSave = async () => {
    if (!form.name.trim()) { notifyError('Employee name is required'); return; }
    setSaving(true);
    try {
      await apiPost('/api/approvals', {
        source: 'office', module: 'employee',
        action_type: modalMode === 'edit' ? 'update' : 'create',
        entity_id: editingId || null,
        new_data: form,
        old_data: editingEmployee ? { name: editingEmployee.name, phone: editingEmployee.phone, designation: editingEmployee.designation } : null,
        remarks: modalMode === 'edit' ? `Updated employee: ${form.name}` : `Created new employee: ${form.name}`,
      });
      success('Request submitted for admin approval');
      setModalOpen(false);
      setForm({ ...emptyForm });
    } catch (err: any) {
      notifyError(err.message || 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <PageHeader title="Employees" icon="ri-team-line">
        <button className="btn-primary" onClick={openAddModal}><i className="ri-add-line"></i> Add Employee</button>
      </PageHeader>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown items={siteItems} value={siteFilter} onChange={setSiteFilter} placeholder="All Sites" label="Filter by Site" />
          </div>
          <div className="form-group">
            <SearchableDropdown items={categoryItems} value={categoryFilter} onChange={setCategoryFilter} placeholder="All Categories" label="Filter by Category" />
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

      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable columns={columns} data={filteredEmployees} actions={tableActions} onActionClick={handleAction} loading={loading} fileName="Employees" emptyMessage="No employees found." />
      </div>

      <ModalDialog isOpen={modalOpen} title={modalMode === 'edit' ? 'Edit Employee' : 'Add Employee'} size="xl" onClose={() => setModalOpen(false)}
        footer={<>
          <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </>}>
        <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '0 4px' }}>
          <h4 style={{ marginBottom: 12, color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}><i className="ri-user-line"></i> Personal Information</h4>
          <div className="form-grid">
            <div className="form-group"><label>Name <span style={{ color: 'var(--danger)' }}>*</span></label><input type="text" value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="Full Name" required /></div>
            <div className="form-group"><label>Father&apos;s Name</label><input type="text" value={form.father_name} onChange={e => updateForm('father_name', e.target.value)} placeholder="Father's Name" /></div>
            <div className="form-group"><label>Date of Birth</label><input type="date" value={form.dob} onChange={e => updateForm('dob', e.target.value)} /></div>
            <div className="form-group"><label>Religion</label><input type="text" value={form.religion} onChange={e => updateForm('religion', e.target.value)} placeholder="Religion" /></div>
            <div className="form-group"><label>Village</label><input type="text" value={form.village} onChange={e => updateForm('village', e.target.value)} placeholder="Village" /></div>
            <div className="form-group"><label>Post</label><input type="text" value={form.post} onChange={e => updateForm('post', e.target.value)} placeholder="Post Office" /></div>
            <div className="form-group"><label>P.S.</label><input type="text" value={form.ps} onChange={e => updateForm('ps', e.target.value)} placeholder="Police Station" /></div>
            <div className="form-group"><label>District</label><input type="text" value={form.district} onChange={e => updateForm('district', e.target.value)} placeholder="District" /></div>
            <div className="form-group"><label>PIN</label><input type="text" value={form.pin} onChange={e => updateForm('pin', e.target.value)} placeholder="PIN Code" maxLength={6} /></div>
            <div className="form-group"><label>Phone</label><input type="tel" value={form.phone} onChange={e => updateForm('phone', e.target.value)} placeholder="Phone" maxLength={10} /></div>
            <div className="form-group"><label>WhatsApp</label><input type="tel" value={form.whatsapp} onChange={e => updateForm('whatsapp', e.target.value)} placeholder="WhatsApp" maxLength={10} /></div>
            <div className="form-group"><label>Emergency Contact</label><input type="tel" value={form.emergency_contact} onChange={e => updateForm('emergency_contact', e.target.value)} placeholder="Emergency" maxLength={10} /></div>
          </div>
          <h4 style={{ marginTop: 20, marginBottom: 12, color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}><i className="ri-bank-card-line"></i> Identity Documents</h4>
          <div className="form-grid">
            <div className="form-group"><label>Aadhaar</label><input type="password" value={form.aadhaar} onChange={e => updateForm('aadhaar', e.target.value)} placeholder="Aadhaar Number" maxLength={12} autoComplete="off" /></div>
            <div className="form-group"><label>UAN</label><input type="text" value={form.uan} onChange={e => updateForm('uan', e.target.value)} placeholder="UAN" /></div>
          </div>
          <h4 style={{ marginTop: 20, marginBottom: 12, color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}><i className="ri-bank-line"></i> Bank Details</h4>
          <div className="form-grid">
            <div className="form-group"><label>Bank Name</label><input type="text" value={form.bank_name} onChange={e => updateForm('bank_name', e.target.value)} placeholder="Bank Name" /></div>
            <div className="form-group"><label>Account Holder</label><input type="text" value={form.account_holder} onChange={e => updateForm('account_holder', e.target.value)} placeholder="Holder Name" /></div>
            <div className="form-group"><label>Account Number</label><input type="text" value={form.account_number} onChange={e => updateForm('account_number', e.target.value)} placeholder="Account Number" /></div>
            <div className="form-group"><label>IFSC Code</label><input type="text" value={form.ifsc_code} onChange={e => updateForm('ifsc_code', e.target.value)} placeholder="IFSC" style={{ textTransform: 'uppercase' }} /></div>
          </div>
          <h4 style={{ marginTop: 20, marginBottom: 12, color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}><i className="ri-briefcase-line"></i> Work Details</h4>
          <div className="form-grid">
            <div className="form-group"><label>Designation</label><input type="text" value={form.designation} onChange={e => updateForm('designation', e.target.value)} placeholder="Designation" /></div>
            <div className="form-group"><SearchableDropdown items={categoryItems} value={form.category_id || null} onChange={(val: any) => updateForm('category_id', val || '')} placeholder="Select Category" label="Category" /></div>
            <div className="form-group"><label>Working Positions</label><input type="text" value={form.working_positions} onChange={e => updateForm('working_positions', e.target.value)} placeholder="Positions" /></div>
            <div className="form-group"><SearchableDropdown items={siteItems} value={form.current_site_id || null} onChange={(val: any) => updateForm('current_site_id', val || '')} placeholder="Select Site" label="Current Site" /></div>
          </div>
        </div>
      </ModalDialog>

      <ModalDialog isOpen={viewModalOpen} title="Employee Details" size="lg" onClose={() => { setViewModalOpen(false); setViewEmployee(null); }}
        footer={<button className="btn-secondary" onClick={() => { setViewModalOpen(false); setViewEmployee(null); }}>Close</button>}>
        {viewEmployee && (
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              {viewEmployee.photo ? (
                <img src={viewEmployee.photo} alt={viewEmployee.name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'var(--text-muted)' }}><i className="ri-user-line"></i></div>
              )}
              <h3 style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>{viewEmployee.name}</h3>
              <span className={`badge ${viewEmployee.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{viewEmployee.status}</span>
            </div>
            <div className="form-grid">
              {[
                ['Display ID', viewEmployee.display_id], ['Father\'s Name', viewEmployee.father_name],
                ['DOB', viewEmployee.dob], ['Phone', viewEmployee.phone], ['Designation', viewEmployee.designation],
                ['Category', viewEmployee.category_name], ['Site', viewEmployee.site_name],
              ].map(([label, value]) => (
                <div key={label as string} className="form-group">
                  <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</label>
                  <div style={{ fontWeight: 600 }}>{(value as string) || '--'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
