'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiGet } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { isSiteLocked, getSupervisorSiteId } from '@/lib/role-utils';
import { exportToExcel, exportToPDF, printReport } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import styles from './EmployeeLedgerPage.module.scss';

interface ApiLedgerEntry {
  date?: string;
  description?: string;
  particulars?: string;
  debit?: number;
  credit?: number;
  amount?: number;
  type?: string;
  balance?: number;
  running_balance?: number;
  month?: string;
  sub_id?: string;
  present_days?: number;
  rate?: number;
}

interface LedgerEntry {
  date: string;
  month: string;
  subId: string;
  presentDays: number;
  rate: number;
  particulars: string;
  grossAmount: number;
  tdsDeduction: number;
  netAmount: number;
  payment: number;
  dueBalance: number;
  debit: number;
  credit: number;
  balance: number;
}

function mapLedgerEntry(e: ApiLedgerEntry): LedgerEntry {
  const isDebit = e.type === 'debit' || (e.debit ?? 0) > 0;
  const amount = e.debit ?? e.credit ?? e.amount ?? 0;
  const debit = e.debit ?? (isDebit ? amount : 0);
  const credit = e.credit ?? (!isDebit ? amount : 0);
  return {
    date: e.date ?? '',
    month: e.month ?? (e.date ? e.date.substring(0, 7) : ''),
    subId: e.sub_id ?? '',
    presentDays: e.present_days ?? 0,
    rate: e.rate ?? 0,
    particulars: e.particulars ?? e.description ?? '',
    grossAmount: debit,
    tdsDeduction: 0,
    netAmount: debit,
    payment: credit,
    dueBalance: e.running_balance ?? e.balance ?? 0,
    debit,
    credit,
    balance: e.running_balance ?? e.balance ?? 0,
  };
}

function formatNum(n: number): string {
  return n.toLocaleString('en-IN');
}

export default function EmployeeLedgerPage() {
  const { success, error: notifyError } = useNotification();
  const { currentUser } = useAuth();

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [employeeItems, setEmployeeItems] = useState<{ value: string; label: string }[]>([]);
  const [siteItems, setSiteItems] = useState<{ value: string; label: string }[]>([]);
  const selectedEmployeeNameRef = useRef('');

  const totalGross = useMemo(() => entries.reduce((sum, e) => sum + e.grossAmount, 0), [entries]);
  const totalTds = useMemo(() => entries.reduce((sum, e) => sum + e.tdsDeduction, 0), [entries]);
  const totalNet = useMemo(() => entries.reduce((sum, e) => sum + e.netAmount, 0), [entries]);
  const totalPayment = useMemo(() => entries.reduce((sum, e) => sum + e.payment, 0), [entries]);
  const netBalance = useMemo(() => totalGross - totalPayment, [totalGross, totalPayment]);

  const summaryCards = useMemo(
    () => [
      {
        title: 'Total Earned',
        value: totalGross,
        icon: 'ri-money-rupee-circle-line',
        color: 'success' as const,
        prefix: '₹',
      },
      {
        title: 'Total Payments',
        value: totalPayment,
        icon: 'ri-hand-coin-line',
        color: 'info' as const,
        prefix: '₹',
      },
      {
        title: 'Net Due Balance',
        value: Math.abs(netBalance),
        icon: 'ri-scales-3-line',
        color: (netBalance > 0 ? 'danger' : 'success') as 'danger' | 'success',
        prefix: '₹',
      },
    ],
    [totalGross, totalPayment, netBalance]
  );

  useEffect(() => {
    apiGet<{ id: string | number; name: string }[]>('/employees')
      .then((emps) =>
        setEmployeeItems(emps.map((e) => ({ value: String(e.id), label: e.name })))
      )
      .catch((err: any) => notifyError(err.message ?? 'Failed to load employees'));

    apiGet<{ id: string | number; name: string }[]>('/sites')
      .then((sites) =>
        setSiteItems(sites.map((s) => ({ value: String(s.id), label: s.name })))
      )
      .catch((err: any) => notifyError(err.message ?? 'Failed to load sites'));
  }, [notifyError]);

  const loadLedger = useCallback(
    async (empId?: string) => {
      const id = empId ?? selectedEmployee;
      if (!id) return;
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        if (dateFrom) params.from = dateFrom;
        if (dateTo) params.to = dateTo;
        if (siteFilter) params.site_id = siteFilter;
        const data = await apiGet<ApiLedgerEntry[]>(`/employee-ledger/${id}`, params);
        setEntries(data.map(mapLedgerEntry));
      } catch (err: any) {
        notifyError(err.message ?? 'Failed to load ledger');
      }
      setLoading(false);
    },
    [selectedEmployee, dateFrom, dateTo, siteFilter, notifyError]
  );

  const onEmployeeChange = (empId: string) => {
    setSelectedEmployee(empId);
    const emp = employeeItems.find((e) => e.value === empId);
    selectedEmployeeNameRef.current = emp?.label ?? '';
    if (empId) loadLedger(empId);
    else setEntries([]);
  };

  const handleExportExcel = () => {
    exportToExcel(
      [
        { header: 'Date', key: 'Date' },
        { header: 'Particulars', key: 'Particulars' },
        { header: 'Gross Amount', key: 'Gross Amount', format: 'currency' },
        { header: 'TDS Deduction', key: 'TDS Deduction', format: 'currency' },
        { header: 'Net Amount', key: 'Net Amount', format: 'currency' },
        { header: 'Payment', key: 'Payment', format: 'currency' },
        { header: 'Due Balance', key: 'Due Balance', format: 'currency' },
      ],
      entries.map((e) => ({
        Date: e.date,
        Particulars: e.particulars,
        'Gross Amount': e.grossAmount,
        'TDS Deduction': e.tdsDeduction,
        'Net Amount': e.netAmount,
        Payment: e.payment,
        'Due Balance': e.dueBalance,
      })),
      `Employee_Ledger_${selectedEmployeeNameRef.current}`
    );
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: `Employee Ledger - ${selectedEmployeeNameRef.current}`,
      fileName: `Ledger_${selectedEmployeeNameRef.current}`,
      companyName: 'ATR Construction Pvt. Ltd.',
      data: entries.map((e) => ({
        date: e.date,
        particulars: e.particulars,
        grossAmount: e.grossAmount,
        payment: e.payment,
        dueBalance: e.dueBalance,
      })),
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'particulars', header: 'Particulars' },
        { key: 'grossAmount', header: 'Gross (Rs.)' },
        { key: 'payment', header: 'Payment (Rs.)' },
        { key: 'dueBalance', header: 'Due (Rs.)' },
      ],
      summary: [
        {
          date: '',
          particulars: 'TOTAL',
          grossAmount: totalGross,
          payment: totalPayment,
          dueBalance: netBalance,
        },
      ],
    });
  };

  const handlePrint = () => {
    const tableEl = document.getElementById('ledger-table');
    if (tableEl) {
      printReport(`Employee Ledger - ${selectedEmployeeNameRef.current}`, tableEl.outerHTML);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <i className="ri-book-open-line" /> Employee Full Ledger
        </h1>
      </div>

      <div className={styles.filterBar}>
        <SearchableDropdown
          items={employeeItems}
          value={selectedEmployee}
          onChange={onEmployeeChange}
          placeholder="Select Employee"
          label="Employee"
        />
        <SearchableDropdown
          items={siteItems}
          value={siteFilter}
          onChange={setSiteFilter}
          placeholder="All Sites"
          label="Site Filter"
        />
        <div className="form-group">
          <label className={styles.filterLabel}>From Date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={styles.filterInput}
          />
        </div>
        <div className="form-group">
          <label className={styles.filterLabel}>To Date</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={styles.filterInput}
          />
        </div>
        <div className={styles.filterActions}>
          <button
            className="btn-secondary"
            onClick={() => loadLedger()}
            disabled={!selectedEmployee || loading}
          >
            <i className="ri-search-line" /> Filter
          </button>
          <button className="btn-outline" onClick={handleExportExcel} disabled={!entries.length}>
            <i className="ri-file-excel-line" /> Excel
          </button>
          <button className="btn-outline" onClick={handleExportPDF} disabled={!entries.length}>
            <i className="ri-file-pdf-line" /> PDF
          </button>
          <button className="btn-outline" onClick={handlePrint} disabled={!entries.length}>
            <i className="ri-printer-line" /> Print
          </button>
        </div>
      </div>

      {selectedEmployee && <SummaryCards cards={summaryCards} />}

      {loading && <p className="loading-text">Loading ledger...</p>}

      <div className="table-responsive" id="ledger-table">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Particulars</th>
              <th style={{ textAlign: 'right' }}>Gross Amount (Rs.)</th>
              <th style={{ textAlign: 'right' }}>TDS Deduction (Rs.)</th>
              <th style={{ textAlign: 'right' }}>Net Amount (Rs.)</th>
              <th style={{ textAlign: 'right' }}>Payment (Rs.)</th>
              <th style={{ textAlign: 'right' }}>Due Balance (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-state">
                  {selectedEmployee
                    ? 'No ledger entries found.'
                    : 'Select an employee to view ledger.'}
                </td>
              </tr>
            ) : (
              entries.map((entry, idx) => (
                <tr key={`${entry.date}-${entry.particulars}-${idx}`}>
                  <td>{entry.date}</td>
                  <td style={{ fontWeight: 600 }}>{entry.particulars}</td>
                  <td style={{ fontWeight: 700, textAlign: 'right' }}>
                    {formatNum(entry.grossAmount)}
                  </td>
                  <td style={{ color: 'var(--danger)', textAlign: 'right' }}>
                    {formatNum(entry.tdsDeduction)}
                  </td>
                  <td style={{ fontWeight: 700, textAlign: 'right' }}>
                    {formatNum(entry.netAmount)}
                  </td>
                  <td style={{ color: 'var(--success)', fontWeight: 700, textAlign: 'right' }}>
                    {formatNum(entry.payment)}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--accent)', textAlign: 'right' }}>
                    {formatNum(entry.dueBalance)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr className="summary-footer">
                <td colSpan={2} style={{ fontWeight: 700 }}>
                  Totals
                </td>
                <td style={{ fontWeight: 700, textAlign: 'right' }}>{formatNum(totalGross)}</td>
                <td style={{ fontWeight: 700, color: 'var(--danger)', textAlign: 'right' }}>
                  {formatNum(totalTds)}
                </td>
                <td style={{ fontWeight: 700, textAlign: 'right' }}>{formatNum(totalNet)}</td>
                <td style={{ fontWeight: 700, color: 'var(--success)', textAlign: 'right' }}>
                  {formatNum(totalPayment)}
                </td>
                <td style={{ fontWeight: 700, color: 'var(--accent)', textAlign: 'right' }}>
                  {formatNum(netBalance)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
