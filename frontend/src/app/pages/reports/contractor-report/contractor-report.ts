import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { DataTableComponent } from '../../../shared/data-table/data-table.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

@Component({
  selector: 'app-contractor-report',
  standalone: true,
  imports: [FormsModule, DataTableComponent, SummaryCardsComponent],
  templateUrl: './contractor-report.html',
  styleUrl: './contractor-report.scss',
})
export class ContractorReportComponent implements OnInit {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  get summaryCards(): SummaryCard[] {
    const data = this.rows();
    const totalOrders = data.reduce((s, r) => s + (r.total_orders ?? 0), 0);
    const totalPaid = data.reduce((s, r) => s + (r.total_paid ?? 0), 0);
    const totalBal = data.reduce((s, r) => s + (r.balance ?? 0), 0);
    return [
      { title: 'Contractors', value: data.length, icon: 'ri-user-settings-line', color: 'primary' },
      { title: 'Total Orders', value: totalOrders, icon: 'ri-file-list-line', color: 'info', prefix: '₹' },
      { title: 'Total Paid', value: totalPaid, icon: 'ri-checkbox-circle-line', color: 'success', prefix: '₹' },
      { title: 'Balance', value: totalBal, icon: 'ri-money-rupee-circle-line', color: totalBal > 0 ? 'danger' : 'success', prefix: '₹' },
    ];
  }

  readonly columns = [
    { key: 'display_id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'phone', label: 'Phone' },
    { key: 'total_orders', label: 'Total Orders' },
    { key: 'total_paid', label: 'Total Paid' },
    { key: 'balance', label: 'Balance' },
    { key: 'status', label: 'Status' },
  ];

  loading = signal(false);
  error = signal('');
  rows = signal<any[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    this.api.get<any[]>('/contractors').subscribe({
      next: (contractors) => {
        const data = Array.isArray(contractors) ? contractors : [];
        // Enrich with ledger summaries if not already present
        const enriched = data.map(c => ({
          ...c,
          total_orders: c.total_orders ?? 0,
          total_paid: c.total_paid ?? 0,
          balance: c.balance ?? (c.total_orders ?? 0) - (c.total_paid ?? 0),
        }));
        this.rows.set(enriched);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to load contractors');
        this.notifications.error('Failed to load contractor report');
        this.loading.set(false);
      },
    });
  }

  exportExcel(): void {
    this.exportService.exportToExcel(this.rows(), 'contractor-report', 'Contractor Report', this.columns.map(c => ({ key: c.key, header: c.label })));
  }

  printReport(): void {
    this.exportService.printReport('contractor-report-table', 'Contractor Report');
  }
}
