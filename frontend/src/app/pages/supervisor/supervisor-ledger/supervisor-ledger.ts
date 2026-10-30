import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { RoleService } from '../../../core/services/role.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface Supervisor { id: number; name: string; contact: string; site_id?: number; }
interface Site { id: number; name: string; }

interface LedgerEntry {
  id: number;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

@Component({
  selector: 'app-supervisor-ledger',
  standalone: true,
  imports: [FormsModule, DecimalPipe, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './supervisor-ledger.html',
  styleUrl: './supervisor-ledger.scss',
})
export class SupervisorLedgerComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  readonly role = inject(RoleService);

  searchQuery = signal('');
  dateFrom = signal('');
  dateTo = signal('');
  selectedSiteId = signal<string>('');
  selectedSupervisorId = signal<string>('');
  supervisors = signal<Supervisor[]>([]);
  sites = signal<Site[]>([]);
  ledger = signal<LedgerEntry[]>([]);
  loadingSupervisors = signal(false);
  loadingLedger = signal(false);

  siteItems = computed<DropdownItem[]>(() =>
    this.sites().map(s => ({ value: String(s.id), label: s.name }))
  );

  supervisorItems = computed<DropdownItem[]>(() => {
    const siteId = this.selectedSiteId();
    let list = this.supervisors();
    if (siteId) {
      list = list.filter(s => String(s.site_id) === siteId);
    }
    return list.map(s => ({ value: String(s.id), label: s.name }));
  });

  filteredLedger = computed(() => {
    let entries = this.ledger();
    const from = this.dateFrom();
    const to = this.dateTo();
    if (from) entries = entries.filter(e => e.date >= from);
    if (to) entries = entries.filter(e => e.date <= to);
    const q = this.searchQuery().toLowerCase();
    if (q) {
      entries = entries.filter(e =>
        e.description.toLowerCase().includes(q) ||
        e.date.includes(q)
      );
    }
    return entries;
  });

  totalDebit = computed(() => this.filteredLedger().reduce((s, e) => s + (e.debit ?? 0), 0));
  totalCredit = computed(() => this.filteredLedger().reduce((s, e) => s + (e.credit ?? 0), 0));
  closingBalance = computed(() => {
    const entries = this.filteredLedger();
    return entries.length ? entries[entries.length - 1].balance : 0;
  });

  summaryCards = computed<SummaryCard[]>(() => [
    { title: 'Total Debit', value: this.totalDebit(), icon: 'ri-arrow-up-line', color: 'danger', prefix: '₹' },
    { title: 'Total Credit', value: this.totalCredit(), icon: 'ri-arrow-down-line', color: 'success', prefix: '₹' },
    { title: 'Balance', value: this.closingBalance(), icon: 'ri-wallet-3-line', color: this.closingBalance() >= 0 ? 'info' : 'danger', prefix: '₹' },
    { title: 'Entries', value: this.filteredLedger().length, icon: 'ri-file-list-3-line', color: 'primary' },
  ]);

  private get selectedSupervisorName(): string {
    const id = this.selectedSupervisorId();
    if (!id) return 'Supervisor';
    return this.supervisors().find(s => String(s.id) === id)?.name ?? 'Supervisor';
  }

  ngOnInit(): void {
    this.loadSites();
    this.loadSupervisors();
  }

  loadSites(): void {
    this.api.get<Site[]>('/sites').subscribe({
      next: data => this.sites.set(data),
      error: () => this.notify.error('Failed to load sites'),
    });
  }

  loadSupervisors(): void {
    this.loadingSupervisors.set(true);
    this.api.get<Supervisor[]>('/supervisors').subscribe({
      next: data => { this.supervisors.set(data); this.loadingSupervisors.set(false); },
      error: () => { this.notify.error('Failed to load supervisors'); this.loadingSupervisors.set(false); },
    });
  }

  onSiteChange(siteId: string): void {
    this.selectedSiteId.set(siteId);
    this.selectedSupervisorId.set('');
    this.ledger.set([]);
  }

  onSupervisorChange(id: string): void {
    this.selectedSupervisorId.set(id);
    if (!id) {
      this.ledger.set([]);
      return;
    }
    this.loadLedger(id);
  }

  loadLedger(supervisorId: string): void {
    this.loadingLedger.set(true);
    this.ledger.set([]);
    this.api.get<LedgerEntry[]>(`/ledger/supervisor/${supervisorId}`).subscribe({
      next: data => { this.ledger.set(data); this.loadingLedger.set(false); },
      error: () => { this.notify.error('Failed to load ledger'); this.loadingLedger.set(false); },
    });
  }

  getBalanceClass(balance: number): string {
    return balance >= 0 ? 'balance-positive' : 'balance-negative';
  }

  getMonthLabel(date: string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  isNewMonth(entries: LedgerEntry[], index: number): boolean {
    if (index === 0) return true;
    const curr = this.getMonthLabel(entries[index].date);
    const prev = this.getMonthLabel(entries[index - 1].date);
    return curr !== prev;
  }

  exportCsv(): void {
    const columns = [
      { key: 'date', header: 'Date' },
      { key: 'description', header: 'Description' },
      { key: 'debit', header: 'Debit' },
      { key: 'credit', header: 'Credit' },
      { key: 'balance', header: 'Balance' },
    ];
    this.exportService.exportToCSV(this.filteredLedger(), `${this.selectedSupervisorName}_Ledger`, columns);
  }

  exportExcel(): void {
    const columns = [
      { key: 'date', header: 'Date' },
      { key: 'description', header: 'Description' },
      { key: 'debit', header: 'Debit' },
      { key: 'credit', header: 'Credit' },
      { key: 'balance', header: 'Balance' },
    ];
    this.exportService.exportToExcel(
      this.filteredLedger(),
      `${this.selectedSupervisorName}_Ledger`,
      `${this.selectedSupervisorName} - Ledger`,
      columns
    );
  }

  exportPdf(): void {
    this.exportService.exportToPDF({
      data: this.filteredLedger(),
      fileName: `${this.selectedSupervisorName}_Ledger`,
      title: `${this.selectedSupervisorName} - Ledger`,
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'description', header: 'Description' },
        { key: 'debit', header: 'Debit' },
        { key: 'credit', header: 'Credit' },
        { key: 'balance', header: 'Balance' },
      ],
    });
  }

  printLedger(): void {
    this.exportService.printReport('ledgerTable', `${this.selectedSupervisorName} - Ledger`);
  }
}
