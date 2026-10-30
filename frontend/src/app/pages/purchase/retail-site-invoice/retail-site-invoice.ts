import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { DocumentService } from '../../../core/services/document.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';

interface BillItem {
  item: string;
  qty: number;
  unit: string;
  price: number;
  gst_percent: number;
  add_to_stock: boolean;
  amount: number;
  gst_amount: number;
}

@Component({
  selector: 'app-retail-site-invoice',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent, ModalDialogComponent],
  templateUrl: './retail-site-invoice.html',
  styleUrl: './retail-site-invoice.scss',
})
export class RetailSiteInvoiceComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly docService = inject(DocumentService);
  private readonly sanitizer = inject(DomSanitizer);

  retailerId = signal('');
  siteId = signal('');
  date = signal('');
  billNumber = signal('');
  invoiceType = signal<'with_invoice' | 'without_invoice'>('with_invoice');
  isGst = signal(true);
  paidAmount = signal(0);
  gstNumber = signal('');
  invoiceFile = signal<File | null>(null);

  items = signal<BillItem[]>([
    { item: '', qty: 0, unit: '', price: 0, gst_percent: 18, add_to_stock: false, amount: 0, gst_amount: 0 },
  ]);

  editingId = signal<string | null>(null);

  retailers = signal<any[]>([]);
  sites = signal<any[]>([]);
  bills = signal<any[]>([]);

  loading = signal(false);
  searchQuery = signal('');
  filterSiteId = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');
  showDocViewer = signal(false);
  docViewerUrl = signal<SafeResourceUrl | null>(null);

  retailerItems = computed<DropdownItem[]>(() =>
    this.retailers().map(r => ({ value: r.id, label: r.name }))
  );
  siteItems = computed<DropdownItem[]>(() =>
    this.sites().map(s => ({ value: s.id, label: s.name }))
  );

  filtered = computed(() => {
    let list = this.bills();
    const site = this.filterSiteId();
    if (site) list = list.filter(b => b.site_id === site);
    const from = this.filterDateFrom();
    if (from) list = list.filter(b => b.date >= from);
    const to = this.filterDateTo();
    if (to) list = list.filter(b => b.date <= to);
    const q = this.searchQuery().toLowerCase();
    if (q) list = list.filter(b =>
      (b.bill_number ?? '').toLowerCase().includes(q) ||
      (b.retailer_name ?? '').toLowerCase().includes(q)
    );
    return list;
  });

  summaryCards = computed<SummaryCard[]>(() => {
    const bills = this.filtered();
    const totalBill = bills.reduce((s, b) => s + (b.total_amount ?? 0), 0);
    const totalPaid = bills.reduce((s, b) => s + (b.paid_amount ?? 0), 0);
    const totalDue = bills.reduce((s, b) => s + (b.due_amount ?? 0), 0);
    return [
      { title: 'Total Bill Amount', value: totalBill, color: 'primary', prefix: '₹', icon: 'ri-money-rupee-circle-line' },
      { title: 'Total Paid', value: totalPaid, color: 'success', prefix: '₹', icon: 'ri-checkbox-circle-line' },
      { title: 'Total Due', value: totalDue, color: totalDue > 0 ? 'danger' : 'success', prefix: '₹', icon: 'ri-error-warning-line' },
    ];
  });

  get subtotal(): number {
    return this.items().reduce((s, i) => s + i.amount, 0);
  }

  get totalGst(): number {
    return this.items().reduce((s, i) => s + i.gst_amount, 0);
  }

  get grandTotal(): number {
    return this.subtotal + this.totalGst;
  }

  get dueAmount(): number {
    return this.grandTotal - this.paidAmount();
  }

  ngOnInit(): void {
    this.loadDropdowns();
    this.loadBills();
  }

  private loadDropdowns(): void {
    this.api.get<any[]>('/retailers').subscribe({
      next: data => this.retailers.set(data),
    });
    this.api.get<any[]>('/sites').subscribe({
      next: data => this.sites.set(data),
    });
  }

  private loadBills(): void {
    this.loading.set(true);
    this.api.get<any[]>('/retailer-bills').subscribe({
      next: data => { this.bills.set(data); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load bills'); this.loading.set(false); },
    });
  }

  onRetailerChange(): void {
    const retailer = this.retailers().find(r => r.id === this.retailerId());
    if (retailer) {
      this.gstNumber.set(retailer.gst_number ?? '');
      if (retailer.gst_status === true || retailer.gst_status === 'GST YES') {
        this.isGst.set(true);
      }
    }
  }

  onInvoiceTypeChange(): void {
    if (this.invoiceType() === 'without_invoice') {
      this.billNumber.set('');
      this.isGst.set(false);
      this.invoiceFile.set(null);
    }
  }

  addItem(): void {
    this.items.update(l => [...l, { item: '', qty: 0, unit: '', price: 0, gst_percent: 18, add_to_stock: false, amount: 0, gst_amount: 0 }]);
  }

  removeItem(i: number): void {
    this.items.update(l => l.filter((_, idx) => idx !== i));
  }

  calculateAmount(i: number): void {
    this.items.update(l => {
      const u = [...l];
      const cur = u[i];
      let baseAmount: number;
      if (cur.unit === 'percentage' || cur.unit === '%') {
        baseAmount = cur.price * cur.qty / 100;
      } else {
        baseAmount = cur.qty * cur.price;
      }
      const gstAmt = this.isGst() ? baseAmount * cur.gst_percent / 100 : 0;
      u[i] = { ...cur, amount: baseAmount, gst_amount: gstAmt };
      return u;
    });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.invoiceFile.set(input.files[0]);
    }
  }

  viewDocument(bill: any): void {
    if (bill.document_url) {
      this.docViewerUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(bill.document_url));
      this.showDocViewer.set(true);
    }
  }

  editBill(bill: any): void {
    this.editingId.set(bill.id);
    this.retailerId.set(bill.retailer_id ?? '');
    this.siteId.set(bill.site_id ?? '');
    this.date.set(bill.date ?? '');
    this.billNumber.set(bill.bill_number ?? '');
    this.invoiceType.set(bill.bill_number ? 'with_invoice' : 'without_invoice');
    this.isGst.set(bill.is_gst ?? true);
    this.paidAmount.set(bill.paid_amount ?? 0);
    this.gstNumber.set(bill.gst_number ?? '');
    if (bill.items?.length) {
      this.items.set(bill.items.map((it: any) => ({
        item: it.item ?? '', qty: it.qty ?? 0, unit: it.unit ?? '',
        price: it.price ?? 0, gst_percent: it.gst_percent ?? 0,
        add_to_stock: it.add_to_stock ?? false,
        amount: (it.qty ?? 0) * (it.price ?? 0),
        gst_amount: it.gst_amount ?? 0,
      })));
    }
  }

  deleteBill(id: string): void {
    this.api.delete<any>(`/retailer-bills/${id}`).subscribe({
      next: () => { this.notify.success('Bill deleted'); this.loadBills(); },
      error: () => this.notify.error('Failed to delete bill'),
    });
  }

  onSubmit(): void {
    const body: any = {
      retailer_id: this.retailerId() || null,
      site_id: this.siteId() || null,
      date: this.date(),
      bill_number: this.invoiceType() === 'with_invoice' ? this.billNumber() : null,
      invoice_type: this.invoiceType(),
      is_gst: this.isGst(),
      gst_number: this.gstNumber() || null,
      items: this.items(),
      subtotal: this.subtotal,
      gst_amount: this.totalGst,
      total_amount: this.grandTotal,
      paid_amount: this.paidAmount(),
      due_amount: this.dueAmount,
      status: this.dueAmount <= 0 ? 'PAID' : 'DUE',
    };

    const id = this.editingId();
    const request = id
      ? this.api.put<any>(`/retailer-bills/${id}`, body)
      : this.api.post<any>('/retailer-bills', body);

    request.subscribe({
      next: saved => {
        if (this.invoiceFile() && saved?.id) {
          this.docService.uploadDocument(this.invoiceFile()!, 'retail_invoice', saved.id).subscribe();
        }
        this.notify.success(id ? 'Bill updated' : 'Bill created');
        this.resetForm();
        this.loadBills();
      },
      error: () => this.notify.error(id ? 'Failed to update bill' : 'Failed to create bill'),
    });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  exportBills(): void {
    this.exportService.exportToExcel(this.filtered(), 'Retailer_Bills', 'Retailer Bills', [
      { key: 'bill_number', header: 'Bill No' },
      { key: 'retailer_name', header: 'Retailer' },
      { key: 'site_name', header: 'Site' },
      { key: 'date', header: 'Date' },
      { key: 'invoice_type', header: 'Type' },
      { key: 'subtotal', header: 'Subtotal' },
      { key: 'gst_amount', header: 'GST' },
      { key: 'total_amount', header: 'Total' },
      { key: 'paid_amount', header: 'Paid' },
      { key: 'due_amount', header: 'Due' },
      { key: 'status', header: 'Status' },
    ]);
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.retailerId.set('');
    this.siteId.set('');
    this.date.set('');
    this.billNumber.set('');
    this.invoiceType.set('with_invoice');
    this.isGst.set(true);
    this.paidAmount.set(0);
    this.gstNumber.set('');
    this.invoiceFile.set(null);
    this.items.set([{ item: '', qty: 0, unit: '', price: 0, gst_percent: 18, add_to_stock: false, amount: 0, gst_amount: 0 }]);
  }
}
