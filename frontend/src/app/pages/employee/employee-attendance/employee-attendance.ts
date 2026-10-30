import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { RoleService } from '../../../core/services/role.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

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
  date?: string;
  present?: boolean;
  status?: string;
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

interface SiteItem { id: string | number; name: string; }

@Component({
  selector: 'app-employee-attendance',
  standalone: true,
  imports: [FormsModule, DecimalPipe, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './employee-attendance.html',
  styleUrl: './employee-attendance.scss',
})
export class EmployeeAttendanceComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  readonly role = inject(RoleService);

  attendanceDate = signal(new Date().toISOString().substring(0, 7));
  siteFilter = signal('');
  searchQuery = signal('');
  loading = signal(false);
  saving = signal(false);
  records = signal<AttendanceRecord[]>([]);
  editingId = signal<number | null>(null);

  sites: SiteItem[] = [];
  siteDropdownItems = signal<DropdownItem[]>([]);

  filteredRecords = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.records();
    return this.records().filter(r =>
      r.name.toLowerCase().includes(q) || r.empId.toLowerCase().includes(q)
    );
  });

  totalAttendanceCount = computed(() => this.records().reduce((sum, r) => sum + r.presentDays, 0));
  totalWageAmount = computed(() => this.records().reduce((sum, r) => sum + r.totalAmount, 0));
  totalOtHours = computed(() => this.records().reduce((sum, r) => sum + r.otHours, 0));

  summaryCards = computed<SummaryCard[]>(() => [
    { title: 'Total Present Days', value: this.totalAttendanceCount(), icon: 'ri-calendar-check-line', color: 'success' },
    { title: 'Total OT Hours', value: this.totalOtHours(), icon: 'ri-time-line', color: 'info' },
    { title: 'Total Wage Amount', value: this.totalWageAmount(), icon: 'ri-money-rupee-circle-line', color: 'primary', prefix: '₹' },
    { title: 'Employees', value: this.records().length, icon: 'ri-team-line', color: 'warning' },
  ]);

  ngOnInit(): void {
    this.api.get<SiteItem[]>('/sites').subscribe({
      next: (siteList) => {
        this.sites = siteList;
        this.siteDropdownItems.set(siteList.map(s => ({ value: String(s.id), label: s.name })));
        if (this.role.isSiteLocked()) {
          this.siteFilter.set(String(this.role.getSupervisorSiteId()));
        }
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to load sites'),
    });
    this.loadAttendance();
  }

  onFilterChange(): void {
    this.loadAttendance();
  }

  computeWages(rec: AttendanceRecord): AttendanceRecord {
    const presentWage = rec.baseDailyWage * rec.presentDays;
    let otRatePerHr = 0;
    let otAmount = 0;
    if (rec.salaryBasis === 'daily' && rec.otHours > 0) {
      otRatePerHr = rec.baseDailyWage / 8;
      otAmount = otRatePerHr * rec.otHours;
    }
    return { ...rec, presentWage, otRatePerHr, otAmount, totalAmount: presentWage + otAmount };
  }

  updateField(empId: string, field: string, value: number): void {
    this.records.update(recs =>
      recs.map(r => {
        if (r.empId !== empId) return r;
        return this.computeWages({ ...r, [field]: value });
      })
    );
  }

  deleteRecord(empId: string): void {
    this.records.update(recs => recs.filter(r => r.empId !== empId));
    this.notify.success('Record removed');
  }

  private loadAttendance(): void {
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.siteFilter()) params['site_id'] = this.siteFilter();
    if (this.attendanceDate()) params['month'] = this.attendanceDate();
    this.api.get<ApiAttendanceRecord[]>('/attendance', params).subscribe({
      next: (recs) => {
        this.records.set(
          recs.map(r => this.computeWages({
            id: r.id,
            empId: r.employee_id ?? '',
            name: r.employee_name ?? r.employee_id ?? '',
            subId: r.sub_id ?? '',
            siteId: r.site_id ?? this.siteFilter(),
            month: r.month ?? this.attendanceDate(),
            presentDays: r.present_days ?? 0,
            otHours: r.ot_hours ?? 0,
            salaryBasis: r.salary_basis ?? 'daily',
            baseDailyWage: r.base_daily_wage ?? 0,
            presentWage: 0, otRatePerHr: 0, otAmount: 0, totalAmount: 0,
          }))
        );
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err.message ?? 'Failed to load attendance');
        this.loading.set(false);
      },
    });
  }

  saveAttendance(): void {
    const recs = this.records();
    if (!recs.length) { this.notify.error('No records to save'); return; }
    this.saving.set(true);
    const body = recs.map(r => ({
      employee_id: r.empId,
      sub_id: r.subId || null,
      site_id: r.siteId || this.siteFilter() || null,
      month: r.month || this.attendanceDate(),
      present_days: r.presentDays,
      ot_hours: r.otHours,
      salary_basis: r.salaryBasis,
      base_daily_wage: r.baseDailyWage,
    }));
    this.api.post('/attendance', body).subscribe({
      next: () => {
        this.notify.success(`Attendance saved for ${this.attendanceDate()}`);
        this.saving.set(false);
      },
      error: (err) => {
        this.notify.error(err.message ?? 'Failed to save attendance');
        this.saving.set(false);
      },
    });
  }

  downloadTemplate(): void {
    const template = [{ employee_id: '', employee_name: '', present_days: 0, ot_hours: 0, base_daily_wage: 0 }];
    this.exportService.exportToExcel(template, `Attendance_Template_${this.attendanceDate()}`, 'Template');
  }

  onBulkUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const XLSX = (window as any)['XLSX'];
        if (!XLSX) { this.notify.error('XLSX library not loaded'); return; }
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        const mapped = rows.map(r => this.computeWages({
          empId: String(r.employee_id ?? ''),
          name: r.employee_name ?? '',
          subId: '', siteId: this.siteFilter(),
          month: this.attendanceDate(),
          presentDays: Number(r.present_days) || 0,
          otHours: Number(r.ot_hours) || 0,
          salaryBasis: 'daily',
          baseDailyWage: Number(r.base_daily_wage) || 0,
          presentWage: 0, otRatePerHr: 0, otAmount: 0, totalAmount: 0,
        }));
        this.records.update(recs => [...recs, ...mapped]);
        this.notify.success(`Imported ${mapped.length} records`);
      } catch {
        this.notify.error('Failed to parse file');
      }
    };
    reader.readAsBinaryString(file);
    input.value = '';
  }

  exportData(): void {
    this.exportService.exportToExcel(
      this.records().map(r => ({
        'Employee ID': r.empId, 'Name': r.name, 'Present Days': r.presentDays,
        'Base Wage': r.baseDailyWage, 'Present Wage': r.presentWage,
        'OT Hours': r.otHours, 'OT Amount': r.otAmount, 'Total': r.totalAmount,
      })),
      `Attendance_${this.attendanceDate()}`, 'Attendance'
    );
  }

  printData(): void {
    this.exportService.printReport('attendance-table', `Attendance ${this.attendanceDate()}`);
  }
}
