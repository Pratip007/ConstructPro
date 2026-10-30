'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPut, apiDelete } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import SearchableDropdown from '@/components/SearchableDropdown';
import ModalDialog from '@/components/ModalDialog';
import SummaryCards from '@/components/SummaryCards';
import { exportToExcel, exportToPDF } from '@/lib/export-utils';
import styles from './PaymentViewPage.module.scss';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'employee', label: 'Employee' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'retailer', label: 'Retailer' },
  { value: 'supervisor_fund', label: 'Supervisor Fund' },
  { value: 'equipment', label: 'Equipment' },
];

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'cleared', label: 'Cleared' },
  { key: 'pending', label: 'Pending' },
  { key: 'void', label: 'Void' },
];

export default function PaymentViewPage() {
  const { success: showSuccess, error: showError } = useNotification();
  const { confirm } = useConfirmDialog();

  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [editModal, setEditModal] = useState(false);
  const [editPayment, setEditPayment] = useState<any>(null);
  const [editRemarks, setEditRemarks] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const siteItems = useMemo(() =>
    [{ value: '', label: 'All Sites' }, ...sites.map(s => ({ value: s.id, label: s.name }))], [sites]);

  const filtered = useMemo(() => {
    let list = payments;
    if (activeTab !== 'all') list = list.filter(p => p.status === activeTab);
    const q = searchQuery.toLowerCase();
    if (q) list = list.filter(p =>
      (p.party_name ?? '').toLowerCase().includes(q) ||
      (p.reference_number ?? '').toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q)
    );
    return list;
  }, [payments, activeTab, searchQuery]);

  const totalGross = useMemo(() => filtered.reduce((s, p) => s + (p.gross_amount ?? 0), 0), [filtered]);
  const totalTds = useMemo(() => filtered.reduce((s, p) => s + (p.tds_amount ?? 0), 0), [filtered]);
  const totalNet = useMemo(() => filtered.reduce((s, p) => s + (p.net_amount ?? 0), 0), [filtered]);

  const tabCounts = useMemo(() => ({
    all: payments.length,
    cleared: payments.filter(p => p.status === 'cleared').length,
    pending: payments.filter(p => p.status === 'pending').length,
    void: payments.filter(p => p.status === 'void').length,
  }), [payments]);

  const summaryCards = useMemo(() => [
    { title: 'Total Payments', value: filtered.length, color: 'primary' as const, icon: 'ri-bank-card-line' },
    { title: 'Gross Amount', value: totalGross, color: 'info' as const, prefix: '₹', icon: 'ri-money-rupee-circle-line' },
    { title: 'TDS Deducted', value: totalTds, color: 'warning' as const, prefix: '₹', icon: 'ri-percent-line' },
    { title: 'Net Paid', value: totalNet, color: 'success' as const, prefix: '₹', icon: 'ri-checkbox-circle-line' },
  ], [filtered, totalGross, totalTds, totalNet]);

  useEffect(() => {
    apiGet<any[]>('/sites').then(setSites).catch(() => {});
  }, []);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedCategory) params.category = selectedCategory;
      if (selectedSiteId) params.site_id = selectedSiteId;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const data = await apiGet<any[]>('/payments', params);
      setPayments(data);
    } catch { showError('Failed to load payments'); }
    setLoading(false);
  }, [selectedCategory, selectedSiteId, dateFrom, dateTo, showError]);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  const openEdit = (p: any) => {
    setEditPayment(p);
    setEditRemarks(p.remarks ?? '');
    setEditStatus(p.status ?? 'pending');
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editPayment) return;
    try {
      await apiPut(`/payments/${editPayment.id}`, { remarks: editRemarks, status: editStatus });
      showSuccess('Payment updated');
      setEditModal(false);
      loadPayments();
    } catch { showError('Failed to update payment'); }
  };

  const voidPayment = async (p: any) => {
    const ok = await confirm('Void Payment', `Void payment of ₹${(p.net_amount ?? 0).toLocaleString('en-IN')} to ${p.party_name}? This cannot be undone.`);
    if (!ok) return;
    try {
      await apiDelete(`/payments/${p.id}`);
      showSuccess('Payment voided');
      loadPayments();
    } catch { showError('Failed to void payment'); }
  };

  const exportExcel = () => {
    exportToExcel(filtered as any[], 'Payments', 'Payment View', [
      { key: 'date', header: 'Date' }, { key: 'category', header: 'Category' },
      { key: 'party_name', header: 'Party' }, { key: 'site_name', header: 'Site' },
      { key: 'gross_amount', header: 'Gross' }, { key: 'tds_amount', header: 'TDS' },
      { key: 'net_amount', header: 'Net' }, { key: 'payment_mode', header: 'Mode' },
      { key: 'reference_number', header: 'Ref No' }, { key: 'status', header: 'Status' },
    ]);
  };

  const exportPdf = () => {
    exportToPDF({
      title: 'Payment Report', fileName: 'Payment_Report',
      columns: [
        { key: 'date', header: 'Date' }, { key: 'party_name', header: 'Party' },
        { key: 'gross_amount', header: 'Gross' }, { key: 'tds_amount', header: 'TDS' },
        { key: 'net_amount', header: 'Net' }, { key: 'status', header: 'Status' },
      ],
      data: filtered as any[],
      summaryRow: { party_name: 'TOTAL', gross_amount: totalGross, tds_amount: totalTds, net_amount: totalNet },
    });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Payment View</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-export" onClick={exportExcel}><i className="ri-file-excel-2-line" /> Excel</button>
          <button className="btn-primary" onClick={exportPdf}><i className="ri-file-pdf-line" /> PDF</button>
        </div>
      </div>

      <div className="card-container">
        <div className="form-grid">
          <div className="form-group">
            <label>Category</label>
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Site</label>
            <SearchableDropdown items={siteItems} value={selectedSiteId} onChange={setSelectedSiteId} placeholder="All Sites" />
          </div>
          <div className="form-group">
            <label>Date From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Date To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Search</label>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Party, ref no..." />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}><SummaryCards cards={summaryCards} /></div>

      <div className={styles.tabs}>
        {STATUS_TABS.map(t => (
          <button key={t.key} className={`${styles.tab} ${activeTab === t.key ? styles.active : ''}`} onClick={() => setActiveTab(t.key)}>
            {t.label} <span className={styles.count}>{tabCounts[t.key as keyof typeof tabCounts]}</span>
          </button>
        ))}
      </div>

      {loading ? <div className="skeleton" style={{ height: 300, marginTop: 20 }} /> : (
        <div className="card-container" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Date</th><th>Category</th><th>Party</th><th>Site</th>
                  <th>Gross</th><th>TDS</th><th>Net</th><th>Mode</th><th>Ref No</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={12} className="empty-state">No payments found.</td></tr>
                ) : filtered.map((p, i) => (
                  <tr key={p.id ?? i}>
                    <td>{i + 1}</td>
                    <td>{p.date}</td>
                    <td><span className="badge badge-info" style={{ fontSize: 10 }}>{p.category}</span></td>
                    <td style={{ fontWeight: 600 }}>{p.party_name ?? '-'}</td>
                    <td>{p.site_name ?? '-'}</td>
                    <td>₹{(p.gross_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--warning)' }}>₹{(p.tds_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>₹{(p.net_amount ?? 0).toLocaleString('en-IN')}</td>
                    <td>{p.payment_mode ?? '-'}</td>
                    <td style={{ color: 'var(--accent)' }}>{p.reference_number || '-'}</td>
                    <td>
                      {p.status === 'cleared' ? <span className="badge badge-success">Cleared</span>
                        : p.status === 'void' ? <span className="badge badge-danger">Void</span>
                        : <span className="badge badge-warning">Pending</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-icon" onClick={() => openEdit(p)} title="Edit"><i className="ri-pencil-line" /></button>
                        {p.status !== 'void' && (
                          <button className="btn-icon btn-icon-danger" onClick={() => voidPayment(p)} title="Void"><i className="ri-close-circle-line" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700, background: 'var(--glass-bg)' }}>
                    <td colSpan={5} style={{ textAlign: 'right' }}>TOTAL:</td>
                    <td>₹{totalGross.toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--warning)' }}>₹{totalTds.toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--accent)' }}>₹{totalNet.toLocaleString('en-IN')}</td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {editModal && editPayment && (
        <ModalDialog title="Edit Payment" onClose={() => setEditModal(false)} onConfirm={saveEdit} confirmText="Save Changes">
          <div className="form-group">
            <label>Party</label>
            <input type="text" value={editPayment.party_name ?? ''} readOnly />
          </div>
          <div className="form-group">
            <label>Amount</label>
            <input type="text" value={`₹${(editPayment.net_amount ?? 0).toLocaleString('en-IN')}`} readOnly />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={editStatus} onChange={e => setEditStatus(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="cleared">Cleared</option>
            </select>
          </div>
          <div className="form-group">
            <label>Remarks</label>
            <textarea rows={3} value={editRemarks} onChange={e => setEditRemarks(e.target.value)} placeholder="Add remarks..." />
          </div>
        </ModalDialog>
      )}
    </div>
  );
}
