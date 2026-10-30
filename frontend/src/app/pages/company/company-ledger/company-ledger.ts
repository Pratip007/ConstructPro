import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

@Component({
  selector: 'app-company-ledger',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './company-ledger.html',
  styleUrl: './company-ledger.scss',
})
export class CompanyLedgerComponent implements OnInit {
  readonly Math = Math;
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  selectedCompany = signal('');
  selectedSite = signal('');
  fromDate = signal('');
  toDate = signal('');

  companyItems = signal<DropdownItem[]>([]);
  siteItems = signal<DropdownItem[]>([]);
  ledgerEntries = signal<any[]>([]);
  loading = signal(false);

  companyOptions: any[] = [];

  ledgerWithBalance = computed(() => {
    let balance = 0;
    const from = this.fromDate();
    const entries = this.ledgerEntries();

    return entries.map(e => {
      const debit = e.debit ?? 0;
      const credit = e.credit ?? 0;
      balance += debit - credit;
      return {
        ...e,
        runningBalance: balance,
        balanceType: balance >= 0 ? 'Dr' : 'Cr',
      };
    });
  });

  summaryCards = computed<SummaryCard[]>(() => {
    const entries = this.ledgerWithBalance();
    const totalDebit = entries.reduce((s, e) => s + (e.debit ?? 0), 0);
    const totalCredit = entries.reduce((s, e) => s + (e.credit ?? 0), 0);
    const totalTds = entries.filter(e => (e.particulars ?? '').toLowerCase().includes('tds')).reduce((s, e) => s + (e.credit ?? 0), 0);
    const bankReceived = totalCredit - totalTds;
    const closing = entries.length ? entries[entries.length - 1].runningBalance : 0;

    return [
      { title: 'Total Billed', value: totalDebit, icon: 'ri-bill-line', color: 'primary', prefix: '₹' },
      { title: 'Bank Received', value: bankReceived, icon: 'ri-bank-line', color: 'success', prefix: '₹' },
      { title: 'TDS Deducted', value: totalTds, icon: 'ri-percent-line', color: 'warning', prefix: '₹' },
      { title: 'Closing Balance', value: Math.abs(closing), icon: 'ri-wallet-3-line', color: closing >= 0 ? 'danger' : 'success', prefix: '₹', suffix: closing >= 0 ? 'Dr' : 'Cr' },
    ];
  });

  get totalDebit(): number {
    return this.ledgerEntries().reduce((sum, e) => sum + (e.debit ?? 0), 0);
  }

  get totalCredit(): number {
    return this.ledgerEntries().reduce((sum, e) => sum + (e.credit ?? 0), 0);
  }

  get closingBalance(): number {
    const entries = this.ledgerWithBalance();
    return entries.length ? entries[entries.length - 1].runningBalance : 0;
  }

  ngOnInit(): void {
    this.loadCompanies();
    this.loadSites();
  }

  loadCompanies(): void {
    this.api.get<any[]>('/companies').subscribe({
      next: (data) => {
        this.companyOptions = data;
        this.companyItems.set([
          { value: '__ALL__', label: 'All Companies (Consolidated)' },
          ...data.map((c: any) => ({ value: c.id, label: c.name }))
        ]);
      },
      error: (err) => this.notify.error('Failed to load companies: ' + err.message),
    });
  }

  loadSites(): void {
    this.api.get<any[]>('/sites').subscribe({
      next: (data) => {
        this.siteItems.set([
          { value: '', label: 'All Sites' },
          ...data.map((s: any) => ({ value: s.id, label: s.name }))
        ]);
      },
      error: () => {},
    });
  }

  filterLedger(): void {
    if (!this.selectedCompany()) return;
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.fromDate()) params['from_date'] = this.fromDate();
    if (this.toDate()) params['to_date'] = this.toDate();
    if (this.selectedSite()) params['site_id'] = this.selectedSite();

    const companyId = this.selectedCompany();
    const endpoint = companyId === '__ALL__'
      ? '/ledger/company'
      : `/ledger/company/${companyId}`;

    this.api.get<any>(endpoint, params).subscribe({
      next: (data) => {
        const entries = Array.isArray(data) ? data : (data.entries ?? []);
        this.ledgerEntries.set(entries);
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error('Failed to load ledger: ' + err.message);
        this.loading.set(false);
      },
    });
  }

  exportExcel(): void {
    this.exportService.exportToExcel(
      this.ledgerWithBalance().map(e => ({
        Date: e.date,
        Particulars: e.particulars,
        'Invoice No': e.invoice_no ?? '',
        Company: e.company_name ?? '',
        Site: e.site_name ?? '',
        'Debit (₹)': e.debit ?? 0,
        'Credit (₹)': e.credit ?? 0,
        'TDS (₹)': e.tds_amount ?? 0,
        'Balance (₹)': e.runningBalance,
        Type: e.balanceType,
      })),
      'company-ledger'
    );
  }

  exportPdf(): void {
    const companyName = this.companyOptions.find(c => c.id === this.selectedCompany())?.name ?? 'All Companies';
    this.exportService.exportToPDF({
      title: `Company Ledger - ${companyName}`,
      fileName: 'company-ledger',
      data: this.ledgerWithBalance() as Record<string, any>[],
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'particulars', header: 'Particulars' },
        { key: 'debit', header: 'Debit (₹)', format: 'currency', align: 'right' },
        { key: 'credit', header: 'Credit (₹)', format: 'currency', align: 'right' },
        { key: 'runningBalance', header: 'Balance (₹)', format: 'currency', align: 'right' },
      ],
      companyName: 'ATR Construction Pvt Ltd',
      dateRange: this.fromDate() || this.toDate() ? { from: this.fromDate(), to: this.toDate() } : undefined,
      summaryRow: {
        date: '',
        particulars: 'TOTAL',
        debit: this.totalDebit,
        credit: this.totalCredit,
        runningBalance: this.closingBalance,
      },
      dualCopy: { partyLabel: 'Company Copy' },
    });
  }

  printLedger(): void {
    this.exportService.printReport('ledger-table', 'Company Ledger');
  }

  exportCsv(): void {
    this.exportService.exportToCSV(this.ledgerWithBalance() as Record<string, any>[], 'company-ledger', [
      { key: 'date', header: 'Date' },
      { key: 'particulars', header: 'Particulars' },
      { key: 'debit', header: 'Debit' },
      { key: 'credit', header: 'Credit' },
      { key: 'runningBalance', header: 'Balance' },
    ]);
  }
}
