import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

@Component({
  selector: 'app-non-gst-report',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './non-gst-report.html',
  styleUrl: './non-gst-report.scss',
})
export class NonGstReportComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  bills = signal<any[]>([]);
  loading = signal(false);
  searchQuery = signal('');
  selectedMonth = signal(new Date().getMonth() + 1);
  selectedYear = signal(new Date().getFullYear());
  selectedRetailerId = signal('');
  selectedSiteId = signal('');

  retailers = signal<any[]>([]);
  sites = signal<any[]>([]);

  months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
  ];

  years: number[] = [];

  retailerItems = computed<DropdownItem[]>(() =>
    [{ value: '', label: 'All Retailers' }, ...this.retailers().map(r => ({ value: r.id, label: r.name }))]
  );
  siteItems = computed<DropdownItem[]>(() =>
    [{ value: '', label: 'All Sites' }, ...this.sites().map(s => ({ value: s.id, label: s.name }))]
  );

  filtered = computed(() => {
    let list = this.bills();
    const q = this.searchQuery().toLowerCase();
    if (q) {
      list = list.filter(b =>
        (b.bill_number ?? '').toLowerCase().includes(q) ||
        (b.retailer_name ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  });

  totalAmount = computed(() => this.filtered().reduce((s, b) => s + (b.total_amount ?? b.amount ?? 0), 0));
  totalPaid = computed(() => this.filtered().reduce((s, b) => s + (b.paid_amount ?? 0), 0));
  totalDue = computed(() => this.filtered().reduce((s, b) => s + (b.due_amount ?? 0), 0));

  summaryCards = computed<SummaryCard[]>(() => [
    { title: 'Total Bills', value: this.filtered().length, color: 'primary', icon: 'ri-file-list-3-line' },
    { title: 'Total Amount', value: this.totalAmount(), color: 'info', prefix: '₹', icon: 'ri-money-rupee-circle-line' },
    { title: 'Total Paid', value: this.totalPaid(), color: 'success', prefix: '₹', icon: 'ri-checkbox-circle-line' },
    { title: 'Total Due', value: this.totalDue(), color: this.totalDue() > 0 ? 'danger' : 'success', prefix: '₹', icon: 'ri-error-warning-line' },
  ]);

  ngOnInit(): void {
    const currentYear = new Date().getFullYear();
    this.years = Array.from({ length: 5 }, (_, i) => currentYear - i);
    this.loadDropdowns();
    this.loadReport();
  }

  private loadDropdowns(): void {
    this.api.get<any[]>('/retailers').subscribe({ next: d => this.retailers.set(d) });
    this.api.get<any[]>('/sites').subscribe({ next: d => this.sites.set(d) });
  }

  loadReport(): void {
    this.loading.set(true);
    const params: Record<string, string> = {
      month: String(this.selectedMonth()),
      year: String(this.selectedYear()),
    };
    if (this.selectedRetailerId()) params['retailer_id'] = this.selectedRetailerId();
    if (this.selectedSiteId()) params['site_id'] = this.selectedSiteId();
    this.api.get<any[]>('/retailer-bills/non-gst-report', params).subscribe({
      next: data => { this.bills.set(data); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load Non-GST report'); this.loading.set(false); },
    });
  }

  exportReport(): void {
    this.exportService.exportToExcel(this.filtered(), 'Non_GST_Report', 'Non-GST Report', [
      { key: 'bill_number', header: 'Bill / Ref No' },
      { key: 'retailer_name', header: 'Retailer' },
      { key: 'site_name', header: 'Site' },
      { key: 'date', header: 'Date' },
      { key: 'total_amount', header: 'Amount' },
      { key: 'paid_amount', header: 'Paid' },
      { key: 'due_amount', header: 'Due' },
      { key: 'status', header: 'Status' },
    ]);
  }

  downloadAllBills(): void {
    const docsWithUrl = this.filtered().filter(b => b.document_url);
    if (!docsWithUrl.length) {
      this.notify.info('No bill documents to download');
      return;
    }
    const fetches = docsWithUrl.map(b =>
      fetch(b.document_url).then(r => r.blob()).then(content => ({
        name: `${b.bill_number ?? b.id}.pdf`,
        content,
      }))
    );
    Promise.all(fetches).then(files =>
      this.exportService.downloadAsZip(files, `NonGST_Bills_${this.selectedMonth()}_${this.selectedYear()}`)
    ).catch(() => this.notify.error('Failed to download bills'));
  }
}
