import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { RoleService } from '../../../core/services/role.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface Payment {
  id: string;
  date: string;
  category: string;
  party_id: string;
  party_name: string;
  party_type: string;
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
}

@Component({
  selector: 'app-all-type-payment',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './all-type-payment.html',
  styleUrl: './all-type-payment.scss',
})
export class AllTypePaymentComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly approval = inject(ApprovalService);
  private readonly role = inject(RoleService);

  loading = signal(false);
  payments = signal<Payment[]>([]);
  paymentModes = signal<any[]>([]);
  banks = signal<any[]>([]);
  sites = signal<any[]>([]);
  parties = signal<any[]>([]);
  dueAmount = signal<number | null>(null);
  recentPayments = signal<any[]>([]);

  date = signal('');
  category = signal('');
  partyId = signal('');
  siteId = signal('');
  amount = signal<number | null>(null);
  tdsPercentage = signal<number>(0);
  paymentModeId = signal('');
  bankId = signal('');
  referenceNo = signal('');
  remarks = signal('');
  settleBills = signal(false);
  settleAmount = signal<number | null>(null);

  filterCategory = signal('');
  filterSiteId = signal('');
  searchQuery = signal('');

  categories = [
    { value: 'employee', label: 'Employee' },
    { value: 'contractor', label: 'Contractor' },
    { value: 'retailer', label: 'Retailer' },
    { value: 'supervisor_fund', label: 'Supervisor Fund' },
    { value: 'equipment', label: 'Equipment' },
  ];

  partyItems = computed<DropdownItem[]>(() =>
    this.parties().map(p => ({ value: p.id, label: p.name }))
  );
  siteItems = computed<DropdownItem[]>(() =>
    this.sites().map(s => ({ value: s.id, label: s.name }))
  );
  paymentModeItems = computed<DropdownItem[]>(() =>
    this.paymentModes().map(m => ({ value: m.id, label: m.name }))
  );
  bankItems = computed<DropdownItem[]>(() =>
    this.banks().map(b => ({ value: b.id, label: b.name }))
  );

  filtered = computed(() => {
    let list = this.payments();
    const cat = this.filterCategory();
    if (cat) list = list.filter(p => p.category === cat);
    const site = this.filterSiteId();
    if (site) list = list.filter(p => p.site_id === site);
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

  summaryCards = computed<SummaryCard[]>(() => [
    { title: 'Total Payments', value: this.filtered().length, color: 'primary', icon: 'ri-file-list-3-line' },
    { title: 'Gross Amount', value: this.totalGross(), color: 'info', prefix: '₹', icon: 'ri-money-rupee-circle-line' },
    { title: 'TDS Deducted', value: this.totalTds(), color: 'warning', prefix: '₹', icon: 'ri-percent-line' },
    { title: 'Net Paid', value: this.totalNet(), color: 'success', prefix: '₹', icon: 'ri-wallet-3-line' },
  ]);

  get tdsAmount(): number {
    return Math.round((this.amount() ?? 0) * this.tdsPercentage() / 100 * 100) / 100;
  }

  get netAmount(): number {
    return (this.amount() ?? 0) - this.tdsAmount;
  }

  ngOnInit(): void {
    this.loadDropdowns();
    this.loadPayments();
  }

  loadDropdowns(): void {
    this.api.get<any[]>('/payment-modes').subscribe({ next: d => this.paymentModes.set(d) });
    this.api.get<any[]>('/banks').subscribe({ next: d => this.banks.set(d) });
    this.api.get<any[]>('/sites').subscribe({ next: d => this.sites.set(d) });
  }

  onCategoryChange(): void {
    this.partyId.set('');
    this.parties.set([]);
    this.dueAmount.set(null);
    this.recentPayments.set([]);
    const cat = this.category();
    if (!cat) return;

    const endpointMap: Record<string, string> = {
      employee: '/employees',
      contractor: '/contractors',
      retailer: '/retailers',
      supervisor_fund: '/supervisors',
      equipment: '/equipment',
    };
    const endpoint = endpointMap[cat];
    if (endpoint) {
      this.api.get<any[]>(endpoint).subscribe({
        next: data => this.parties.set(data),
        error: () => this.notify.error('Failed to load parties'),
      });
    }
  }

  onPartyChange(): void {
    const pid = this.partyId();
    const cat = this.category();
    if (!pid || !cat) return;

    this.api.get<any>(`/ledger/${cat}/${pid}/summary`).subscribe({
      next: summary => {
        this.dueAmount.set(summary?.due_balance ?? summary?.balance ?? null);
      },
      error: () => {},
    });

    this.api.get<any[]>(`/payments/recent`, { party_id: pid, limit: '5' }).subscribe({
      next: data => this.recentPayments.set(data),
      error: () => {},
    });
  }

  loadPayments(): void {
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.filterCategory()) params['category'] = this.filterCategory();
    if (this.filterSiteId()) params['site_id'] = this.filterSiteId();
    this.api.get<Payment[]>('/payments', params).subscribe({
      next: data => { this.payments.set(data); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load payments'); this.loading.set(false); },
    });
  }

  fillDueAmount(): void {
    if (this.dueAmount() !== null) {
      this.amount.set(this.dueAmount()!);
    }
  }

  submitPayment(): void {
    if (!this.date() || !this.category() || !this.amount()) {
      this.notify.error('Date, category, and amount are required');
      return;
    }

    const party = this.parties().find(p => p.id === this.partyId());
    const body = {
      date: this.date(),
      category: this.category(),
      party_id: this.partyId(),
      party_name: party?.name ?? '',
      party_type: this.category(),
      site_id: this.siteId(),
      amount: this.amount(),
      tds_percentage: this.tdsPercentage(),
      tds_amount: this.tdsAmount,
      net_amount: this.netAmount,
      reference_no: this.referenceNo(),
      payment_mode_id: this.paymentModeId(),
      bank_id: this.bankId(),
      remarks: this.remarks(),
      settle_bills: this.settleBills(),
      settle_amount: this.settleAmount(),
    };

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'AllTypePayment',
        actionType: 'create',
        summary: `Payment ₹${this.netAmount} to ${party?.name ?? 'Unknown'} (${this.category()})`,
        data: body,
      }).subscribe({
        next: () => { this.notify.success('Payment sent for approval'); this.resetForm(); },
        error: () => this.notify.error('Failed to submit approval'),
      });
      return;
    }

    this.api.post<Payment>('/payments', body).subscribe({
      next: created => {
        this.payments.update(list => [created, ...list]);
        this.notify.success('Payment recorded');
        this.resetForm();
      },
      error: () => this.notify.error('Failed to record payment'),
    });
  }

  addPaymentMode(): void {
    const name = prompt('Enter new payment mode name:');
    if (name?.trim()) {
      this.api.post<any>('/payment-modes', { name: name.trim() }).subscribe({
        next: mode => {
          this.paymentModes.update(l => [...l, mode]);
          this.paymentModeId.set(mode.id);
          this.notify.success('Payment mode added');
        },
        error: () => this.notify.error('Failed to add payment mode'),
      });
    }
  }

  exportPayments(): void {
    this.exportService.exportToExcel(this.filtered(), 'All_Type_Payments', 'Payments', [
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
    ]);
  }

  private resetForm(): void {
    this.date.set('');
    this.category.set('');
    this.partyId.set('');
    this.siteId.set('');
    this.amount.set(null);
    this.tdsPercentage.set(0);
    this.paymentModeId.set('');
    this.bankId.set('');
    this.referenceNo.set('');
    this.remarks.set('');
    this.parties.set([]);
    this.dueAmount.set(null);
    this.recentPayments.set([]);
    this.settleBills.set(false);
    this.settleAmount.set(null);
  }
}
