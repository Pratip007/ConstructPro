'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import { useIndianNumber } from '@/hooks/useIndianNumber';
import DataTable, { TableColumn } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';

interface AttendanceRecord {
  id?: number;
  employee_id?: string;
  employee_name?: string;
  sub_id?: string;
  month?: string;
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
  if (form.ot_hours > 0) {
    otRate = form.base_daily_wage / 8;
    otAmount = otRate * form.ot_hours;
  }
  const totalAmount = presentWage + otAmount;
  return { presentWage, otRate, otAmount, totalAmount };
}

export default function SupervisorAttendancePage() {
  const { apiGet, apiPost } = useApi();
  const { success, error: notifyError } = useNotification();
  const { getSiteId } = useRole();
  const { formatCurrency } = useIndianNumber();

  const siteId = getSiteId();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [employeeItems, setEmployeeItems] = useState<DropdownItem[]>([]);

  // Month filter
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const computed = useMemo(() => computeWages(form), [form]);

  const loadEmployees = useCallback(async () => {
    if (!siteId) return;
    try {
      const emps = await apiGet<any[]>(`/api/employees?site_id=${siteId}`);
      setEmployeeItems(
        (emps || []).map((e: any) => ({
          value: String(e.id),
          label: `${e.display_id || e.id} - ${e.name}`,
        }))
      );
    } catch (err: any) {
      notifyError(err.message || 'Failed to load employees');
    }
  }, [apiGet, siteId, notifyError]);

  const loadAttendance = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('site_id', siteId);
      if (monthFilter) params.set('month', monthFilter);
      const data = await apiGet<AttendanceRecord[]>(`/api/attendance?${params.toString()}`);
      setRecords(data || []);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [apiGet, siteId, monthFilter, notifyError]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const columns: TableColumn[] = [
    { key: 'employee_name', label: 'Employee', sortable: true },
    { key: 'sub_id', label: 'Sub ID', sortable: true },
    { key: 'present_days', label: 'Present Days', sortable: true },
    { key: 'ot_hours', label: 'OT Hours', sortable: true },
    { key: 'base_daily_wage', label: 'Base Rate', type: 'currency', sortable: true },
    { key: 'present_wage', label: 'Present Wage', type: 'currency', sortable: true },
    { key: 'ot_amount', label: 'OT Amount', type: 'currency', sortable: true },
    { key: 'total_amount', label: 'Total', type: 'currency', sortable: true },
  ];

  const openAddModal = () => {
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
    if (!form.month) {
      notifyError('Please select a month');
      return;
    }

    setSaving(true);
    const wages = computeWages(form);
    const formData = {
      ...form,
      site_id: siteId,
      present_wage: wages.presentWage,
      ot_rate: wages.otRate,
      ot_amount: wages.otAmount,
      total_amount: wages.totalAmount,
    };

    try {
      await apiPost('/api/approvals', {
        source: 'supervisor',
        module: 'attendance',
        action_type: 'create',
        entity_id: null,
        new_data: formData,
        remarks: `Attendance for ${form.month}`,
      });
      success('Attendance request submitted for approval');
      setModalOpen(false);
      setForm({ ...emptyForm });
      loadAttendance();
    } catch (err: any) {
      notifyError(err.message || 'Failed to submit attendance');
    } finally {
      setSaving(false);
    }
  };

  const modalFooter = (
    <>
      <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
      <button className="btn-primary" onClick={handleSave} disabled={saving || !form.employee_id}>
        {saving ? 'Submitting...' : 'Submit for Approval'}
      </button>
    </>
  );

  return (
    <div className="page-container">
      <PageHeader title="Attendance Entry" icon="ri-calendar-check-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line"></i> Add Attendance
        </button>
      </PageHeader>

      {/* Month Filter */}
      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <label>Month</label>
            <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="card-container" style={{ marginTop: 16 }}>
        <DataTable
          columns={columns}
          data={records}
          loading={loading}
          fileName="Site_Attendance"
          showFooterTotals
          emptyMessage="No attendance records found for this month."
        />
      </div>

      {/* Add Modal */}
      <ModalDialog
        isOpen={modalOpen}
        title="Add Attendance"
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
            <input
              type="text"
              value={form.sub_id}
              onChange={e => updateForm('sub_id', e.target.value)}
              placeholder="Sub ID"
            />
          </div>
          <div className="form-group">
            <label>Month <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="month"
              value={form.month}
              onChange={e => updateForm('month', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Present Days</label>
            <input
              type="number"
              value={form.present_days}
              onChange={e => updateForm('present_days', Number(e.target.value))}
              min={0}
              max={31}
            />
          </div>
          <div className="form-group">
            <label>OT Hours</label>
            <input
              type="number"
              value={form.ot_hours}
              onChange={e => updateForm('ot_hours', Number(e.target.value))}
              min={0}
              step={0.5}
            />
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
            <input
              type="number"
              value={form.base_daily_wage}
              onChange={e => updateForm('base_daily_wage', Number(e.target.value))}
              min={0}
              step={1}
            />
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
