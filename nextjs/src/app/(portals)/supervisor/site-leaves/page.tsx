'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useRole } from '@/hooks/useRole';
import DataTable, { TableColumn } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown, { DropdownItem } from '@/components/SearchableDropdown';

interface LeaveRecord {
  id?: number;
  employee_id?: string;
  employee_name?: string;
  date?: string;
  leave_type?: string;
  reason?: string;
  status?: string;
}

const emptyForm = {
  employee_id: '',
  date: '',
  leave_type: 'casual',
  reason: '',
};

export default function SupervisorSiteLeavesPage() {
  const { apiGet, apiPost } = useApi();
  const { success, error: notifyError } = useNotification();
  const { getSiteId } = useRole();

  const siteId = getSiteId();

  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [employeeItems, setEmployeeItems] = useState<DropdownItem[]>([]);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

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

  const loadLeaves = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const data = await apiGet<LeaveRecord[]>(`/api/site-leaves?site_id=${siteId}`);
      setRecords(data || []);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load site leaves');
    } finally {
      setLoading(false);
    }
  }, [apiGet, siteId, notifyError]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  const columns: TableColumn[] = [
    { key: 'employee_name', label: 'Employee', sortable: true },
    { key: 'date', label: 'Date', type: 'date', sortable: true },
    {
      key: 'leave_type',
      label: 'Type',
      type: 'badge',
      sortable: true,
      badgeMap: {
        casual: 'info',
        sick: 'warning',
        earned: 'success',
        unpaid: 'danger',
      },
    },
    { key: 'reason', label: 'Reason', sortable: false },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: {
        pending: 'warning',
        approved: 'success',
        rejected: 'danger',
      },
    },
  ];

  const openAddModal = () => {
    setForm({
      ...emptyForm,
      date: new Date().toISOString().split('T')[0],
    });
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
    if (!form.date) {
      notifyError('Please select a date');
      return;
    }

    setSaving(true);
    const formData = {
      ...form,
      site_id: siteId,
    };

    try {
      await apiPost('/api/approvals', {
        source: 'supervisor',
        module: 'site_leave',
        action_type: 'create',
        entity_id: null,
        new_data: formData,
        remarks: `Site leave: ${form.leave_type} on ${form.date}`,
      });
      success('Leave request submitted for approval');
      setModalOpen(false);
      setForm({ ...emptyForm });
      loadLeaves();
    } catch (err: any) {
      notifyError(err.message || 'Failed to submit leave request');
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
      <PageHeader title="Site Leave Entry" icon="ri-rest-time-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line"></i> Add Leave
        </button>
      </PageHeader>

      {/* Data Table */}
      <div className="card-container">
        <DataTable
          columns={columns}
          data={records}
          loading={loading}
          fileName="Site_Leaves"
          emptyMessage="No leave records found."
        />
      </div>

      {/* Add Leave Modal */}
      <ModalDialog
        isOpen={modalOpen}
        title="Add Site Leave"
        size="md"
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
            <label>Date <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="date"
              value={form.date}
              onChange={e => updateForm('date', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Leave Type <span style={{ color: 'var(--danger)' }}>*</span></label>
            <select value={form.leave_type} onChange={e => updateForm('leave_type', e.target.value)}>
              <option value="casual">Casual Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="earned">Earned Leave</option>
              <option value="unpaid">Unpaid Leave</option>
            </select>
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 8 }}>
          <label>Reason</label>
          <textarea
            value={form.reason}
            onChange={e => updateForm('reason', e.target.value)}
            placeholder="Enter reason for leave..."
            rows={3}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>
      </ModalDialog>
    </div>
  );
}
