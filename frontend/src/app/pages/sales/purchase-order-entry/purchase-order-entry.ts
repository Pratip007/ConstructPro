import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { GstService } from '../../../core/services/gst.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { RoleService } from '../../../core/services/role.service';
import { SearchableDropdownComponent } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface PoItem {
  product: string;
  hsn: string;
  unit: string;
  qty: number;
  rate: number;
  gst_percent: number;
  amount: number;
  gst_amount: number;
}

@Component({
  selector: 'app-purchase-order-entry',
  standalone: true,
  imports: [FormsModule, DecimalPipe, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './purchase-order-entry.html',
  styleUrl: './purchase-order-entry.scss',
})
export class PurchaseOrderEntryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly gstService = inject(GstService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly approval = inject(ApprovalService);
  readonly role = inject(RoleService);

  poNumber = signal('');
  company = signal('');
  retailer = signal('');
  site = signal('');
  date = signal('');
  tcOption = signal('');
  status = signal('Active');
  reminderDate = signal('');
  reminderRemark = signal('');
  items = signal<PoItem[]>([
    { product: '', hsn: '', unit: 'Nos', qty: 0, rate: 0, gst_percent: 18, amount: 0, gst_amount: 0 },
  ]);

  editingId = signal<string | null>(null);

  retailers = signal<any[]>([]);
  companiesOptions = signal<any[]>([]);
  sites = signal<any[]>([]);
  termsOptions = signal<any[]>([]);
  products = signal<any[]>([]);

  unitOptions = ['Nos', 'Kg', 'Litre', 'Meter', 'Sq.Ft', 'Cu.M', 'Bag', 'Ton', 'Cft', '%'];
  statusOptions = ['Active', 'Hold', 'Complete', 'Cancelled'];

  orders = signal<any[]>([]);
  loading = signal(false);

  filterStatus = signal('');
  filterSearch = signal('');

  get retailerDropdownItems() {
    return this.retailers().map(r => ({ value: r.id, label: r.name }));
  }

  get companyDropdownItems() {
    return this.companiesOptions().map(c => ({ value: c.id, label: c.name }));
  }

  get siteDropdownItems() {
    return this.sites().map(s => ({ value: s.id, label: s.name }));
  }

  get productDropdownItems() {
    return this.products().map(p => ({ value: p.id, label: `${p.name} (${p.unit})` }));
  }

  get subtotal(): number {
    return this.items().reduce((s, i) => s + i.amount, 0);
  }

  get totalGst(): number {
    return this.items().reduce((s, i) => s + i.gst_amount, 0);
  }

  get grandTotal(): number {
    return this.subtotal + this.totalGst;
  }

  get summaryCards(): SummaryCard[] {
    const all = this.filteredOrders;
    const active = all.filter(o => o.status === 'Active').length;
    const totalValue = all.reduce((s, o) => s + (o.total_amount || 0), 0);
    return [
      { title: 'Total POs', value: all.length, icon: 'ri-file-list-line', color: 'primary' },
      { title: 'Active', value: active, icon: 'ri-checkbox-circle-line', color: 'success' },
      { title: 'Total Value', value: totalValue, icon: 'ri-money-rupee-circle-line', color: 'info', prefix: '₹' },
    ];
  }

  get filteredOrders(): any[] {
    let list = this.orders();
    const st = this.filterStatus();
    const q = this.filterSearch().toLowerCase();
    if (st) list = list.filter(o => o.status === st);
    if (q) list = list.filter(o =>
      (o.display_id || '').toLowerCase().includes(q) ||
      (o.retailer_name || '').toLowerCase().includes(q) ||
      (o.site_name || '').toLowerCase().includes(q)
    );
    return list;
  }

  ngOnInit(): void {
    this.loadDropdowns();
    this.loadOrders();
  }

  private loadDropdowns(): void {
    this.api.get<any[]>('/retailers').subscribe({ next: d => this.retailers.set(d), error: () => {} });
    this.api.get<any[]>('/companies').subscribe({ next: d => this.companiesOptions.set(d), error: () => {} });
    this.api.get<any[]>('/sites').subscribe({ next: d => this.sites.set(d), error: () => {} });
    this.api.get<any[]>('/settings/terms').subscribe({ next: d => this.termsOptions.set(d), error: () => {} });
    this.api.get<any[]>('/stock-products').subscribe({ next: d => this.products.set(d), error: () => {} });
  }

  private loadOrders(): void {
    this.loading.set(true);
    this.api.get<any[]>('/purchase-orders').subscribe({
      next: data => { this.orders.set(data); this.loading.set(false); this.generatePoNumber(); },
      error: () => { this.notify.error('Failed to load purchase orders'); this.loading.set(false); },
    });
  }

  private generatePoNumber(): void {
    if (this.editingId()) return;
    const count = this.orders().length;
    this.poNumber.set(`PO-${String(count + 1).padStart(4, '0')}`);
  }

  addItem(): void {
    this.items.update(l => [...l, { product: '', hsn: '', unit: 'Nos', qty: 0, rate: 0, gst_percent: 18, amount: 0, gst_amount: 0 }]);
  }

  removeItem(i: number): void {
    this.items.update(l => l.filter((_, idx) => idx !== i));
  }

  onProductSelect(index: number, productId: any): void {
    const prod = this.products().find(p => p.id === productId);
    if (!prod) return;
    this.items.update(l => {
      const u = [...l];
      u[index] = { ...u[index], product: prod.name, hsn: prod.hsn_code ?? '', unit: prod.unit ?? 'Nos', gst_percent: prod.gst_rate ?? 18 };
      return u;
    });
    this.calculateAmount(index);
  }

  calculateAmount(i: number): void {
    this.items.update(l => {
      const u = [...l];
      const item = u[i];
      const base = item.unit === '%' ? Math.round(item.rate * item.qty / 100 * 100) / 100 : Math.round(item.qty * item.rate * 100) / 100;
      const gst = Math.round(base * item.gst_percent / 100 * 100) / 100;
      u[i] = { ...item, amount: base, gst_amount: gst };
      return u;
    });
  }

  editOrder(order: any): void {
    this.editingId.set(order.id);
    this.poNumber.set(order.display_id ?? `PO-${order.id}`);
    this.date.set(order.date ?? '');
    this.site.set(order.site_id ?? '');
    this.retailer.set(order.retailer_id ?? '');
    this.company.set(order.company_id ?? '');
    this.tcOption.set(order.tc_id ?? '');
    this.status.set(order.status ?? 'Active');
    if (order.items?.length) {
      this.items.set(order.items.map((it: any) => ({
        product: it.name ?? it.description ?? '', hsn: it.hsn ?? '', unit: it.unit ?? 'Nos',
        qty: it.qty ?? it.quantity ?? 0, rate: it.price ?? 0, gst_percent: it.gst_percent ?? 18,
        amount: it.amount ?? 0, gst_amount: it.gst_amount ?? 0,
      })));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async deleteOrder(order: any): Promise<void> {
    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'purchase-orders', actionType: 'delete',
        summary: `Delete PO ${order.display_id}`, data: order, referenceId: order.id,
      }).subscribe({ next: () => this.notify.success('Delete request submitted'), error: () => this.notify.error('Failed') });
      return;
    }
    const ok = await this.confirmDialog.confirm({ title: 'Delete PO', message: `Delete "${order.display_id}"?`, type: 'danger' });
    if (!ok) return;
    this.api.delete<any>(`/purchase-orders/${order.id}`).subscribe({
      next: () => { this.notify.success('PO deleted'); this.loadOrders(); },
      error: () => this.notify.error('Failed to delete PO'),
    });
  }

  toggleStatus(order: any, newStatus: string): void {
    this.api.put<any>(`/purchase-orders/${order.id}`, { ...order, status: newStatus }).subscribe({
      next: () => { this.notify.success(`PO status changed to ${newStatus}`); this.loadOrders(); },
      error: () => this.notify.error('Failed to update status'),
    });
  }

  onSubmit(): void {
    const body = {
      display_id: this.poNumber(),
      date: this.date(),
      site_id: this.site() || null,
      retailer_id: this.retailer() || null,
      company_id: this.company() || null,
      tc_id: this.tcOption() || null,
      status: this.status(),
      total_amount: this.grandTotal,
      reminder_date: this.reminderDate() || null,
      reminder_remark: this.reminderRemark() || null,
      items: this.items().map(({ product, hsn, unit, qty, rate, gst_percent, amount, gst_amount }) => ({
        description: product, name: product, hsn, unit, quantity: qty, qty, price: rate, gst_percent, amount, gst_amount,
      })),
    };
    const id = this.editingId();
    const request = id ? this.api.put<any>(`/purchase-orders/${id}`, body) : this.api.post<any>('/purchase-orders', body);
    request.subscribe({
      next: () => { this.notify.success(id ? 'PO updated' : 'PO created'); this.resetForm(); this.loadOrders(); },
      error: () => this.notify.error(id ? 'Failed to update' : 'Failed to create'),
    });
  }

  exportToExcel(): void {
    this.exportService.exportToExcel(
      this.filteredOrders.map(o => ({
        po_no: o.display_id, date: o.date, retailer: o.retailer_name, site: o.site_name,
        total: o.total_amount, status: o.status,
      })),
      'purchase-orders', 'Purchase Orders'
    );
  }

  cancelEdit(): void { this.resetForm(); }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'Active': return 'badge-success';
      case 'Hold': return 'badge-warning';
      case 'Complete': return 'badge-info';
      case 'Cancelled': return 'badge-danger';
      default: return 'badge-info';
    }
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.company.set('');
    this.retailer.set('');
    this.site.set('');
    this.date.set('');
    this.tcOption.set('');
    this.status.set('Active');
    this.reminderDate.set('');
    this.reminderRemark.set('');
    this.items.set([{ product: '', hsn: '', unit: 'Nos', qty: 0, rate: 0, gst_percent: 18, amount: 0, gst_amount: 0 }]);
    this.generatePoNumber();
  }
}
