import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { DataTableComponent } from '../../../shared/data-table/data-table.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { SearchableDropdownComponent } from '../../../shared/searchable-dropdown/searchable-dropdown.component';

@Component({
  selector: 'app-non-gst-bill-download',
  standalone: true,
  imports: [FormsModule, DataTableComponent, SummaryCardsComponent, SearchableDropdownComponent],
  templateUrl: './non-gst-bill-download.html',
  styleUrl: './non-gst-bill-download.scss',
})
export class NonGstBillDownloadComponent implements OnInit {
  readonly columns = [
    { key: 'bill_no', label: 'Bill No' },
    { key: 'retailer_name', label: 'Retailer' },
    { key: 'site_name', label: 'Site' },
    { key: 'bill_date', label: 'Date', type: 'date' as const },
    { key: 'description', label: 'Description' },
    { key: 'total_amount', label: 'Amount', type: 'currency' as const },
    { key: 'status', label: 'Status', type: 'badge' as const, badgeMap: { paid: 'badge-success', unpaid: 'badge-danger', partial: 'badge-warning' } as any },
  ];
  private api = inject(ApiService);
  private notifications = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  dateFrom = signal('');
  dateTo = signal('');
  companyFilter = signal('');
  siteFilter = signal('');

  companies = signal<any[]>([]);
  sites = signal<any[]>([]);
  loading = signal(false);
  error = signal('');
  rows = signal<any[]>([]);

  get companyItems() { return this.companies().map(c => ({ value: String(c.id), label: c.name })); }
  get siteItems() { return this.sites().map(s => ({ value: String(s.id), label: s.name })); }

  get summaryCards(): SummaryCard[] {
    const data = this.rows();
    const totalAmount = data.reduce((s, r) => s + (r.total_amount ?? 0), 0);
    const paid = data.filter(r => r.status === 'paid').length;
    return [
      { title: 'Total Bills', value: data.length, icon: 'ri-file-list-3-line', color: 'primary' },
      { title: 'Total Amount', value: totalAmount, icon: 'ri-money-rupee-circle-line', color: 'info', prefix: '₹' },
      { title: 'Paid', value: paid, icon: 'ri-checkbox-circle-line', color: 'success' },
      { title: 'Unpaid', value: data.length - paid, icon: 'ri-close-circle-line', color: 'danger' },
    ];
  }

  ngOnInit(): void {
    this.api.get<any[]>('/companies').subscribe({ next: d => this.companies.set(d ?? []), error: () => {} });
    this.api.get<any[]>('/sites').subscribe({ next: d => this.sites.set(d ?? []), error: () => {} });
  }

  generate(): void {
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string> = {};
    if (this.dateFrom()) params['date_from'] = this.dateFrom();
    if (this.dateTo()) params['date_to'] = this.dateTo();
    if (this.companyFilter()) params['company_id'] = this.companyFilter();
    if (this.siteFilter()) params['site_id'] = this.siteFilter();

    this.api.get<any[]>('/retailer-bills/non-gst-report', params).subscribe({
      next: res => { this.rows.set(Array.isArray(res) ? res : []); this.loading.set(false); },
      error: err => {
        this.error.set(err.message ?? 'Failed to load non-GST report');
        this.notifications.error('Failed to load non-GST bill report');
        this.loading.set(false);
      },
    });
  }

  exportExcel(): void {
    this.exportService.exportToExcel(this.rows() as any[], 'non-gst-bills', 'Non-GST Bill Report', this.columns.map(c => ({ key: c.key, header: c.label })));
  }

  printReport(): void {
    this.exportService.printReport('non-gst-report-table', 'Non-GST Bill Report');
  }
}
