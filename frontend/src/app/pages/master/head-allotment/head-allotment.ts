import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

interface Head {
  id: string;
  name: string;
  opening_balance: number;
  date: string;
  status: string;
  pending_status?: string;
  editing?: boolean;
  editName?: string;
  editBalance?: number;
  editDate?: string;
}

@Component({
  selector: 'app-head-allotment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './head-allotment.html',
  styleUrl: './head-allotment.scss',
})
export class HeadAllotmentComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  readonly role = inject(RoleService);
  readonly approval = inject(ApprovalService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  headName = signal('');
  openingBalance = signal<number | null>(null);
  headDate = signal('');
  loading = signal(false);
  heads = signal<Head[]>([]);

  readonly canModify = computed(() => !this.role.isSupervisor());
  readonly roleBadge = computed(() => {
    if (this.role.isOffice()) return 'Office Mode - Requires Approval';
    if (this.role.isSupervisor()) return 'Supervisor Mode - View Only';
    return '';
  });

  ngOnInit(): void {
    this.headDate.set(new Date().toISOString().split('T')[0]);
    this.loadHeads();
  }

  private loadHeads(): void {
    this.api.get<Head[]>('/settings/heads').subscribe({
      next: (heads) => this.heads.set((heads ?? []).map(h => ({
        ...h,
        opening_balance: h.opening_balance ?? 0,
        date: h.date ?? '',
        status: h.status ?? 'Active',
      }))),
      error: () => this.notify.error('Failed to load head allotments'),
    });
  }

  formatInr(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  }

  onSubmit(): void {
    if (!this.headName() || this.openingBalance() == null || !this.headDate()) return;
    if (this.role.isSupervisor()) return;

    const payload = {
      name: this.headName(),
      opening_balance: this.openingBalance(),
      date: this.headDate(),
    };

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'HeadAllotment',
        actionType: 'create',
        summary: `${payload.name} - Opening Bal: ${this.formatInr(payload.opening_balance!)}`,
        data: { ...payload, status: 'Active' },
      }).subscribe({
        next: () => {
          this.notify.success('Head allotment request sent for approval');
          this.resetForm();
        },
        error: (err) => this.notify.error(err?.message ?? 'Failed to submit request'),
      });
      return;
    }

    this.loading.set(true);
    this.api.post('/settings/heads', payload).subscribe({
      next: () => {
        this.notify.success('Head allotment registered');
        this.resetForm();
        this.loadHeads();
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err?.message ?? 'Failed to add head');
        this.loading.set(false);
      },
    });
  }

  startEdit(head: Head): void {
    if (this.role.isSupervisor()) return;
    this.heads.update(list => list.map(h =>
      h.id === head.id
        ? { ...h, editing: true, editName: h.name, editBalance: h.opening_balance, editDate: h.date }
        : { ...h, editing: false }
    ));
  }

  cancelEdit(): void {
    this.heads.update(list => list.map(h => ({ ...h, editing: false })));
  }

  saveEdit(head: Head): void {
    if (!head.editName || head.editBalance == null || !head.editDate) {
      this.notify.error('All fields are required');
      return;
    }

    const payload = {
      name: head.editName,
      opening_balance: head.editBalance,
      date: head.editDate,
    };

    if (this.approval.requiresApproval()) {
      this.cancelEdit();
      this.approval.submitForApproval({
        module: 'HeadAllotment',
        actionType: 'update',
        summary: `${head.name} -> ${payload.name} (${this.formatInr(payload.opening_balance!)})`,
        data: payload,
        oldData: head,
        referenceId: head.id,
      }).subscribe({
        next: () => {
          this.notify.success('Edit request sent for approval');
          this.loadHeads();
        },
        error: (err) => this.notify.error(err?.message ?? 'Failed to submit request'),
      });
      return;
    }

    this.api.put(`/settings/heads/${head.id}`, payload).subscribe({
      next: () => {
        this.notify.success('Head updated');
        this.cancelEdit();
        this.loadHeads();
      },
      error: (err) => this.notify.error(err?.message ?? 'Failed to update head'),
    });
  }

  async toggleStatus(head: Head): Promise<void> {
    if (this.role.isSupervisor()) return;
    const newStatus = head.status === 'Active' ? 'Disabled' : 'Active';

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'HeadAllotment',
        actionType: 'update',
        summary: `${head.name} (${head.id}) -> ${newStatus}`,
        data: { ...head, status: newStatus },
        oldData: head,
        referenceId: head.id,
      }).subscribe({
        next: () => {
          this.notify.success('Status change sent for approval');
          this.loadHeads();
        },
        error: (err) => this.notify.error(err?.message ?? 'Failed to submit request'),
      });
      return;
    }

    const confirmed = await this.confirmDialog.confirm({
      title: `${newStatus === 'Active' ? 'Enable' : 'Disable'} Head`,
      message: `Change status of "${head.name}" to ${newStatus}?`,
      confirmText: newStatus === 'Active' ? 'Enable' : 'Disable',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;

    this.api.put(`/settings/heads/${head.id}`, { status: newStatus }).subscribe({
      next: () => {
        this.notify.success(`Head status changed to ${newStatus}`);
        this.loadHeads();
      },
      error: (err) => this.notify.error(err?.message ?? 'Failed to update status'),
    });
  }

  private resetForm(): void {
    this.headName.set('');
    this.openingBalance.set(null);
    this.headDate.set(new Date().toISOString().split('T')[0]);
  }
}
