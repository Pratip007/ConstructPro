import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService, ApprovalRequest } from '../../../core/services/approval.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { DataTableComponent, TableColumn, TableAction } from '../../../shared/data-table/data-table.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';

interface Employee {
  id: string;
  display_id?: string;
  name: string;
  phone?: string;
  status?: string;
}

interface UserRecord {
  id: string;
  display_id: string;
  name: string;
  email?: string;
  username: string;
  role: string;
  designation: string;
  contact: string;
  site_id: string | null;
  status: string;
  pending_status?: string;
  created_at: string;
}

@Component({
  selector: 'app-new-user-entry',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    DataTableComponent, ModalDialogComponent,
    SearchableDropdownComponent
  ],
  templateUrl: './new-user-entry.html',
  styleUrl: './new-user-entry.scss',
})
export class NewUserEntryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  readonly role = inject(RoleService);
  readonly approval = inject(ApprovalService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  allUsers = signal<UserRecord[]>([]);
  employees = signal<DropdownItem[]>([]);
  loading = signal(false);
  usersLoading = signal(false);
  showModal = signal(false);
  editingUser = signal<UserRecord | null>(null);

  selectedEmpId = signal('');
  name = signal('');
  designation = signal('');
  username = signal('');
  password = signal('');
  contact = signal('');

  columns: TableColumn[] = [
    { key: 'display_id', label: 'Emp ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'designation', label: 'Designation', sortable: true },
    { key: 'username', label: 'User ID', sortable: true },
    { key: 'contact', label: 'Contact' },
    { key: 'status', label: 'Status', type: 'badge', sortable: true, badgeMap: { Active: 'success', Disabled: 'danger' } },
  ];

  actions: TableAction[] = [
    { label: 'Edit', icon: 'ri-edit-line', class: 'btn-icon', action: 'edit', show: () => !this.role.isSupervisor() },
    { label: 'Toggle', icon: 'ri-toggle-line', class: 'btn-icon', action: 'toggle', show: () => !this.role.isSupervisor() },
  ];

  readonly canModify = computed(() => !this.role.isSupervisor());
  readonly roleBadge = computed(() => {
    if (this.role.isOffice()) return 'Office Mode - Requires Approval';
    if (this.role.isSupervisor()) return 'Supervisor Mode - View Only';
    return '';
  });

  ngOnInit(): void {
    this.loadUsers();
    this.loadEmployees();
  }

  private loadUsers(): void {
    this.usersLoading.set(true);
    this.api.get<any[]>('/employees').subscribe({
      next: (res) => {
        const users = (Array.isArray(res) ? res : []).map(u => ({
          id: u.id ?? '',
          display_id: u.display_id ?? u.id ?? '',
          name: u.name ?? '',
          email: u.email ?? '',
          username: u.username ?? u.email ?? '',
          role: u.role ?? '',
          designation: u.designation ?? u.role ?? 'Office Staff',
          contact: u.contact ?? u.phone ?? '',
          site_id: u.site_id ?? null,
          status: u.status ?? 'Active',
          pending_status: u.pending_status ?? undefined,
          created_at: u.created_at ?? '',
        }));
        this.allUsers.set(users);
        this.usersLoading.set(false);
      },
      error: () => {
        this.notify.error('Failed to load user list');
        this.usersLoading.set(false);
      },
    });
  }

  private loadEmployees(): void {
    this.api.get<Employee[]>('/employees').subscribe({
      next: (emps) => {
        const items: DropdownItem[] = (emps ?? [])
          .filter(e => e.status === 'Active' || !e.status)
          .map(e => ({
            value: e.id,
            label: `${e.name} (${e.display_id ?? e.id})`,
          }));
        this.employees.set(items);
      },
      error: () => {},
    });
  }

  openAddModal(): void {
    if (this.role.isSupervisor()) return;
    this.editingUser.set(null);
    this.resetForm();
    this.showModal.set(true);
  }

  openEditModal(user: UserRecord): void {
    if (this.role.isSupervisor()) return;
    this.editingUser.set(user);
    this.selectedEmpId.set(user.display_id);
    this.name.set(user.name);
    this.designation.set(user.designation);
    this.username.set(user.username);
    this.password.set('');
    this.contact.set(user.contact);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingUser.set(null);
    this.resetForm();
  }

  onEmpSelected(empId: string): void {
    const emp = this.employees().find(e => e.value === empId);
    if (emp) {
      this.name.set(emp.label.replace(/ \(.*\)$/, ''));
    }
  }

  onSubmit(): void {
    if (!this.name() || !this.username() || !this.contact()) return;
    if (!this.editingUser() && !this.password()) return;

    const existingUser = this.allUsers().find(
      u => u.username.toLowerCase() === this.username().toLowerCase() && u.id !== this.editingUser()?.id
    );
    if (existingUser) {
      this.notify.error('Username already exists. Choose a different one.');
      return;
    }

    const payload = {
      name: this.name(),
      designation: this.designation() || 'Office Staff',
      username: this.username(),
      password: this.password() || undefined,
      contact: this.contact(),
      display_id: this.selectedEmpId() || undefined,
    };

    if (this.approval.requiresApproval()) {
      const request: ApprovalRequest = {
        module: 'NewUserEntry',
        actionType: this.editingUser() ? 'update' : 'create',
        summary: `${payload.name} (${payload.username}) - Role: ${payload.designation}`,
        data: payload,
        oldData: this.editingUser() ?? undefined,
      };
      this.approval.submitForApproval(request).subscribe({
        next: () => {
          this.notify.success('Request sent for admin approval');
          this.closeModal();
          this.loadUsers();
        },
        error: (err) => this.notify.error(err?.message ?? 'Failed to submit approval request'),
      });
      return;
    }

    this.loading.set(true);
    const id = this.editingUser()?.id;
    const request$ = id
      ? this.api.put(`/employees/${id}`, payload)
      : this.api.post('/auth/signup', {
          ...payload,
          email: `${this.username()}@constructpro.local`,
          role: 'office',
        });

    request$.subscribe({
      next: () => {
        this.notify.success(id ? 'User updated successfully' : 'User registered successfully');
        this.closeModal();
        this.loadUsers();
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err?.message ?? 'Failed to save user');
        this.loading.set(false);
      },
    });
  }

  onAction(event: { action: string; row: UserRecord }): void {
    if (event.action === 'edit') {
      this.openEditModal(event.row);
    } else if (event.action === 'toggle') {
      this.toggleUserStatus(event.row);
    }
  }

  private async toggleUserStatus(user: UserRecord): Promise<void> {
    const newStatus = user.status === 'Active' ? 'Disabled' : 'Active';

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'NewUserEntry',
        actionType: 'update',
        summary: `${user.name} (${user.display_id}) -> ${newStatus}`,
        data: { ...user, status: newStatus },
        oldData: user,
      }).subscribe({
        next: () => {
          this.notify.success('Status change sent for approval');
          this.loadUsers();
        },
        error: (err) => this.notify.error(err?.message ?? 'Failed to submit request'),
      });
      return;
    }

    const confirmed = await this.confirmDialog.confirm({
      title: `${newStatus === 'Active' ? 'Enable' : 'Disable'} User`,
      message: `Are you sure you want to ${newStatus === 'Active' ? 'enable' : 'disable'} ${user.name}?`,
      confirmText: newStatus === 'Active' ? 'Enable' : 'Disable',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    this.api.put(`/employees/${user.id}`, { status: newStatus }).subscribe({
      next: () => {
        this.notify.success(`User status changed to ${newStatus}`);
        this.loadUsers();
      },
      error: (err) => this.notify.error(err?.message ?? 'Failed to update status'),
    });
  }

  private resetForm(): void {
    this.selectedEmpId.set('');
    this.name.set('');
    this.designation.set('');
    this.username.set('');
    this.password.set('');
    this.contact.set('');
  }
}
