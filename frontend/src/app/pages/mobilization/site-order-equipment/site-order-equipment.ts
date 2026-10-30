import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { ExportService } from '../../../core/services/export.service';
import { GstService } from '../../../core/services/gst.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';

interface EquipmentAssignment {
  id: string;
  equipment_id: string;
  equipment_name?: string;
  site_id: string;
  site_name?: string;
  start_date: string;
  end_date: string;
  released_date: string | null;
  rate: number;
  rate_unit: string;
  purpose: string;
  status: string;
  invoice_no?: string;
  invoice_date?: string;
  contractor_id?: string;
  contractor_name?: string;
  include_gst?: boolean;
  gst_percent?: number;
  tds_applicable?: boolean;
  tds_percent?: number;
}

interface CartItem {
  name: string;
  unit: string;
  qty: number;
  rate: number;
  gstPercent: number;
  amount: number;
  gstAmount: number;
  total: number;
}

interface Equipment { id: string; name: string; }
interface Site { id: string; name: string; }
interface Contractor { id: string; name: string; tds_applicable?: boolean; tds_percent?: number; }

@Component({
  selector: 'app-site-order-equipment',
  standalone: true,
  imports: [FormsModule, DecimalPipe, TitleCasePipe, SearchableDropdownComponent, SummaryCardsComponent, ModalDialogComponent],
  templateUrl: './site-order-equipment.html',
  styleUrl: './site-order-equipment.scss',
})
export class SiteOrderEquipmentComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotificationService);
  readonly role = inject(RoleService);
  readonly approval = inject(ApprovalService);
  private exportService = inject(ExportService);
  private gst = inject(GstService);

  loading = signal(false);
  assignments = signal<EquipmentAssignment[]>([]);
  equipmentOptions = signal<Equipment[]>([]);
  siteOptions = signal<Site[]>([]);
  contractors = signal<Contractor[]>([]);

  selectedEquipment = signal('');
  selectedSite = signal('');
  selectedContractor = signal('');
  startDate = signal('');
  endDate = signal('');
  purpose = signal('');
  rate = signal<number>(0);
  rateUnit = signal<string>('per_day');
  invoiceNo = signal('');
  invoiceDate = signal('');
  includeGst = signal(false);
  gstPercent = signal<number>(18);

  cart = signal<CartItem[]>([]);
  itemName = signal('');
  itemUnit = signal('');
  itemQty = signal<number>(1);
  itemRate = signal<number>(0);
  itemGstPercent = signal<number>(18);

  equipmentItems = computed<DropdownItem[]>(() =>
    this.equipmentOptions().map(e => ({ value: e.id, label: e.name }))
  );
  siteItems = computed<DropdownItem[]>(() =>
    this.siteOptions().map(s => ({ value: s.id, label: s.name }))
  );
  contractorItems = computed<DropdownItem[]>(() =>
    this.contractors().map(c => ({ value: c.id, label: c.name }))
  );

  selectedContractorData = computed(() =>
    this.contractors().find(c => c.id === this.selectedContractor())
  );

  cartSubtotal = computed(() => this.cart().reduce((s, i) => s + i.amount, 0));
  cartGstTotal = computed(() => this.cart().reduce((s, i) => s + i.gstAmount, 0));
  cartTdsAmount = computed(() => {
    const c = this.selectedContractorData();
    if (!c?.tds_applicable || !c.tds_percent) return 0;
    return this.cartSubtotal() * (c.tds_percent / 100);
  });
  cartGrandTotal = computed(() => this.cartSubtotal() + this.cartGstTotal() - this.cartTdsAmount());

  summaryCards = computed<SummaryCard[]>(() => {
    const orders = this.assignments();
    const totalCost = orders.reduce((s, o) => s + this.getTotalCost(o), 0);
    return [
      { title: 'Total Orders', value: orders.length, icon: 'ri-file-list-3-line', color: 'primary' },
      { title: 'Active', value: orders.filter(o => o.status === 'active').length, icon: 'ri-check-line', color: 'success' },
      { title: 'Total Cost', value: totalCost, icon: 'ri-money-rupee-circle-line', color: 'info', prefix: '₹' },
    ];
  });

  ngOnInit(): void {
    this.api.get<Equipment[]>('/equipment').subscribe({
      next: data => this.equipmentOptions.set(data),
      error: () => this.notify.error('Failed to load equipment'),
    });
    this.api.get<Site[]>('/sites').subscribe({
      next: data => this.siteOptions.set(data),
      error: () => this.notify.error('Failed to load sites'),
    });
    this.api.get<Contractor[]>('/contractors').subscribe({
      next: data => this.contractors.set(data),
      error: () => {},
    });
    this.loadAssignments();
  }

  loadAssignments(): void {
    this.loading.set(true);
    this.api.get<EquipmentAssignment[]>('/equipment-site-assignments').subscribe({
      next: data => { this.assignments.set(data); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load orders'); this.loading.set(false); },
    });
  }

  addItemToCart(): void {
    if (!this.itemName() || !this.itemQty() || !this.itemRate()) {
      this.notify.error('Item name, quantity, and rate are required');
      return;
    }
    const qty = this.itemQty();
    const rate = this.itemRate();
    const isPercent = this.itemUnit().toLowerCase() === '%';
    const amount = isPercent ? (rate * qty / 100) : (qty * rate);
    const gstAmt = this.includeGst() ? amount * (this.itemGstPercent() / 100) : 0;

    this.cart.update(c => [...c, {
      name: this.itemName(),
      unit: this.itemUnit(),
      qty,
      rate,
      gstPercent: this.includeGst() ? this.itemGstPercent() : 0,
      amount,
      gstAmount: gstAmt,
      total: amount + gstAmt,
    }]);
    this.itemName.set('');
    this.itemUnit.set('');
    this.itemQty.set(1);
    this.itemRate.set(0);
  }

  removeCartItem(index: number): void {
    this.cart.update(c => c.filter((_, i) => i !== index));
  }

  addOrder(): void {
    if (!this.selectedEquipment() || !this.selectedSite() || !this.startDate()) {
      this.notify.error('Equipment, site, and start date are required');
      return;
    }
    const body: Record<string, any> = {
      equipment_id: this.selectedEquipment(),
      site_id: this.selectedSite(),
      start_date: this.startDate(),
      end_date: this.endDate(),
      purpose: this.purpose(),
      rate: this.rate(),
      rate_unit: this.rateUnit(),
      invoice_no: this.invoiceNo(),
      invoice_date: this.invoiceDate(),
      contractor_id: this.selectedContractor() || null,
      include_gst: this.includeGst(),
      gst_percent: this.includeGst() ? this.gstPercent() : null,
      cart_items: this.cart(),
    };

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'SiteOrderEquipment',
        actionType: 'create',
        summary: `Equipment Order: ${this.equipmentItems().find(e => e.value === this.selectedEquipment())?.label ?? ''} at ${this.siteItems().find(s => s.value === this.selectedSite())?.label ?? ''}`,
        data: body,
      }).subscribe({
        next: () => { this.notify.success('Order sent for approval'); this.resetForm(); },
        error: () => this.notify.error('Failed to submit order for approval'),
      });
      return;
    }

    this.api.post<EquipmentAssignment>('/equipment-site-assignments', body).subscribe({
      next: created => {
        this.assignments.update(list => [created, ...list]);
        this.notify.success('Equipment order created');
        this.resetForm();
      },
      error: () => this.notify.error('Failed to create equipment order'),
    });
  }

  releaseAssignment(assignment: EquipmentAssignment): void {
    const today = new Date().toISOString().split('T')[0];
    this.api.put<EquipmentAssignment>(`/equipment-site-assignments/${assignment.id}`, {
      released_date: today,
      status: 'released',
    }).subscribe({
      next: updated => {
        this.assignments.update(list => list.map(a => a.id === updated.id ? updated : a));
        this.notify.success('Equipment released');
      },
      error: () => this.notify.error('Failed to release equipment'),
    });
  }

  getDurationDays(a: EquipmentAssignment): number {
    if (!a.start_date) return 0;
    const start = new Date(a.start_date).getTime();
    const end = a.released_date ? new Date(a.released_date).getTime() : a.end_date ? new Date(a.end_date).getTime() : Date.now();
    return Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  }

  getTotalCost(a: EquipmentAssignment): number {
    const days = this.getDurationDays(a);
    const r = a.rate ?? 0;
    if (a.rate_unit === 'per_month') return Math.round(r * days / 30 * 100) / 100;
    return r * days;
  }

  exportExcel(): void {
    const data = this.assignments().map(a => ({
      equipment: a.equipment_name,
      site: a.site_name,
      contractor: a.contractor_name ?? '-',
      invoice_no: a.invoice_no ?? '-',
      start_date: a.start_date,
      end_date: a.released_date ?? a.end_date ?? '-',
      days: this.getDurationDays(a),
      rate: a.rate,
      total_cost: this.getTotalCost(a),
      status: a.status,
    }));
    this.exportService.exportToExcel(data, 'Equipment_Orders', 'Orders');
  }

  private resetForm(): void {
    this.selectedEquipment.set('');
    this.selectedSite.set('');
    this.selectedContractor.set('');
    this.startDate.set('');
    this.endDate.set('');
    this.purpose.set('');
    this.rate.set(0);
    this.rateUnit.set('per_day');
    this.invoiceNo.set('');
    this.invoiceDate.set('');
    this.includeGst.set(false);
    this.cart.set([]);
  }
}
