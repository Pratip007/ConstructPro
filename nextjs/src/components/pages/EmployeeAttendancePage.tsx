'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { isSiteLocked, getSupervisorSiteId } from '@/lib/role-utils';
import { exportToExcel, printReport } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import SummaryCards from '@/components/SummaryCards';
import styles from './EmployeeAttendancePage.module.scss';

interface ApiAttendanceRecord {
  id?: number;
  employee_id?: string;
  employee_name?: string;
  sub_id?: string;
  site_id?: string;
  month?: string;
  present_days?: number;
  ot_hours?: number;
  salary_basis?: string;
  base_daily_wage?: number;
  present_wage?: number;
  ot_rate_per_hr?: number;
  ot_amount?: number;
  total_amount?: number;
}

interface AttendanceRecord {
  id?: number;
  empId: string;
  name: string;
  subId: string;
  siteId: string;
  month: string;
  presentDays: number;
  otHours: number;
  salaryBasis: string;
  baseDailyWage: number;
  presentWage: number;
  otRatePerHr: number;
  otAmount: number;
  totalAmount: number;
}

interface DropdownItem {
  value: string;
  label: string;
}

function computeWages(rec: AttendanceRecord): AttendanceRecord {
  const presentWage = rec.baseDailyWage * rec.presentDays;
  let otRatePerHr = 0;
  let otAmount = 0;
  if (rec.salaryBasis === 'daily' && rec.otHours > 0) {
    otRatePerHr = rec.baseDailyWage / 8;
    otAmount = otRatePerHr * rec.otHours;
  }
  return { ...rec, presentWage, otRatePerHr, otAmount, totalAmount: presentWage + otAmount };
}

export default function EmployeeAttendancePage() {
  const { success, error: notifyError } = useNotification();
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attendanceDate, setAttendanceDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [siteFilter, setSiteFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const [siteDropdownItems, setSiteDropdownItems] = useState<DropdownItem[]>([]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return records;
    return records.filter(r =>
      r.name.toLowerCase().includes(q) || r.empId.toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const totalAttendanceCount = useMemo(() => records.reduce((sum, r) => sum + r.presentDays, 0), [records]);
  const totalWageAmount = useMemo(() => records.reduce((sum, r) => sum + r.totalAmount, 0), [records]);
  const totalOtHours = useMemo(() => records.reduce((sum, r) => sum + r.otHours, 0), [records]);

  const summaryCards = useMemo(() => [
    { title: 'Total Present Days', value: totalAttendanceCount, icon: 'ri-calendar-check-line', color: 'success' as const },
    { title: 'Total OT Hours', value: totalOtHours, icon: 'ri-time-line', color: 'info' as const },
    { title: 'Total Wage Amount', value: totalWageAmount, icon: 'ri-money-rupee-circle-line', color: 'primary' as const, prefix: '₹' },
    { title: 'Employees', value: records.length, icon: 'ri-team-line', color: 'warning' as const },
  ], [totalAttendanceCount, totalOtHours, totalWageAmount, records.length]);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (siteFilter) params.site_id = siteFilter;
      if (attendanceDate) params.month = attendanceDate;
      const recs = await apiGet<ApiAttendanceRecord[]>('/attendance', params);
      setRecords(
        recs.map(r => computeWages({
          id: r.id,
          empId: r.employee_id ?? '',
          name: r.employee_name ?? r.employee_id ?? '',
          subId: r.sub_id ?? '',
          siteId: r.site_id ?? siteFilter,
          month: r.month ?? attendanceDate,
          presentDays: r.present_days ?? 0,
          otHours: r.ot_hours ?? 0,
          salaryBasis: r.salary_basis ?? 'daily',
          baseDailyWage: r.base_daily_wage ?? 0,
          presentWage: 0,
          otRatePerHr: 0,
          otAmount: 0,
          totalAmount: 0,
        }))
      );
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to load attendance');
    }
    setLoading(false);
  }, [siteFilter, attendanceDate, notifyError]);

  useEffect(() => {
    (async () => {
      try {
        const sites = await apiGet<{ id: string | number; name: string }[]>('/sites');
        setSiteDropdownItems(sites.map(s => ({ value: String(s.id), label: s.name })));
        if (isSiteLocked(currentUser)) {
          setSiteFilter(String(getSupervisorSiteId(currentUser)));
        }
      } catch (err: any) {
        notifyError(err.message ?? 'Failed to load sites');
      }
    })();
  }, [currentUser, notifyError]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const updateField = (empId: string, field: string, value: number) => {
    setRecords(prev =>
      prev.map(r => {
        if (r.empId !== empId) return r;
        return computeWages({ ...r, [field]: value });
      })
    );
  };

  const deleteRecord = (empId: string) => {
    setRecords(prev => prev.filter(r => r.empId !== empId));
    success('Record removed');
  };

  const saveAttendance = async () => {
    if (!records.length) {
      notifyError('No records to save');
      return;
    }
    setSaving(true);
    const body = records.map(r => ({
      employee_id: r.empId,
      sub_id: r.subId || null,
      site_id: r.siteId || siteFilter || null,
      month: r.month || attendanceDate,
      present_days: r.presentDays,
      ot_hours: r.otHours,
      salary_basis: r.salaryBasis,
      base_daily_wage: r.baseDailyWage,
    }));
    try {
      await apiPost('/attendance', body);
      success(`Attendance saved for ${attendanceDate}`);
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to save attendance');
    }
    setSaving(false);
  };

  const downloadTemplate = () => {
    exportToExcel(
      [
        { header: 'Employee ID', key: 'employee_id' },
        { header: 'Employee Name', key: 'employee_name' },
        { header: 'Present Days', key: 'present_days' },
        { header: 'OT Hours', key: 'ot_hours' },
        { header: 'Base Daily Wage', key: 'base_daily_wage' },
      ],
      [{ employee_id: '', employee_name: '', present_days: 0, ot_hours: 0, base_daily_wage: 0 }],
      `Attendance_Template_${attendanceDate}`
    );
  };

  const onBulkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const XLSX = (window as any)['XLSX'];
        if (!XLSX) {
          notifyError('XLSX library not loaded');
          return;
        }
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        const mapped = rows.map((r: any) => computeWages({
          empId: String(r.employee_id ?? ''),
          name: r.employee_name ?? '',
          subId: '',
          siteId: siteFilter,
          month: attendanceDate,
          presentDays: Number(r.present_days) || 0,
          otHours: Number(r.ot_hours) || 0,
          salaryBasis: 'daily',
          baseDailyWage: Number(r.base_daily_wage) || 0,
          presentWage: 0,
          otRatePerHr: 0,
          otAmount: 0,
          totalAmount: 0,
        }));
        setRecords(prev => [...prev, ...mapped]);
        success(`Imported ${mapped.length} records`);
      } catch {
        notifyError('Failed to parse file');
      }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
  };

  const handleExportData = () => {
    exportToExcel(
      [
        { header: 'Employee ID', key: 'empId' },
        { header: 'Name', key: 'name' },
        { header: 'Present Days', key: 'presentDays' },
        { header: 'Base Wage', key: 'baseDailyWage' },
        { header: 'Present Wage', key: 'presentWage' },
        { header: 'OT Hours', key: 'otHours' },
        { header: 'OT Amount', key: 'otAmount' },
        { header: 'Total', key: 'totalAmount' },
      ],
      records as unknown as Record<string, unknown>[],
      `Attendance_${attendanceDate}`
    );
  };

  const handlePrint = () => {
    printReport(`Attendance ${attendanceDate}`, 'attendance-table');
  };

  const fmt = (n: number) => n.toFixed(2);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><i className="ri-calendar-check-line" /> Employee Attendance</h1>
        <div className={styles.filterBar}>
          <input type="month" value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            className={styles.filterInput} />
          <SearchableDropdown
            items={siteDropdownItems}
            placeholder="All Sites"
            disabled={isSiteLocked(currentUser)}
            value={siteFilter}
            onChange={(val: string) => setSiteFilter(val)}
          />
          <input type="text" className={styles.filterInput} placeholder="Search employee..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <div className="action-bar" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <button className="btn-primary" onClick={saveAttendance} disabled={saving}>
          <i className="ri-save-line" /> Save Attendance
        </button>
        <button className="btn-secondary" onClick={downloadTemplate}>
          <i className="ri-download-line" /> Download Template
        </button>
        <label className="btn-secondary" style={{ cursor: 'pointer' }}>
          <i className="ri-upload-line" /> Upload CSV
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={onBulkUpload} style={{ display: 'none' }} />
        </label>
        <button className="btn-outline" onClick={handleExportData}>
          <i className="ri-file-excel-line" /> Export Excel
        </button>
        <button className="btn-outline" onClick={handlePrint}>
          <i className="ri-printer-line" /> Print
        </button>
      </div>

      {loading && <p className="loading-text">Loading attendance...</p>}

      <div className="table-responsive" id="attendance-table">
        <table>
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Present Days</th>
              <th>Base Daily Wage</th>
              <th>Present Wage</th>
              <th>OT Hours</th>
              <th>OT Rate/Hr</th>
              <th>OT Amount</th>
              <th>Total Amount</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr><td colSpan={10} className="empty-state">No employees found for attendance.</td></tr>
            ) : filteredRecords.map(rec => (
              <tr key={rec.empId}>
                <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{rec.empId}</td>
                <td style={{ fontWeight: 600 }}>{rec.name}</td>
                <td>
                  <input type="number" min={0} max={31} value={rec.presentDays}
                    onChange={(e) => updateField(rec.empId, 'presentDays', Number(e.target.value))}
                    className={styles.compactInput} />
                </td>
                <td>
                  <input type="number" min={0} value={rec.baseDailyWage}
                    onChange={(e) => updateField(rec.empId, 'baseDailyWage', Number(e.target.value))}
                    className={styles.compactInput} />
                </td>
                <td className={styles.computedCell}>{fmt(rec.presentWage)}</td>
                <td>
                  <input type="number" min={0} max={200} value={rec.otHours}
                    onChange={(e) => updateField(rec.empId, 'otHours', Number(e.target.value))}
                    className={styles.compactInput} />
                </td>
                <td className={styles.computedCell}>{fmt(rec.otRatePerHr)}</td>
                <td className={styles.computedCell}>{fmt(rec.otAmount)}</td>
                <td className={`${styles.computedCell} ${styles.total}`}>{fmt(rec.totalAmount)}</td>
                <td style={{ textAlign: 'center' }}>
                  <button className="btn-danger btn-sm" onClick={() => deleteRecord(rec.empId)}>
                    <i className="ri-delete-bin-line" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {records.length > 0 && (
            <tfoot>
              <tr className="summary-footer">
                <td colSpan={2} style={{ fontWeight: 700 }}>Totals</td>
                <td style={{ fontWeight: 700 }}>{totalAttendanceCount}</td>
                <td />
                <td />
                <td style={{ fontWeight: 700 }}>{totalOtHours}</td>
                <td />
                <td />
                <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(totalWageAmount)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
