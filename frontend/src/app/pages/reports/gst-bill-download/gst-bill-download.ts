import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { DataTableComponent } from '../../../shared/data-table/data-table.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { SearchableDropdownComponent } from '../../../shared/searchable-dropdown/searchable-dropdown.component';

@Component({
  selector: 'app-gst-bill-download',
  standalone: true,
  imports: [FormsModule, DataTableComponent, SummaryCardsComponent, SearchableDropdownComponent],
  templateUrl: './gst-bill-download.html',
  styleUrl: './gst-bill-download.scss',
})
export class GstBillDownloadComponent implements OnInit {
  readonly columns = [
    { key: 'bill_no', label: 'Bill No' },
    { key: 'retailer_name', label: 'Retailer' },
    { key: 'gst_no', label: 'GST No' },
    { key: 'bill_date', label: 'Date', type: 'date' as const },
    { key: 'base_amount', label: 'Base Amount', type: 'currency' as const },
    { key: 'cgst', label: 'CGST', type: 'currency' as const },
    { key: 'sgst', label: 'SGST', type: 'currency' as const },
    { key: 'igst', label: 'IGST', type: 'currency' as const },
    { key: 'total_amount', label: 'Total Amount', type: 'currency' as const },
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
  selectedBills = signal<Set<string>>(new Set());

  get companyItems() { return this.companies().map(c => ({ value: String(c.id), label: c.name })); }
  get siteItems() { return this.sites().map(s => ({ value: String(s.id), label: s.name })); }

  get summaryCards(): SummaryCard[] {
    const data = this.rows();
    const totalBase = data.reduce((s, r) => s + (r.base_amount ?? 0), 0);
    const totalGst = data.reduce((s, r) => s + (r.cgst ?? 0) + (r.sgst ?? 0) + (r.igst ?? 0), 0);
    const totalAmount = data.reduce((s, r) => s + (r.total_amount ?? 0), 0);
    return [
      { title: 'Total Bills', value: data.length, icon: 'ri-file-text-line', color: 'primary' },
      { title: 'Base Amount', value: totalBase, icon: 'ri-money-rupee-circle-line', color: 'info', prefix: '₹' },
      { title: 'Total GST', value: totalGst, icon: 'ri-percent-line', color: 'warning', prefix: '₹' },
      { title: 'Grand Total', value: totalAmount, icon: 'ri-wallet-line', color: 'success', prefix: '₹' },
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

    this.api.get<any[]>('/retailer-bills/gst-report', params).subscribe({
      next: res => {
        const data = Array.isArray(res) ? res : [];
        const enriched = data.map(b => ({
          ...b,
          base_amount: b.base_amount ?? b.taxable_amount ?? 0,
          cgst: b.cgst ?? 0, sgst: b.sgst ?? 0, igst: b.igst ?? 0,
        }));
        this.rows.set(enriched);
        this.selectedBills.set(new Set());
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err.message ?? 'Failed to load GST report');
        this.notifications.error('Failed to load GST bill report');
        this.loading.set(false);
      },
    });
  }

  toggleBillSelection(billNo: string): void {
    this.selectedBills.update(set => {
      const next = new Set(set);
      next.has(billNo) ? next.delete(billNo) : next.add(billNo);
      return next;
    });
  }

  toggleSelectAll(): void {
    const all = this.rows().map(r => r.bill_no);
    this.selectedBills.update(set => set.size === all.length ? new Set() : new Set(all));
  }

  get allSelected(): boolean {
    return this.rows().length > 0 && this.selectedBills().size === this.rows().length;
  }

  exportExcel(): void {
    this.exportService.exportToExcel(this.rows() as any[], 'gst-bills', 'GST Bill Report', this.columns.map(c => ({ key: c.key, header: c.label })));
  }

  printReport(): void {
    this.exportService.printReport('gst-report-table', 'GST Bill Report');
  }
}
