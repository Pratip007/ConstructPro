import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { DataTableComponent } from '../../../shared/data-table/data-table.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

@Component({
  selector: 'app-company-report',
  standalone: true,
  imports: [FormsModule, DataTableComponent, SummaryCardsComponent],
  templateUrl: './company-report.html',
  styleUrl: './company-report.scss',
})
export class CompanyReportComponent implements OnInit {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  readonly columns = [
    { key: 'display_id', label: 'ID' },
    { key: 'name', label: 'Company Name' },
    { key: 'contact_person', label: 'Contact' },
    { key: 'phone', label: 'Phone' },
    { key: 'gst_no', label: 'GST No' },
    { key: 'total_invoices', label: 'Total Invoices' },
    { key: 'total_payments', label: 'Total Payments' },
    { key: 'balance', label: 'Balance' },
    { key: 'status', label: 'Status' },
  ];

  search = '';

  get summaryCards(): SummaryCard[] {
    const data = this.rows();
    const totalInv = data.reduce((s, r) => s + (r.total_invoices ?? 0), 0);
    const totalPay = data.reduce((s, r) => s + (r.total_payments ?? 0), 0);
    const totalBal = data.reduce((s, r) => s + (r.balance ?? 0), 0);
    return [
      { title: 'Companies', value: data.length, icon: 'ri-building-line', color: 'primary' },
      { title: 'Total Invoiced', value: totalInv, icon: 'ri-file-text-line', color: 'info', prefix: '₹' },
      { title: 'Total Paid', value: totalPay, icon: 'ri-checkbox-circle-line', color: 'success', prefix: '₹' },
      { title: 'Balance Due', value: totalBal, icon: 'ri-money-rupee-circle-line', color: totalBal > 0 ? 'danger' : 'success', prefix: '₹' },
    ];
  }

  loading = signal(false);
  error = signal('');
  rows = signal<any[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string> = {};
    if (this.search.trim()) params['search'] = this.search.trim();

    this.api.get<any[]>('/companies', params).subscribe({
      next: (res) => {
        const data = Array.isArray(res) ? res : [];
        const enriched = data.map(c => ({
          ...c,
          total_invoices: c.total_invoices ?? 0,
          total_payments: c.total_payments ?? 0,
          balance: c.balance ?? (c.total_invoices ?? 0) - (c.total_payments ?? 0),
        }));
        this.rows.set(enriched);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to load companies');
        this.notifications.error('Failed to load company report');
        this.loading.set(false);
      },
    });
  }

  exportExcel(): void {
    this.exportService.exportToExcel(this.rows(), 'company-report', 'Company Report', this.columns.map(c => ({ key: c.key, header: c.label })));
  }

  printReport(): void {
    this.exportService.printReport('company-report-table', 'Company Report');
  }
}
