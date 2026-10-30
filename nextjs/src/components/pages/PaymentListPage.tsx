'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useAuth } from '@/contexts/AuthContext';
import { isSiteLocked, getSupervisorSiteId } from '@/lib/role-utils';
import { exportToExcel, exportMultiSheetExcel, exportToPDF, printReport } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import styles from './PaymentListPage.module.scss';

interface ApiPaymentRecord {
  id: number;
  employee_id?: string;
  employee_name?: string;
  site_id?: string;
  site_name?: string;
  days_worked?: number;
  rate?: number;
  amount?: number;
  gross_amount?: number;
  tds_amount?: number;
  net_amount?: number;
  total_amount?: number;
  final_payment?: number;
  status?: string;
  category?: string;
  bank_name?: string;
  account_no?: string;
  ifsc?: string;
  payment_date?: string;
}

interface PaymentRecord {
  id: number;
  employeeId: string;
  employee: string;
  site: string;
  daysWorked: number;
  rate: number;
  grossAmount: number;
  tdsAmount: number;
  netAmount: number;
  finalPayment: number;
  bankName: string;
  accountNo: string;
  ifsc: string;
  status: string;
}

function mapPayment(p: ApiPaymentRecord): PaymentRecord {
  const gross = p.gross_amount ?? p.total_amount ?? p.amount ?? 0;
  const tds = p.tds_amount ?? 0;
  const net = p.net_amount ?? (gross - tds);
  return {
    id: p.id,
    employeeId: p.employee_id ?? '',
    employee: p.employee_name ?? p.employee_id ?? '',
    site: p.site_name ?? p.site_id ?? '',
    daysWorked: p.days_worked ?? 0,
    rate: p.rate ?? 0,
    grossAmount: gross,
    tdsAmount: tds,
    netAmount: net,
    finalPayment: p.final_payment ?? net,
    bankName: p.bank_name ?? '',
    accountNo: p.account_no ?? '',
    ifsc: p.ifsc ?? '',
    status: p.status ?? 'draft',
  };
}

interface DropdownItem {
  value: string;
  label: string;
}

const COLUMN_KEYS = [
  'daysWorked', 'rate', 'grossAmount', 'tdsAmount', 'netAmount',
  'finalPayment', 'bankName', 'accountNo', 'ifsc', 'status',
] as const;

const COLUMN_LABELS: Record<string, string> = {
  daysWorked: 'Days Worked',
  rate: 'Rate',
  grossAmount: 'Gross Amount',
  tdsAmount: 'TDS',
  netAmount: 'Net Amount',
  finalPayment: 'Final Payment',
  bankName: 'Bank Name',
  accountNo: 'Account No',
  ifsc: 'IFSC',
  status: 'Status',
};

export default function PaymentListPage() {
  const { success, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const { currentUser } = useAuth();

  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedSite, setSelectedSite] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [listGenerated, setListGenerated] = useState(false);

  const [siteDropdownItems, setSiteDropdownItems] = useState<DropdownItem[]>([]);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    daysWorked: true,
    rate: true,
    grossAmount: true,
    tdsAmount: true,
    netAmount: true,
    finalPayment: true,
    bankName: false,
    accountNo: false,
    ifsc: false,
    status: true,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const totalGross = useMemo(() => payments.reduce((sum, p) => sum + p.grossAmount, 0), [payments]);
  const totalTds = useMemo(() => payments.reduce((sum, p) => sum + p.tdsAmount, 0), [payments]);
  const totalNet = useMemo(() => payments.reduce((sum, p) => sum + p.netAmount, 0), [payments]);
  const totalFinalPayment = useMemo(() => payments.reduce((sum, p) => sum + p.finalPayment, 0), [payments]);

  const summaryCards = useMemo(() => [
    { title: 'Total Gross', value: totalGross, icon: 'ri-money-rupee-circle-line', color: 'primary' as const, prefix: '₹' },
    { title: 'Total TDS', value: totalTds, icon: 'ri-subtract-line', color: 'danger' as const, prefix: '₹' },
    { title: 'Total Net', value: totalNet, icon: 'ri-hand-coin-line', color: 'info' as const, prefix: '₹' },
    { title: 'Final Payment', value: totalFinalPayment, icon: 'ri-wallet-3-line', color: 'success' as const, prefix: '₹' },
  ], [totalGross, totalTds, totalNet, totalFinalPayment]);

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    setPaymentDate(now.toISOString().split('T')[0]);

    (async () => {
      try {
        const sites = await apiGet<{ id: string | number; name: string }[]>('/sites');
        setSiteDropdownItems(sites.map(s => ({ value: String(s.id), label: s.name })));
        if (isSiteLocked(currentUser)) {
          const lockedSite = getSupervisorSiteId(currentUser);
          if (lockedSite) setSelectedSite(String(lockedSite));
        }
      } catch (err: any) {
        notifyError(err.message ?? 'Failed to load sites');
      }
    })();
  }, [currentUser, notifyError]);

  const isColumnVisible = (col: string) => visibleColumns[col] ?? true;

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  const generateList = async () => {
    if (!selectedMonth) {
      notifyError('Select a month');
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = { month: selectedMonth, category: 'employee' };
      if (selectedSite) params.site_id = selectedSite;
      const data = await apiGet<ApiPaymentRecord[]>('/payments/generate', params);
      setPayments(data.map(mapPayment));
      setListGenerated(true);
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to generate payment list');
    }
    setLoading(false);
  };

  const updateFinalPayment = (id: number, value: number) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, finalPayment: value } : p));
  };

  const submitPayments = async () => {
    if (!paymentDate) {
      notifyError('Select a payment date');
      return;
    }
    const confirmed = await confirm({
      title: 'Submit Payments',
      message: `Submit payments for ${payments.length} employees? This will mark them as submitted.`,
      type: 'info',
    });
    if (!confirmed) return;
    const body = {
      month: selectedMonth,
      site_id: selectedSite || null,
      payment_date: paymentDate,
      payments: payments.map(p => ({
        id: p.id,
        employee_id: p.employeeId,
        final_payment: p.finalPayment,
      })),
    };
    try {
      await apiPost('/payments/submit', body);
      success('Payments submitted successfully');
      setPayments(prev => prev.map(p => ({ ...p, status: 'submitted' })));
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to submit payments');
    }
  };

  const holdPayments = async () => {
    const confirmed = await confirm({
      title: 'Hold Payments',
      message: 'Put all payments on hold?',
      type: 'warning',
    });
    if (!confirmed) return;
    const body = {
      month: selectedMonth,
      site_id: selectedSite || null,
      payment_ids: payments.map(p => p.id),
    };
    try {
      await apiPost('/payments/hold', body);
      success('Payments put on hold');
      setPayments(prev => prev.map(p => ({ ...p, status: 'on_hold' })));
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to hold payments');
    }
  };

  const handleExportExcel = () => {
    const paymentSheet = payments.map(p => ({
      Employee: p.employee,
      Site: p.site,
      'Days Worked': p.daysWorked,
      Rate: p.rate,
      'Gross Amount': p.grossAmount,
      TDS: p.tdsAmount,
      'Net Amount': p.netAmount,
      'Final Payment': p.finalPayment,
      Status: p.status,
    }));
    const bankSheet = payments.filter(p => p.bankName).map(p => ({
      Employee: p.employee,
      'Bank Name': p.bankName,
      'Account No': p.accountNo,
      IFSC: p.ifsc,
      Amount: p.finalPayment,
    }));
    exportMultiSheetExcel(
      [
        { name: 'Payment Details', data: paymentSheet as unknown as Record<string, unknown>[] },
        { name: 'Bank Details', data: bankSheet as unknown as Record<string, unknown>[] },
      ],
      `Payment_List_${selectedMonth}`
    );
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: `Payment List - ${selectedMonth}`,
      fileName: `Payment_List_${selectedMonth}`,
      companyName: 'ATR Construction Pvt. Ltd.',
      data: payments as unknown as Record<string, unknown>[],
      columns: [
        { key: 'employee', header: 'Employee' },
        { key: 'daysWorked', header: 'Days' },
        { key: 'grossAmount', header: 'Gross (Rs.)' },
        { key: 'tdsAmount', header: 'TDS (Rs.)' },
        { key: 'netAmount', header: 'Net (Rs.)' },
        { key: 'finalPayment', header: 'Final (Rs.)' },
      ],
    });
  };

  const handlePrint = () => {
    printReport(`Payment List - ${selectedMonth}`, 'payment-table');
  };

  const formatNum = (n: number) => n.toLocaleString('en-IN');

  const statusBadgeClass = (status: string) => {
    if (status === 'draft') return 'badge badge-info';
    if (status === 'submitted' || status === 'cleared') return 'badge badge-success';
    if (status === 'on_hold') return 'badge badge-warning';
    if (status === 'pending') return 'badge badge-danger';
    return 'badge';
  };

  // Count visible columns for colspan
  const visibleColCount = 3 + COLUMN_KEYS.filter(c => isColumnVisible(c)).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-money-rupee-circle-line" /> Payment List</h1>
      </div>

      <div className={styles.filterSection}>
        <div className="form-group">
          <label className={styles.filterLabel}>Payment Month</label>
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            className={styles.filterInput} />
        </div>
        <SearchableDropdown
          items={siteDropdownItems}
          placeholder="All Sites"
          label="Site"
          disabled={isSiteLocked(currentUser)}
          value={selectedSite}
          onChange={setSelectedSite}
        />
        <div className={styles.filterActions}>
          <button className="btn-primary" onClick={generateList} disabled={loading}>
            <i className="ri-list-check" /> Generate List
          </button>
        </div>
      </div>

      {listGenerated && (
        <>
          <SummaryCards cards={summaryCards} />

          <div className={styles.actionBar}>
            <div className={styles.actionLeft}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className={styles.filterLabel}>Payment Date</label>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                  className={styles.filterInput} />
              </div>
              <button className="btn-primary" onClick={submitPayments} disabled={!payments.length}>
                <i className="ri-check-double-line" /> Submit Payment
              </button>
              <button className={styles.btnWarning} onClick={holdPayments} disabled={!payments.length}>
                <i className="ri-pause-circle-line" /> Put on Hold
              </button>
            </div>
            <div className={styles.actionRight}>
              <div className={styles.columnToggle}>
                <button className="btn-outline" onClick={() => setShowColumnMenu(prev => !prev)}>
                  <i className="ri-layout-column-line" /> Columns
                </button>
                {showColumnMenu && (
                  <div className={styles.dropdownMenu}>
                    {COLUMN_KEYS.map(col => (
                      <label key={col} className={styles.dropdownCheck}>
                        <input type="checkbox" checked={isColumnVisible(col)} onChange={() => toggleColumn(col)} />
                        {COLUMN_LABELS[col]}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn-outline" onClick={handleExportExcel}>
                <i className="ri-file-excel-line" /> Excel
              </button>
              <button className="btn-outline" onClick={handleExportPDF}>
                <i className="ri-file-pdf-line" /> PDF
              </button>
              <button className="btn-outline" onClick={handlePrint}>
                <i className="ri-printer-line" /> Print
              </button>
            </div>
          </div>

          {loading && <p className="loading-text">Loading payment data...</p>}

          <div className="table-responsive" id="payment-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Employee</th>
                  <th>Site</th>
                  {isColumnVisible('daysWorked') && <th style={{ textAlign: 'right' }}>Days</th>}
                  {isColumnVisible('rate') && <th style={{ textAlign: 'right' }}>Rate</th>}
                  {isColumnVisible('grossAmount') && <th style={{ textAlign: 'right' }}>Gross (Rs.)</th>}
                  {isColumnVisible('tdsAmount') && <th style={{ textAlign: 'right' }}>TDS (Rs.)</th>}
                  {isColumnVisible('netAmount') && <th style={{ textAlign: 'right' }}>Net (Rs.)</th>}
                  {isColumnVisible('finalPayment') && <th style={{ textAlign: 'right' }}>Final Payment (Rs.)</th>}
                  {isColumnVisible('bankName') && <th>Bank</th>}
                  {isColumnVisible('accountNo') && <th>Account No</th>}
                  {isColumnVisible('ifsc') && <th>IFSC</th>}
                  {isColumnVisible('status') && <th>Status</th>}
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={visibleColCount} className="empty-state">No payment records. Generate a list for the selected month.</td></tr>
                ) : payments.map((pay, i) => (
                  <tr key={pay.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{pay.employee}</td>
                    <td>{pay.site}</td>
                    {isColumnVisible('daysWorked') && <td style={{ textAlign: 'right' }}>{pay.daysWorked}</td>}
                    {isColumnVisible('rate') && <td style={{ textAlign: 'right' }}>{formatNum(pay.rate)}</td>}
                    {isColumnVisible('grossAmount') && <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatNum(pay.grossAmount)}</td>}
                    {isColumnVisible('tdsAmount') && <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{formatNum(pay.tdsAmount)}</td>}
                    {isColumnVisible('netAmount') && <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatNum(pay.netAmount)}</td>}
                    {isColumnVisible('finalPayment') && (
                      <td style={{ textAlign: 'right' }}>
                        <input type="number" className={styles.compactInput}
                          style={{ fontWeight: 700, color: 'var(--accent)' }}
                          value={pay.finalPayment}
                          onChange={(e) => updateFinalPayment(pay.id, Number(e.target.value))}
                          min={0} />
                      </td>
                    )}
                    {isColumnVisible('bankName') && <td>{pay.bankName}</td>}
                    {isColumnVisible('accountNo') && <td>{pay.accountNo}</td>}
                    {isColumnVisible('ifsc') && <td>{pay.ifsc}</td>}
                    {isColumnVisible('status') && (
                      <td>
                        <span className={statusBadgeClass(pay.status)}>{pay.status}</span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {payments.length > 0 && (
                <tfoot>
                  <tr className="summary-footer">
                    <td colSpan={3} style={{ fontWeight: 700 }}>Totals ({payments.length} employees)</td>
                    {isColumnVisible('daysWorked') && <td />}
                    {isColumnVisible('rate') && <td />}
                    {isColumnVisible('grossAmount') && <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatNum(totalGross)}</td>}
                    {isColumnVisible('tdsAmount') && <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>{formatNum(totalTds)}</td>}
                    {isColumnVisible('netAmount') && <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatNum(totalNet)}</td>}
                    {isColumnVisible('finalPayment') && <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{formatNum(totalFinalPayment)}</td>}
                    {isColumnVisible('bankName') && <td />}
                    {isColumnVisible('accountNo') && <td />}
                    {isColumnVisible('ifsc') && <td />}
                    {isColumnVisible('status') && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
