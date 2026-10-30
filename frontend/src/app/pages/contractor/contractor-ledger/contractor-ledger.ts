import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { RoleService } from '../../../core/services/role.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface Contractor {
  id: number;
  name: string;
  category: string;
  tds_applicable?: boolean;
  tds_percent?: number;
}

interface Site {
  id: number;
  name: string;
}

interface LedgerEntry {
  id: number;
  date: string;
  site_name?: string;
  invoice_ref?: string;
  description: string;
  gross_amount: number;
  tds_amount: number;
  net_payable: number;
  debit: number;
  credit: number;
  balance: number;
  payments?: { date: string; amount: number; ref?: string }[];
}

@Component({
  selector: 'app-contractor-ledger',
  standalone: true,
  imports: [FormsModule, CommonModule, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './contractor-ledger.html',
  styleUrl: './contractor-ledger.scss',
})
export class ContractorLedgerComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  readonly role = inject(RoleService);

  searchQuery = signal('');
  dateFrom = signal('');
  dateTo = signal('');
  contractors = signal<Contractor[]>([]);
  sites = signal<Site[]>([]);
  selectedContractorId = signal<number | null>(null);
  selectedSiteId = signal<number | null>(null);
  ledger = signal<LedgerEntry[]>([]);
  loadingContractors = signal(false);
  loadingLedger = signal(false);

  contractorItems = computed<DropdownItem[]>(() =>
    this.contractors().map(c => ({ value: c.id, label: c.name }))
  );

  siteItems = computed<DropdownItem[]>(() => [
    { value: 0, label: 'All Sites (Consolidated)' },
    ...this.sites().map(s => ({ value: s.id, label: s.name }))
  ]);

  selectedContractor = computed(() => {
    const id = this.selectedContractorId();
    if (!id) return null;
    return this.contractors().find(c => c.id === id) ?? null;
  });

  filteredLedger = computed(() => {
    let entries = this.ledger();
    const from = this.dateFrom();
    const to = this.dateTo();
    const siteId = this.selectedSiteId();
    const q = this.searchQuery().toLowerCase();

    if (from) entries = entries.filter(e => e.date >= from);
    if (to) entries = entries.filter(e => e.date <= to);
    if (siteId && siteId > 0) entries = entries.filter(e => e.site_name?.toLowerCase().includes(
      this.sites().find(s => s.id === siteId)?.name?.toLowerCase() || ''
    ));
    if (q) entries = entries.filter(e =>
      e.description.toLowerCase().includes(q) ||
      (e.invoice_ref || '').toLowerCase().includes(q) ||
      (e.site_name || '').toLowerCase().includes(q)
    );
    return entries;
  });

  totalGross = computed(() => this.filteredLedger().reduce((s, e) => s + (e.gross_amount || e.debit || 0), 0));

  totalTds = computed(() => {
    const entries = this.filteredLedger();
    const entryTds = entries.reduce((s, e) => s + (e.tds_amount || 0), 0);
    if (entryTds > 0) return entryTds;
    const c = this.selectedContractor();
    if (c?.tds_applicable && c.tds_percent) {
      return Math.round(this.totalGross() * c.tds_percent / 100 * 100) / 100;
    }
    return 0;
  });

  netBilled = computed(() => Math.round((this.totalGross() - this.totalTds()) * 100) / 100);
  totalPayments = computed(() => this.filteredLedger().reduce((s, e) => s + (e.credit || 0), 0));
  outstandingDue = computed(() => Math.round((this.netBilled() - this.totalPayments()) * 100) / 100);

  summaryCards = computed<SummaryCard[]>(() => [
    { title: 'Total Billed (Net)', value: this.netBilled(), prefix: '₹', icon: 'ri-bill-line', color: 'info' },
    { title: 'Total Payments Cleared', value: this.totalPayments(), prefix: '₹', icon: 'ri-money-dollar-circle-line', color: 'success' },
    { title: 'Outstanding Due Balance', value: this.outstandingDue(), prefix: '₹', icon: 'ri-funds-line', color: this.outstandingDue() > 0 ? 'danger' : 'success' },
  ]);

  ngOnInit(): void {
    this.loadContractors();
    this.loadSites();
  }

  loadContractors(): void {
    this.loadingContractors.set(true);
    this.api.get<Contractor[]>('/contractors').subscribe({
      next: data => { this.contractors.set(data); this.loadingContractors.set(false); },
      error: err => { this.notify.error('Failed to load contractors: ' + err.message); this.loadingContractors.set(false); },
    });
  }

  loadSites(): void {
    this.api.get<Site[]>('/sites').subscribe({
      next: data => this.sites.set(data),
      error: () => {},
    });
  }

  onContractorChange(id: number | null): void {
    this.selectedContractorId.set(id);
    if (!id) { this.ledger.set([]); return; }
    this.loadLedger(id);
  }

  loadLedger(contractorId: number): void {
    this.loadingLedger.set(true);
    this.ledger.set([]);
    this.api.get<LedgerEntry[]>(`/ledger/contractor/${contractorId}`).subscribe({
      next: data => { this.ledger.set(data); this.loadingLedger.set(false); },
      error: err => { this.notify.error('Failed to load ledger: ' + err.message); this.loadingLedger.set(false); },
    });
  }

  formatCurrency(val: number): string {
    if (val == null || val === 0) return '';
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Export / Print
  exportExcel(): void {
    const name = this.selectedContractor()?.name ?? 'contractor';
    this.exportService.exportToExcel(this.filteredLedger() as any, `${name}_ledger`, `Ledger - ${name}`, [
      { key: 'date', header: 'Date' },
      { key: 'site_name', header: 'Site / Project' },
      { key: 'invoice_ref', header: 'Invoice / Ref' },
      { key: 'description', header: 'Particulars' },
      { key: 'gross_amount', header: 'Gross Bill' },
      { key: 'tds_amount', header: 'TDS Deducted' },
      { key: 'net_payable', header: 'Net Payable' },
      { key: 'credit', header: 'Payments' },
      { key: 'balance', header: 'Due Balance' },
    ]);
  }

  exportPdf(): void {
    const name = this.selectedContractor()?.name ?? 'Contractor';
    this.exportService.exportToPDF({
      title: `Contractor Ledger - ${name}`,
      fileName: `${name}_ledger`,
      data: this.filteredLedger() as any,
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'site_name', header: 'Site' },
        { key: 'invoice_ref', header: 'Ref No' },
        { key: 'gross_amount', header: 'Gross', format: 'currency', align: 'right' },
        { key: 'tds_amount', header: 'TDS', format: 'currency', align: 'right' },
        { key: 'net_payable', header: 'Net', format: 'currency', align: 'right' },
        { key: 'credit', header: 'Paid', format: 'currency', align: 'right' },
        { key: 'balance', header: 'Due', format: 'currency', align: 'right' },
      ],
      summaryRow: {
        date: '', site_name: '', invoice_ref: 'TOTAL',
        gross_amount: this.totalGross(), tds_amount: this.totalTds(),
        net_payable: this.netBilled(), credit: this.totalPayments(), balance: this.outstandingDue()
      },
      dualCopy: { partyLabel: 'Contractor Copy' },
      footerLeft: 'Contractor Signature',
      footerRight: 'Authorized Signatory',
      dateRange: this.dateFrom() || this.dateTo() ? { from: this.dateFrom(), to: this.dateTo() } : undefined,
    });
  }

  printLedger(): void {
    const name = this.selectedContractor()?.name ?? 'Contractor';
    this.exportService.printReport('ledgerTable', `Ledger - ${name}`);
  }

  clearDateFilter(): void {
    this.dateFrom.set('');
    this.dateTo.set('');
  }
}
