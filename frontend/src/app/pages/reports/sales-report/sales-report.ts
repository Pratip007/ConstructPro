import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface Company { id: string; name: string; }
interface MonthlySales {
  month: string;
  invoices: number;
  total_gross: number;
  total_base: number;
  total_gst: number;
}
interface SalesResponse {
  monthly: MonthlySales[];
  grandTotal: {
    invoices: number;
    total_gross: number;
    total_base: number;
    total_gst: number;
  };
}

@Component({
  selector: 'app-sales-report',
  standalone: true,
  imports: [FormsModule, DecimalPipe, SummaryCardsComponent],
  templateUrl: './sales-report.html',
  styleUrl: './sales-report.scss',
})
export class SalesReportComponent implements OnInit {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  get summaryCards(): SummaryCard[] {
    const gt = this.grandTotal();
    if (!gt) return [];
    return [
      { title: 'Total Invoices', value: gt.invoices ?? 0, icon: 'ri-file-text-line', color: 'primary' },
      { title: 'Base Amount', value: gt.total_base ?? 0, icon: 'ri-money-rupee-circle-line', color: 'info', prefix: '₹' },
      { title: 'Total GST', value: gt.total_gst ?? 0, icon: 'ri-percent-line', color: 'warning', prefix: '₹' },
      { title: 'Gross Amount', value: gt.total_gross ?? 0, icon: 'ri-wallet-line', color: 'success', prefix: '₹' },
    ];
  }

  companyId = '';
  fiscalYear = '';

  companies: Company[] = [];
  loading = signal(false);
  error = signal('');
  monthlyData = signal<MonthlySales[]>([]);
  grandTotal = signal<any>(null);

  ngOnInit(): void {
    this.api.get<Company[]>('/companies').subscribe({
      next: (res) => this.companies = Array.isArray(res) ? res : [],
      error: () => {},
    });
  }

  generate(): void {
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string> = {};
    if (this.companyId.trim()) params['company_id'] = this.companyId.trim();
    if (this.fiscalYear.trim()) params['fy'] = this.fiscalYear.trim();

    this.api.get<SalesResponse>('/reports/sales', params).subscribe({
      next: (res) => {
        if (res && res.monthly) {
          this.monthlyData.set(res.monthly);
          this.grandTotal.set(res.grandTotal ?? null);
        } else if (Array.isArray(res)) {
          // Fallback: API returned flat array
          this.monthlyData.set(res as any);
          this.grandTotal.set(null);
        } else {
          this.monthlyData.set([]);
          this.grandTotal.set(null);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to load report');
        this.notifications.error('Failed to load sales report');
        this.loading.set(false);
      },
    });
  }

  exportExcel(): void {
    const data = this.monthlyData().map(m => ({
      month: m.month,
      invoices: m.invoices,
      total_base: m.total_base,
      total_gst: m.total_gst,
      total_gross: m.total_gross,
    }));
    this.exportService.exportToExcel(data, 'sales-report', 'Sales Report', [
      { key: 'month', header: 'Month' },
      { key: 'invoices', header: 'Invoices' },
      { key: 'total_base', header: 'Base Amount' },
      { key: 'total_gst', header: 'GST' },
      { key: 'total_gross', header: 'Gross Amount' },
    ]);
  }

  printReport(): void {
    this.exportService.printReport('sales-report-table', 'Sales Report');
  }
}
