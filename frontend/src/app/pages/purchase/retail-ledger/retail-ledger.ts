import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

@Component({
  selector: 'app-retail-ledger',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './retail-ledger.html',
  styleUrl: './retail-ledger.scss',
})
export class RetailLedgerComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  retailers = signal<any[]>([]);
  sites = signal<any[]>([]);
  selectedRetailerId = signal('');
  selectedSiteId = signal('');
  ledgerEntries = signal<any[]>([]);
  loading = signal(false);
  searchQuery = signal('');
  dateFrom = signal('');
  dateTo = signal('');

  retailerItems = computed<DropdownItem[]>(() =>
    this.retailers().map(r => ({ value: r.id, label: r.name }))
  );

  siteItems = computed<DropdownItem[]>(() =>
    [{ value: '', label: 'All Sites (Consolidated)' }, ...this.sites().map(s => ({ value: s.id, label: s.name }))]
  );

  filtered = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const entries = this.ledgerEntries();
    if (!q) return entries;
    return entries.filter(e =>
      (e.description ?? e.particulars ?? '').toLowerCase().includes(q) ||
      (e.type ?? '').toLowerCase().includes(q) ||
      (e.ref_no ?? '').toLowerCase().includes(q)
    );
  });

  entriesWithBalance = computed(() => {
    let running = 0;
    return this.filtered().map(e => {
      running += (e.debit ?? 0) - (e.credit ?? 0);
      return { ...e, running_balance: running };
    });
  });

  totalDebit = computed(() => this.filtered().reduce((sum, e) => sum + (e.debit ?? 0), 0));
  totalCredit = computed(() => this.filtered().reduce((sum, e) => sum + (e.credit ?? 0), 0));
  balanceDue = computed(() => this.totalDebit() - this.totalCredit());

  summaryCards = computed<SummaryCard[]>(() => [
    { title: 'Total Billed (Dr)', value: this.totalDebit(), color: 'danger', prefix: '₹', icon: 'ri-arrow-up-circle-line' },
    { title: 'Total Paid (Cr)', value: this.totalCredit(), color: 'success', prefix: '₹', icon: 'ri-arrow-down-circle-line' },
    { title: 'Closing Due Balance', value: this.balanceDue(), color: this.balanceDue() > 0 ? 'warning' : 'success', prefix: '₹', icon: 'ri-scales-3-line' },
  ]);

  ngOnInit(): void {
    this.loadRetailers();
    this.api.get<any[]>('/sites').subscribe({
      next: data => this.sites.set(data),
    });
  }

  private loadRetailers(): void {
    this.api.get<any[]>('/retailers').subscribe({
      next: data => this.retailers.set(data),
      error: () => this.notify.error('Failed to load retailers'),
    });
  }

  generateLedger(): void {
    const id = this.selectedRetailerId();
    if (!id) {
      this.ledgerEntries.set([]);
      return;
    }
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.dateFrom()) params['from'] = this.dateFrom();
    if (this.dateTo()) params['to'] = this.dateTo();
    if (this.selectedSiteId()) params['site_id'] = this.selectedSiteId();
    this.api.get<any[]>(`/ledger/retailer/${id}`, params).subscribe({
      next: data => { this.ledgerEntries.set(data); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load retailer ledger'); this.loading.set(false); },
    });
  }

  exportLedger(): void {
    const retailer = this.retailers().find(r => r.id === this.selectedRetailerId());
    const name = retailer?.name ?? 'Retailer';
    this.exportService.exportToExcel(this.entriesWithBalance(), `Ledger_${name}`, 'Retail Ledger', [
      { key: 'date', header: 'Date' },
      { key: 'type', header: 'Type' },
      { key: 'particulars', header: 'Particulars' },
      { key: 'ref_no', header: 'Ref / Bill No' },
      { key: 'debit', header: 'Debit (₹)' },
      { key: 'credit', header: 'Credit (₹)' },
      { key: 'running_balance', header: 'Balance (₹)' },
    ]);
  }

  exportPDF(): void {
    const retailer = this.retailers().find(r => r.id === this.selectedRetailerId());
    this.exportService.exportToPDF({
      title: `Retail Ledger - ${retailer?.name ?? ''}`,
      fileName: `Ledger_${retailer?.name ?? 'Retailer'}`,
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'particulars', header: 'Particulars' },
        { key: 'ref_no', header: 'Ref No' },
        { key: 'debit', header: 'Debit (₹)' },
        { key: 'credit', header: 'Credit (₹)' },
        { key: 'running_balance', header: 'Balance (₹)' },
      ],
      data: this.entriesWithBalance(),
      summaryRow: { particulars: 'TOTAL', debit: this.totalDebit(), credit: this.totalCredit(), running_balance: this.balanceDue() },
      orientation: 'portrait',
      dualCopy: { partyLabel: 'Retailer Copy' },
    });
  }

  printLedger(): void {
    this.exportService.printReport('ledger-table', `Retail Ledger`);
  }
}
