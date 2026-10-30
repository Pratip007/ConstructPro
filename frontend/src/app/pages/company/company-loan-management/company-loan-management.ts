import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';

@Component({
  selector: 'app-company-loan-management',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent, ModalDialogComponent],
  templateUrl: './company-loan-management.html',
  styleUrl: './company-loan-management.scss',
})
export class CompanyLoanManagementComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  bankName = signal('');
  loanId = signal('');
  amount = signal<number | null>(null);
  interestType = signal<'%' | '₹'>('%');
  interestRate = signal<number | null>(null);
  tenure = signal<number | null>(null);
  emiDate = signal<number | null>(null);
  purpose = signal('');
  status = signal('Active');
  editingId = signal<string | null>(null);

  loans = signal<any[]>([]);
  reminders = signal<any[]>([]);
  bankOptions = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);

  activeTab = signal<'Active' | 'Closed'>('Active');

  // EMI modal
  emiModalOpen = signal(false);
  emiHistoryModalOpen = signal(false);
  selectedLoanId = signal<string | null>(null);
  emis = signal<any[]>([]);
  emisLoading = signal(false);

  emiAmount = signal<number | null>(null);
  emiPayDate = signal('');
  emiPayMethod = signal('');
  emiRemarks = signal('');

  bankItems = computed<DropdownItem[]>(() =>
    this.bankOptions().map(b => ({ value: b.bank_name ?? b.name, label: b.bank_name ?? b.name }))
  );

  filteredLoans = computed(() =>
    this.loans().filter(l => (l.status ?? 'Active') === this.activeTab())
  );

  selectedLoan = computed(() =>
    this.loans().find(l => String(l.id) === String(this.selectedLoanId())) ?? null
  );

  summaryCards = computed<SummaryCard[]>(() => {
    const all = this.loans();
    const active = all.filter(l => l.status === 'Active' || !l.status);
    const totalPrincipal = active.reduce((s, l) => s + (l.principal ?? 0), 0);
    const closed = all.filter(l => l.status === 'Closed').length;
    return [
      { title: 'Total Principal', value: totalPrincipal, icon: 'ri-money-rupee-circle-line', color: 'primary', prefix: '₹' },
      { title: 'Active Loans', value: active.length, icon: 'ri-funds-line', color: 'success' },
      { title: 'Closed Loans', value: closed, icon: 'ri-checkbox-circle-line', color: 'info' },
      { title: 'Upcoming EMIs', value: this.reminders().length, icon: 'ri-alarm-warning-line', color: this.reminders().length > 0 ? 'warning' : 'info' },
    ];
  });

  totalEmiPaid = computed(() =>
    this.emis().reduce((s, e) => s + (e.amount ?? 0), 0)
  );

  pendingAmount = computed(() => {
    const loan = this.selectedLoan();
    if (!loan) return 0;
    return (loan.principal ?? 0) - this.totalEmiPaid();
  });

  interestDisplay = computed(() => {
    const loan = this.selectedLoan();
    if (!loan) return '-';
    const principal = loan.principal ?? 0;
    const rate = loan.interest_value ?? 0;
    if (loan.interest_type === '%') {
      const interest = (principal * rate) / 100;
      return `₹${interest.toLocaleString('en-IN')} (${rate}% of ₹${principal.toLocaleString('en-IN')})`;
    }
    return `₹${rate.toLocaleString('en-IN')} (flat)`;
  });

  ngOnInit(): void {
    this.loadLoans();
    this.loadReminders();
    this.loadBanks();
  }

  loadLoans(): void {
    this.loading.set(true);
    this.api.get<any[]>('/loans').subscribe({
      next: (data) => { this.loans.set(data ?? []); this.loading.set(false); },
      error: (err) => { this.notify.error('Failed to load loans: ' + err.message); this.loading.set(false); },
    });
  }

  loadReminders(): void {
    this.api.get<any[]>('/loans/reminders').subscribe({
      next: (data) => this.reminders.set(data ?? []),
      error: () => {},
    });
  }

  loadBanks(): void {
    this.api.get<any[]>('/banks').subscribe({
      next: (data) => this.bankOptions.set(data ?? []),
      error: () => {},
    });
  }

  saveLoan(): void {
    if (!this.bankName() || !this.loanId() || !this.amount()) return;
    this.saving.set(true);
    const body = {
      bank: this.bankName(),
      loan_id_external: this.loanId(),
      principal: this.amount(),
      interest_type: this.interestType(),
      interest_value: this.interestRate(),
      tenure: this.tenure(),
      due_date: this.emiDate(),
      purpose: this.purpose(),
      status: this.status(),
    };
    const id = this.editingId();
    const request = id
      ? this.api.put<any>(`/loans/${id}`, body)
      : this.api.post<any>('/loans', body);

    request.subscribe({
      next: (result) => {
        if (id) {
          this.loans.update(list => list.map(l => l.id === id ? { ...l, ...result } : l));
          this.notify.success('Loan updated');
        } else {
          this.loans.update(list => [result, ...list]);
          this.notify.success('Loan added');
        }
        this.resetForm();
        this.saving.set(false);
      },
      error: (err) => { this.notify.error('Failed to save loan: ' + err.message); this.saving.set(false); },
    });
  }

  editLoan(l: any): void {
    this.editingId.set(l.id);
    this.bankName.set(l.bank ?? '');
    this.loanId.set(l.loan_id_external ?? '');
    this.amount.set(l.principal ?? null);
    this.interestType.set(l.interest_type ?? '%');
    this.interestRate.set(l.interest_value ?? null);
    this.tenure.set(l.tenure ?? null);
    this.emiDate.set(l.due_date ?? null);
    this.purpose.set(l.purpose ?? '');
    this.status.set(l.status ?? 'Active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void { this.resetForm(); }

  async deleteLoan(l: any): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Loan',
      message: `Delete loan "${l.loan_id_external}" from ${l.bank}?`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!confirmed) return;

    this.api.delete<any>(`/loans/${l.id}`).subscribe({
      next: () => {
        this.loans.update(list => list.filter(lo => lo.id !== l.id));
        this.notify.success('Loan deleted');
        if (this.selectedLoanId() === l.id) {
          this.selectedLoanId.set(null);
          this.emis.set([]);
        }
      },
      error: (err) => this.notify.error('Failed to delete: ' + err.message),
    });
  }

  toggleLoanStatus(l: any): void {
    const newStatus = l.status === 'Active' ? 'Closed' : 'Active';
    this.api.put<any>(`/loans/${l.id}`, { ...l, status: newStatus }).subscribe({
      next: () => {
        this.loans.update(list => list.map(lo => lo.id === l.id ? { ...lo, status: newStatus } : lo));
        this.notify.success(`Loan marked as ${newStatus}`);
      },
      error: (err) => this.notify.error('Failed to update: ' + err.message),
    });
  }

  openEmiModal(loanId: string): void {
    this.selectedLoanId.set(loanId);
    this.emiModalOpen.set(true);
    this.emiAmount.set(null);
    this.emiPayDate.set('');
    this.emiPayMethod.set('');
    this.emiRemarks.set('');
  }

  closeEmiModal(): void { this.emiModalOpen.set(false); }

  openEmiHistory(loanId: string): void {
    this.selectedLoanId.set(loanId);
    this.emiHistoryModalOpen.set(true);
    this.loadEmis(loanId);
  }

  closeEmiHistory(): void {
    this.emiHistoryModalOpen.set(false);
    this.emis.set([]);
  }

  loadEmis(loanId: string): void {
    this.emisLoading.set(true);
    this.api.get<any[]>(`/loans/${loanId}/emis`).subscribe({
      next: (data) => { this.emis.set(data ?? []); this.emisLoading.set(false); },
      error: (err) => { this.notify.error('Failed to load EMIs: ' + err.message); this.emisLoading.set(false); },
    });
  }

  addEmi(): void {
    const loanId = this.selectedLoanId();
    if (!loanId || !this.emiAmount()) return;
    const body = {
      amount: this.emiAmount(),
      date: this.emiPayDate() || new Date().toISOString().split('T')[0],
      pay_bank: this.emiPayMethod(),
      ref_no: this.emiRemarks(),
    };
    this.api.post<any>(`/loans/${loanId}/emis`, body).subscribe({
      next: (created) => {
        this.emis.update(list => [...list, created]);
        this.notify.success('EMI payment recorded');
        this.emiModalOpen.set(false);
      },
      error: (err) => this.notify.error('Failed to record EMI: ' + err.message),
    });
  }

  exportExcel(): void {
    this.exportService.exportToExcel(
      this.filteredLoans().map(l => ({
        Bank: l.bank,
        'Loan ID': l.loan_id_external,
        'Principal (₹)': l.principal,
        'Interest': `${l.interest_value}${l.interest_type}`,
        'Tenure (mo)': l.tenure,
        'EMI Date': l.due_date,
        Purpose: l.purpose,
        Status: l.status,
      })),
      'company-loans'
    );
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.bankName.set('');
    this.loanId.set('');
    this.amount.set(null);
    this.interestType.set('%');
    this.interestRate.set(null);
    this.tenure.set(null);
    this.emiDate.set(null);
    this.purpose.set('');
    this.status.set('Active');
  }
}
