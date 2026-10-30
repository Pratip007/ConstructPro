import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { DataTableComponent } from '../../../shared/data-table/data-table.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface Site { id: string; name: string; }
interface Retailer { id: string; name: string; }

@Component({
  selector: 'app-purchase-report',
  standalone: true,
  imports: [FormsModule, DataTableComponent, SummaryCardsComponent],
  templateUrl: './purchase-report.html',
  styleUrl: './purchase-report.scss',
})
export class PurchaseReportComponent implements OnInit {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  get summaryCards(): SummaryCard[] {
    const data = this.rows();
    const totalAmount = data.reduce((s, r) => s + (r.total_amount ?? 0), 0);
    const paid = data.filter(r => r.status === 'paid').length;
    return [
      { title: 'Total Bills', value: data.length, icon: 'ri-shopping-cart-line', color: 'primary' },
      { title: 'Total Amount', value: totalAmount, icon: 'ri-money-rupee-circle-line', color: 'info', prefix: '₹' },
      { title: 'Paid', value: paid, icon: 'ri-checkbox-circle-line', color: 'success' },
      { title: 'Pending', value: data.length - paid, icon: 'ri-time-line', color: 'warning' },
    ];
  }

  readonly columns = [
    { key: 'bill_no', label: 'Bill No' },
    { key: 'retailer_name', label: 'Retailer' },
    { key: 'site_name', label: 'Site' },
    { key: 'bill_date', label: 'Date' },
    { key: 'total_amount', label: 'Amount' },
    { key: 'status', label: 'Status' },
  ];

  dateFrom = '';
  dateTo = '';
  siteId = '';
  retailerId = '';

  sites: Site[] = [];
  retailers: Retailer[] = [];

  loading = signal(false);
  error = signal('');
  rows = signal<any[]>([]);

  ngOnInit(): void {
    this.api.get<Site[]>('/sites').subscribe({
      next: (res) => this.sites = Array.isArray(res) ? res : [],
      error: () => {},
    });
    this.api.get<Retailer[]>('/retailers').subscribe({
      next: (res) => this.retailers = Array.isArray(res) ? res : [],
      error: () => {},
    });
  }

  generate(): void {
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string> = {};
    if (this.dateFrom) params['date_from'] = this.dateFrom;
    if (this.dateTo) params['date_to'] = this.dateTo;
    if (this.siteId.trim()) params['site_id'] = this.siteId.trim();
    if (this.retailerId.trim()) params['retailer_id'] = this.retailerId.trim();

    this.api.get<any[]>('/retailer-bills', params).subscribe({
      next: (res) => {
        this.rows.set(Array.isArray(res) ? res : []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to load report');
        this.notifications.error('Failed to load purchase report');
        this.loading.set(false);
      },
    });
  }

  exportExcel(): void {
    this.exportService.exportToExcel(this.rows(), 'purchase-report', 'Purchase Report', this.columns.map(c => ({ key: c.key, header: c.label })));
  }

  printReport(): void {
    this.exportService.printReport('purchase-report-table', 'Purchase Report');
  }
}
