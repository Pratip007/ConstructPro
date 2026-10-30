import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { RoleService } from '../../../core/services/role.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface ApiLedgerEntry {
  date?: string;
  description?: string;
  particulars?: string;
  debit?: number;
  credit?: number;
  amount?: number;
  type?: string;
  balance?: number;
  running_balance?: number;
  month?: string;
  sub_id?: string;
  present_days?: number;
  rate?: number;
}

interface LedgerEntry {
  date: string;
  month: string;
  subId: string;
  presentDays: number;
  rate: number;
  particulars: string;
  grossAmount: number;
  tdsDeduction: number;
  netAmount: number;
  payment: number;
  dueBalance: number;
  debit: number;
  credit: number;
  balance: number;
}

function mapLedgerEntry(e: ApiLedgerEntry): LedgerEntry {
  const isDebit = e.type === 'debit' || (e.debit ?? 0) > 0;
  const amount = e.debit ?? e.credit ?? e.amount ?? 0;
  const debit = e.debit ?? (isDebit ? amount : 0);
  const credit = e.credit ?? (!isDebit ? amount : 0);
  return {
    date: e.date ?? '',
    month: e.month ?? (e.date ? e.date.substring(0, 7) : ''),
    subId: e.sub_id ?? '',
    presentDays: e.present_days ?? 0,
    rate: e.rate ?? 0,
    particulars: e.particulars ?? e.description ?? '',
    grossAmount: debit,
    tdsDeduction: 0,
    netAmount: debit,
    payment: credit,
    dueBalance: e.running_balance ?? e.balance ?? 0,
    debit, credit,
    balance: e.running_balance ?? e.balance ?? 0,
  };
}

interface SiteItem { id: string | number; name: string; }

@Component({
  selector: 'app-employee-ledger',
  standalone: true,
  imports: [FormsModule, DecimalPipe, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './employee-ledger.html',
  styleUrl: './employee-ledger.scss',
})
export class EmployeeLedgerComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  readonly role = inject(RoleService);

  selectedEmployee = signal('');
  siteFilter = signal('');
  dateFrom = signal('');
  dateTo = signal('');
  entries = signal<LedgerEntry[]>([]);
  loading = signal(false);

  employeeDropdownItems = signal<DropdownItem[]>([]);
  siteDropdownItems = signal<DropdownItem[]>([]);
  selectedEmployeeName = '';

  totalGross = computed(() => this.entries().reduce((sum, e) => sum + e.grossAmount, 0));
  totalTds = computed(() => this.entries().reduce((sum, e) => sum + e.tdsDeduction, 0));
  totalNet = computed(() => this.entries().reduce((sum, e) => sum + e.netAmount, 0));
  totalPayment = computed(() => this.entries().reduce((sum, e) => sum + e.payment, 0));
  netBalance = computed(() => this.totalGross() - this.totalPayment());

  summaryCards = computed<SummaryCard[]>(() => [
    { title: 'Total Earned', value: this.totalGross(), icon: 'ri-money-rupee-circle-line', color: 'success', prefix: '₹' },
    { title: 'Total Payments', value: this.totalPayment(), icon: 'ri-hand-coin-line', color: 'info', prefix: '₹' },
    { title: 'Net Due Balance', value: Math.abs(this.netBalance()), icon: 'ri-scales-3-line', color: this.netBalance() > 0 ? 'danger' : 'success', prefix: '₹' },
  ]);

  ngOnInit(): void {
    this.api.get<{id: string | number; name: string}[]>('/employees').subscribe({
      next: (emps) => {
        this.employeeDropdownItems.set(emps.map(e => ({ value: String(e.id), label: e.name })));
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to load employees'),
    });
    this.api.get<SiteItem[]>('/sites').subscribe({
      next: (sites) => {
        this.siteDropdownItems.set(sites.map(s => ({ value: String(s.id), label: s.name })));
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to load sites'),
    });
  }

  onEmployeeChange(empId: string): void {
    this.selectedEmployee.set(empId);
    const emp = this.employeeDropdownItems().find(e => e.value === empId);
    this.selectedEmployeeName = emp?.label ?? '';
    if (empId) this.loadLedger(empId);
    else this.entries.set([]);
  }

  loadLedger(empId?: string): void {
    const id = empId ?? this.selectedEmployee();
    if (!id) return;
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.dateFrom()) params['from'] = this.dateFrom();
    if (this.dateTo()) params['to'] = this.dateTo();
    if (this.siteFilter()) params['site_id'] = this.siteFilter();
    this.api.get<ApiLedgerEntry[]>(`/employee-ledger/${id}`, params).subscribe({
      next: (data) => {
        this.entries.set(data.map(mapLedgerEntry));
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err.message ?? 'Failed to load ledger');
        this.loading.set(false);
      },
    });
  }

  exportExcel(): void {
    this.exportService.exportToExcel(
      this.entries().map(e => ({
        'Date': e.date, 'Particulars': e.particulars,
        'Gross Amount': e.grossAmount, 'TDS Deduction': e.tdsDeduction,
        'Net Amount': e.netAmount, 'Payment': e.payment, 'Due Balance': e.dueBalance,
      })),
      `Employee_Ledger_${this.selectedEmployeeName}`, 'Ledger'
    );
  }

  exportPDF(): void {
    this.exportService.exportToPDF({
      title: `Employee Ledger - ${this.selectedEmployeeName}`,
      fileName: `Ledger_${this.selectedEmployeeName}`,
      companyName: 'ATR Construction Pvt. Ltd.',
      data: this.entries() as any[],
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'particulars', header: 'Particulars' },
        { key: 'grossAmount', header: 'Gross (Rs.)', align: 'right', format: 'currency' },
        { key: 'payment', header: 'Payment (Rs.)', align: 'right', format: 'currency' },
        { key: 'dueBalance', header: 'Due (Rs.)', align: 'right', format: 'currency' },
      ],
      summaryRow: { date: '', particulars: 'TOTAL', grossAmount: this.totalGross(), payment: this.totalPayment(), dueBalance: this.netBalance() },
      footerLeft: 'Employee Signature',
      footerRight: 'Authorized Signatory',
      dualCopy: { partyLabel: 'Employee Copy' },
    });
  }

  printLedger(): void {
    this.exportService.printReport('ledger-table', `Employee Ledger - ${this.selectedEmployeeName}`);
  }
}
