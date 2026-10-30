import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { DataTableComponent } from '../../../shared/data-table/data-table.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

@Component({
  selector: 'app-supervisor-report',
  standalone: true,
  imports: [FormsModule, DataTableComponent, SummaryCardsComponent],
  templateUrl: './supervisor-report.html',
  styleUrl: './supervisor-report.scss',
})
export class SupervisorReportComponent implements OnInit {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  get summaryCards(): SummaryCard[] {
    const data = this.rows();
    const totalFund = data.reduce((s, r) => s + (r.fund_balance ?? 0), 0);
    const active = data.filter(r => r.status === 'active').length;
    return [
      { title: 'Supervisors', value: data.length, icon: 'ri-shield-user-line', color: 'primary' },
      { title: 'Active', value: active, icon: 'ri-checkbox-circle-line', color: 'success' },
      { title: 'Inactive', value: data.length - active, icon: 'ri-close-circle-line', color: 'danger' },
      { title: 'Total Fund', value: totalFund, icon: 'ri-wallet-line', color: 'info', prefix: '₹' },
    ];
  }

  readonly columns = [
    { key: 'display_id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'site_name', label: 'Site' },
    { key: 'designation', label: 'Designation' },
    { key: 'fund_balance', label: 'Fund Balance' },
    { key: 'status', label: 'Status' },
  ];

  search = '';

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

    this.api.get<any[]>('/supervisors', params).subscribe({
      next: (res) => {
        const data = Array.isArray(res) ? res : [];
        const enriched = data.map(s => ({
          ...s,
          fund_balance: s.fund_balance ?? 0,
        }));
        this.rows.set(enriched);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to load supervisors');
        this.notifications.error('Failed to load supervisor report');
        this.loading.set(false);
      },
    });
  }

  exportExcel(): void {
    this.exportService.exportToExcel(this.rows(), 'supervisor-report', 'Supervisor Report', this.columns.map(c => ({ key: c.key, header: c.label })));
  }

  printReport(): void {
    this.exportService.printReport('supervisor-report-table', 'Supervisor Report');
  }
}
