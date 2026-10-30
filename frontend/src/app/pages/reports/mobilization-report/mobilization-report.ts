import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface Site { id: string; name: string; }
interface Contractor { id: string; name: string; }
interface Equipment { id: string; name: string; }

@Component({
  selector: 'app-mobilization-report',
  standalone: true,
  imports: [FormsModule, DecimalPipe, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './mobilization-report.html',
  styleUrl: './mobilization-report.scss',
})
export class MobilizationReportComponent implements OnInit {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  siteId = signal('');
  partyId = signal('');
  equipmentId = signal('');
  dateFrom = signal('');
  dateTo = signal('');

  sites = signal<Site[]>([]);
  contractors = signal<Contractor[]>([]);
  equipmentList = signal<Equipment[]>([]);

  loading = signal(false);
  error = signal('');
  rows = signal<any[]>([]);

  siteItems = computed<DropdownItem[]>(() =>
    this.sites().map(s => ({ value: s.id, label: s.name }))
  );
  contractorItems = computed<DropdownItem[]>(() =>
    this.contractors().map(c => ({ value: c.id, label: c.name }))
  );
  equipmentItems = computed<DropdownItem[]>(() =>
    this.equipmentList().map(e => ({ value: e.id, label: e.name }))
  );

  totalDuration = computed(() => this.rows().reduce((s, r) => s + (r.duration_days ?? 0), 0));
  totalCost = computed(() => this.rows().reduce((s, r) => s + (r.total_cost ?? 0), 0));
  avgRate = computed(() => {
    const r = this.rows();
    if (!r.length) return 0;
    return r.reduce((s, row) => s + (row.rate ?? 0), 0) / r.length;
  });

  summaryCards = computed<SummaryCard[]>(() => [
    { title: 'Total Records', value: this.rows().length, icon: 'ri-file-list-3-line', color: 'primary' },
    { title: 'Total Days', value: this.totalDuration(), icon: 'ri-time-line', color: 'info' },
    { title: 'Total Cost', value: this.totalCost(), icon: 'ri-money-rupee-circle-line', color: 'success', prefix: '₹' },
    { title: 'Avg Rate', value: Math.round(this.avgRate()), icon: 'ri-bar-chart-line', color: 'warning', prefix: '₹' },
  ]);

  ngOnInit(): void {
    this.api.get<Site[]>('/sites').subscribe({
      next: res => this.sites.set(Array.isArray(res) ? res : []),
      error: () => {},
    });
    this.api.get<Contractor[]>('/contractors').subscribe({
      next: res => this.contractors.set(Array.isArray(res) ? res : []),
      error: () => {},
    });
    this.api.get<Equipment[]>('/equipment').subscribe({
      next: res => this.equipmentList.set(Array.isArray(res) ? res : []),
      error: () => {},
    });
  }

  generate(): void {
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string> = {};
    if (this.siteId()) params['site_id'] = this.siteId();
    if (this.partyId()) params['party_id'] = this.partyId();
    if (this.equipmentId()) params['equipment_id'] = this.equipmentId();
    if (this.dateFrom()) params['from'] = this.dateFrom();
    if (this.dateTo()) params['to'] = this.dateTo();

    this.api.get<any[]>('/reports/mobilization', params).subscribe({
      next: res => {
        this.rows.set(Array.isArray(res) ? res : []);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err.message ?? 'Failed to load report');
        this.notifications.error('Failed to load mobilization report');
        this.loading.set(false);
      },
    });
  }

  exportExcel(): void {
    this.exportService.exportToExcel(this.rows(), 'mobilization-report', 'Mobilization Report', [
      { key: 'equipment_name', header: 'Equipment' },
      { key: 'party_name', header: 'Party' },
      { key: 'site_name', header: 'Site' },
      { key: 'from_date', header: 'From' },
      { key: 'to_date', header: 'To' },
      { key: 'duration_days', header: 'Days' },
      { key: 'rate', header: 'Rate' },
      { key: 'total_cost', header: 'Total Cost' },
    ]);
  }

  exportPdf(): void {
    this.exportService.exportToPDF({
      data: this.rows(),
      fileName: 'Mobilization_Report',
      title: 'Mobilization Report',
      columns: [
        { key: 'equipment_name', header: 'Equipment' },
        { key: 'party_name', header: 'Party' },
        { key: 'site_name', header: 'Site' },
        { key: 'from_date', header: 'From' },
        { key: 'to_date', header: 'To' },
        { key: 'duration_days', header: 'Days' },
        { key: 'rate', header: 'Rate' },
        { key: 'total_cost', header: 'Total Cost' },
      ],
    });
  }

  printReport(): void {
    this.exportService.printReport('mobilization-report-table', 'Mobilization Report');
  }
}
