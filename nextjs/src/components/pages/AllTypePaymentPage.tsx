'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import styles from './AllTypePaymentPage.module.scss';

const CATEGORIES = [
  { value: 'employee', label: 'Employee' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'retailer', label: 'Retailer' },
  { value: 'supervisor_fund', label: 'Supervisor Fund' },
  { value: 'equipment', label: 'Equipment' },
];

interface PaymentForm {
  category: string;
  party_id: string;
  site_id: string;
  payment_mode_id: string;
  bank_id: string;
  date: string;
  gross_amount: number;
  tds_percentage: number;
  tds_amount: number;
  net_amount: number;
  reference_number: string;
  remarks: string;
}

const emptyForm: PaymentForm = {
  category: 'employee', party_id: '', site_id: '', payment_mode_id: '', bank_id: '',
  date: new Date().toISOString().split('T')[0], gross_amount: 0, tds_percentage: 0,
  tds_amount: 0, net_amount: 0, reference_number: '', remarks: '',
};

export default function AllTypePaymentPage() {
  const { success: showSuccess, error: showError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [form, setForm] = useState<PaymentForm>({ ...emptyForm });
  const [parties, setParties] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [dueAmount, setDueAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingParties, setLoadingParties] = useState(false);

  const siteItems = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);
  const partyItems = useMemo(() => parties.map(p => ({ value: p.id, label: p.name })), [parties]);
  const modeItems = useMemo(() => paymentModes.map(m => ({ value: m.id, label: m.name })), [paymentModes]);
  const bankItems = useMemo(() => [{ value: '', label: 'N/A' }, ...banks.map(b => ({ value: b.id, label: b.name }))], [banks]);

  useEffect(() => {
    apiGet<any[]>('/sites').then(setSites).catch(() => {});
    apiGet<any[]>('/payment-modes').then(setPaymentModes).catch(() => {});
    apiGet<any[]>('/banks').then(setBanks).catch(() => {});
    loadRecentPayments();
  }, []);

  const loadRecentPayments = async () => {
    try {
      const data = await apiGet<any[]>('/payments', { limit: '10' });
      setRecentPayments(data);
    } catch {}
  };

  const loadParties = useCallback(async (category: string) => {
    setLoadingParties(true);
    setForm(f => ({ ...f, party_id: '' }));
    setDueAmount(null);
    try {
      const endpoints: Record<string, string> = {
        employee: '/employees', contractor: '/contractors', retailer: '/retailers',
        supervisor_fund: '/supervisors', equipment: '/equipment',
      };
      const data = await apiGet<any[]>(endpoints[category] ?? '/employees');
      setParties(data);
    } catch { setParties([]); }
    setLoadingParties(false);
  }, []);

  useEffect(() => { loadParties(form.category); }, [form.category, loadParties]);

  const loadDueAmount = useCallback(async (partyId: string) => {
    if (!partyId || !form.category) { setDueAmount(null); return; }
    try {
      const summary = await apiGet<any>(`/ledger/${form.category}/${partyId}/summary`);
      setDueAmount(summary?.due_amount ?? summary?.balance ?? null);
      if (summary?.due_amount != null) {
        setForm(f => ({ ...f, gross_amount: summary.due_amount }));
      }
    } catch { setDueAmount(null); }
  }, [form.category]);

  useEffect(() => { if (form.party_id) loadDueAmount(form.party_id); }, [form.party_id, loadDueAmount]);

  const updateField = <K extends keyof PaymentForm>(key: K, value: PaymentForm[K]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'gross_amount' || key === 'tds_percentage') {
        const gross = key === 'gross_amount' ? (value as number) : prev.gross_amount;
        const tdsPct = key === 'tds_percentage' ? (value as number) : prev.tds_percentage;
        next.tds_amount = Math.round((gross * tdsPct / 100) * 100) / 100;
        next.net_amount = Math.round((gross - next.tds_amount) * 100) / 100;
      }
      return next;
    });
  };

  const resetForm = () => setForm({ ...emptyForm });

  const handleSubmit = async () => {
    if (!form.party_id) { showError('Please select a party'); return; }
    if (!form.site_id) { showError('Please select a site'); return; }
    if (!form.payment_mode_id) { showError('Please select a payment mode'); return; }
    if (form.gross_amount <= 0) { showError('Amount must be greater than 0'); return; }

    const ok = await confirm('Confirm Payment', `Pay ₹${form.net_amount.toLocaleString('en-IN')} to ${parties.find(p => p.id === form.party_id)?.name ?? 'party'}?`);
    if (!ok) return;

    setSaving(true);
    try {
      await apiPost('/payments', form);
      showSuccess('Payment recorded successfully');
      resetForm();
      loadRecentPayments();
    } catch { showError('Failed to record payment'); }
    setSaving(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>All Type Payment</h1>
      </div>

      <div className="card-container">
        <h3 style={{ marginBottom: 16 }}>Payment Entry</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Category *</label>
            <select value={form.category} onChange={e => updateField('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>
              Party *
              {loadingParties && <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.6 }}>Loading...</span>}
            </label>
            <SearchableDropdown items={partyItems} value={form.party_id} onChange={v => updateField('party_id', v)} placeholder="Select party..." />
            {dueAmount !== null && (
              <small style={{ color: dueAmount > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600, marginTop: 4, display: 'block' }}>
                Due: ₹{dueAmount.toLocaleString('en-IN')}
              </small>
            )}
          </div>
          <div className="form-group">
            <label>Site / Project *</label>
            <SearchableDropdown items={siteItems} value={form.site_id} onChange={v => updateField('site_id', v)} placeholder="Select site..." />
          </div>
          <div className="form-group">
            <label>Date *</label>
            <input type="date" value={form.date} onChange={e => updateField('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Payment Mode *</label>
            <SearchableDropdown items={modeItems} value={form.payment_mode_id} onChange={v => updateField('payment_mode_id', v)} placeholder="Select mode..." />
          </div>
          <div className="form-group">
            <label>Bank</label>
            <SearchableDropdown items={bankItems} value={form.bank_id} onChange={v => updateField('bank_id', v)} placeholder="Select bank..." />
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: 16 }}>
          <div className="form-group">
            <label>Gross Amount *</label>
            <input type="number" min={0} value={form.gross_amount || ''} onChange={e => updateField('gross_amount', +e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label>TDS %</label>
            <input type="number" min={0} max={100} step={0.1} value={form.tds_percentage || ''} onChange={e => updateField('tds_percentage', +e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label>TDS Amount</label>
            <input type="number" value={form.tds_amount} readOnly className={styles.readonlyField} />
          </div>
          <div className="form-group">
            <label>Net Amount</label>
            <input type="number" value={form.net_amount} readOnly className={styles.readonlyField} style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)' }} />
          </div>
          <div className="form-group">
            <label>Reference / Cheque No</label>
            <input type="text" value={form.reference_number} onChange={e => updateField('reference_number', e.target.value)} placeholder="Ref number" />
          </div>
          <div className="form-group">
            <label>Remarks</label>
            <input type="text" value={form.remarks} onChange={e => updateField('remarks', e.target.value)} placeholder="Optional remarks" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Record Payment'}
          </button>
          <button className="btn-secondary" onClick={resetForm}>Reset</button>
        </div>
      </div>

      {recentPayments.length > 0 && (
        <div className="card-container" style={{ marginTop: 20 }}>
          <h3 style={{ marginBottom: 12 }}>Recent Payments</h3>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Category</th><th>Party</th><th>Site</th>
                  <th>Gross</th><th>TDS</th><th>Net</th><th>Mode</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((p, i) => (
                  <tr key={p.id ?? i}>
                    <td>{p.date}</td>
                    <td><span className="badge badge-info" style={{ fontSize: 10 }}>{p.category}</span></td>
                    <td style={{ fontWeight: 600 }}>{p.party_name ?? '-'}</td>
                    <td>{p.site_name ?? '-'}</td>
                    <td>₹{(p.gross_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--warning)' }}>₹{(p.tds_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>₹{(p.net_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td>{p.payment_mode ?? '-'}</td>
                    <td>
                      {p.status === 'cleared' ? <span className="badge badge-success">Cleared</span>
                        : p.status === 'void' ? <span className="badge badge-danger">Void</span>
                        : <span className="badge badge-warning">Pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
