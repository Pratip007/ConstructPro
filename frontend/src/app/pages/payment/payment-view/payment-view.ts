import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';

interface Payment {
  id: string;
  date: string;
  category: string;
  party_name: string;
  party_id: string;
  site_id: string;
  site_name?: string;
  amount: number;
  tds_percentage: number;
  tds_amount: number;
  net_amount: number;
  payment_mode_id: string;
  payment_mode_name?: string;
  bank_id: string;
  bank_name?: string;
  reference_no: string;
  remarks: string;
  status: string;
  is_gst?: boolean;
  document_url?: string;
}

@Component({
  selector: 'app-payment-view',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent, ModalDialogComponent],
  templateUrl: './payment-view.html',
  styleUrl: './payment-view.scss',
})
export class PaymentViewComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly confirm = inject(ConfirmDialogService);

  loading = signal(false);
  payments = signal<Payment[]>([]);
  sites = signal<any[]>([]);

  filterCategory = signal('');
  filterStatus = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');
  filterSiteId = signal('');
  searchQuery = signal('');

  activeTab = signal<'all' | 'cleared' | 'pending' | 'void'>('all');

  showEditModal = signal(false);
  editingPayment = signal<Payment | null>(null);
  editRemarks = signal('');
  editStatus = signal('');

  categories = [
    { value: 'employee', label: 'Employee' },
    { value: 'contractor', label: 'Contractor' },
    { value: 'retailer', label: 'Retailer' },
    { value: 'supervisor_fund', label: 'Supervisor Fund' },
    { value: 'equipment', label: 'Equipment' },
  ];

  statuses = [
    { value: 'cleared', label: 'Cleared' },
    { value: 'pending', label: 'Pending' },
    { value: 'on_hold', label: 'On Hold' },
  ];

  siteItems = computed<DropdownItem[]>(() =>
    [{ value: '', label: 'All Sites' }, ...this.sites().map(s => ({ value: s.id, label: s.name }))]
  );

  filtered = computed(() => {
    let list = this.payments();
    const tab = this.activeTab();
    if (tab === 'cleared') list = list.filter(p => p.status === 'cleared');
    else if (tab === 'pending') list = list.filter(p => p.status === 'pending' || p.status === 'on_hold');
    else if (tab === 'void') list = list.filter(p => p.status === 'void' || p.status === 'voided');

    const q = this.searchQuery().toLowerCase();
    if (q) list = list.filter(p =>
      (p.party_name ?? '').toLowerCase().includes(q) ||
      (p.reference_no ?? '').toLowerCase().includes(q) ||
      (p.remarks ?? '').toLowerCase().includes(q)
    );
    return list;
  });

  totalGross = computed(() => this.filtered().reduce((s, p) => s + (p.amount ?? 0), 0));
  totalTds = computed(() => this.filtered().reduce((s, p) => s + (p.tds_amount ?? 0), 0));
  totalNet = computed(() => this.filtered().reduce((s, p) => s + (p.net_amount ?? 0), 0));

  tabCounts = computed(() => {
    const all = this.payments();
    return {
      all: all.length,
      cleared: all.filter(p => p.status === 'cleared').length,
      pending: all.filter(p => p.status === 'pending' || p.status === 'on_hold').length,
      void: all.filter(p => p.status === 'void' || p.status === 'voided').length,
    };
  });

  summaryCards = computed<SummaryCard[]>(() => [
    { title: 'Total Payments', value: this.filtered().length, color: 'primary', icon: 'ri-file-list-3-line' },
    { title: 'Gross Amount', value: this.totalGross(), color: 'info', prefix: '₹', icon: 'ri-money-rupee-circle-line' },
    { title: 'TDS Deducted', value: this.totalTds(), color: 'warning', prefix: '₹', icon: 'ri-percent-line' },
    { title: 'Net Paid', value: this.totalNet(), color: 'success', prefix: '₹', icon: 'ri-wallet-3-line' },
  ]);

  ngOnInit(): void {
    this.loadPayments();
    this.api.get<any[]>('/sites').subscribe({ next: d => this.sites.set(d) });
  }

  loadPayments(): void {
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.filterCategory()) params['category'] = this.filterCategory();
    if (this.filterStatus()) params['status'] = this.filterStatus();
    if (this.filterDateFrom()) params['date_from'] = this.filterDateFrom();
    if (this.filterDateTo()) params['date_to'] = this.filterDateTo();
    if (this.filterSiteId()) params['site_id'] = this.filterSiteId();
    this.api.get<Payment[]>('/payments', params).subscribe({
      next: data => { this.payments.set(data); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load payments'); this.loading.set(false); },
    });
  }

  switchTab(tab: 'all' | 'cleared' | 'pending' | 'void'): void {
    this.activeTab.set(tab);
  }

  openEditModal(p: Payment): void {
    this.editingPayment.set(p);
    this.editRemarks.set(p.remarks ?? '');
    this.editStatus.set(p.status ?? 'cleared');
    this.showEditModal.set(true);
  }

  saveEdit(): void {
    const p = this.editingPayment();
    if (!p) return;
    this.api.put<Payment>(`/payments/${p.id}`, {
      remarks: this.editRemarks(),
      status: this.editStatus(),
    }).subscribe({
      next: updated => {
        this.payments.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.notify.success('Payment updated');
        this.showEditModal.set(false);
      },
      error: () => this.notify.error('Failed to update payment'),
    });
  }

  async voidPayment(p: Payment): Promise<void> {
    const result = await this.confirm.confirm({
      title: 'Void Payment',
      message: `Void payment of ₹${(p.net_amount ?? p.amount ?? 0).toLocaleString('en-IN')} to ${p.party_name}?`,
      type: 'danger',
      confirmText: 'Void Payment',
    });
    if (!result) return;

    this.api.delete<void>(`/payments/${p.id}`).subscribe({
      next: () => {
        this.payments.update(list => list.map(x => x.id === p.id ? { ...x, status: 'void' } : x));
        this.notify.success('Payment voided');
      },
      error: () => this.notify.error('Failed to void payment'),
    });
  }

  viewInvoice(p: Payment): void {
    if (p.document_url) {
      window.open(p.document_url, '_blank');
    }
  }

  exportPayments(): void {
    this.exportService.exportToExcel(this.filtered(), 'Payment_View', 'Payments', [
      { key: 'date', header: 'Date' },
      { key: 'category', header: 'Category' },
      { key: 'party_name', header: 'Party' },
      { key: 'site_name', header: 'Site' },
      { key: 'amount', header: 'Gross Amount' },
      { key: 'tds_percentage', header: 'TDS %' },
      { key: 'tds_amount', header: 'TDS Amount' },
      { key: 'net_amount', header: 'Net Amount' },
      { key: 'payment_mode_name', header: 'Mode' },
      { key: 'bank_name', header: 'Bank' },
      { key: 'reference_no', header: 'Reference No' },
      { key: 'status', header: 'Status' },
      { key: 'remarks', header: 'Remarks' },
    ]);
  }

  exportPDF(): void {
    this.exportService.exportToPDF({
      title: 'Payment Report',
      fileName: 'Payment_Report',
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'category', header: 'Category' },
        { key: 'party_name', header: 'Party' },
        { key: 'amount', header: 'Gross' },
        { key: 'tds_amount', header: 'TDS' },
        { key: 'net_amount', header: 'Net' },
        { key: 'reference_no', header: 'Ref No' },
        { key: 'status', header: 'Status' },
      ],
      data: this.filtered(),
      summaryRow: { category: 'TOTAL', amount: this.totalGross(), tds_amount: this.totalTds(), net_amount: this.totalNet() },
      orientation: 'landscape',
    });
  }
}
