import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { GstService, GstBreakdown } from '../../../core/services/gst.service';
import { ExportService } from '../../../core/services/export.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { SearchableDropdownComponent } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';

interface InvoiceItem {
  product: string;
  hsn: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
}

@Component({
  selector: 'app-invoice-entry',
  standalone: true,
  imports: [FormsModule, DecimalPipe, SearchableDropdownComponent, SummaryCardsComponent, ModalDialogComponent],
  templateUrl: './invoice-entry.html',
  styleUrl: './invoice-entry.scss',
})
export class InvoiceEntryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly gstService = inject(GstService);
  private readonly exportService = inject(ExportService);
  readonly role = inject(RoleService);
  private readonly approval = inject(ApprovalService);
  private readonly confirm = inject(ConfirmDialogService);

  invoiceNo = signal('');
  company = signal('');
  site = signal('');
  poRef = signal('');
  date = signal('');
  isGst = signal(true);
  gstRate = signal(18);
  invoiceFile = signal<File | null>(null);
  ownStateCode = signal('19');
  roundOff = signal(0);

  items = signal<InvoiceItem[]>([
    { product: '', hsn: '', unit: 'Nos', qty: 0, rate: 0, amount: 0 },
  ]);

  editingId = signal<string | null>(null);

  companies = signal<any[]>([]);
  sites = signal<any[]>([]);
  purchaseOrders = signal<any[]>([]);

  invoices = signal<any[]>([]);

  loading = signal(false);
  showPreview = signal(false);

  // Filters
  filterCompany = signal('');
  filterSite = signal('');
  filterFY = signal('');
  filterStatus = signal('');
  filterSearch = signal('');

  unitOptions = ['Nos', 'Kg', 'Litre', 'Meter', 'Sq.Ft', 'Cu.M', 'Bag', 'Ton', 'Cft', '%'];

  get gstRates(): readonly number[] {
    return this.gstService.GST_RATES;
  }

  get currentFY(): string {
    return this.gstService.getFinancialYear();
  }

  get financialYears(): string[] {
    const current = new Date().getFullYear();
    const years: string[] = [];
    for (let y = current - 2; y <= current + 1; y++) {
      years.push(`${y}-${(y + 1).toString().slice(2)}`);
    }
    return years;
  }

  get companyDropdownItems() {
    return this.companies().map(c => ({ value: c.id, label: c.name }));
  }

  get siteDropdownItems() {
    return this.sites().map(s => ({ value: s.id ?? s.name, label: s.name }));
  }

  get poDropdownItems() {
    return this.purchaseOrders().map(po => ({ value: po.id, label: po.display_id ?? `PO-${po.id}` }));
  }

  get subtotal(): number {
    return this.items().reduce((s, i) => s + i.amount, 0);
  }

  get selectedCompanyStateCode(): string {
    const companyId = this.company();
    if (!companyId) return this.ownStateCode();
    const found = this.companies().find(c => c.id === companyId || String(c.id) === String(companyId));
    return found?.state_code ?? this.ownStateCode();
  }

  get gstBreakdown(): GstBreakdown {
    const rate = this.isGst() ? this.gstRate() : 0;
    return this.gstService.calculateGst(this.subtotal, rate, this.ownStateCode(), this.selectedCompanyStateCode);
  }

  get gstAmount(): number {
    return this.gstBreakdown.totalGst;
  }

  get grandTotal(): number {
    return Math.round(this.gstBreakdown.grossAmount + this.roundOff());
  }

  get grandTotalInWords(): string {
    return this.gstService.amountInWords(this.grandTotal);
  }

  get summaryCards(): SummaryCard[] {
    const invs = this.filteredInvoices;
    const totalBills = invs.length;
    const totalInvoiced = invs.reduce((s, i) => s + (i.gross_amount || 0), 0);
    const totalReceived = invs.reduce((s, i) => s + (i.received_amount || 0), 0);
    const remaining = totalInvoiced - totalReceived;
    return [
      { title: 'Total Bills', value: totalBills, icon: 'ri-file-list-line', color: 'primary' },
      { title: 'Total Invoiced', value: totalInvoiced, icon: 'ri-money-rupee-circle-line', color: 'info', prefix: '₹' },
      { title: 'Total Received', value: totalReceived, icon: 'ri-checkbox-circle-line', color: 'success', prefix: '₹' },
      { title: 'Remaining Due', value: remaining, icon: 'ri-error-warning-line', color: remaining > 0 ? 'danger' : 'success', prefix: '₹' },
    ];
  }

  get filteredInvoices(): any[] {
    let list = this.invoices();
    const fc = this.filterCompany();
    const fs = this.filterSite();
    const fy = this.filterFY();
    const fst = this.filterStatus();
    const q = this.filterSearch().toLowerCase();

    if (fc) list = list.filter(i => String(i.company_id) === String(fc));
    if (fs) list = list.filter(i => i.site_name === fs || String(i.site_id) === String(fs));
    if (fy) {
      const range = this.gstService.getFinancialYearRange(fy);
      list = list.filter(i => {
        const d = new Date(i.date);
        return d >= range.start && d <= range.end;
      });
    }
    if (fst) list = list.filter(i => (i.status || 'unpaid') === fst);
    if (q) list = list.filter(i =>
      (i.invoice_no || '').toLowerCase().includes(q) ||
      (i.company_name || '').toLowerCase().includes(q) ||
      (i.site_name || '').toLowerCase().includes(q)
    );
    return list;
  }

  ngOnInit(): void {
    this.filterFY.set(this.currentFY);
    this.loadDropdowns();
    this.loadInvoices();
    this.generateInvoiceNo();
  }

  private generateInvoiceNo(): void {
    const fy = this.currentFY;
    const count = this.invoices().filter(i => {
      const range = this.gstService.getFinancialYearRange(fy);
      const d = new Date(i.date);
      return d >= range.start && d <= range.end;
    }).length;
    this.invoiceNo.set(`INV/${fy}/${String(count + 1).padStart(4, '0')}`);
  }

  private loadDropdowns(): void {
    this.api.get<any[]>('/companies').subscribe({
      next: data => this.companies.set(data),
      error: () => this.notify.error('Failed to load companies'),
    });
    this.api.get<any[]>('/sites').subscribe({
      next: data => this.sites.set(data),
      error: () => this.notify.error('Failed to load sites'),
    });
    this.api.get<any[]>('/purchase-orders').subscribe({
      next: data => this.purchaseOrders.set(data),
      error: () => this.notify.error('Failed to load purchase orders'),
    });
  }

  private loadInvoices(): void {
    this.loading.set(true);
    this.api.get<any[]>('/invoices').subscribe({
      next: data => { this.invoices.set(data); this.loading.set(false); this.generateInvoiceNo(); },
      error: () => { this.notify.error('Failed to load invoices'); this.loading.set(false); },
    });
  }

  addItem(): void {
    this.items.update(l => [...l, { product: '', hsn: '', unit: 'Nos', qty: 0, rate: 0, amount: 0 }]);
  }

  removeItem(i: number): void {
    this.items.update(l => l.filter((_, idx) => idx !== i));
  }

  calculateAmount(i: number): void {
    this.items.update(l => {
      const u = [...l];
      const item = u[i];
      if (item.unit === '%') {
        u[i] = { ...item, amount: Math.round(item.rate * item.qty / 100 * 100) / 100 };
      } else {
        u[i] = { ...item, amount: Math.round(item.qty * item.rate * 100) / 100 };
      }
      return u;
    });
  }

  autoRoundOff(): void {
    const raw = this.gstBreakdown.grossAmount;
    this.roundOff.set(Math.round(raw) - raw);
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.invoiceFile.set(input.files[0]);
  }

  editInvoice(inv: any): void {
    this.editingId.set(inv.id);
    this.invoiceNo.set(inv.invoice_no ?? '');
    this.company.set(inv.company_id ?? '');
    this.site.set(inv.site_name ?? inv.site_id ?? '');
    this.poRef.set(inv.po_id ?? '');
    this.date.set(inv.date ?? '');
    this.isGst.set(inv.is_gst !== false);
    this.gstRate.set(inv.gst_rate ?? 18);
    if (inv.items?.length) {
      this.items.set(inv.items.map((it: any) => ({
        product: it.description ?? it.name ?? '',
        hsn: it.hsn ?? '',
        unit: it.unit ?? 'Nos',
        qty: it.qty ?? it.quantity ?? 0,
        rate: it.price ?? it.rate ?? 0,
        amount: it.amount ?? 0,
      })));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async deleteInvoice(inv: any): Promise<void> {
    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'invoices', actionType: 'delete', summary: `Delete invoice ${inv.invoice_no}`,
        data: inv, referenceId: inv.id,
      }).subscribe({
        next: () => this.notify.success('Delete request submitted for approval'),
        error: () => this.notify.error('Failed to submit approval request'),
      });
      return;
    }
    const confirmed = await this.confirm.confirm({
      title: 'Delete Invoice', message: `Delete invoice "${inv.invoice_no}"?`, type: 'danger',
    });
    if (!confirmed) return;
    this.api.delete<any>(`/invoices/${inv.id}`).subscribe({
      next: () => { this.notify.success('Invoice deleted'); this.loadInvoices(); },
      error: () => this.notify.error('Failed to delete invoice'),
    });
  }

  onSubmit(): void {
    const body: any = {
      invoice_no: this.invoiceNo(),
      po_id: this.poRef() || null,
      company_id: this.company() || null,
      site_name: this.site(),
      date: this.date(),
      base_amount: this.subtotal,
      gst_rate: this.isGst() ? this.gstRate() : 0,
      gst_amount: this.gstAmount,
      cgst: this.gstBreakdown.cgst,
      sgst: this.gstBreakdown.sgst,
      igst: this.gstBreakdown.igst,
      is_igst: this.gstBreakdown.isIgst,
      round_off: this.roundOff(),
      gross_amount: this.grandTotal,
      is_gst: this.isGst(),
      financial_year: this.currentFY,
      items: this.items().map((it, idx) => ({
        sno: idx + 1, description: it.product, hsn: it.hsn, unit: it.unit,
        qty: it.qty, price: it.rate, amount: it.amount,
      })),
    };

    if (this.approval.requiresApproval() && !this.editingId()) {
      this.approval.submitForApproval({
        module: 'invoices', actionType: 'create', summary: `Create invoice ${body.invoice_no}`,
        data: body,
      }).subscribe({
        next: () => { this.notify.success('Invoice submitted for approval'); this.resetForm(); },
        error: () => this.notify.error('Failed to submit approval request'),
      });
      return;
    }

    const id = this.editingId();
    const file = this.invoiceFile();
    if (file) {
      const formData = new FormData();
      Object.entries(body).forEach(([key, val]) => {
        if (val != null) formData.append(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
      });
      formData.append('file', file, file.name);
      const request = id ? this.api.put<any>(`/invoices/${id}`, formData) : this.api.post<any>('/invoices', formData);
      request.subscribe({
        next: () => { this.notify.success(id ? 'Invoice updated' : 'Invoice created'); this.resetForm(); this.loadInvoices(); },
        error: () => this.notify.error(id ? 'Failed to update invoice' : 'Failed to create invoice'),
      });
    } else {
      const request = id ? this.api.put<any>(`/invoices/${id}`, body) : this.api.post<any>('/invoices', body);
      request.subscribe({
        next: () => { this.notify.success(id ? 'Invoice updated' : 'Invoice created'); this.resetForm(); this.loadInvoices(); },
        error: () => this.notify.error(id ? 'Failed to update invoice' : 'Failed to create invoice'),
      });
    }
  }

  previewInvoice(inv?: any): void {
    const source = inv || {
      invoice_no: this.invoiceNo(), date: this.date(),
      company_name: this.companies().find(c => String(c.id) === String(this.company()))?.name ?? '',
      base_amount: this.subtotal, gst_amount: this.gstAmount, gross_amount: this.grandTotal,
    };
    const comp = this.companies().find(c => String(c.id) === String(source.company_id || this.company()));
    this.exportService.generateInvoicePDF({
      invoiceNo: source.invoice_no ?? this.invoiceNo(),
      invoiceDate: source.date ?? this.date(),
      financialYear: this.currentFY,
      poRef: source.po_id ?? this.poRef() ?? undefined,
      companyName: 'ATR Construction Pvt Ltd',
      companyAddress: 'West Bengal, India',
      companyGstin: 'N/A',
      billedTo: {
        name: comp?.name ?? source.company_name ?? '',
        address: comp?.address ?? '',
        gstin: comp?.gst_number ?? '',
      },
      items: (source.items ?? this.items()).map((it: any, idx: number) => ({
        sno: idx + 1,
        description: it.product ?? it.description ?? it.name ?? '',
        hsnSac: it.hsn ?? '',
        qty: it.qty ?? it.quantity ?? 0,
        unit: it.unit ?? 'Nos',
        rate: it.rate ?? it.price ?? 0,
        amount: it.amount ?? 0,
      })),
      subtotal: source.base_amount ?? this.subtotal,
      cgst: this.gstBreakdown.cgst,
      sgst: this.gstBreakdown.sgst,
      igst: this.gstBreakdown.igst,
      isIgst: this.gstBreakdown.isIgst,
      roundOff: this.roundOff(),
      grandTotal: source.gross_amount ?? this.grandTotal,
    });
  }

  exportToExcel(): void {
    this.exportService.exportToExcel(
      this.filteredInvoices.map(i => ({
        invoice_no: i.invoice_no, company: i.company_name, site: i.site_name,
        date: i.date, base: i.base_amount, gst: i.gst_amount, total: i.gross_amount,
        status: i.status ?? 'unpaid',
      })),
      'invoices', 'Invoices'
    );
  }

  cancelEdit(): void { this.resetForm(); }

  statusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'paid': return 'badge-success';
      case 'partial': return 'badge-info';
      case 'unpaid': return 'badge-warning';
      case 'cancelled': return 'badge-danger';
      default: return 'badge-warning';
    }
  }

  clearFilters(): void {
    this.filterCompany.set('');
    this.filterSite.set('');
    this.filterFY.set(this.currentFY);
    this.filterStatus.set('');
    this.filterSearch.set('');
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.company.set('');
    this.site.set('');
    this.poRef.set('');
    this.date.set('');
    this.isGst.set(true);
    this.gstRate.set(18);
    this.invoiceFile.set(null);
    this.roundOff.set(0);
    this.items.set([{ product: '', hsn: '', unit: 'Nos', qty: 0, rate: 0, amount: 0 }]);
    this.generateInvoiceNo();
  }
}
