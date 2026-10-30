import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

@Component({
  selector: 'app-bank-statement',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './bank-statement.html',
  styleUrl: './bank-statement.scss',
})
export class BankStatementComponent implements OnInit {
  readonly Math = Math;
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  selectedBank = signal('');
  fromDate = signal('');
  toDate = signal('');
  searchQuery = signal('');
  banks = signal<any[]>([]);
  entries = signal<any[]>([]);
  loading = signal(false);
  statementsLoading = signal(false);

  bankItems = computed<DropdownItem[]>(() =>
    this.banks().map(b => ({
      value: b.bank_name ?? b.name,
      label: `${b.bank_name ?? b.name}${b.account_number ? ' (' + b.account_number + ')' : ''}`,
    }))
  );

  statementEntries = computed(() => {
    let balance = 0;
    let list = this.entries().map(e => {
      const debit = e.type === 'Expense' ? (Number(e.amount) || 0) : 0;
      const credit = e.type === 'Income' ? (Number(e.amount) || 0) : 0;
      balance = balance + credit - debit;
      return { ...e, debit, credit, balance };
    });
    const q = this.searchQuery().toLowerCase();
    if (q) {
      list = list.filter(e =>
        (e.purpose ?? '').toLowerCase().includes(q) ||
        (e.remark ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  });

  totalDebit = computed(() => this.statementEntries().reduce((s, r) => s + r.debit, 0));
  totalCredit = computed(() => this.statementEntries().reduce((s, r) => s + r.credit, 0));
  closingBalance = computed(() => {
    const rows = this.statementEntries();
    return rows.length ? rows[rows.length - 1].balance : 0;
  });

  summaryCards = computed<SummaryCard[]>(() => {
    const debit = this.totalDebit();
    const credit = this.totalCredit();
    const closing = this.closingBalance();
    return [
      { title: 'Total Debit', value: debit, icon: 'ri-arrow-down-circle-line', color: 'danger', prefix: '₹' },
      { title: 'Total Credit', value: credit, icon: 'ri-arrow-up-circle-line', color: 'success', prefix: '₹' },
      { title: 'Closing Balance', value: Math.abs(closing), icon: 'ri-wallet-3-line', color: closing >= 0 ? 'success' : 'danger', prefix: '₹', suffix: closing >= 0 ? 'Cr' : 'Dr' },
      { title: 'Transactions', value: this.statementEntries().length, icon: 'ri-exchange-line', color: 'info' },
    ];
  });

  ngOnInit(): void {
    this.loadBanks();
  }

  loadBanks(): void {
    this.loading.set(true);
    this.api.get<any[]>('/banks').subscribe({
      next: (data) => { this.banks.set(data); this.loading.set(false); },
      error: (err) => { this.notify.error('Failed to load banks: ' + err.message); this.loading.set(false); },
    });
  }

  loadStatement(): void {
    const bank = this.selectedBank();
    if (!bank) {
      this.notify.error('Please select a bank');
      return;
    }
    this.statementsLoading.set(true);
    this.entries.set([]);
    const params: Record<string, string> = { bank_account: bank };
    if (this.fromDate()) params['from_date'] = this.fromDate();
    if (this.toDate()) params['to_date'] = this.toDate();
    this.api.get<any>('/income-expenses', params).subscribe({
      next: (data) => {
        const list = data?.entries ?? (Array.isArray(data) ? data : []);
        list.sort((a: any, b: any) => (a.date ?? '').localeCompare(b.date ?? ''));
        this.entries.set(list);
        this.statementsLoading.set(false);
      },
      error: (err) => {
        this.notify.error('Failed to load statement: ' + (err?.message ?? 'Unknown error'));
        this.statementsLoading.set(false);
      },
    });
  }

  exportExcel(): void {
    this.exportService.exportToExcel(
      this.statementEntries().map(e => ({
        Date: e.date,
        Particulars: e.purpose,
        Remark: e.remark,
        'Debit (₹)': e.debit || '',
        'Credit (₹)': e.credit || '',
        'Balance (₹)': e.balance,
      })),
      `bank-statement-${this.selectedBank()}`
    );
  }

  exportPdf(): void {
    this.exportService.exportToPDF({
      title: `Bank Statement — ${this.selectedBank()}`,
      fileName: `bank-statement-${this.selectedBank()}`,
      data: this.statementEntries() as Record<string, any>[],
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'purpose', header: 'Particulars' },
        { key: 'debit', header: 'Debit (₹)', format: 'currency', align: 'right' },
        { key: 'credit', header: 'Credit (₹)', format: 'currency', align: 'right' },
        { key: 'balance', header: 'Balance (₹)', format: 'currency', align: 'right' },
      ],
      companyName: 'ATR Construction Pvt Ltd',
      dateRange: this.fromDate() || this.toDate() ? { from: this.fromDate(), to: this.toDate() } : undefined,
      summaryRow: {
        date: '', purpose: 'TOTAL',
        debit: this.totalDebit(), credit: this.totalCredit(), balance: this.closingBalance(),
      },
    });
  }

  printStatement(): void {
    this.exportService.printReport('bank-statement-table', 'Bank Statement - ' + this.selectedBank());
  }
}
