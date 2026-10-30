import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { RoleService } from '../../../core/services/role.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface ApiLeaveRecord {
  id: number;
  employee_id?: string;
  employee_name?: string;
  site_id?: string;
  site_name?: string;
  date?: string;
  leave_type?: string;
  reason?: string;
  status?: string;
}

interface LeaveRecord {
  id: number;
  employeeId: string;
  employee: string;
  site: string;
  leaveDate: string;
  leaveType: string;
  reason: string;
  status: string;
}

function mapLeave(r: ApiLeaveRecord): LeaveRecord {
  return {
    id: r.id,
    employeeId: r.employee_id ?? '',
    employee: r.employee_name ?? r.employee_id ?? '',
    site: r.site_name ?? r.site_id ?? '',
    leaveDate: r.date ?? '',
    leaveType: r.leave_type ?? 'CL',
    reason: r.reason ?? '',
    status: r.status ?? 'approved',
  };
}

interface EmployeeCheckItem {
  id: string;
  name: string;
  displayId: string;
}

@Component({
  selector: 'app-site-leave-entry',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './site-leave-entry.html',
  styleUrl: './site-leave-entry.scss',
})
export class SiteLeaveEntryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  readonly role = inject(RoleService);

  selectedSite = signal('');
  leaveDate = signal('');
  leaveType = signal('CL');
  reason = signal('');
  searchQuery = signal('');
  historySearch = signal('');
  records = signal<LeaveRecord[]>([]);
  loading = signal(false);
  editingId = signal<number | null>(null);

  siteDropdownItems = signal<DropdownItem[]>([]);
  employeeList = signal<EmployeeCheckItem[]>([]);
  selectedEmployeeIds = signal<Set<string>>(new Set());

  allSelected = computed(() => {
    const emps = this.employeeList();
    const sel = this.selectedEmployeeIds();
    return emps.length > 0 && emps.every(e => sel.has(e.id));
  });

  filteredEmployeeList = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.employeeList();
    return this.employeeList().filter(e =>
      e.name.toLowerCase().includes(q) || e.displayId.toLowerCase().includes(q)
    );
  });

  selectedCount = computed(() => this.selectedEmployeeIds().size);

  filteredRecords = computed(() => {
    const q = this.historySearch().toLowerCase();
    if (!q) return this.records();
    return this.records().filter(r =>
      r.employee.toLowerCase().includes(q) ||
      r.site.toLowerCase().includes(q) ||
      r.leaveType.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q)
    );
  });

  summaryCards = computed<SummaryCard[]>(() => {
    const recs = this.records();
    const cl = recs.filter(r => r.leaveType === 'CL').length;
    const sl = recs.filter(r => r.leaveType === 'SL').length;
    const ul = recs.filter(r => r.leaveType === 'UL').length;
    return [
      { title: 'Total Leaves', value: recs.length, icon: 'ri-calendar-line', color: 'primary' },
      { title: 'Casual Leave', value: cl, icon: 'ri-sun-line', color: 'info' },
      { title: 'Sick Leave', value: sl, icon: 'ri-heart-pulse-line', color: 'warning' },
      { title: 'Unpaid Leave', value: ul, icon: 'ri-close-circle-line', color: 'danger' },
    ];
  });

  ngOnInit(): void {
    this.api.get<{ id: string | number; name: string }[]>('/sites').subscribe({
      next: (sites) => {
        this.siteDropdownItems.set(sites.map(s => ({ value: String(s.id), label: s.name })));
        if (this.role.isSiteLocked()) {
          const lockedSite = this.role.getSupervisorSiteId();
          if (lockedSite) {
            this.selectedSite.set(String(lockedSite));
            this.loadEmployeesForSite(String(lockedSite));
          }
        }
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to load sites'),
    });
    this.loadLeaves();
  }

  onSiteChange(siteId: string): void {
    this.selectedSite.set(siteId);
    this.selectedEmployeeIds.set(new Set());
    if (siteId) this.loadEmployeesForSite(siteId);
    else this.employeeList.set([]);
  }

  private loadEmployeesForSite(siteId: string): void {
    this.api.get<{ id: string | number; name: string; display_id?: string }[]>('/employees', { site_id: siteId }).subscribe({
      next: (emps) => {
        this.employeeList.set(emps.map(e => ({
          id: String(e.id),
          name: e.name,
          displayId: e.display_id ?? String(e.id),
        })));
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to load employees'),
    });
  }

  toggleEmployee(empId: string): void {
    this.selectedEmployeeIds.update(set => {
      const next = new Set(set);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  }

  toggleAll(): void {
    if (this.allSelected()) {
      this.selectedEmployeeIds.set(new Set());
    } else {
      this.selectedEmployeeIds.set(new Set(this.employeeList().map(e => e.id)));
    }
  }

  isSelected(empId: string): boolean {
    return this.selectedEmployeeIds().has(empId);
  }

  private loadLeaves(): void {
    this.loading.set(true);
    this.api.get<ApiLeaveRecord[]>('/site-leaves').subscribe({
      next: (recs) => {
        this.records.set(recs.map(mapLeave));
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err.message ?? 'Failed to load leave records');
        this.loading.set(false);
      },
    });
  }

  addLeave(): void {
    const ids = this.selectedEmployeeIds();
    if (ids.size === 0 || !this.leaveDate()) {
      this.notify.error('Select at least one employee and a date');
      return;
    }

    if (this.editingId() !== null) {
      const body = {
        site_id: this.selectedSite() || null,
        date: this.leaveDate(),
        leave_type: this.leaveType(),
        reason: this.reason(),
      };
      this.api.put(`/site-leaves/${this.editingId()}`, body).subscribe({
        next: () => {
          this.notify.success('Leave record updated');
          this.resetForm();
          this.loadLeaves();
        },
        error: (err) => this.notify.error(err.message ?? 'Failed to update'),
      });
      return;
    }

    const isAdmin = this.role.isAdmin();
    let completed = 0;
    const total = ids.size;

    ids.forEach(empId => {
      const body = {
        employee_id: empId,
        site_id: this.selectedSite() || null,
        date: this.leaveDate(),
        leave_type: this.leaveType(),
        reason: this.reason(),
        status: isAdmin ? 'approved' : 'pending',
      };
      this.api.post<ApiLeaveRecord>('/site-leaves', body).subscribe({
        next: () => {
          completed++;
          if (completed === total) {
            this.notify.success(`${total} leave record(s) added`);
            this.resetForm();
            this.loadLeaves();
          }
        },
        error: (err) => {
          completed++;
          this.notify.error(`Failed for employee: ${err.message ?? 'Unknown error'}`);
        },
      });
    });
  }

  editLeave(rec: LeaveRecord): void {
    this.editingId.set(rec.id);
    this.leaveDate.set(rec.leaveDate);
    this.leaveType.set(rec.leaveType);
    this.reason.set(rec.reason);
    this.selectedEmployeeIds.set(new Set([rec.employeeId]));
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.resetForm();
  }

  async deleteLeave(id: number): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Leave Record',
      message: 'Are you sure you want to delete this leave record?',
      type: 'danger',
    });
    if (!confirmed) return;
    this.api.delete(`/site-leaves/${id}`).subscribe({
      next: () => {
        this.notify.success('Leave record deleted');
        this.loadLeaves();
      },
      error: () => {
        this.records.update(r => r.filter(x => x.id !== id));
        this.notify.success('Leave removed');
      },
    });
  }

  exportData(): void {
    this.exportService.exportToExcel(
      this.filteredRecords().map(r => ({
        'Employee': r.employee, 'Site': r.site, 'Date': r.leaveDate,
        'Leave Type': r.leaveType, 'Reason': r.reason, 'Status': r.status,
      })),
      'Site_Leave_Records', 'Leave Records'
    );
  }

  private resetForm(): void {
    this.leaveDate.set('');
    this.leaveType.set('CL');
    this.reason.set('');
    this.selectedEmployeeIds.set(new Set());
    this.editingId.set(null);
  }
}
