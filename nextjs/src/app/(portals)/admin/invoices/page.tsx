'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown from '@/components/SearchableDropdown';

interface Invoice {
  id: string;
  invoice_number: string;
  date: string;
  company_id: string;
  company_name?: string;
  site_name: string;
  base_amount: number;
  gst_amount: number;
  gross_amount: number;
  is_gst: boolean;
  status: string;
  paid_amount?: number;
}

export default function InvoicesPage() {
  const { apiGet, apiPost, apiPut, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterCompanyId, setFilterCompanyId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterIsGst, setFilterIsGst] = useState<boolean | null>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCompanyId, setFormCompanyId] = useState('');
  const [formSiteName, setFormSiteName] = useState('');
  const [formBaseAmount, setFormBaseAmount] = useState<number>(0);
  const [formGstAmount, setFormGstAmount] = useState<number>(0);
  const [formIsGst, setFormIsGst] = useState(true);

  const companyItems = useMemo(() => companies.map(c => ({ value: c.id, label: c.name })), [companies]);
  const computedGross = useMemo(() => Math.round((formBaseAmount + formGstAmount) * 100) / 100, [formBaseAmount, formGstAmount]);

  const loadCompanies = useCallback(async () => {
    try {
      const data = await apiGet<any[]>('/api/companies');
      setCompanies(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }, [apiGet]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterCompanyId) params.company_id = filterCompanyId;
      if (filterStatus) params.status = filterStatus;
      if (filterIsGst !== null) params.is_gst = String(filterIsGst);
      const query = new URLSearchParams(params).toString();
      const url = query ? `/api/invoices?${query}` : '/api/invoices';
      const data = await apiGet<Invoice[]>(url);
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load invoices: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [apiGet, filterCompanyId, filterStatus, filterIsGst, notifyError]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);
  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const tableData = useMemo(() => invoices.map(inv => ({
    ...inv,
    is_gst_display: inv.is_gst ? 'YES' : 'NO',
  })), [invoices]);

  const columns: TableColumn[] = [
    { key: 'invoice_number', label: 'Display ID', sortable: true },
    { key: 'date', label: 'Date', type: 'date', sortable: true },
    { key: 'company_name', label: 'Company', sortable: true },
    { key: 'site_name', label: 'Site Name', sortable: true },
    { key: 'base_amount', label: 'Base Amount', type: 'currency' },
    { key: 'gst_amount', label: 'GST', type: 'currency' },
    { key: 'gross_amount', label: 'Gross Amount', type: 'currency' },
    { key: 'is_gst_display', label: 'GST?', type: 'badge', badgeMap: { YES: 'success', NO: 'warning' } },
    { key: 'status', label: 'Status', type: 'badge', badgeMap: { unpaid: 'danger', partial: 'warning', paid: 'success' } },
  ];

  const actions: TableAction[] = [
    { label: 'Edit', icon: 'ri-edit-line', action: 'edit' },
    { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger' },
  ];

  const resetForm = () => {
    setEditingId(null);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormCompanyId('');
    setFormSiteName('');
    setFormBaseAmount(0);
    setFormGstAmount(0);
    setFormIsGst(true);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (inv: Invoice) => {
    setEditingId(inv.id);
    setFormDate(inv.date?.split('T')[0] || '');
    setFormCompanyId(inv.company_id || '');
    setFormSiteName(inv.site_name || '');
    setFormBaseAmount(inv.base_amount || 0);
    setFormGstAmount(inv.gst_amount || 0);
    setFormIsGst(inv.is_gst ?? true);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formCompanyId) { notifyError('Company is required.'); return; }
    if (!formBaseAmount) { notifyError('Base amount is required.'); return; }

    const payload = {
      date: formDate,
      company_id: formCompanyId,
      site_name: formSiteName,
      base_amount: formBaseAmount,
      gst_amount: formGstAmount,
      gross_amount: computedGross,
      is_gst: formIsGst,
    };

    setSaving(true);
    try {
      if (editingId) {
        await apiPut(`/api/invoices/${editingId}`, payload);
        success('Invoice updated.');
      } else {
        await apiPost('/api/invoices', payload);
        success('Invoice created.');
      }
      setShowModal(false);
      resetForm();
      loadInvoices();
    } catch (err: any) {
      notifyError('Failed to save invoice: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (inv: Invoice) => {
    const ok = await confirm({
      title: 'Cancel Invoice',
      message: `Cancel invoice "${inv.invoice_number}"? This will mark it as cancelled.`,
      confirmText: 'Cancel Invoice',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/invoices/${inv.id}`);
      success('Invoice cancelled.');
      loadInvoices();
    } catch (err: any) {
      notifyError('Failed to cancel invoice: ' + err.message);
    }
  };

  const handleActionClick = (event: { action: string; row: any }) => {
    const inv = event.row as Invoice;
    switch (event.action) {
      case 'edit': openEditModal(inv); break;
      case 'delete': handleDelete(inv); break;
    }
  };

  return (
    <div className="page-container">
      <PageHeader title="Invoices" icon="ri-file-text-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line"></i> Add Invoice
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="card-container" style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown items={companyItems} value={filterCompanyId} onChange={setFilterCompanyId} label="Company" placeholder="All Companies" />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="form-group">
            <label>GST Filter</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={filterIsGst === true} onChange={e => setFilterIsGst(e.target.checked ? true : null)} /> GST Only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={filterIsGst === false} onChange={e => setFilterIsGst(e.target.checked ? false : null)} /> Non-GST Only
              </label>
            </div>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={tableData}
        loading={loading}
        actions={actions}
        onActionClick={handleActionClick}
        fileName="invoices"
        showFooterTotals
      />

      {/* Add/Edit Invoice Modal */}
      <ModalDialog isOpen={showModal} title={editingId ? 'Edit Invoice' : 'Add Invoice'} size="md" onClose={() => setShowModal(false)}>
        <div className="form-grid">
          <div className="form-group">
            <label>Date <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} required />
          </div>
          <div className="form-group">
            <SearchableDropdown items={companyItems} value={formCompanyId} onChange={setFormCompanyId} label="Company" placeholder="Select Company..." required />
          </div>
          <div className="form-group">
            <label>Site Name</label>
            <input type="text" value={formSiteName} onChange={e => setFormSiteName(e.target.value)} placeholder="Enter site name" />
          </div>
          <div className="form-group">
            <label>Base Amount <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="number" value={formBaseAmount || ''} onChange={e => setFormBaseAmount(Number(e.target.value))} placeholder="0.00" min={0} step={0.01} required />
          </div>
          <div className="form-group">
            <label>GST Amount</label>
            <input type="number" value={formGstAmount || ''} onChange={e => setFormGstAmount(Number(e.target.value))} placeholder="0.00" min={0} step={0.01} />
          </div>
          <div className="form-group">
            <label>Gross Amount</label>
            <input type="number" value={computedGross} disabled style={{ fontWeight: 700, color: 'var(--success)' }} />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={formIsGst} onChange={e => {
                setFormIsGst(e.target.checked);
                if (!e.target.checked) setFormGstAmount(0);
              }} />
              GST Applicable
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
            {saving ? 'Saving...' : editingId ? 'Update Invoice' : 'Create Invoice'}
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
