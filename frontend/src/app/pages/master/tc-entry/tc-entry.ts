import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

interface TermsEntry {
  id: string;
  content: string;
  status: string;
  pending_status?: string;
  editing?: boolean;
  editContent?: string;
}

@Component({
  selector: 'app-tc-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tc-entry.html',
  styleUrl: './tc-entry.scss',
})
export class TcEntryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  readonly role = inject(RoleService);
  readonly approval = inject(ApprovalService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  statement = signal('');
  loading = signal(false);
  entries = signal<TermsEntry[]>([]);

  readonly canModify = computed(() => !this.role.isSupervisor());
  readonly roleBadge = computed(() => {
    if (this.role.isOffice()) return 'Office Mode - Requires Approval';
    if (this.role.isSupervisor()) return 'Supervisor Mode - View Only';
    return '';
  });

  ngOnInit(): void {
    this.loadTerms();
  }

  private loadTerms(): void {
    this.api.get<TermsEntry[]>('/settings/terms').subscribe({
      next: (terms) => this.entries.set((terms ?? []).map(t => ({
        ...t,
        content: t.content ?? '',
        status: t.status ?? 'Active',
      }))),
      error: () => this.notify.error('Failed to load terms & conditions'),
    });
  }

  onSubmit(): void {
    if (!this.statement()) return;
    if (this.role.isSupervisor()) return;

    const payload = { content: this.statement() };

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'TCEntry',
        actionType: 'create',
        summary: this.statement().substring(0, 60) + '...',
        data: { ...payload, status: 'Active' },
      }).subscribe({
        next: () => {
          this.notify.success('T&C clause request sent for approval');
          this.statement.set('');
        },
        error: (err) => this.notify.error(err?.message ?? 'Failed to submit request'),
      });
      return;
    }

    this.loading.set(true);
    this.api.post('/settings/terms', payload).subscribe({
      next: () => {
        this.notify.success('T&C clause added');
        this.statement.set('');
        this.loadTerms();
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err?.message ?? 'Failed to add clause');
        this.loading.set(false);
      },
    });
  }

  startEdit(entry: TermsEntry): void {
    if (this.role.isSupervisor()) return;
    this.entries.update(list => list.map(e =>
      e.id === entry.id
        ? { ...e, editing: true, editContent: e.content }
        : { ...e, editing: false }
    ));
  }

  cancelEdit(): void {
    this.entries.update(list => list.map(e => ({ ...e, editing: false })));
  }

  saveEdit(entry: TermsEntry): void {
    if (!entry.editContent) {
      this.notify.error('Statement cannot be empty');
      return;
    }

    const payload = { content: entry.editContent };

    if (this.approval.requiresApproval()) {
      this.cancelEdit();
      this.approval.submitForApproval({
        module: 'TCEntry',
        actionType: 'update',
        summary: `${entry.id} updated to: ${entry.editContent!.substring(0, 50)}...`,
        data: payload,
        oldData: entry,
        referenceId: entry.id,
      }).subscribe({
        next: () => {
          this.notify.success('Edit request sent for approval');
          this.loadTerms();
        },
        error: (err) => this.notify.error(err?.message ?? 'Failed to submit request'),
      });
      return;
    }

    this.api.put(`/settings/terms/${entry.id}`, payload).subscribe({
      next: () => {
        this.notify.success('Clause updated');
        this.cancelEdit();
        this.loadTerms();
      },
      error: (err) => this.notify.error(err?.message ?? 'Failed to update clause'),
    });
  }

  async toggleStatus(entry: TermsEntry): Promise<void> {
    if (this.role.isSupervisor()) return;
    const newStatus = entry.status === 'Active' ? 'Disabled' : 'Active';

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'TCEntry',
        actionType: 'update',
        summary: `${entry.id} -> ${newStatus} (${entry.content.substring(0, 40)}...)`,
        data: { ...entry, status: newStatus },
        oldData: entry,
        referenceId: entry.id,
      }).subscribe({
        next: () => {
          this.notify.success('Status change sent for approval');
          this.loadTerms();
        },
        error: (err) => this.notify.error(err?.message ?? 'Failed to submit request'),
      });
      return;
    }

    const confirmed = await this.confirmDialog.confirm({
      title: `${newStatus === 'Active' ? 'Enable' : 'Disable'} Clause`,
      message: `Change status to ${newStatus}?`,
      confirmText: newStatus === 'Active' ? 'Enable' : 'Disable',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;

    this.api.put(`/settings/terms/${entry.id}`, { status: newStatus }).subscribe({
      next: () => {
        this.notify.success(`Clause status changed to ${newStatus}`);
        this.loadTerms();
      },
      error: (err) => this.notify.error(err?.message ?? 'Failed to update status'),
    });
  }
}
