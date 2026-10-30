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

interface PaymentRecord {
  id?: number;
  display_id?: string;
  date?: string;
  category?: string;
  party_name?: string;
  amount?: number;
  tds_percentage?: number;
  tds_amount?: number;
  net_amount?: number;
  payment_mode?: string;
  status?: string;
  remarks?: string;
}

const emptyForm = {
  date: '',
  category: 'employee',
  party_id: '',
  amount: 0,
  tds_percentage: 0,
  payment_mode: 'bank_transfer',
  remarks: '',
};

export default function SupervisorPaymentsPage() {
  const { apiGet, apiPost } = useApi();
  const { success, error: notifyError } = useNotification();
  const { getSiteId } = useRole();
  const { formatCurrency } = useIndianNumber();

  const siteId = getSiteId();

  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Party dropdown items (context-dependent on category)
  const [employeeItems, setEmployeeItems] = useState<DropdownItem[]>([]);
  const [retailerItems, setRetailerItems] = useState<DropdownItem[]>([]);
  const [contractorItems, setContractorItems] = useState<DropdownItem[]>([]);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // Computed TDS
  const tdsAmount = useMemo(() => {
    return (form.amount * form.tds_percentage) / 100;
  }, [form.amount, form.tds_percentage]);

  const netAmount = useMemo(() => {
    return form.amount - tdsAmount;
  }, [form.amount, tdsAmount]);

  // Get party items based on category
  const partyItems = useMemo(() => {
    switch (form.category) {
      case 'employee': return employeeItems;
      case 'retailer': return retailerItems;
      case 'contractor': return contractorItems;
      default: return [];
    }
  }, [form.category, employeeItems, retailerItems, contractorItems]);

  const loadDropdowns = useCallback(async () => {
    try {
      const [emps, retailers, contractors] = await Promise.all([
        siteId ? apiGet<any[]>(`/api/employees?site_id=${siteId}`) : Promise.resolve([]),
        apiGet<any[]>('/api/retailers').catch(() => []),
        apiGet<any[]>('/api/contractors').catch(() => []),
      ]);
      setEmployeeItems((emps || []).map((e: any) => ({
        value: String(e.id),
        label: `${e.display_id || e.id} - ${e.name}`,
      })));
      setRetailerItems((retailers || []).map((r: any) => ({
        value: String(r.id),
        label: `${r.display_id || r.id} - ${r.name}`,
      })));
      setContractorItems((contractors || []).map((c: any) => ({
        value: String(c.id),
        label: `${c.display_id || c.id} - ${c.name}`,
      })));
    } catch (err: any) {
      notifyError(err.message || 'Failed to load dropdown data');
    }
  }, [apiGet, siteId, notifyError]);

  const loadPayments = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const data = await apiGet<PaymentRecord[]>(`/api/payments?site_id=${siteId}`);
      setRecords(data || []);
    } catch (err: any) {
      notifyError(err.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [apiGet, siteId, notifyError]);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const columns: TableColumn[] = [
    { key: 'display_id', label: 'Payment ID', sortable: true },
    { key: 'date', label: 'Date', type: 'date', sortable: true },
    {
      key: 'category',
      label: 'Category',
      type: 'badge',
      sortable: true,
      badgeMap: {
        employee: 'info',
        retailer: 'success',
        contractor: 'warning',
        mobilization: 'danger',
        other: 'info',
      },
    },
    { key: 'party_name', label: 'Party Name', sortable: true },
    { key: 'amount', label: 'Amount', type: 'currency', sortable: true },
    { key: 'tds_percentage', label: 'TDS%', sortable: true },
    { key: 'tds_amount', label: 'TDS Amount', type: 'currency', sortable: true },
    { key: 'net_amount', label: 'Net Amount', type: 'currency', sortable: true },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: { pending: 'warning', approved: 'success', paid: 'info', rejected: 'danger' },
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
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-set TDS for contractors
      if (field === 'category') {
        updated.party_id = '';
        if (value === 'contractor') {
          updated.tds_percentage = 2;
        } else {
          updated.tds_percentage = 0;
        }
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!form.party_id && form.category !== 'mobilization' && form.category !== 'other') {
      notifyError('Please select a party');
      return;
    }
    if (!form.date) {
      notifyError('Please select a date');
      return;
    }
    if (form.amount <= 0) {
      notifyError('Amount must be greater than zero');
      return;
    }

    setSaving(true);
    const formData = {
      ...form,
      site_id: siteId,
      tds_amount: tdsAmount,
      net_amount: netAmount,
    };

    try {
      await apiPost('/api/approvals', {
        source: 'supervisor',
        module: 'payment',
        action_type: 'create',
        entity_id: null,
        new_data: formData,
        remarks: `Payment request: ${form.category} - ${formatCurrency(form.amount)}`,
      });
      success('Payment request submitted for approval');
      setModalOpen(false);
      setForm({ ...emptyForm });
      loadPayments();
    } catch (err: any) {
      notifyError(err.message || 'Failed to submit payment request');
    } finally {
      setSaving(false);
    }
  };

  const modalFooter = (
    <>
      <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
      <button className="btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Submitting...' : 'Submit for Approval'}
      </button>
    </>
  );

  return (
    <div className="page-container">
      <PageHeader title="Payments" icon="ri-secure-payment-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line"></i> Request Payment
        </button>
      </PageHeader>

      {/* Data Table */}
      <div className="card-container">
        <DataTable
          columns={columns}
          data={records}
          loading={loading}
          fileName="Payments"
          showFooterTotals
          emptyMessage="No payment records found."
        />
      </div>

      {/* Add Payment Modal */}
      <ModalDialog
        isOpen={modalOpen}
        title="Request Payment"
        size="lg"
        onClose={() => setModalOpen(false)}
        footer={modalFooter}
      >
        <div className="form-grid">
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
            <label>Category <span style={{ color: 'var(--danger)' }}>*</span></label>
            <select value={form.category} onChange={e => updateForm('category', e.target.value)}>
              <option value="employee">Employee</option>
              <option value="retailer">Retailer</option>
              <option value="contractor">Contractor</option>
              <option value="mobilization">Mobilization</option>
              <option value="other">Other</option>
            </select>
          </div>
          {form.category !== 'mobilization' && form.category !== 'other' && (
            <div className="form-group">
              <SearchableDropdown
                items={partyItems}
                value={form.party_id || null}
                onChange={(val: any) => updateForm('party_id', val || '')}
                placeholder="Select Party..."
                label="Party"
                required
              />
            </div>
          )}
          <div className="form-group">
            <label>Amount <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="number"
              value={form.amount}
              onChange={e => updateForm('amount', Number(e.target.value))}
              min={0}
              step={0.01}
            />
          </div>
          <div className="form-group">
            <label>TDS % {form.category === 'contractor' && <span style={{ fontSize: 10, color: 'var(--info)' }}>(Auto 2%)</span>}</label>
            <input
              type="number"
              value={form.tds_percentage}
              onChange={e => updateForm('tds_percentage', Number(e.target.value))}
              min={0}
              max={100}
              step={0.1}
            />
          </div>
          <div className="form-group">
            <label>Payment Mode</label>
            <select value={form.payment_mode} onChange={e => updateForm('payment_mode', e.target.value)}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="upi">UPI</option>
            </select>
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 8 }}>
          <label>Remarks</label>
          <textarea
            value={form.remarks}
            onChange={e => updateForm('remarks', e.target.value)}
            placeholder="Add remarks..."
            rows={2}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        {/* Computed Values */}
        <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>
            <i className="ri-calculator-line"></i> Computed Values
          </h4>
          <div className="form-grid">
            <div className="form-group">
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gross Amount</label>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{formatCurrency(form.amount)}</div>
            </div>
            <div className="form-group">
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>TDS Amount ({form.tds_percentage}%)</label>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--warning)' }}>{formatCurrency(tdsAmount)}</div>
            </div>
            <div className="form-group">
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Net Amount</label>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--success)' }}>{formatCurrency(netAmount)}</div>
            </div>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
