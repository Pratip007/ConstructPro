import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

interface Bank {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  ifsc_code: string;
  branch_name: string;
  status?: string;
  pending_status?: string;
  editing?: boolean;
  editBankName?: string;
  editAccountName?: string;
  editAccountNumber?: string;
  editIfsc?: string;
  editBranch?: string;
}

@Component({
  selector: 'app-bank-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bank-entry.html',
  styleUrl: './bank-entry.scss',
})
export class BankEntryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  readonly role = inject(RoleService);
  readonly approval = inject(ApprovalService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  bankName = signal('');
  accountName = signal('');
  accountNumber = signal('');
  ifscCode = signal('');
  branchName = signal('');
  loading = signal(false);
  banks = signal<Bank[]>([]);

  readonly canModify = computed(() => !this.role.isSupervisor());
  readonly roleBadge = computed(() => {
    if (this.role.isOffice()) return 'Office Mode - Requires Approval';
    if (this.role.isSupervisor()) return 'Supervisor Mode - View Only';
    return '';
  });

  ngOnInit(): void {
    this.loadBanks();
  }

  private loadBanks(): void {
    this.api.get<Bank[]>('/banks').subscribe({
      next: (banks) => this.banks.set((banks ?? []).map(b => ({
        ...b,
        account_name: b.account_name ?? '',
        status: b.status ?? 'Active',
      }))),
      error: () => this.notify.error('Failed to load banks'),
    });
  }

  onSubmit(): void {
    if (!this.bankName() || !this.accountName() || !this.accountNumber() || !this.ifscCode() || !this.branchName()) {
      this.notify.error('All fields are required');
      return;
    }
    if (this.role.isSupervisor()) return;

    const payload = {
      bank_name: this.bankName(),
      account_name: this.accountName(),
      account_number: this.accountNumber(),
      ifsc_code: this.ifscCode().toUpperCase(),
      branch_name: this.branchName(),
    };

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'BankEntry',
        actionType: 'create',
        summary: `${payload.bank_name} - A/C: ${payload.account_number} (${payload.account_name})`,
        data: payload,
      }).subscribe({
        next: () => {
          this.notify.success('Bank account request sent for approval');
          this.resetForm();
        },
        error: (err) => this.notify.error(err?.message ?? 'Failed to submit request'),
      });
      return;
    }

    this.loading.set(true);
    this.api.post('/banks', payload).subscribe({
      next: () => {
        this.notify.success('Bank account registered');
        this.resetForm();
        this.loadBanks();
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err?.message ?? 'Failed to add bank');
        this.loading.set(false);
      },
    });
  }

  async startEdit(bank: Bank): Promise<void> {
    if (this.role.isSupervisor()) return;

    if (this.role.isAdmin()) {
      const result = await this.confirmDialog.confirmWithPassword({
        title: 'Admin Protected Action',
        message: 'Enter admin password to edit this bank account.',
        confirmText: 'Proceed',
        cancelText: 'Cancel',
      });
      if (!result.confirmed) return;
    }

    this.banks.update(list => list.map(b =>
      b.id === bank.id
        ? {
            ...b,
            editing: true,
            editBankName: b.bank_name,
            editAccountName: b.account_name,
            editAccountNumber: b.account_number,
            editIfsc: b.ifsc_code,
            editBranch: b.branch_name,
          }
        : { ...b, editing: false }
    ));
  }

  cancelEdit(): void {
    this.banks.update(list => list.map(b => ({ ...b, editing: false })));
  }

  saveEdit(bank: Bank): void {
    if (!bank.editBankName || !bank.editAccountName || !bank.editAccountNumber || !bank.editIfsc || !bank.editBranch) {
      this.notify.error('All fields are required');
      return;
    }

    const payload = {
      bank_name: bank.editBankName,
      account_name: bank.editAccountName,
      account_number: bank.editAccountNumber,
      ifsc_code: bank.editIfsc!.toUpperCase(),
      branch_name: bank.editBranch,
    };

    if (this.approval.requiresApproval()) {
      this.cancelEdit();
      this.approval.submitForApproval({
        module: 'BankEntry',
        actionType: 'update',
        summary: `${bank.bank_name} A/C: ${bank.account_number} -> ${payload.bank_name} A/C: ${payload.account_number}`,
        data: payload,
        oldData: bank,
        referenceId: bank.id,
      }).subscribe({
        next: () => {
          this.notify.success('Edit request sent for approval');
          this.loadBanks();
        },
        error: (err) => this.notify.error(err?.message ?? 'Failed to submit request'),
      });
      return;
    }

    this.api.put(`/banks/${bank.id}`, payload).subscribe({
      next: () => {
        this.notify.success('Bank account updated');
        this.cancelEdit();
        this.loadBanks();
      },
      error: (err) => this.notify.error(err?.message ?? 'Failed to update bank'),
    });
  }

  async deleteBank(bank: Bank): Promise<void> {
    if (this.role.isSupervisor()) return;

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'BankEntry',
        actionType: 'delete',
        summary: `Delete ${bank.bank_name} - A/C: ${bank.account_number}`,
        data: null,
        oldData: bank,
        referenceId: bank.id,
      }).subscribe({
        next: () => {
          this.notify.success('Delete request sent for approval');
          this.loadBanks();
        },
        error: (err) => this.notify.error(err?.message ?? 'Failed to submit request'),
      });
      return;
    }

    const result = await this.confirmDialog.confirmWithPassword({
      title: 'Admin Protected Action',
      message: `Delete bank account: ${bank.bank_name} (A/C: ${bank.account_number})?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!result.confirmed) return;

    this.api.delete(`/banks/${bank.id}`).subscribe({
      next: () => {
        this.notify.success('Bank account deleted');
        this.loadBanks();
      },
      error: (err) => this.notify.error(err?.message ?? 'Failed to delete bank'),
    });
  }

  private resetForm(): void {
    this.bankName.set('');
    this.accountName.set('');
    this.accountNumber.set('');
    this.ifscCode.set('');
    this.branchName.set('');
  }
}
