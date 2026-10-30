import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { SearchableDropdownComponent } from '../../../shared/searchable-dropdown/searchable-dropdown.component';

interface Site { id: string; name: string; }
interface Company { id: string; name: string; }
interface SectionData {
  label: string;
  key: string;
  items: any[];
  total: number;
}

@Component({
  selector: 'app-full-site-ledger',
  standalone: true,
  imports: [FormsModule, DecimalPipe, SummaryCardsComponent, SearchableDropdownComponent],
  templateUrl: './full-site-ledger.html',
  styleUrl: './full-site-ledger.scss',
})
export class FullSiteLedgerComponent implements OnInit {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  companyId = signal('');
  siteId = signal('');

  sitesLoading = signal(false);
  loading = signal(false);
  error = signal('');
  sites = signal<Site[]>([]);
  companies = signal<Company[]>([]);
  sections = signal<SectionData[]>([]);
  grandTotal = signal<number>(0);

  get companyItems() { return this.companies().map(c => ({ value: c.id, label: c.name })); }
  get siteItems() { return this.sites().map(s => ({ value: s.id, label: s.name })); }

  get summaryCards(): SummaryCard[] {
    const secs = this.sections();
    if (!secs.length) return [];
    const cards: SummaryCard[] = secs.map(s => ({
      title: s.label, value: s.total, icon: 'ri-folder-line', color: 'info' as const, prefix: '₹',
    }));
    cards.push({ title: 'Grand Total', value: this.grandTotal(), icon: 'ri-wallet-line', color: 'success', prefix: '₹' });
    return cards;
  }

  ngOnInit(): void {
    this.loadDropdowns();
  }

  loadDropdowns(): void {
    this.sitesLoading.set(true);
    this.api.get<Site[]>('/sites').subscribe({
      next: res => { this.sites.set(Array.isArray(res) ? res : []); this.sitesLoading.set(false); },
      error: () => this.sitesLoading.set(false),
    });
    this.api.get<Company[]>('/companies').subscribe({
      next: res => this.companies.set(Array.isArray(res) ? res : []),
      error: () => {},
    });
  }

  search(): void {
    if (!this.siteId()) { this.notifications.error('Please select a site'); return; }
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string> = { site_id: this.siteId() };
    if (this.companyId()) params['company_id'] = this.companyId();

    this.api.get<any>('/reports/site-ledger', params).subscribe({
      next: res => {
        if (res?.sections) {
          const sectionLabels: Record<string, string> = {
            employee: 'Employee', mobilization: 'Mobilization', retailer: 'Retailer', contractor: 'Contractor',
          };
          const parsedSections: SectionData[] = [];
          Object.entries(res.sections).forEach(([key, items]: [string, any]) => {
            const list = Array.isArray(items) ? items : [];
            const total = list.reduce((s: number, item: any) => s + (item.amount ?? item.total ?? 0), 0);
            parsedSections.push({ label: sectionLabels[key] ?? key, key, items: list, total });
          });
          this.sections.set(parsedSections);
          this.grandTotal.set(typeof res.grandTotal === 'number' ? res.grandTotal : parsedSections.reduce((s, sec) => s + sec.total, 0));
        } else {
          this.sections.set([]);
          this.grandTotal.set(0);
        }
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err.message ?? 'Failed to load ledger');
        this.notifications.error('Failed to load site ledger');
        this.loading.set(false);
      },
    });
  }

  exportExcel(): void {
    const allRows: any[] = [];
    this.sections().forEach(sec => {
      sec.items.forEach(item => { allRows.push({ section: sec.label, ...item }); });
    });
    this.exportService.exportToExcel(allRows as any[], 'full-site-ledger', 'Full Site Ledger', [
      { key: 'section', header: 'Section' },
      { key: 'month', header: 'Month' },
      { key: 'particulars', header: 'Particulars' },
      { key: 'debit', header: 'Debit' },
      { key: 'credit', header: 'Credit' },
      { key: 'amount', header: 'Amount' },
    ]);
  }

  printReport(): void {
    this.exportService.printReport('site-ledger-table', 'Full Site Ledger');
  }
}
