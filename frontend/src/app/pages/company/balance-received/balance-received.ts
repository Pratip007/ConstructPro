import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

@Component({
  selector: 'app-balance-received',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './balance-received.html',
  styleUrl: './balance-received.scss',
})
export class BalanceReceivedComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  selectedCompany = signal('');
  selectedInvoiceId = signal('');
  amount = signal<number | null>(null);
  receiveDate = signal('');
  referenceNo = signal('');
  bank = signal('');
  remarks = signal('');
  tdsAmount = signal<number | null>(null);
  tdsPercent = signal<number | null>(null);
  paymentMode = signal('');
  selectedSite = signal('');
  editingId = signal<string | null>(null);

  companies = signal<any[]>([]);
  invoices = signal<any[]>([]);
  bankOptions = signal<any[]>([]);
  receipts = signal<any[]>([]);
  sites = signal<any[]>([]);
  selectedInvoice = signal<any | null>(null);
  paymentHistory = signal<any[]>([]);

  loading = signal(false);
  saving = signal(false);

  paymentModes = ['NEFT', 'RTGS', 'Cheque', 'Cash', 'UPI', 'DD'];
  tdsPresets = [1, 2, 5, 10];

  companyItems = computed<DropdownItem[]>(() =>
    this.companies().map(c => ({ value: c.id, label: c.name }))
  );

  siteItems = computed<DropdownItem[]>(() =>
    [{ value: '', label: 'All Sites' }, ...this.sites().map(s => ({ value: s.id, label: s.name }))]
  );

  bankItems = computed<DropdownItem[]>(() => [
    ...this.bankOptions().map(b => ({
      value: b.bank_name ?? b.name,
      label: `${b.bank_name ?? b.name}${b.account_number ? ' (' + b.account_number + ')' : ''}`,
    })),
    { value: 'Cash', label: 'Cash' },
  ]);

  filteredInvoices = computed(() => {
    const companyId = this.selectedCompany();
    if (!companyId) return [];
    let list = this.invoices().filter(inv => String(inv.company_id) === String(companyId));
    const site = this.selectedSite();
    if (site) list = list.filter(inv => String(inv.site_id) === String(site));
    return list;
  });

  netReceived = computed(() => (this.amount() ?? 0) - (this.tdsAmount() ?? 0));

  alreadyPaid = computed(() =>
    this.paymentHistory().reduce((sum, r) => sum + (r.amount ?? 0), 0)
  );

  balanceDue = computed(() => {
    const inv = this.selectedInvoice();
    if (!inv) return 0;
    return (inv.gross_amount ?? ((inv.base_amount ?? 0) + (inv.gst_amount ?? 0))) - this.alreadyPaid();
  });

  filteredReceipts = computed(() => {
    let list = this.receipts();
    const companyId = this.selectedCompany();
    const site = this.selectedSite();
    if (companyId) list = list.filter(r => String(r.company_id) === String(companyId));
    if (site) list = list.filter(r => String(r.site_id) === String(site));
    return list;
  });

  summaryCards = computed<SummaryCard[]>(() => {
    const all = this.filteredReceipts();
    const totalReceived = all.reduce((s, r) => s + (r.amount ?? 0), 0);
    const totalTds = all.reduce((s, r) => s + (r.tds_amount ?? 0), 0);
    const netAmount = totalReceived - totalTds;
    return [
      { title: 'Total Received', value: totalReceived, icon: 'ri-money-rupee-circle-line', color: 'success', prefix: '₹' },
      { title: 'TDS Deducted', value: totalTds, icon: 'ri-percent-line', color: 'warning', prefix: '₹' },
      { title: 'Net Received', value: netAmount, icon: 'ri-wallet-3-line', color: 'primary', prefix: '₹' },
      { title: 'Receipts', value: all.length, icon: 'ri-file-list-3-line', color: 'info' },
    ];
  });

  ngOnInit(): void {
    this.loadCompanies();
    this.loadInvoices();
    this.loadBanks();
    this.loadReceipts();
    this.loadSites();
  }

  loadCompanies(): void {
    this.api.get<any[]>('/companies').subscribe({
      next: (data) => this.companies.set(data ?? []),
      error: () => this.notify.error('Failed to load companies'),
    });
  }

  loadInvoices(): void {
    this.api.get<any[]>('/invoices').subscribe({
      next: (data) => this.invoices.set(data ?? []),
      error: () => {},
    });
  }

  loadBanks(): void {
    this.api.get<any[]>('/banks').subscribe({
      next: (data) => this.bankOptions.set(data ?? []),
      error: () => {},
    });
  }

  loadSites(): void {
    this.api.get<any[]>('/sites').subscribe({
      next: (data) => this.sites.set(data ?? []),
      error: () => {},
    });
  }

  loadReceipts(): void {
    this.loading.set(true);
    this.api.get<any[]>('/balance-received').subscribe({
      next: (data) => { this.receipts.set(data ?? []); this.loading.set(false); },
      error: (err) => { this.notify.error('Failed to load receipts: ' + err.message); this.loading.set(false); },
    });
  }

  onCompanyChange(): void {
    this.selectedInvoiceId.set('');
    this.selectedInvoice.set(null);
    this.paymentHistory.set([]);
  }

  onInvoiceSelect(invoiceId: string): void {
    this.selectedInvoiceId.set(invoiceId);
    if (!invoiceId) {
      this.selectedInvoice.set(null);
      this.paymentHistory.set([]);
      return;
    }
    const inv = this.invoices().find(i => String(i.id) === String(invoiceId));
    this.selectedInvoice.set(inv ?? null);
    this.api.get<any[]>('/balance-received', { invoice_id: invoiceId }).subscribe({
      next: (data) => this.paymentHistory.set(data ?? []),
      error: () => this.paymentHistory.set([]),
    });
  }

  applyTdsPercent(pct: number): void {
    this.tdsPercent.set(pct);
    const amt = this.amount() ?? 0;
    this.tdsAmount.set(Math.round((amt * pct) / 100));
  }

  saveReceipt(): void {
    if (!this.selectedInvoiceId() || !this.amount()) return;
    this.saving.set(true);
    const body = {
      invoiceId: this.selectedInvoiceId(),
      date: this.receiveDate() || new Date().toISOString().split('T')[0],
      amount: this.amount(),
      tdsAmount: this.tdsAmount() ?? 0,
      entryType: (this.tdsAmount() ?? 0) > 0 && !(this.amount()) ? 'TDS' : 'PAYMENT',
      paymentMethod: this.paymentMode() || this.bank(),
      referenceNumber: this.referenceNo(),
      remarks: this.remarks(),
    };
    const id = this.editingId();
    const request = id
      ? this.api.put<any>(`/balance-received/${id}`, body)
      : this.api.post<any>('/balance-received', body);

    request.subscribe({
      next: (result) => {
        if (id) {
          this.receipts.update(list => list.map(r => r.id === id ? { ...r, ...result } : r));
          this.notify.success('Receipt updated');
        } else {
          this.receipts.update(list => [result, ...list]);
          this.notify.success('Balance received recorded');
        }
        if (this.selectedInvoiceId()) this.onInvoiceSelect(this.selectedInvoiceId());
        this.resetForm();
        this.saving.set(false);
      },
      error: (err) => { this.notify.error('Failed to save: ' + err.message); this.saving.set(false); },
    });
  }

  editReceipt(r: any): void {
    this.editingId.set(r.id);
    this.selectedCompany.set(r.company_id ?? '');
    this.selectedInvoiceId.set(r.invoice_id ?? '');
    this.amount.set(r.amount ?? null);
    this.tdsAmount.set(r.tds_amount ?? null);
    this.receiveDate.set(r.date ?? '');
    this.paymentMode.set(r.payment_method ?? '');
    this.bank.set('');
    this.referenceNo.set(r.reference_number ?? '');
    this.remarks.set(r.remarks ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void { this.resetForm(); }

  async deleteReceipt(r: any): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Receipt',
      message: `Delete receipt of ₹${r.amount?.toLocaleString()}?`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!confirmed) return;

    this.api.delete<any>(`/balance-received/${r.id}`).subscribe({
      next: () => {
        this.receipts.update(list => list.filter(re => re.id !== r.id));
        this.notify.success('Receipt deleted');
      },
      error: (err) => this.notify.error('Failed to delete: ' + err.message),
    });
  }

  companyName(id: string): string {
    return this.companies().find(c => String(c.id) === String(id))?.name ?? '';
  }

  exportExcel(): void {
    this.exportService.exportToExcel(
      this.filteredReceipts().map(r => ({
        Date: r.date,
        Invoice: r.invoice_id,
        Company: this.companyName(r.company_id),
        'Amount (₹)': r.amount,
        'TDS (₹)': r.tds_amount ?? 0,
        'Net (₹)': (r.amount ?? 0) - (r.tds_amount ?? 0),
        Mode: r.payment_method,
        'Ref No': r.reference_number,
        Remarks: r.remarks,
      })),
      'balance-received'
    );
  }

  exportPdf(): void {
    this.exportService.exportToPDF({
      title: 'Balance Received Report',
      fileName: 'balance-received',
      data: this.filteredReceipts() as Record<string, any>[],
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'invoice_id', header: 'Invoice' },
        { key: 'amount', header: 'Amount (₹)', format: 'currency', align: 'right' },
        { key: 'tds_amount', header: 'TDS (₹)', format: 'currency', align: 'right' },
        { key: 'payment_method', header: 'Mode' },
        { key: 'reference_number', header: 'Ref No' },
      ],
      companyName: 'ATR Construction Pvt Ltd',
    });
  }

  printReport(): void {
    this.exportService.printReport('receipt-table', 'Balance Received Report');
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.amount.set(null);
    this.receiveDate.set('');
    this.referenceNo.set('');
    this.bank.set('');
    this.remarks.set('');
    this.tdsAmount.set(null);
    this.tdsPercent.set(null);
    this.paymentMode.set('');
  }
}
