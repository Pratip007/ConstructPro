import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

@Component({
  selector: 'app-income-expense-entry',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './income-expense-entry.html',
  styleUrl: './income-expense-entry.scss',
})
export class IncomeExpenseEntryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly role = inject(RoleService);
  private readonly approval = inject(ApprovalService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  entryType = signal('');
  head = signal('');
  amount = signal<number | null>(null);
  entryDate = signal('');
  description = signal('');
  bank = signal('');

  entries = signal<any[]>([]);
  heads = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);
  editingId = signal<string | null>(null);

  bankOptions = signal<any[]>([]);

  filterType = signal('');
  filterHead = signal('');
  filterFromDate = signal('');
  filterToDate = signal('');

  headItems = computed<DropdownItem[]>(() => {
    return this.heads()
      .filter((h: any) => !h.head_type || !this.entryType() || h.head_type.toLowerCase() === this.entryType().toLowerCase())
      .map((h: any) => ({ value: h.name, label: h.name }));
  });

  filterHeadItems = computed<DropdownItem[]>(() => {
    const unique = [...new Set(this.entries().map(e => e.purpose).filter(Boolean))];
    return unique.map(h => ({ value: h, label: h }));
  });

  bankItems = computed<DropdownItem[]>(() => {
    return [
      ...this.bankOptions().map(b => ({
        value: b.bank_name ?? b.name,
        label: `${b.bank_name ?? b.name}${b.account_number ? ' (' + b.account_number + ')' : ''}`
      })),
      { value: 'Cash', label: 'Cash' },
    ];
  });

  filteredEntries = computed(() => {
    let result = this.entries();
    const ft = this.filterType();
    const fh = this.filterHead();
    const fd = this.filterFromDate();
    const td = this.filterToDate();

    if (ft) result = result.filter((e: any) => e.type === ft);
    if (fh) result = result.filter((e: any) => e.purpose === fh);
    if (fd) result = result.filter((e: any) => e.date >= fd);
    if (td) result = result.filter((e: any) => e.date <= td);
    return result;
  });

  summaryCards = computed<SummaryCard[]>(() => {
    const filtered = this.filteredEntries();
    const income = filtered.filter(e => e.type === 'Income').reduce((s, e) => s + (e.amount ?? 0), 0);
    const expense = filtered.filter(e => e.type === 'Expense').reduce((s, e) => s + (e.amount ?? 0), 0);
    const net = income - expense;
    return [
      { title: 'Total Income', value: income, icon: 'ri-arrow-up-circle-line', color: 'success', prefix: '₹' },
      { title: 'Total Expense', value: expense, icon: 'ri-arrow-down-circle-line', color: 'danger', prefix: '₹' },
      { title: 'Net Balance', value: Math.abs(net), icon: 'ri-wallet-3-line', color: net >= 0 ? 'success' : 'danger', prefix: '₹', suffix: net >= 0 ? 'Surplus' : 'Deficit' },
    ];
  });

  ngOnInit(): void {
    this.loadEntries();
    this.loadHeads();
    this.loadBanks();
  }

  loadEntries(): void {
    this.loading.set(true);
    this.api.get<any>('/income-expenses').subscribe({
      next: (data) => {
        this.entries.set(data?.entries ?? (Array.isArray(data) ? data : []));
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error('Failed to load entries: ' + err.message);
        this.loading.set(false);
      },
    });
  }

  loadHeads(): void {
    this.api.get<any[]>('/settings/heads').subscribe({
      next: (data) => this.heads.set(data),
      error: () => {},
    });
  }

  loadBanks(): void {
    this.api.get<any[]>('/banks').subscribe({
      next: (data) => this.bankOptions.set(data),
      error: () => {},
    });
  }

  saveEntry(): void {
    if (!this.entryType() || !this.head() || !this.amount()) return;

    const body = {
      type: this.entryType(),
      amount: this.amount(),
      date: this.entryDate() || new Date().toISOString().split('T')[0],
      purpose: this.head(),
      remark: this.description(),
      bank_account: this.bank(),
    };

    if (this.role.isAdmin() || !this.approval.requiresApproval()) {
      this.saving.set(true);
      const id = this.editingId();
      const request = id
        ? this.api.put<any>(`/income-expenses/${id}`, body)
        : this.api.post<any>('/income-expenses', body);

      request.subscribe({
        next: (result) => {
          if (id) {
            this.entries.update(list => list.map(e => e.id === id ? { ...e, ...result } : e));
            this.notify.success('Entry updated successfully');
          } else {
            this.entries.update(list => [result, ...list]);
            this.notify.success('Entry added successfully');
          }
          this.resetForm();
          this.saving.set(false);
          this.loadEntries();
        },
        error: (err) => {
          this.notify.error('Failed to save entry: ' + err.message);
          this.saving.set(false);
        },
      });
    } else {
      this.approval.submitForApproval({
        module: 'IncomeExpense',
        actionType: this.editingId() ? 'update' : 'create',
        summary: `${this.editingId() ? 'Update' : 'Add'} ${this.entryType()}: ${this.head()} - ₹${this.amount()}`,
        data: body,
        referenceId: this.editingId() ?? undefined,
      }).subscribe({
        next: () => {
          this.notify.success('Submitted for approval');
          this.resetForm();
        },
        error: (err) => this.notify.error('Failed to submit: ' + err.message),
      });
    }
  }

  editEntry(e: any): void {
    this.editingId.set(e.id);
    this.entryType.set(e.type ?? '');
    this.head.set(e.purpose ?? '');
    this.amount.set(e.amount ?? null);
    this.entryDate.set(e.date ?? '');
    this.description.set(e.remark ?? '');
    this.bank.set(e.bank_account ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async deleteEntry(e: any): Promise<void> {
    if (this.role.isAdmin()) {
      const confirmed = await this.confirmDialog.confirm({
        title: 'Delete Entry',
        message: `Delete ${e.type} entry "${e.purpose}" for ₹${e.amount?.toLocaleString()}?`,
        type: 'danger',
        confirmText: 'Delete',
      });
      if (!confirmed) return;
    } else if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'IncomeExpense',
        actionType: 'delete',
        summary: `Delete ${e.type}: ${e.purpose} - ₹${e.amount}`,
        data: e,
        referenceId: e.id,
      }).subscribe({
        next: () => this.notify.success('Delete request submitted for approval'),
        error: (err) => this.notify.error('Failed to submit: ' + err.message),
      });
      return;
    }

    this.api.delete<any>(`/income-expenses/${e.id}`).subscribe({
      next: () => {
        this.entries.update(list => list.filter(en => en.id !== e.id));
        this.notify.success('Entry deleted');
        this.loadEntries();
      },
      error: (err) => this.notify.error('Failed to delete: ' + err.message),
    });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  clearFilters(): void {
    this.filterType.set('');
    this.filterHead.set('');
    this.filterFromDate.set('');
    this.filterToDate.set('');
  }

  onAddHead(): void {
    const name = prompt('Enter new purpose/head name:');
    if (!name) return;
    this.api.post<any>('/settings/heads', {
      name,
      head_type: this.entryType() || 'Expense',
    }).subscribe({
      next: (created) => {
        this.heads.update(list => [...list, created]);
        this.head.set(name);
        this.notify.success('New head added');
      },
      error: (err) => this.notify.error('Failed to add head: ' + err.message),
    });
  }

  exportExcel(): void {
    this.exportService.exportToExcel(
      this.filteredEntries().map(e => ({
        Type: e.type,
        Head: e.purpose,
        'Amount (₹)': e.amount,
        Date: e.date,
        Description: e.remark,
        Bank: e.bank_account,
      })),
      'income-expense'
    );
  }

  exportPdf(): void {
    this.exportService.exportToPDF({
      title: 'Income & Expense Report',
      fileName: 'income-expense-report',
      data: this.filteredEntries() as Record<string, any>[],
      columns: [
        { key: 'type', header: 'Type' },
        { key: 'purpose', header: 'Head' },
        { key: 'amount', header: 'Amount (₹)', format: 'currency', align: 'right' },
        { key: 'date', header: 'Date', format: 'date' },
        { key: 'remark', header: 'Description' },
        { key: 'bank_account', header: 'Bank' },
      ],
      companyName: 'ATR Construction Pvt Ltd',
      dateRange: this.filterFromDate() || this.filterToDate() ? { from: this.filterFromDate(), to: this.filterToDate() } : undefined,
    });
  }

  printReport(): void {
    this.exportService.printReport('ie-table', 'Income & Expense Report');
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.entryType.set('');
    this.head.set('');
    this.amount.set(null);
    this.entryDate.set('');
    this.description.set('');
    this.bank.set('');
  }
}
