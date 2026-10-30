import { Component, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';

interface ApiSubId {
  id: number;
  employee_id?: string;
  employee_name?: string;
  site_id?: string;
  site_name?: string;
  type?: string;
  rate?: number;
  salary_basis?: string;
  status?: string;
  position_type?: string;
}

interface SubId {
  id: number;
  employee: string;
  subIdName: string;
  siteName: string;
  rate: number;
  salaryBasis: string;
  status: string;
  positionType: string;
}

@Component({
  selector: 'app-employee-sub-id',
  standalone: true,
  imports: [FormsModule, DecimalPipe, SearchableDropdownComponent],
  templateUrl: './employee-sub-id.html',
  styleUrl: './employee-sub-id.scss',
})
export class EmployeeSubIdComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  selectedEmployee = signal('');
  selectedSite = signal('');
  subIdType = signal('');
  rate = signal<number>(0);
  salaryBasis = signal('daily');
  positionType = signal('Erection');
  subIds = signal<SubId[]>([]);
  loading = signal(false);
  editingId = signal<number | null>(null);

  employeeDropdownItems = signal<DropdownItem[]>([]);
  siteDropdownItems = signal<DropdownItem[]>([]);
  selectedEmployeeName = '';

  ngOnInit(): void {
    this.api.get<{id: string|number; name: string}[]>('/employees').subscribe({
      next: (emps) => this.employeeDropdownItems.set(emps.map(e => ({ value: String(e.id), label: e.name }))),
      error: (err) => this.notify.error(err.message ?? 'Failed to load employees'),
    });
    this.api.get<{id: string|number; name: string}[]>('/sites').subscribe({
      next: (siteList) => this.siteDropdownItems.set(siteList.map(s => ({ value: String(s.id), label: s.name }))),
      error: (err) => this.notify.error(err.message ?? 'Failed to load sites'),
    });
  }

  onEmployeeChange(empId: string): void {
    this.selectedEmployee.set(empId);
    const emp = this.employeeDropdownItems().find(e => e.value === empId);
    this.selectedEmployeeName = emp?.label ?? '';
    if (empId) this.loadSubIds(empId);
    else this.subIds.set([]);
  }

  private loadSubIds(empId: string): void {
    this.loading.set(true);
    this.api.get<ApiSubId[]>(`/employees/${empId}/sub-ids`).subscribe({
      next: (subs) => {
        this.subIds.set(subs.map(s => ({
          id: s.id,
          employee: s.employee_name ?? this.selectedEmployeeName,
          subIdName: s.type ?? '',
          siteName: s.site_name ?? s.site_id ?? '',
          rate: s.rate ?? 0,
          salaryBasis: s.salary_basis ?? 'daily',
          status: s.status ?? 'active',
          positionType: s.position_type ?? '',
        })));
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err.message ?? 'Failed to load sub IDs');
        this.loading.set(false);
      },
    });
  }

  addSubId(): void {
    if (!this.selectedEmployee() || !this.subIdType()) return;
    const body = {
      site_id: this.selectedSite() || null,
      type: this.subIdType(),
      rate: this.rate(),
      salary_basis: this.salaryBasis(),
      position_type: this.positionType(),
    };
    if (this.editingId() !== null) {
      this.api.put(`/employees/${this.selectedEmployee()}/sub-ids/${this.editingId()}`, body).subscribe({
        next: () => {
          this.notify.success('Sub ID updated');
          this.resetForm();
          this.loadSubIds(this.selectedEmployee());
        },
        error: (err) => this.notify.error(err.message ?? 'Failed to update'),
      });
    } else {
      this.api.post(`/employees/${this.selectedEmployee()}/sub-ids`, body).subscribe({
        next: () => {
          this.notify.success('Sub ID created');
          this.resetForm();
          this.loadSubIds(this.selectedEmployee());
        },
        error: (err) => this.notify.error(err.message ?? 'Failed to create sub ID'),
      });
    }
  }

  editSubId(sub: SubId): void {
    this.editingId.set(sub.id);
    this.subIdType.set(sub.subIdName);
    this.rate.set(sub.rate);
    this.salaryBasis.set(sub.salaryBasis);
    this.positionType.set(sub.positionType || 'Erection');
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.resetForm();
  }

  async deleteSubId(id: number): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Sub ID',
      message: 'Are you sure you want to delete this sub ID?',
      type: 'danger',
    });
    if (!confirmed) return;
    this.api.delete(`/employees/${this.selectedEmployee()}/sub-ids/${id}`).subscribe({
      next: () => {
        this.notify.success('Sub ID deleted');
        this.loadSubIds(this.selectedEmployee());
      },
      error: () => {
        this.subIds.update(s => s.filter(x => x.id !== id));
        this.notify.success('Sub ID removed');
      },
    });
  }

  exportData(): void {
    this.exportService.exportToExcel(
      this.subIds().map(s => ({
        'Employee': s.employee, 'Sub ID': s.subIdName, 'Site': s.siteName,
        'Rate': s.rate, 'Salary Basis': s.salaryBasis, 'Position': s.positionType, 'Status': s.status,
      })),
      `SubIDs_${this.selectedEmployeeName}`, 'Sub IDs'
    );
  }

  private resetForm(): void {
    this.subIdType.set('');
    this.rate.set(0);
    this.salaryBasis.set('daily');
    this.positionType.set('Erection');
    this.selectedSite.set('');
    this.editingId.set(null);
  }
}
