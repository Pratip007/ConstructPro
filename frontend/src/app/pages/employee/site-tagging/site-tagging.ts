import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { RoleService } from '../../../core/services/role.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';

interface ApiTagRecord {
  id: number;
  employee_ids?: string[];
  employee_names?: string[];
  employee_id?: string;
  employee_name?: string;
  from_site_id?: string;
  from_site_name?: string;
  to_site_id?: string;
  to_site_name?: string;
  site_id?: string;
  site_name?: string;
  tagged_date?: string;
  status?: string;
  created_by?: string;
}

interface TagRecord {
  id: number;
  employees: string;
  employeeCount: number;
  fromSite: string;
  toSite: string;
  date: string;
  status: string;
  createdBy: string;
}

function mapTagRecord(r: ApiTagRecord): TagRecord {
  const names = r.employee_names ?? (r.employee_name ? [r.employee_name] : []);
  return {
    id: r.id,
    employees: names.join(', ') || r.employee_id || '',
    employeeCount: names.length || (r.employee_id ? 1 : 0),
    fromSite: r.from_site_name ?? '',
    toSite: r.to_site_name ?? r.site_name ?? r.site_id ?? '',
    date: r.tagged_date ?? '',
    status: r.status ?? 'completed',
    createdBy: r.created_by ?? '',
  };
}

interface EmployeeCheckItem {
  id: string;
  name: string;
  displayId: string;
}

@Component({
  selector: 'app-site-tagging',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent],
  templateUrl: './site-tagging.html',
  styleUrl: './site-tagging.scss',
})
export class SiteTaggingComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  readonly role = inject(RoleService);

  siteFrom = signal('');
  siteTo = signal('');
  tagDate = signal('');
  searchQuery = signal('');
  historySearch = signal('');
  records = signal<TagRecord[]>([]);
  loading = signal(false);

  siteDropdownItems = signal<DropdownItem[]>([]);
  employeeList = signal<EmployeeCheckItem[]>([]);
  selectedEmployeeIds = signal<Set<string>>(new Set());

  allSelected = computed(() => {
    const emps = this.filteredEmployeeList();
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
      r.employees.toLowerCase().includes(q) ||
      r.fromSite.toLowerCase().includes(q) ||
      r.toSite.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.api.get<{ id: string | number; name: string }[]>('/sites').subscribe({
      next: (sites) => {
        this.siteDropdownItems.set(sites.map(s => ({ value: String(s.id), label: s.name })));
        if (this.role.isSiteLocked()) {
          const lockedSite = this.role.getSupervisorSiteId();
          if (lockedSite) {
            this.siteFrom.set(String(lockedSite));
            this.loadEmployeesForSite(String(lockedSite));
          }
        }
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to load sites'),
    });
    this.loadRecords();
  }

  onSiteFromChange(siteId: string): void {
    this.siteFrom.set(siteId);
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
      this.selectedEmployeeIds.set(new Set(this.filteredEmployeeList().map(e => e.id)));
    }
  }

  isSelected(empId: string): boolean {
    return this.selectedEmployeeIds().has(empId);
  }

  private loadRecords(): void {
    this.loading.set(true);
    this.api.get<ApiTagRecord[]>('/site-tagging').subscribe({
      next: (recs) => {
        this.records.set(recs.map(mapTagRecord));
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err.message ?? 'Failed to load tagging records');
        this.loading.set(false);
      },
    });
  }

  submitTagging(): void {
    const ids = this.selectedEmployeeIds();
    if (ids.size === 0 || !this.siteTo() || !this.tagDate()) {
      this.notify.error('Select employees, target site, and date');
      return;
    }
    if (this.siteFrom() === this.siteTo()) {
      this.notify.error('From and To sites cannot be the same');
      return;
    }
    const body = {
      employee_ids: Array.from(ids),
      from_site_id: this.siteFrom() || null,
      to_site_id: this.siteTo(),
      tagged_date: this.tagDate(),
    };
    this.api.post<ApiTagRecord>('/site-tagging', body).subscribe({
      next: () => {
        this.notify.success(`${ids.size} employee(s) transferred successfully`);
        this.siteTo.set('');
        this.tagDate.set('');
        this.selectedEmployeeIds.set(new Set());
        this.loadRecords();
        if (this.siteFrom()) this.loadEmployeesForSite(this.siteFrom());
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to submit tagging'),
    });
  }

  async revertTagging(id: number): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Revert Transfer',
      message: 'This will move employees back to their original site. Continue?',
      type: 'warning',
      passwordRequired: this.role.isAdmin(),
    });
    if (!confirmed) return;
    this.api.put(`/site-tagging/${id}/revert`, {}).subscribe({
      next: () => {
        this.notify.success('Transfer reverted');
        this.loadRecords();
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to revert'),
    });
  }

  async deleteTagging(id: number): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Transfer Record',
      message: 'Are you sure you want to permanently delete this record?',
      type: 'danger',
      passwordRequired: true,
    });
    if (!confirmed) return;
    this.api.delete(`/site-tagging/${id}`).subscribe({
      next: () => {
        this.notify.success('Record deleted');
        this.loadRecords();
      },
      error: () => {
        this.records.update(r => r.filter(x => x.id !== id));
        this.notify.success('Record removed');
      },
    });
  }

  exportData(): void {
    this.exportService.exportToExcel(
      this.filteredRecords().map(r => ({
        'Employees': r.employees, 'Count': r.employeeCount,
        'From Site': r.fromSite, 'To Site': r.toSite,
        'Date': r.date, 'Status': r.status,
      })),
      'Site_Tagging_Records', 'Tagging Records'
    );
  }
}
