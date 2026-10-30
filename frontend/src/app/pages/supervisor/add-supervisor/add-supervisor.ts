import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ExportService } from '../../../core/services/export.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';

interface Supervisor {
  id: number;
  name: string;
  contact: string;
  address: string;
  employee_id: number | null;
  assigned_site_id: number | null;
  status?: string;
  pending_status?: string | null;
}

interface Employee {
  id: number;
  name: string;
  contact?: string;
}

interface Site {
  id: number;
  name: string;
}

@Component({
  selector: 'app-add-supervisor',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent, ModalDialogComponent, TitleCasePipe],
  templateUrl: './add-supervisor.html',
  styleUrl: './add-supervisor.scss',
})
export class AddSupervisorComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  readonly role = inject(RoleService);
  readonly approval = inject(ApprovalService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly exportService = inject(ExportService);

  searchQuery = signal('');
  showFormModal = signal(false);
  showPassword = signal(false);

  name = signal('');
  contact = signal('');
  address = signal('');
  password = signal('');
  selectedEmployeeId = signal<number | null>(null);
  selectedSiteId = signal<number | null>(null);

  supervisors = signal<Supervisor[]>([]);
  employees = signal<Employee[]>([]);
  sites = signal<Site[]>([]);
  loading = signal(false);
  saving = signal(false);
  editingId = signal<number | null>(null);

  employeeItems = computed<DropdownItem[]>(() =>
    this.employees().map(e => ({ value: String(e.id), label: e.name }))
  );
  siteItems = computed<DropdownItem[]>(() =>
    this.sites().map(s => ({ value: String(s.id), label: s.name }))
  );

  summaryCards = computed<SummaryCard[]>(() => {
    const all = this.supervisors();
    const active = all.filter(s => (s.status ?? 'active') === 'active').length;
    return [
      { title: 'Total', value: all.length, icon: 'ri-group-line', color: 'primary' },
      { title: 'Active', value: active, icon: 'ri-check-line', color: 'success' },
      { title: 'Inactive', value: all.length - active, icon: 'ri-close-line', color: 'danger' },
    ];
  });

  filteredSupervisors = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const list = this.supervisors();
    if (!q) return list;
    return list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.contact.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.loadDropdowns();
    this.loadSupervisors();
  }

  loadDropdowns(): void {
    this.api.get<Employee[]>('/employees').subscribe({
      next: data => this.employees.set(data),
      error: () => this.notify.error('Failed to load employees'),
    });
    this.api.get<Site[]>('/sites').subscribe({
      next: data => this.sites.set(data),
      error: () => this.notify.error('Failed to load sites'),
    });
  }

  loadSupervisors(): void {
    this.loading.set(true);
    this.api.get<Supervisor[]>('/supervisors').subscribe({
      next: data => { this.supervisors.set(data); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load supervisors'); this.loading.set(false); },
    });
  }

  openAddModal(): void {
    this.resetForm();
    this.showFormModal.set(true);
  }

  editSupervisor(s: Supervisor): void {
    this.editingId.set(s.id);
    this.name.set(s.name);
    this.contact.set(s.contact);
    this.address.set(s.address);
    this.password.set('');
    this.selectedEmployeeId.set(s.employee_id);
    this.selectedSiteId.set(s.assigned_site_id);
    this.showFormModal.set(true);
  }

  onEmployeeChange(val: string): void {
    const id = val ? Number(val) : null;
    this.selectedEmployeeId.set(id);
    if (id) {
      const emp = this.employees().find(e => e.id === id);
      if (emp) {
        if (!this.name()) this.name.set(emp.name);
        if (!this.contact() && emp.contact) this.contact.set(emp.contact);
      }
    }
  }

  saveSupervisor(): void {
    if (!this.name() || !this.contact()) {
      this.notify.error('Name and contact are required');
      return;
    }
    if (this.editingId() === null && (!this.password() || this.password().length < 8)) {
      this.notify.error('Password is required (min 8 characters) for new supervisors');
      return;
    }
    const body: Record<string, any> = {
      name: this.name(),
      contact: this.contact(),
      address: this.address(),
      employee_id: this.selectedEmployeeId(),
      assigned_site_id: this.selectedSiteId(),
    };
    if (this.editingId() === null || this.password()) {
      body['password'] = this.password();
    }

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'Supervisor',
        actionType: this.editingId() ? 'update' : 'create',
        summary: `${this.editingId() ? 'Update' : 'Add'} Supervisor: ${this.name()}`,
        data: body,
        referenceId: this.editingId() ? String(this.editingId()) : undefined,
      }).subscribe({
        next: () => {
          this.notify.success('Submitted for approval');
          this.showFormModal.set(false);
          this.resetForm();
        },
        error: () => this.notify.error('Failed to submit for approval'),
      });
      return;
    }

    this.saving.set(true);
    if (this.editingId() !== null) {
      this.api.put<Supervisor>(`/supervisors/${this.editingId()}`, body).subscribe({
        next: updated => {
          this.supervisors.update(list => list.map(s => s.id === updated.id ? updated : s));
          this.notify.success('Supervisor updated');
          this.saving.set(false);
          this.showFormModal.set(false);
          this.resetForm();
        },
        error: () => { this.notify.error('Failed to update supervisor'); this.saving.set(false); },
      });
    } else {
      this.api.post<Supervisor>('/supervisors', body).subscribe({
        next: created => {
          this.supervisors.update(list => [...list, created]);
          this.notify.success('Supervisor added');
          this.saving.set(false);
          this.showFormModal.set(false);
          this.resetForm();
        },
        error: () => { this.notify.error('Failed to add supervisor'); this.saving.set(false); },
      });
    }
  }

  async deleteSupervisor(s: Supervisor): Promise<void> {
    const result = await this.confirm.confirmWithPassword({
      title: 'Delete Supervisor',
      message: `Delete supervisor "${s.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });
    if (!result.confirmed) return;

    this.api.delete<void>(`/supervisors/${s.id}`).subscribe({
      next: () => {
        this.supervisors.update(list => list.filter(x => x.id !== s.id));
        this.notify.success('Supervisor deleted');
      },
      error: () => this.notify.error('Failed to delete supervisor'),
    });
  }

  toggleStatus(s: Supervisor): void {
    const newStatus = (s.status ?? 'active') === 'active' ? 'inactive' : 'active';
    this.api.put<Supervisor>(`/supervisors/${s.id}`, { status: newStatus }).subscribe({
      next: updated => {
        this.supervisors.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.notify.success(`Supervisor ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      },
      error: () => this.notify.error('Failed to update status'),
    });
  }

  employeeName(id: number | null): string {
    if (!id) return '-';
    return this.employees().find(e => e.id === id)?.name ?? String(id);
  }

  siteName(id: number | null): string {
    if (!id) return '-';
    return this.sites().find(s => s.id === id)?.name ?? String(id);
  }

  exportExcel(): void {
    const data = this.supervisors().map(s => ({
      name: s.name,
      contact: s.contact,
      address: s.address,
      employee: this.employeeName(s.employee_id),
      site: this.siteName(s.assigned_site_id),
      status: s.status ?? 'active',
    }));
    this.exportService.exportToExcel(data, 'Supervisors', 'Supervisors');
  }

  resetForm(): void {
    this.editingId.set(null);
    this.name.set('');
    this.contact.set('');
    this.address.set('');
    this.password.set('');
    this.selectedEmployeeId.set(null);
    this.selectedSiteId.set(null);
    this.showPassword.set(false);
  }
}
