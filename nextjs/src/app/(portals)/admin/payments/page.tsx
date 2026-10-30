'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import DataTable, { type TableColumn, type TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown from '@/components/SearchableDropdown';

const CATEGORIES = [
  { value: 'employee', label: 'Employee' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'retailer', label: 'Retailer' },
  { value: 'supervisor_fund', label: 'Supervisor Fund' },
  { value: 'equipment', label: 'Equipment' },
];

const DEFAULT_TDS: Record<string, number> = {
  contractor: 2,
  employee: 0,
  retailer: 0,
  supervisor_fund: 0,
  equipment: 0,
};

interface PaymentForm {
  date: string;
  category: string;
  party_id: string;
  site_id: string;
  gross_amount: number;
  tds_percentage: number;
  tds_amount: number;
  net_amount: number;
  payment_mode_id: string;
  bank_id: string;
  remarks: string;
}

const emptyForm = (): PaymentForm => ({
  date: new Date().toISOString().split('T')[0],
  category: 'employee',
  party_id: '',
  site_id: '',
  gross_amount: 0,
  tds_percentage: 0,
  tds_amount: 0,
  net_amount: 0,
  payment_mode_id: '',
  bank_id: '',
  remarks: '',
});

export default function PaymentsPage() {
  const { apiGet, apiPost, apiPut, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [payments, setPayments] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSiteId, setFilterSiteId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PaymentForm>(emptyForm());

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);
  const modeItems = useMemo(() => paymentModes.map(m => ({ value: m.id, label: m.name })), [paymentModes]);
  const bankItems = useMemo(() => banks.map(b => ({ value: b.id, label: b.bank_name || b.name })), [banks]);

  const partyItems = useMemo(() => {
    switch (form.category) {
      case 'employee': return employees.map(e => ({ value: e.id, label: e.name }));
      case 'contractor': return contractors.map(c => ({ value: c.id, label: c.name }));
      case 'retailer': return retailers.map(r => ({ value: r.id, label: r.name }));
      case 'supervisor_fund': return supervisors.map(s => ({ value: s.id, label: s.name }));
      case 'equipment': return equipmentList.map(e => ({ value: e.id, label: e.name }));
      default: return [];
    }
  }, [form.category, employees, contractors, retailers, supervisors, equipmentList]);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterCategory) params.category = filterCategory;
      if (filterSiteId) params.site_id = filterSiteId;
      if (filterStatus) params.status = filterStatus;
      if (filterDateFrom) params.from_date = filterDateFrom;
      if (filterDateTo) params.to_date = filterDateTo;
      const qs = Object.keys(params).length
        ? '?' + new URLSearchParams(params).toString()
        : '';
      const data = await apiGet<any[]>(`/api/payments${qs}`);
      setPayments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load payments: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [apiGet, notifyError, filterCategory, filterSiteId, filterStatus, filterDateFrom, filterDateTo]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    apiGet<any[]>('/api/sites').then(d => setSites(Array.isArray(d) ? d : [])).catch(() => {});
    apiGet<any[]>('/api/employees').then(d => setEmployees(Array.isArray(d) ? d : [])).catch(() => {});
    apiGet<any[]>('/api/contractors').then(d => setContractors(Array.isArray(d) ? d : [])).catch(() => {});
    apiGet<any[]>('/api/retailers').then(d => setRetailers(Array.isArray(d) ? d : [])).catch(() => {});
    apiGet<any[]>('/api/supervisors').then(d => setSupervisors(Array.isArray(d) ? d : [])).catch(() => {});
    apiGet<any[]>('/api/equipment').then(d => setEquipmentList(Array.isArray(d) ? d : [])).catch(() => {});
    apiGet<any[]>('/api/payment-modes').then(d => setPaymentModes(Array.isArray(d) ? d : [])).catch(() => {});
    apiGet<any[]>('/api/banks').then(d => setBanks(Array.isArray(d) ? d : [])).catch(() => {});
  }, [apiGet]);

  const columns: TableColumn[] = [
    { key: 'payment_number', label: 'Display ID' },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'category', label: 'Category', type: 'badge', badgeMap: { employee: 'info', contractor: 'warning', retailer: 'success', supervisor_fund: 'info', equipment: 'warning' } },
    { key: 'party_name', label: 'Party Name' },
    { key: 'site_name', label: 'Site' },
    { key: 'gross_amount', label: 'Amount', type: 'currency' },
    { key: 'tds_percentage', label: 'TDS%' },
    { key: 'tds_amount', label: 'TDS Amount', type: 'currency' },
    { key: 'net_amount', label: 'Net Amount', type: 'currency' },
    { key: 'status', label: 'Status', type: 'badge', badgeMap: { cleared: 'success', on_hold: 'warning', pending: 'info', voided: 'danger' } },
  ];

  const actions: TableAction[] = [
    { label: '', icon: 'ri-edit-line', action: 'edit', class: 'btn-primary' },
    { label: '', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger' },
  ];

  const updateForm = (field: keyof PaymentForm, value: any) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };

      if (field === 'category') {
        updated.party_id = '';
        updated.tds_percentage = DEFAULT_TDS[value] ?? 0;
        updated.tds_amount = Math.round(updated.gross_amount * updated.tds_percentage) / 100;
        updated.net_amount = updated.gross_amount - updated.tds_amount;
      }

      if (field === 'gross_amount' || field === 'tds_percentage') {
        const amount = field === 'gross_amount' ? Number(value) : updated.gross_amount;
        const pct = field === 'tds_percentage' ? Number(value) : updated.tds_percentage;
        updated.tds_amount = Math.round(amount * pct) / 100;
        updated.net_amount = amount - updated.tds_amount;
      }

      if (field === 'tds_amount') {
        updated.net_amount = updated.gross_amount - Number(value);
      }

      return updated;
    });
  };

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEditModal = (row: any) => {
    setEditingId(row.id);
    setForm({
      date: row.date?.split('T')[0] || '',
      category: row.category || 'employee',
      party_id: row.party_id || '',
      site_id: row.site_id || '',
      gross_amount: row.gross_amount || 0,
      tds_percentage: row.tds_percentage || 0,
      tds_amount: row.tds_amount || 0,
      net_amount: row.net_amount || 0,
      payment_mode_id: row.payment_mode_id || '',
      bank_id: row.bank_id || '',
      remarks: row.remarks || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.party_id || !form.gross_amount) {
      notifyError('Party and amount are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        date: form.date,
        category: form.category,
        party_id: form.party_id,
        site_id: form.site_id || null,
        gross_amount: form.gross_amount,
        tds_percentage: form.tds_percentage,
        tds_amount: form.tds_amount,
        net_amount: form.net_amount,
        payment_mode_id: form.payment_mode_id || null,
        bank_id: form.bank_id || null,
        remarks: form.remarks,
      };
      if (editingId) {
        await apiPut(`/api/payments/${editingId}`, payload);
        success('Payment updated successfully.');
      } else {
        await apiPost('/api/payments', payload);
        success('Payment created successfully.');
      }
      setModalOpen(false);
      loadPayments();
    } catch (err: any) {
      notifyError('Failed to save payment: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: any) => {
    const ok = await confirm({
      title: 'Delete Payment',
      message: `Are you sure you want to delete payment "${row.payment_number}"?`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/payments/${row.id}`);
      success('Payment deleted.');
      loadPayments();
    } catch (err: any) {
      notifyError('Failed to delete: ' + err.message);
    }
  };

  const handleAction = ({ action, row }: { action: string; row: any }) => {
    if (action === 'edit') openEditModal(row);
    if (action === 'delete') handleDelete(row);
  };

  const formatCurrency = (v: number) => v ? `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';

  return (
    <div className="page-container">
      <PageHeader title="Payments" icon="ri-money-rupee-circle-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line"></i> Add Payment
        </button>
      </PageHeader>

      <div className="card-container" style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <label>Category</label>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={filterSiteId}
              onChange={setFilterSiteId}
              label="Site"
              placeholder="All Sites"
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="cleared">Cleared</option>
              <option value="on_hold">On Hold</option>
              <option value="pending">Pending</option>
              <option value="voided">Voided</option>
            </select>
          </div>
          <div className="form-group">
            <label>From Date</label>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>To Date</label>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card-container">
        <DataTable
          columns={columns}
          data={payments}
          loading={loading}
          actions={actions}
          onActionClick={handleAction}
          fileName="payments"
          showFooterTotals
        />
      </div>

      <ModalDialog
        isOpen={modalOpen}
        title={editingId ? 'Edit Payment' : 'Add Payment'}
        size="lg"
        onClose={() => setModalOpen(false)}
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>Date <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="date" value={form.date} onChange={e => updateForm('date', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Category <span style={{ color: 'var(--danger)' }}>*</span></label>
            <select value={form.category} onChange={e => updateForm('category', e.target.value)}>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={partyItems}
              value={form.party_id}
              onChange={(v: any) => updateForm('party_id', v)}
              label="Party"
              placeholder="Select party..."
              required
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={form.site_id}
              onChange={(v: any) => updateForm('site_id', v)}
              label="Site"
              placeholder="Select site..."
            />
          </div>
          <div className="form-group">
            <label>Amount <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="number"
              value={form.gross_amount || ''}
              onChange={e => updateForm('gross_amount', Number(e.target.value))}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>
          <div className="form-group">
            <label>TDS %</label>
            <input
              type="number"
              value={form.tds_percentage || ''}
              onChange={e => updateForm('tds_percentage', Number(e.target.value))}
              placeholder="0"
              min="0"
              step="0.01"
            />
          </div>
          <div className="form-group">
            <label>TDS Amount</label>
            <input
              type="number"
              value={form.tds_amount || ''}
              onChange={e => updateForm('tds_amount', Number(e.target.value))}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>
          <div className="form-group">
            <label>Net Amount</label>
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              fontWeight: 700,
              color: 'var(--success)',
              fontSize: 16,
            }}>
              {formatCurrency(form.net_amount)}
            </div>
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={modeItems}
              value={form.payment_mode_id}
              onChange={(v: any) => updateForm('payment_mode_id', v)}
              label="Payment Mode"
              placeholder="Select mode..."
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={bankItems}
              value={form.bank_id}
              onChange={(v: any) => updateForm('bank_id', v)}
              label="Bank"
              placeholder="Select bank..."
            />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Remarks</label>
            <textarea
              value={form.remarks}
              onChange={e => updateForm('remarks', e.target.value)}
              placeholder="Optional remarks"
              rows={2}
            />
          </div>
        </div>

        {form.gross_amount > 0 && (
          <div style={{
            marginTop: 16,
            padding: 16,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
          }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--accent)', textTransform: 'uppercase' }}>
              TDS Computation
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gross Amount</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(form.gross_amount)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>TDS @ {form.tds_percentage}%</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--warning)' }}>- {formatCurrency(form.tds_amount)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net Payable</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(form.net_amount)}</div>
              </div>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
