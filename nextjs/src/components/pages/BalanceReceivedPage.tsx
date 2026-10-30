'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { exportToExcel, exportToPDF, printReport } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards from '@/components/SummaryCards';
import styles from './BalanceReceivedPage.module.scss';

const TDS_PRESETS = [1, 2, 5, 10];
const PAYMENT_MODES = ['NEFT', 'RTGS', 'Cheque', 'Cash', 'UPI', 'DD'];

export default function BalanceReceivedPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [companies, setCompanies] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [tdsPercent, setTdsPercent] = useState('');
  const [tdsAmount, setTdsAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [bankId, setBankId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyInvoice, setHistoryInvoice] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  const loadMasters = useCallback(async () => {
    try {
      const [c, s, b] = await Promise.all([
        apiGet<any[]>('/companies'),
        apiGet<any[]>('/sites'),
        apiGet<any[]>('/banks'),
      ]);
      setCompanies(c);
      setSites(s);
      setBanks(b);
    } catch (err: any) {
      notifyError('Failed to load masters: ' + err.message);
    }
  }, [notifyError]);

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<any[]>('/balance-received');
      setReceipts(data);
    } catch (err: any) {
      notifyError('Failed to load receipts: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  const loadInvoices = useCallback(async () => {
    if (!selectedCompanyId) { setInvoices([]); return; }
    try {
      const params: Record<string, string> = { company_id: selectedCompanyId };
      if (selectedSiteId) params.site_id = selectedSiteId;
      const data = await apiGet<any[]>('/invoices', params);
      setInvoices(data);
    } catch (err: any) {
      notifyError('Failed to load invoices: ' + err.message);
    }
  }, [selectedCompanyId, selectedSiteId, notifyError]);

  useEffect(() => { loadMasters(); loadReceipts(); }, [loadMasters, loadReceipts]);
  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const selectedInvoice = useMemo(() => invoices.find(i => i.id === selectedInvoiceId), [invoices, selectedInvoiceId]);

  const companyItems = useMemo(() => companies.map(c => ({ value: c.id, label: c.name })), [companies]);
  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);
  const invoiceItems = useMemo(() => invoices.map(i => ({ value: i.id, label: `${i.invoice_number} — ₹${(i.gross_amount ?? 0).toLocaleString('en-IN')}` })), [invoices]);
  const bankItems = useMemo(() => banks.map(b => ({ value: b.id, label: `${b.bank_name} - ${b.account_number}` })), [banks]);

  const handleTdsPreset = (pct: number) => {
    setTdsPercent(String(pct));
    if (selectedInvoice) {
      const gross = selectedInvoice.gross_amount ?? 0;
      setTdsAmount(String(Math.round(gross * pct / 100)));
    }
  };

  const summaryCards = useMemo(() => {
    const totalReceived = receipts.reduce((s, r) => s + (r.amount ?? 0), 0);
    const totalTds = receipts.reduce((s, r) => s + (r.tds_amount ?? 0), 0);
    return [
      { title: 'Total Received', value: `₹${totalReceived.toLocaleString('en-IN')}`, icon: 'ri-money-rupee-circle-line', color: 'success' as const },
      { title: 'TDS Deducted', value: `₹${totalTds.toLocaleString('en-IN')}`, icon: 'ri-percent-line', color: 'warning' as const },
      { title: 'Net Received', value: `₹${(totalReceived - totalTds).toLocaleString('en-IN')}`, icon: 'ri-wallet-3-line', color: 'primary' as const },
      { title: 'Receipts', value: receipts.length, icon: 'ri-file-list-3-line', color: 'info' as const },
    ];
  }, [receipts]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setSelectedCompanyId('');
    setSelectedSiteId('');
    setSelectedInvoiceId('');
    setAmount('');
    setTdsPercent('');
    setTdsAmount('');
    setPaymentMode('');
    setBankId('');
    setReferenceNo('');
    setReceivedDate(new Date().toISOString().split('T')[0]);
    setRemarks('');
  }, []);

  const saveReceipt = useCallback(async () => {
    if (!selectedCompanyId || !amount || !paymentMode) return;
    setSaving(true);
    const body = {
      company_id: selectedCompanyId,
      site_id: selectedSiteId || null,
      invoice_id: selectedInvoiceId || null,
      amount: parseFloat(amount),
      tds_percent: tdsPercent ? parseFloat(tdsPercent) : null,
      tds_amount: tdsAmount ? parseFloat(tdsAmount) : null,
      payment_mode: paymentMode,
      bank_id: bankId || null,
      reference_no: referenceNo,
      received_date: receivedDate,
      remarks,
    };
    try {
      if (editingId) {
        await apiPut(`/balance-received/${editingId}`, body);
        success('Receipt updated');
      } else {
        await apiPost('/balance-received', body);
        success('Receipt added');
      }
      resetForm();
      loadReceipts();
    } catch (err: any) {
      notifyError('Failed to save receipt: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [selectedCompanyId, selectedSiteId, selectedInvoiceId, amount, tdsPercent, tdsAmount, paymentMode, bankId, referenceNo, receivedDate, remarks, editingId, success, notifyError, resetForm, loadReceipts]);

  const editReceipt = useCallback((r: any) => {
    setEditingId(r.id);
    setSelectedCompanyId(r.company_id ?? '');
    setSelectedSiteId(r.site_id ?? '');
    setSelectedInvoiceId(r.invoice_id ?? '');
    setAmount(String(r.amount ?? ''));
    setTdsPercent(String(r.tds_percent ?? ''));
    setTdsAmount(String(r.tds_amount ?? ''));
    setPaymentMode(r.payment_mode ?? '');
    setBankId(r.bank_id ?? '');
    setReferenceNo(r.reference_no ?? '');
    setReceivedDate(r.received_date?.split('T')[0] ?? '');
    setRemarks(r.remarks ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const deleteReceipt = useCallback(async (r: any) => {
    const ok = await confirm({ title: 'Delete Receipt', message: 'Are you sure you want to delete this receipt?', type: 'danger', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await apiDelete(`/balance-received/${r.id}`);
      success('Receipt deleted');
      loadReceipts();
    } catch (err: any) {
      notifyError('Delete failed: ' + err.message);
    }
  }, [confirm, success, notifyError, loadReceipts]);

  const showPaymentHistory = useCallback(async (invoice: any) => {
    setHistoryInvoice(invoice);
    setHistoryModalOpen(true);
    try {
      const data = await apiGet<any[]>('/balance-received', { invoice_id: invoice.id });
      setPaymentHistory(data);
    } catch { setPaymentHistory([]); }
  }, []);

  const getCompanyName = (id: string) => companies.find(c => c.id === id)?.name ?? '--';
  const getSiteName = (id: string) => sites.find(s => s.id === id)?.name ?? '--';

  const handleExportExcel = () => {
    exportToExcel(receipts.map(r => ({
      Date: r.received_date?.split('T')[0],
      Company: getCompanyName(r.company_id),
      Amount: r.amount,
      TDS: r.tds_amount,
      Mode: r.payment_mode,
      Reference: r.reference_no,
      Remarks: r.remarks,
    })), 'balance-received');
  };

  const handleExportPDF = () => {
    exportToPDF('Balance Received Report', ['Date', 'Company', 'Amount', 'TDS', 'Mode', 'Reference'],
      receipts.map(r => [r.received_date?.split('T')[0], getCompanyName(r.company_id), r.amount, r.tds_amount ?? 0, r.payment_mode, r.reference_no ?? ''])
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-money-rupee-circle-line"></i> Balance Received</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-export" onClick={handleExportExcel}><i className="ri-file-excel-2-line"></i> Excel</button>
          <button className="btn-export" onClick={handleExportPDF}><i className="ri-file-pdf-2-line"></i> PDF</button>
          <button className="btn-export" onClick={() => printReport('Balance Received')}><i className="ri-printer-line"></i> Print</button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="card-container" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
          {editingId ? 'Edit Receipt' : 'New Receipt Entry'}
        </h3>
        <form onSubmit={e => { e.preventDefault(); saveReceipt(); }}>
          <div className="form-grid">
            <div className="form-group">
              <SearchableDropdown items={companyItems} label="Company *" placeholder="Select Company..." value={selectedCompanyId} onChange={setSelectedCompanyId} />
            </div>
            <div className="form-group">
              <SearchableDropdown items={siteItems} label="Site" placeholder="Select Site..." value={selectedSiteId} onChange={setSelectedSiteId} />
            </div>
            <div className="form-group">
              <SearchableDropdown items={invoiceItems} label="Invoice" placeholder="Select Invoice..." value={selectedInvoiceId} onChange={setSelectedInvoiceId} />
            </div>
            <div className="form-group">
              <label>Amount <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" required />
            </div>
            <div className="form-group">
              <label>TDS %</label>
              <input type="number" value={tdsPercent} onChange={e => {
                setTdsPercent(e.target.value);
                if (selectedInvoice && e.target.value) {
                  setTdsAmount(String(Math.round((selectedInvoice.gross_amount ?? 0) * parseFloat(e.target.value) / 100)));
                }
              }} placeholder="0" min="0" step="0.01" />
              <div className={styles.tdsPresets}>
                {TDS_PRESETS.map(p => (
                  <button key={p} type="button" className={styles.tdsBtn} onClick={() => handleTdsPreset(p)}>{p}%</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>TDS Amount</label>
              <input type="number" value={tdsAmount} onChange={e => setTdsAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" />
            </div>
            <div className="form-group">
              <label>Payment Mode <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} required>
                <option value="">-- Select Mode --</option>
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <SearchableDropdown items={bankItems} label="Bank" placeholder="Select Bank..." value={bankId} onChange={setBankId} />
            </div>
            <div className="form-group">
              <label>Reference No</label>
              <input type="text" value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="Transaction reference" />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Remarks</label>
              <textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional remarks" rows={2} />
            </div>
          </div>

          {selectedInvoice && (
            <div className={styles.invoiceDetails}>
              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--accent)' }}>Invoice Details</h4>
              <div className={styles.invoiceGrid}>
                <div><div className={styles.invoiceLabel}>Base Amount</div><div className={styles.invoiceValue}>₹{(selectedInvoice.base_amount ?? 0).toLocaleString('en-IN')}</div></div>
                <div><div className={styles.invoiceLabel}>GST</div><div className={styles.invoiceValue}>₹{(selectedInvoice.gst_amount ?? 0).toLocaleString('en-IN')}</div></div>
                <div><div className={styles.invoiceLabel}>Gross</div><div className={styles.invoiceValue}>₹{(selectedInvoice.gross_amount ?? 0).toLocaleString('en-IN')}</div></div>
                <div><div className={styles.invoiceLabel}>Paid</div><div className={styles.invoiceValue}>₹{(selectedInvoice.paid_amount ?? 0).toLocaleString('en-IN')}</div></div>
                <div><div className={styles.invoiceLabel}>Balance Due</div><div className={styles.invoiceValue} style={{ color: 'var(--danger)' }}>₹{((selectedInvoice.gross_amount ?? 0) - (selectedInvoice.paid_amount ?? 0)).toLocaleString('en-IN')}</div></div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn-primary" disabled={saving || !selectedCompanyId || !amount || !paymentMode}>
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'}></i>
              {editingId ? 'Update Receipt' : 'Add Receipt'}
            </button>
            {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>

      <div className="table-responsive" style={{ marginTop: 20 }}>
        {loading ? (
          <div className="empty-state"><div className="skeleton" style={{ height: 200 }}></div></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Company</th>
                <th>Amount</th>
                <th>TDS</th>
                <th>Mode</th>
                <th>Reference</th>
                <th>Remarks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">No receipts found.</td></tr>
              ) : receipts.map(r => (
                <tr key={r.id}>
                  <td>{r.received_date?.split('T')[0] ?? '--'}</td>
                  <td style={{ fontWeight: 600 }}>{getCompanyName(r.company_id)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--success)' }}>₹{(r.amount ?? 0).toLocaleString('en-IN')}</td>
                  <td>{r.tds_amount ? `₹${r.tds_amount.toLocaleString('en-IN')}` : '--'}</td>
                  <td><span className="badge badge-info">{r.payment_mode}</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.reference_no ?? '--'}</td>
                  <td>{r.remarks ?? '--'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => editReceipt(r)} title="Edit"><i className="ri-pencil-line"></i></button>
                      <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteReceipt(r)} title="Delete"><i className="ri-delete-bin-line"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ModalDialog isOpen={historyModalOpen} title="Payment History" size="lg" onClose={() => setHistoryModalOpen(false)}>
        {historyInvoice && (
          <>
            <p style={{ marginBottom: 12, fontWeight: 600 }}>Invoice: {historyInvoice.invoice_number}</p>
            <table>
              <thead>
                <tr><th>Date</th><th>Amount</th><th>TDS</th><th>Mode</th><th>Reference</th></tr>
              </thead>
              <tbody>
                {paymentHistory.length === 0 ? (
                  <tr><td colSpan={5} className="empty-state">No payments found.</td></tr>
                ) : paymentHistory.map(p => (
                  <tr key={p.id}>
                    <td>{p.received_date?.split('T')[0]}</td>
                    <td style={{ fontWeight: 700 }}>₹{(p.amount ?? 0).toLocaleString('en-IN')}</td>
                    <td>{p.tds_amount ? `₹${p.tds_amount.toLocaleString('en-IN')}` : '--'}</td>
                    <td>{p.payment_mode}</td>
                    <td>{p.reference_no ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </ModalDialog>
    </div>
  );
}
