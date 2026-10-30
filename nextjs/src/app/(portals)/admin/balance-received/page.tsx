'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import DataTable, { TableColumn, TableAction } from '@/components/DataTable';
import ModalDialog from '@/components/ModalDialog';
import PageHeader from '@/components/PageHeader';
import SearchableDropdown from '@/components/SearchableDropdown';

interface BalanceEntry {
  id: string;
  invoice_id: string;
  invoice_number?: string;
  received_date: string;
  entry_type: string;
  amount: number;
  tds_amount: number;
  payment_mode: string;
  reference_no: string;
  remarks: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  gross_amount: number;
  paid_amount: number;
  status: string;
}

const PAYMENT_MODES = ['NEFT', 'RTGS', 'Cheque', 'Cash', 'UPI', 'DD'];

function formatINR(val: number): string {
  if (!val && val !== 0) return '--';
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BalanceReceivedPage() {
  const { apiGet, apiPost, apiDelete } = useApi();
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [entries, setEntries] = useState<BalanceEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filter
  const [filterInvoiceId, setFilterInvoiceId] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);

  // Form
  const [formInvoiceId, setFormInvoiceId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formTdsAmount, setFormTdsAmount] = useState<number>(0);
  const [formEntryType, setFormEntryType] = useState('PAYMENT');
  const [formPaymentMethod, setFormPaymentMethod] = useState('');
  const [formReferenceNumber, setFormReferenceNumber] = useState('');
  const [formRemarks, setFormRemarks] = useState('');

  const invoiceItems = useMemo(() => invoices.map(i => ({
    value: i.id,
    label: `${i.invoice_number} - ${formatINR(i.gross_amount)}`,
  })), [invoices]);

  const selectedInvoice = useMemo(() => invoices.find(i => i.id === formInvoiceId), [invoices, formInvoiceId]);

  const loadMasters = useCallback(async () => {
    try {
      const [inv, b] = await Promise.all([
        apiGet<Invoice[]>('/api/invoices'),
        apiGet<any[]>('/api/banks'),
      ]);
      setInvoices(Array.isArray(inv) ? inv : []);
      setBanks(Array.isArray(b) ? b : []);
    } catch { /* ignore */ }
  }, [apiGet]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterInvoiceId) params.invoice_id = filterInvoiceId;
      const query = new URLSearchParams(params).toString();
      const url = query ? `/api/balance-received?${query}` : '/api/balance-received';
      const data = await apiGet<BalanceEntry[]>(url);
      setEntries(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Failed to load entries: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [apiGet, filterInvoiceId, notifyError]);

  useEffect(() => { loadMasters(); }, [loadMasters]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  const columns: TableColumn[] = [
    { key: 'received_date', label: 'Date', type: 'date', sortable: true },
    { key: 'invoice_number', label: 'Invoice', sortable: true },
    { key: 'entry_type', label: 'Entry Type', type: 'badge', badgeMap: { PAYMENT: 'success', TDS: 'warning' } },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'tds_amount', label: 'TDS Amount', type: 'currency' },
    { key: 'payment_mode', label: 'Payment Method' },
    { key: 'reference_no', label: 'Reference' },
    { key: 'remarks', label: 'Remarks' },
  ];

  const actions: TableAction[] = [
    { label: 'Delete', icon: 'ri-delete-bin-line', action: 'delete', class: 'btn-danger' },
  ];

  const resetForm = () => {
    setFormInvoiceId('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormAmount(0);
    setFormTdsAmount(0);
    setFormEntryType('PAYMENT');
    setFormPaymentMethod('');
    setFormReferenceNumber('');
    setFormRemarks('');
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formInvoiceId) { notifyError('Invoice is required.'); return; }
    if (!formAmount && formEntryType === 'PAYMENT') { notifyError('Amount is required.'); return; }
    if (!formPaymentMethod) { notifyError('Payment method is required.'); return; }

    const payload = {
      invoice_id: formInvoiceId,
      received_date: formDate,
      amount: formAmount,
      tds_amount: formTdsAmount,
      entry_type: formEntryType,
      payment_mode: formPaymentMethod,
      reference_no: formReferenceNumber,
      remarks: formRemarks,
    };

    setSaving(true);
    try {
      await apiPost('/api/balance-received', payload);
      success('Balance entry added. Invoice status updated.');
      setShowModal(false);
      resetForm();
      loadEntries();
      loadMasters(); // refresh invoice balances
    } catch (err: any) {
      notifyError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: BalanceEntry) => {
    const ok = await confirm({
      title: 'Delete Entry',
      message: 'Are you sure you want to delete this balance entry?',
      confirmText: 'Delete',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/balance-received/${entry.id}`);
      success('Entry deleted.');
      loadEntries();
      loadMasters();
    } catch (err: any) {
      notifyError('Delete failed: ' + err.message);
    }
  };

  const handleActionClick = (event: { action: string; row: any }) => {
    if (event.action === 'delete') handleDelete(event.row as BalanceEntry);
  };

  return (
    <div className="page-container">
      <PageHeader title="Balance Received" icon="ri-money-rupee-circle-line">
        <button className="btn-primary" onClick={openAddModal}>
          <i className="ri-add-line"></i> Add Entry
        </button>
      </PageHeader>

      {/* Filter */}
      <div className="card-container" style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <SearchableDropdown items={invoiceItems} value={filterInvoiceId} onChange={setFilterInvoiceId} label="Filter by Invoice" placeholder="All Invoices" />
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={entries}
        loading={loading}
        actions={actions}
        onActionClick={handleActionClick}
        fileName="balance-received"
        showFooterTotals
      />

      {/* Add Entry Modal */}
      <ModalDialog isOpen={showModal} title="Add Balance Entry" size="md" onClose={() => setShowModal(false)}>
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <SearchableDropdown items={invoiceItems} value={formInvoiceId} onChange={setFormInvoiceId} label="Invoice" placeholder="Select Invoice..." required />
          </div>

          {selectedInvoice && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gross Amount</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{formatINR(selectedInvoice.gross_amount)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paid</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: 'var(--success)' }}>{formatINR(selectedInvoice.paid_amount ?? 0)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Balance Due</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: 'var(--danger)' }}>
                      {formatINR((selectedInvoice.gross_amount ?? 0) - (selectedInvoice.paid_amount ?? 0))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</div>
                    <div style={{ marginTop: 4 }}>
                      <span className={`badge ${selectedInvoice.status === 'paid' ? 'badge-success' : selectedInvoice.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                        {selectedInvoice.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Date <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Entry Type</label>
            <select value={formEntryType} onChange={e => setFormEntryType(e.target.value)}>
              <option value="PAYMENT">PAYMENT</option>
              <option value="TDS">TDS</option>
            </select>
          </div>
          <div className="form-group">
            <label>Amount <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="number" value={formAmount || ''} onChange={e => setFormAmount(Number(e.target.value))} placeholder="0.00" min={0} step={0.01} required />
          </div>
          <div className="form-group">
            <label>TDS Amount</label>
            <input type="number" value={formTdsAmount || ''} onChange={e => setFormTdsAmount(Number(e.target.value))} placeholder="0.00" min={0} step={0.01} />
          </div>
          <div className="form-group">
            <label>Payment Method <span style={{ color: 'var(--danger)' }}>*</span></label>
            <select value={formPaymentMethod} onChange={e => setFormPaymentMethod(e.target.value)} required>
              <option value="">-- Select Method --</option>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Reference Number</label>
            <input type="text" value={formReferenceNumber} onChange={e => setFormReferenceNumber(e.target.value)} placeholder="Transaction reference" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Remarks</label>
            <textarea value={formRemarks} onChange={e => setFormRemarks(e.target.value)} placeholder="Optional remarks" rows={2} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <i className="ri-add-line"></i>
            {saving ? 'Saving...' : 'Add Entry'}
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
