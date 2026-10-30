'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';

interface AttendanceRecord {
  id?: number;
  employee_id?: string;
  employee_name?: string;
  sub_id?: string;
  month?: string;
  site_id?: string;
  present_days?: number;
  ot_hours?: number;
  salary_basis?: string;
  base_daily_wage?: number;
  present_wage?: number;
  ot_rate?: number;
  ot_amount?: number;
  total_amount?: number;
}

const emptyForm = {
  employee_id: '',
  sub_id: '',
  month: '',
  present_days: 0,
  ot_hours: 0,
  salary_basis: 'daily',
  base_daily_wage: 0,
};

function computeWages(form: typeof emptyForm) {
  const presentWage = form.base_daily_wage * form.present_days;
  let otRate = 0;
  let otAmount = 0;
  if (form.salary_basis === 'daily' && form.ot_hours > 0) {
    otRate = form.base_daily_wage / 8;
    otAmount = otRate * form.ot_hours;
  }
  const totalAmount = presentWage + otAmount;
  return { presentWage, otRate, otAmount, totalAmount };
}

function formatCurrency(val: number): string {
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AttendancePage() {
  const { apiGet, apiPost, apiPut, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { isAdmin } = useRole();
  const { confirm } = useConfirmDialog();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [siteFilter, setSiteFilter] = useState<string | null>(null);

  // Dropdown items
  const [siteItems, setSiteItems] = useState<DropdownItem[]>([]);
  const [employeeItems, setEmployeeItems] = useState<DropdownItem[]>([]);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const computed = useMemo(() => computeWages(form), [form]);

  const loadDropdowns = useCallback(async () => {
    try {
      const [sites, emps] = await Promise.all([
        apiGet<any[]>('/api/sites'),
        apiGet<any[]>('/api/employees'),
      ]);
      setSiteItems(sites.map((s: any) => ({ value: String(s.id), label: s.name })));
      setEmployeeItems(emps.map((e: any) => ({ value: String(e.id), label: `${e.display_id || e.id} - ${e.name}` })));
    } catch (err: any) {
      notifyError(err.message || 'Failed to load dropdown data');
    }
  }, [apiGet, notifyError]);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/attendance';
      const params = new URLSearchParams();
      if (monthFilter) params.set('month', monthFilter);
      if (siteFilter) params.set('site_id', siteFilter);
      const qs = params.toString();
      if (qs) url += `?${qs}`;
      const data = await apiGet<AttendanceRecord[]>(url);
      setRecords(data);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [apiGet, monthFilter, siteFilter, notifyError]);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const columns: TableColumn[] = [
    { key: 'employee_name', label: 'Employee', sortable: true },
    { key: 'sub_id', label: 'Sub ID', sortable: true },
    { key: 'month', label: 'Month', sortable: true },
    { key: 'present_days', label: 'Present Days', sortable: true },
    { key: 'ot_hours', label: 'OT Hours', sortable: true },
    { key: 'salary_basis', label: 'Basis', sortable: true },
    { key: 'base_daily_wage', label: 'Daily Wage', type: 'currency', sortable: true },
    { key: 'present_wage', label: 'Present Wage', type: 'currency', sortable: true },
    { key: 'ot_amount', label: 'OT Amount', type: 'currency', sortable: true },
    { key: 'total_amount', label: 'Total', type: 'currency', sortable: true },
  ];

  const tableActions: TableAction[] = [
    { label: '', icon: 'ri-pencil-line', action: 'edit', class: 'btn-primary btn-sm' },
    { label: '', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger btn-sm' },
  ];

  const handleAction = useCallback(async (event: { action: string; row: any }) => {
    const rec = event.row as AttendanceRecord;
    if (event.action === 'edit') {
      setModalMode('edit');
      setEditingId(rec.id || null);
      setForm({
        employee_id: rec.employee_id || '',
        sub_id: rec.sub_id || '',
        month: rec.month || monthFilter,
        present_days: rec.present_days || 0,
        ot_hours: rec.ot_hours || 0,
        salary_basis: rec.salary_basis || 'daily',
        base_daily_wage: rec.base_daily_wage || 0,
      });
      setModalOpen(true);
    } else if (event.action === 'delete') {
      const ok = await confirm({
        title: 'Delete Attendance Record',
        message: `Delete attendance record for "${rec.employee_name}"?`,
        type: 'danger',
        confirmText: 'Delete',
      });
      if (!ok) return;
      try {
        await apiDelete(`/api/attendance/${rec.id}`);
        setRecords(prev => prev.filter(r => r.id !== rec.id));
        success('Attendance record deleted');
      } catch (err: any) {
        notifyError(err.message || 'Failed to delete');
      }
    }
  }, [apiDelete, confirm, success, notifyError, monthFilter]);

  const openAddModal = () => {
    setModalMode('add');
    setEditingId(null);
    setForm({ ...emptyForm, month: monthFilter });
    setModalOpen(true);
  };

  const updateForm = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.employee_id) {
      notifyError('Please select an employee');
      return;
    }
    setSaving(true);
    const wages = computeWages(form);
    const body = {
      ...form,
      present_wage: wages.presentWage,
      ot_rate: wages.otRate,
      ot_amount: wages.otAmount,
      total_amount: wages.totalAmount,
    };
    try {
      if (modalMode === 'edit' && editingId) {
        await apiPut(`/api/attendance/${editingId}`, body);
        success('Attendance record updated');
      } else {
        await apiPost('/api/attendance', body);
        success('Attendance record added');
      }
      setModalOpen(false);
      setForm({ ...emptyForm });
      loadAttendance();
    } catch (err: any) {
      notifyError(err.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const modalFooter = (
    <>
      <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
      <button className="btn-primary" onClick={handleSave} disabled={saving || !form.employee_id}>
        {saving ? 'Saving...' : modalMode === 'edit' ? 'Update' : 'Add Record'}
      </button>
    </>
  );

  return (
    <div className="page-container">
      <PageHeader title="Attendance Management" icon="ri-calendar-check-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line"></i> Add Attendance
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <label>Month</label>
            <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={siteFilter}
              onChange={setSiteFilter}
              placeholder="All Sites"
              label="Filter by Site"
            />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable
          columns={columns}
          data={records}
          actions={tableActions}
          onActionClick={handleAction}
          loading={loading}
          fileName="Attendance"
          showFooterTotals
          emptyMessage="No attendance records found."
        />
      </div>

      {/* Add/Edit Modal */}
      <ModalDialog
        isOpen={modalOpen}
        title={modalMode === 'edit' ? 'Edit Attendance' : 'Add Attendance'}
        size="lg"
        onClose={() => setModalOpen(false)}
        footer={modalFooter}
      >
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown
              items={employeeItems}
              value={form.employee_id || null}
              onChange={(val: any) => updateForm('employee_id', val || '')}
              placeholder="Select Employee..."
              label="Employee"
              required
            />
          </div>
          <div className="form-group">
            <label>Sub ID</label>
            <input type="text" value={form.sub_id} onChange={e => updateForm('sub_id', e.target.value)} placeholder="Sub ID" />
          </div>
          <div className="form-group">
            <label>Month <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="month" value={form.month} onChange={e => updateForm('month', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Present Days</label>
            <input type="number" value={form.present_days} onChange={e => updateForm('present_days', Number(e.target.value))} min={0} max={31} />
          </div>
          <div className="form-group">
            <label>OT Hours</label>
            <input type="number" value={form.ot_hours} onChange={e => updateForm('ot_hours', Number(e.target.value))} min={0} step={0.5} />
          </div>
          <div className="form-group">
            <label>Salary Basis</label>
            <select value={form.salary_basis} onChange={e => updateForm('salary_basis', e.target.value)}>
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="form-group">
            <label>Base Daily Wage</label>
            <input type="number" value={form.base_daily_wage} onChange={e => updateForm('base_daily_wage', Number(e.target.value))} min={0} step={1} />
          </div>
        </div>

        {/* Computed Values */}
        <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>
            <i className="ri-calculator-line"></i> Computed Values
          </h4>
          <div className="form-grid">
            <div className="form-group">
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Present Wage</label>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{formatCurrency(computed.presentWage)}</div>
            </div>
            <div className="form-group">
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>OT Rate/Hr</label>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{formatCurrency(computed.otRate)}</div>
            </div>
            <div className="form-group">
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>OT Amount</label>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{formatCurrency(computed.otAmount)}</div>
            </div>
            <div className="form-group">
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Amount</label>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--success)' }}>{formatCurrency(computed.totalAmount)}</div>
            </div>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
