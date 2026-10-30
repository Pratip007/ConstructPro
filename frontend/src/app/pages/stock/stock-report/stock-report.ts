import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { SearchableDropdownComponent } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface StockSummaryRow {
  site_name: string;
  product_name: string;
  unit: string;
  total_added: number;
  total_damaged: number;
  total_transferred_out: number;
  net_available: number;
}

interface Site { id: string; name: string; }

@Component({
  selector: 'app-stock-report',
  standalone: true,
  imports: [FormsModule, DecimalPipe, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './stock-report.html',
  styleUrl: './stock-report.scss',
})
export class StockReportComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotificationService);
  private exportService = inject(ExportService);

  loading = signal(false);
  stockSummary = signal<StockSummaryRow[]>([]);
  sites = signal<Site[]>([]);
  selectedSite = signal('');
  dateFrom = signal('');
  dateTo = signal('');
  searchQuery = signal('');

  get siteItems() { return this.sites().map(s => ({ value: s.id, label: s.name })); }

  get summaryCards(): SummaryCard[] {
    const data = this.filteredSummary;
    const totalProducts = new Set(data.map(r => r.product_name)).size;
    const totalAdded = data.reduce((s, r) => s + r.total_added, 0);
    const totalDamaged = data.reduce((s, r) => s + r.total_damaged, 0);
    const totalAvailable = data.reduce((s, r) => s + r.net_available, 0);
    return [
      { title: 'Products', value: totalProducts, icon: 'ri-archive-line', color: 'primary' },
      { title: 'Total Added', value: totalAdded, icon: 'ri-add-circle-line', color: 'success' },
      { title: 'Total Damaged', value: totalDamaged, icon: 'ri-close-circle-line', color: 'danger' },
      { title: 'Net Available', value: totalAvailable, icon: 'ri-checkbox-circle-line', color: 'info' },
    ];
  }

  get filteredSummary(): StockSummaryRow[] {
    let list = this.stockSummary();
    const q = this.searchQuery().toLowerCase();
    if (q) list = list.filter(r => r.product_name.toLowerCase().includes(q) || r.site_name.toLowerCase().includes(q));
    return list;
  }

  ngOnInit(): void {
    this.api.get<Site[]>('/sites').subscribe({ next: d => this.sites.set(d), error: () => {} });
    this.loadReport();
  }

  loadReport(): void {
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.selectedSite()) params['site_id'] = this.selectedSite();
    if (this.dateFrom()) params['date_from'] = this.dateFrom();
    if (this.dateTo()) params['date_to'] = this.dateTo();

    this.api.get<any[]>('/site-inventory', params).subscribe({
      next: data => {
        const rows: StockSummaryRow[] = data.map(item => ({
          site_name: item.site_name || 'Unknown',
          product_name: item.product_name || 'Unknown',
          unit: item.unit || '',
          total_added: item.total_in || item.quantity || 0,
          total_damaged: item.damaged || 0,
          total_transferred_out: item.total_out || 0,
          net_available: item.quantity || 0,
        }));
        this.stockSummary.set(rows);
        this.loading.set(false);
      },
      error: () => { this.notify.error('Failed to load stock report'); this.loading.set(false); },
    });
  }

  exportReport(): void {
    this.exportService.exportToExcel(this.filteredSummary as any[], 'stock-summary-report', 'Stock Summary', [
      { key: 'site_name', header: 'Site' },
      { key: 'product_name', header: 'Product' },
      { key: 'unit', header: 'Unit' },
      { key: 'total_added', header: 'Total Added' },
      { key: 'total_damaged', header: 'Total Damaged' },
      { key: 'total_transferred_out', header: 'Transferred Out' },
      { key: 'net_available', header: 'Net Available' },
    ]);
  }

  printReport(): void {
    this.exportService.printReport('stockReportTable');
  }
}
