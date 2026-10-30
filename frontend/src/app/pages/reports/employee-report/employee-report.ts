import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { DataTableComponent } from '../../../shared/data-table/data-table.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface Site { id: string; name: string; }

@Component({
  selector: 'app-employee-report',
  standalone: true,
  imports: [FormsModule, DataTableComponent, SummaryCardsComponent],
  templateUrl: './employee-report.html',
  styleUrl: './employee-report.scss',
})
export class EmployeeReportComponent implements OnInit {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  get summaryCards(): SummaryCard[] {
    const data = this.rows();
    const active = data.filter(r => r.status === 'active').length;
    const catsCount = new Set(data.map(r => r.category).filter(Boolean)).size;
    return [
      { title: 'Total Employees', value: data.length, icon: 'ri-group-line', color: 'primary' },
      { title: 'Active', value: active, icon: 'ri-checkbox-circle-line', color: 'success' },
      { title: 'Inactive', value: data.length - active, icon: 'ri-close-circle-line', color: 'danger' },
      { title: 'Categories', value: catsCount, icon: 'ri-folder-line', color: 'info' },
    ];
  }

  readonly columns = [
    { key: 'display_id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'designation', label: 'Designation' },
    { key: 'category', label: 'Category' },
    { key: 'site_name', label: 'Site' },
    { key: 'phone', label: 'Phone' },
    { key: 'status', label: 'Status' },
  ];

  categoryFilter = '';
  siteFilter = '';
  statusFilter = '';

  sites: Site[] = [];
  categories: string[] = [];

  loading = signal(false);
  error = signal('');
  rows = signal<any[]>([]);

  ngOnInit(): void {
    this.loadSites();
    this.load();
  }

  loadSites(): void {
    this.api.get<Site[]>('/sites').subscribe({
      next: (res) => this.sites = Array.isArray(res) ? res : [],
      error: () => {},
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string> = {};
    if (this.categoryFilter.trim()) params['category'] = this.categoryFilter.trim();
    if (this.siteFilter.trim()) params['site_id'] = this.siteFilter.trim();
    if (this.statusFilter.trim()) params['status'] = this.statusFilter.trim();

    this.api.get<any[]>('/employees', params).subscribe({
      next: (res) => {
        const data = Array.isArray(res) ? res : [];
        this.rows.set(data);
        // Extract unique categories for filter
        const cats = new Set<string>();
        data.forEach(r => { if (r.category) cats.add(r.category); });
        this.categories = [...cats].sort();
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to load employees');
        this.notifications.error('Failed to load employee report');
        this.loading.set(false);
      },
    });
  }

  exportExcel(): void {
    this.exportService.exportToExcel(this.rows(), 'employee-report', 'Employee Report', this.columns.map(c => ({ key: c.key, header: c.label })));
  }

  printReport(): void {
    this.exportService.printReport('employee-report-table', 'Employee Report');
  }
}
