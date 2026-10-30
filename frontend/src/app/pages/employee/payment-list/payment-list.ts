import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { RoleService } from '../../../core/services/role.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface ApiPaymentRecord {
  id: number;
  employee_id?: string;
  employee_name?: string;
  site_id?: string;
  site_name?: string;
  days_worked?: number;
  rate?: number;
  amount?: number;
  gross_amount?: number;
  tds_amount?: number;
  net_amount?: number;
  total_amount?: number;
  final_payment?: number;
  status?: string;
  category?: string;
  bank_name?: string;
  account_no?: string;
  ifsc?: string;
  payment_date?: string;
}

interface PaymentRecord {
  id: number;
  employeeId: string;
  employee: string;
  site: string;
  daysWorked: number;
  rate: number;
  grossAmount: number;
  tdsAmount: number;
  netAmount: number;
  finalPayment: number;
  bankName: string;
  accountNo: string;
  ifsc: string;
  status: string;
}

function mapPayment(p: ApiPaymentRecord): PaymentRecord {
  const gross = p.gross_amount ?? p.total_amount ?? p.amount ?? 0;
  const tds = p.tds_amount ?? 0;
  const net = p.net_amount ?? (gross - tds);
  return {
    id: p.id,
    employeeId: p.employee_id ?? '',
    employee: p.employee_name ?? p.employee_id ?? '',
    site: p.site_name ?? p.site_id ?? '',
    daysWorked: p.days_worked ?? 0,
    rate: p.rate ?? 0,
    grossAmount: gross,
    tdsAmount: tds,
    netAmount: net,
    finalPayment: p.final_payment ?? net,
    bankName: p.bank_name ?? '',
    accountNo: p.account_no ?? '',
    ifsc: p.ifsc ?? '',
    status: p.status ?? 'draft',
  };
}

@Component({
  selector: 'app-payment-list',
  standalone: true,
  imports: [FormsModule, DecimalPipe, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './payment-list.html',
  styleUrl: './payment-list.scss',
})
export class PaymentListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  readonly role = inject(RoleService);

  selectedMonth = signal('');
  selectedSite = signal('');
  paymentDate = signal('');
  payments = signal<PaymentRecord[]>([]);
  loading = signal(false);
  listGenerated = signal(false);

  siteDropdownItems = signal<DropdownItem[]>([]);

  visibleColumns = signal<Record<string, boolean>>({
    daysWorked: true,
    rate: true,
    grossAmount: true,
    tdsAmount: true,
    netAmount: true,
    finalPayment: true,
    bankName: false,
    accountNo: false,
    ifsc: false,
    status: true,
  });
  showColumnMenu = signal(false);

  columnLabels: Record<string, string> = {
    daysWorked: 'Days Worked',
    rate: 'Rate',
    grossAmount: 'Gross Amount',
    tdsAmount: 'TDS',
    netAmount: 'Net Amount',
    finalPayment: 'Final Payment',
    bankName: 'Bank Name',
    accountNo: 'Account No',
    ifsc: 'IFSC',
    status: 'Status',
  };

  totalGross = computed(() => this.payments().reduce((sum, p) => sum + p.grossAmount, 0));
  totalTds = computed(() => this.payments().reduce((sum, p) => sum + p.tdsAmount, 0));
  totalNet = computed(() => this.payments().reduce((sum, p) => sum + p.netAmount, 0));
  totalFinalPayment = computed(() => this.payments().reduce((sum, p) => sum + p.finalPayment, 0));

  summaryCards = computed<SummaryCard[]>(() => [
    { title: 'Total Gross', value: this.totalGross(), icon: 'ri-money-rupee-circle-line', color: 'primary', prefix: '₹' },
    { title: 'Total TDS', value: this.totalTds(), icon: 'ri-subtract-line', color: 'danger', prefix: '₹' },
    { title: 'Total Net', value: this.totalNet(), icon: 'ri-hand-coin-line', color: 'info', prefix: '₹' },
    { title: 'Final Payment', value: this.totalFinalPayment(), icon: 'ri-wallet-3-line', color: 'success', prefix: '₹' },
  ]);

  ngOnInit(): void {
    const now = new Date();
    this.selectedMonth.set(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    this.paymentDate.set(now.toISOString().split('T')[0]);

    this.api.get<{ id: string | number; name: string }[]>('/sites').subscribe({
      next: (sites) => {
        this.siteDropdownItems.set(sites.map(s => ({ value: String(s.id), label: s.name })));
        if (this.role.isSiteLocked()) {
          const lockedSite = this.role.getSupervisorSiteId();
          if (lockedSite) this.selectedSite.set(String(lockedSite));
        }
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to load sites'),
    });
  }

  generateList(): void {
    if (!this.selectedMonth()) {
      this.notify.error('Select a month');
      return;
    }
    this.loading.set(true);
    const params: Record<string, string> = { month: this.selectedMonth(), category: 'employee' };
    if (this.selectedSite()) params['site_id'] = this.selectedSite();
    this.api.get<ApiPaymentRecord[]>('/payments/generate', params).subscribe({
      next: (data) => {
        this.payments.set(data.map(mapPayment));
        this.listGenerated.set(true);
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err.message ?? 'Failed to generate payment list');
        this.loading.set(false);
      },
    });
  }

  updateFinalPayment(id: number, value: number): void {
    this.payments.update(list =>
      list.map(p => p.id === id ? { ...p, finalPayment: value } : p)
    );
  }

  isColumnVisible(col: string): boolean {
    return this.visibleColumns()[col] ?? true;
  }

  toggleColumn(col: string): void {
    this.visibleColumns.update(v => ({ ...v, [col]: !v[col] }));
  }

  toggleColumnMenu(): void {
    this.showColumnMenu.update(v => !v);
  }

  async submitPayments(): Promise<void> {
    if (!this.paymentDate()) {
      this.notify.error('Select a payment date');
      return;
    }
    const confirmed = await this.confirmDialog.confirm({
      title: 'Submit Payments',
      message: `Submit payments for ${this.payments().length} employees? This will mark them as submitted.`,
      type: 'info',
    });
    if (!confirmed) return;
    const body = {
      month: this.selectedMonth(),
      site_id: this.selectedSite() || null,
      payment_date: this.paymentDate(),
      payments: this.payments().map(p => ({
        id: p.id,
        employee_id: p.employeeId,
        final_payment: p.finalPayment,
      })),
    };
    this.api.post('/payments/submit', body).subscribe({
      next: () => {
        this.notify.success('Payments submitted successfully');
        this.payments.update(list => list.map(p => ({ ...p, status: 'submitted' })));
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to submit payments'),
    });
  }

  async holdPayments(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Hold Payments',
      message: 'Put all payments on hold?',
      type: 'warning',
    });
    if (!confirmed) return;
    const body = {
      month: this.selectedMonth(),
      site_id: this.selectedSite() || null,
      payment_ids: this.payments().map(p => p.id),
    };
    this.api.post('/payments/hold', body).subscribe({
      next: () => {
        this.notify.success('Payments put on hold');
        this.payments.update(list => list.map(p => ({ ...p, status: 'on_hold' })));
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to hold payments'),
    });
  }

  exportExcel(): void {
    const paymentSheet = this.payments().map(p => ({
      'Employee': p.employee, 'Site': p.site, 'Days Worked': p.daysWorked,
      'Rate': p.rate, 'Gross Amount': p.grossAmount, 'TDS': p.tdsAmount,
      'Net Amount': p.netAmount, 'Final Payment': p.finalPayment, 'Status': p.status,
    }));
    const bankSheet = this.payments().filter(p => p.bankName).map(p => ({
      'Employee': p.employee, 'Bank Name': p.bankName,
      'Account No': p.accountNo, 'IFSC': p.ifsc, 'Amount': p.finalPayment,
    }));
    this.exportService.exportMultiSheetExcel(
      [
        { name: 'Payment Details', data: paymentSheet },
        { name: 'Bank Details', data: bankSheet },
      ],
      `Payment_List_${this.selectedMonth()}`
    );
  }

  exportPDF(): void {
    this.exportService.exportToPDF({
      title: `Payment List - ${this.selectedMonth()}`,
      fileName: `Payment_List_${this.selectedMonth()}`,
      companyName: 'ATR Construction Pvt. Ltd.',
      data: this.payments() as any[],
      columns: [
        { key: 'employee', header: 'Employee' },
        { key: 'daysWorked', header: 'Days' },
        { key: 'grossAmount', header: 'Gross (Rs.)', align: 'right', format: 'currency' },
        { key: 'tdsAmount', header: 'TDS (Rs.)', align: 'right', format: 'currency' },
        { key: 'netAmount', header: 'Net (Rs.)', align: 'right', format: 'currency' },
        { key: 'finalPayment', header: 'Final (Rs.)', align: 'right', format: 'currency' },
      ],
      summaryRow: {
        employee: 'TOTAL', daysWorked: '', grossAmount: this.totalGross(),
        tdsAmount: this.totalTds(), netAmount: this.totalNet(), finalPayment: this.totalFinalPayment(),
      },
      footerLeft: 'Prepared By',
      footerRight: 'Authorized Signatory',
      dualCopy: { partyLabel: 'Office Copy' },
    });
  }

  printPayments(): void {
    this.exportService.printReport('payment-table', `Payment List - ${this.selectedMonth()}`);
  }
}
