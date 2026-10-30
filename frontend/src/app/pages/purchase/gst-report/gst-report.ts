import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { GstService } from '../../../core/services/gst.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

@Component({
  selector: 'app-gst-report',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './gst-report.html',
  styleUrl: './gst-report.scss',
})
export class GstReportComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly gstService = inject(GstService);

  bills = signal<any[]>([]);
  loading = signal(false);
  searchQuery = signal('');
  selectedMonth = signal(new Date().getMonth() + 1);
  selectedYear = signal(new Date().getFullYear());
  selectedRetailerId = signal('');
  selectedSiteId = signal('');

  retailers = signal<any[]>([]);
  sites = signal<any[]>([]);

  months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
  ];

  years: number[] = [];

  retailerItems = computed<DropdownItem[]>(() =>
    [{ value: '', label: 'All Retailers' }, ...this.retailers().map(r => ({ value: r.id, label: r.name }))]
  );
  siteItems = computed<DropdownItem[]>(() =>
    [{ value: '', label: 'All Sites' }, ...this.sites().map(s => ({ value: s.id, label: s.name }))]
  );

  filtered = computed(() => {
    let list = this.bills();
    const q = this.searchQuery().toLowerCase();
    if (q) {
      list = list.filter(b =>
        (b.bill_number ?? '').toLowerCase().includes(q) ||
        (b.retailer_name ?? '').toLowerCase().includes(q) ||
        (b.gst_number ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  });

  totalBaseAmount = computed(() => this.filtered().reduce((s, b) => s + (b.base_amount ?? b.subtotal ?? 0), 0));
  totalCgst = computed(() => this.filtered().reduce((s, b) => s + (b.cgst_amount ?? 0), 0));
  totalSgst = computed(() => this.filtered().reduce((s, b) => s + (b.sgst_amount ?? 0), 0));
  totalIgst = computed(() => this.filtered().reduce((s, b) => s + (b.igst_amount ?? 0), 0));
  totalGstAmount = computed(() => this.filtered().reduce((s, b) => s + (b.gst_amount ?? 0), 0));
  totalAmount = computed(() => this.filtered().reduce((s, b) => s + (b.total_amount ?? 0), 0));

  summaryCards = computed<SummaryCard[]>(() => [
    { title: 'Total Bills', value: this.filtered().length, color: 'primary', icon: 'ri-file-list-3-line' },
    { title: 'Total Taxable Value', value: this.totalBaseAmount(), color: 'info', prefix: '₹', icon: 'ri-money-rupee-circle-line' },
    { title: 'Total GST', value: this.totalGstAmount(), color: 'warning', prefix: '₹', icon: 'ri-percent-line' },
    { title: 'Total Invoice Value', value: this.totalAmount(), color: 'success', prefix: '₹', icon: 'ri-wallet-3-line' },
  ]);

  ngOnInit(): void {
    const currentYear = new Date().getFullYear();
    this.years = Array.from({ length: 5 }, (_, i) => currentYear - i);
    this.loadDropdowns();
    this.loadReport();
  }

  private loadDropdowns(): void {
    this.api.get<any[]>('/retailers').subscribe({ next: d => this.retailers.set(d) });
    this.api.get<any[]>('/sites').subscribe({ next: d => this.sites.set(d) });
  }

  loadReport(): void {
    this.loading.set(true);
    const params: Record<string, string> = {
      month: String(this.selectedMonth()),
      year: String(this.selectedYear()),
    };
    if (this.selectedRetailerId()) params['retailer_id'] = this.selectedRetailerId();
    if (this.selectedSiteId()) params['site_id'] = this.selectedSiteId();
    this.api.get<any[]>('/retailer-bills/gst-report', params).subscribe({
      next: data => { this.bills.set(data); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load GST report'); this.loading.set(false); },
    });
  }

  exportGSTR1(): void {
    const fy = this.gstService.getFinancialYear(new Date(this.selectedYear(), this.selectedMonth() - 1));
    const cols = [
      { key: 'bill_number', header: 'Invoice Number' },
      { key: 'date', header: 'Invoice Date' },
      { key: 'retailer_name', header: 'Supplier Name' },
      { key: 'gst_number', header: 'GSTIN' },
      { key: 'base_amount', header: 'Taxable Value' },
      { key: 'cgst_amount', header: 'CGST' },
      { key: 'sgst_amount', header: 'SGST' },
      { key: 'igst_amount', header: 'IGST' },
      { key: 'gst_amount', header: 'Total Tax' },
      { key: 'total_amount', header: 'Invoice Value' },
    ];
    this.exportService.exportToExcel(this.filtered(), `GSTR1_${fy}_${this.months[this.selectedMonth() - 1].label}`, 'GSTR-1', cols);
  }

  exportReport(): void {
    this.exportService.exportToExcel(this.filtered(), 'GST_Report', 'GST Report', [
      { key: 'bill_number', header: 'Bill Number' },
      { key: 'retailer_name', header: 'Retailer' },
      { key: 'gst_number', header: 'GSTIN' },
      { key: 'date', header: 'Date' },
      { key: 'base_amount', header: 'Taxable Value' },
      { key: 'gst_rate', header: 'GST Rate (%)' },
      { key: 'cgst_amount', header: 'CGST' },
      { key: 'sgst_amount', header: 'SGST' },
      { key: 'igst_amount', header: 'IGST' },
      { key: 'gst_amount', header: 'Total GST' },
      { key: 'total_amount', header: 'Total' },
    ]);
  }

  downloadInvoice(bill: any): void {
    if (bill.document_url) {
      window.open(bill.document_url, '_blank');
    } else {
      this.notify.info('No invoice document available');
    }
  }

  downloadAllInvoices(): void {
    const docsWithUrl = this.filtered().filter(b => b.document_url);
    if (!docsWithUrl.length) {
      this.notify.info('No invoices to download');
      return;
    }
    const fetches = docsWithUrl.map(b =>
      fetch(b.document_url).then(r => r.blob()).then(content => ({
        name: `${b.bill_number ?? b.id}.pdf`,
        content,
      }))
    );
    Promise.all(fetches).then(files =>
      this.exportService.downloadAsZip(files, `GST_Invoices_${this.selectedMonth()}_${this.selectedYear()}`)
    ).catch(() => this.notify.error('Failed to download invoices'));
  }
}
