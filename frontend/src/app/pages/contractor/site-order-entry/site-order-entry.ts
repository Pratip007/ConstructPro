import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { RoleService } from '../../../core/services/role.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface OrderItem {
  product_id: number | null;
  name: string;
  hsn: string;
  unit: string;
  qty: number;
  price: number;
  gst_percent: number;
}

interface PurchaseOrder {
  id: number;
  order_id?: string;
  contractor_id: number;
  site_id: number;
  date: string;
  include_gst: boolean;
  items: OrderItem[];
  total_base?: number;
  total_gst?: number;
  tds_amount?: number;
  grand_total?: number;
}

interface Contractor {
  id: number;
  name: string;
  category: string;
  tds_applicable: boolean;
  tds_percent: number;
}

interface Site {
  id: number;
  name: string;
}

interface StockProduct {
  id: number;
  name: string;
  hsn: string;
  unit: string;
  price: number;
  gst_percent: number;
}

const UNIT_OPTIONS = ['Nos', 'Kg', 'Bag', 'Pcs', 'Cft', 'Rft', 'Sqft', 'Cum', 'MT', 'Litre', 'Ton', '%'] as const;

@Component({
  selector: 'app-site-order-entry',
  standalone: true,
  imports: [FormsModule, CommonModule, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './site-order-entry.html',
  styleUrl: './site-order-entry.scss',
})
export class SiteOrderEntryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  readonly role = inject(RoleService);

  readonly unitOptions = UNIT_OPTIONS;

  // View toggle
  viewMode = signal<'entry' | 'list'>('entry');
  searchQuery = signal('');

  // Dropdown data
  contractors = signal<Contractor[]>([]);
  sites = signal<Site[]>([]);
  products = signal<StockProduct[]>([]);
  purchaseOrders = signal<PurchaseOrder[]>([]);

  // Form fields
  selectedContractorId = signal<number | null>(null);
  selectedSiteId = signal<number | null>(null);
  orderDate = signal(new Date().toISOString().slice(0, 10));
  includeGst = signal(true);
  items = signal<OrderItem[]>([this.emptyItem()]);

  loading = signal(false);
  saving = signal(false);
  editingId = signal<number | null>(null);

  // Dropdown items for searchable dropdown
  contractorItems = computed<DropdownItem[]>(() =>
    this.contractors().map(c => ({ value: c.id, label: c.name }))
  );
  siteItems = computed<DropdownItem[]>(() =>
    this.sites().map(s => ({ value: s.id, label: s.name }))
  );
  productItems = computed<DropdownItem[]>(() =>
    this.products().map(p => ({ value: p.id, label: `${p.name} (${p.unit})` }))
  );

  selectedContractor = computed(() => {
    const id = this.selectedContractorId();
    return id ? this.contractors().find(c => c.id === id) ?? null : null;
  });

  // Auto-generated order ID
  nextOrderId = computed(() => {
    const orders = this.purchaseOrders();
    const maxNum = orders.reduce((max, o) => {
      const num = parseInt((o.order_id || '').replace(/\D/g, ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 1000);
    return `ORD-${maxNum + 1}`;
  });

  // Item calculations
  itemAmount(item: OrderItem): number {
    if (item.unit === '%') return Math.round(item.price * item.qty / 100 * 100) / 100;
    return Math.round(item.qty * item.price * 100) / 100;
  }

  itemGst(item: OrderItem): number {
    if (!this.includeGst()) return 0;
    return Math.round(this.itemAmount(item) * item.gst_percent / 100 * 100) / 100;
  }

  itemTotal(item: OrderItem): number {
    return this.itemAmount(item) + this.itemGst(item);
  }

  // Totals
  totalBase = computed(() => this.items().reduce((s, item) => s + this.itemAmount(item), 0));
  totalGstAmount = computed(() => this.includeGst() ? this.items().reduce((s, item) => s + this.itemGst(item), 0) : 0);

  tdsPercent = computed(() => {
    const c = this.selectedContractor();
    return c?.tds_applicable ? c.tds_percent || 0 : 0;
  });

  tdsAmount = computed(() => {
    const rate = this.tdsPercent();
    if (!rate) return 0;
    return Math.round(this.totalBase() * rate / 100 * 100) / 100;
  });

  grandTotal = computed(() =>
    Math.round((this.totalBase() + this.totalGstAmount() - this.tdsAmount()) * 100) / 100
  );

  // List view computed values
  filteredOrders = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const orders = this.purchaseOrders();
    if (!q) return orders;
    return orders.filter(o =>
      (o.order_id || '').toLowerCase().includes(q) ||
      this.contractorName(o.contractor_id).toLowerCase().includes(q) ||
      this.siteName(o.site_id).toLowerCase().includes(q) ||
      o.date.includes(q)
    );
  });

  listSummary = computed<SummaryCard[]>(() => {
    const orders = this.filteredOrders();
    const totalOrders = orders.length;
    const totalItems = orders.reduce((s, o) => s + (o.items?.length || 0), 0);
    const totalNet = orders.reduce((s, o) => s + (o.grand_total || 0), 0);
    return [
      { title: 'Total Orders', value: totalOrders, icon: 'ri-file-list-3-line', color: 'primary' },
      { title: 'Total Items', value: totalItems, icon: 'ri-stack-line', color: 'info' },
      { title: 'Total Net Amount', value: totalNet, prefix: '₹', icon: 'ri-money-dollar-circle-line', color: 'success' },
    ];
  });

  ngOnInit(): void {
    this.loadDropdowns();
    this.loadOrders();
  }

  loadDropdowns(): void {
    this.api.get<Contractor[]>('/contractors').subscribe({
      next: data => this.contractors.set(data),
      error: err => this.notify.error('Failed to load contractors: ' + err.message),
    });
    this.api.get<Site[]>('/sites').subscribe({
      next: data => this.sites.set(data),
      error: err => this.notify.error('Failed to load sites: ' + err.message),
    });
    this.api.get<StockProduct[]>('/stock-products').subscribe({
      next: data => this.products.set(data),
      error: () => {},
    });
  }

  loadOrders(): void {
    this.loading.set(true);
    this.api.get<PurchaseOrder[]>('/purchase-orders').subscribe({
      next: data => { this.purchaseOrders.set(data); this.loading.set(false); },
      error: err => { this.notify.error('Failed to load orders: ' + err.message); this.loading.set(false); },
    });
  }

  emptyItem(): OrderItem {
    return { product_id: null, name: '', hsn: '', unit: '', qty: 1, price: 0, gst_percent: 18 };
  }

  addItem(): void {
    this.items.update(list => [...list, this.emptyItem()]);
  }

  removeItem(index: number): void {
    this.items.update(list => list.filter((_, i) => i !== index));
  }

  onProductSelect(item: OrderItem, productId: number): void {
    const product = this.products().find(p => p.id === productId);
    if (product) {
      item.product_id = productId;
      item.name = product.name;
      item.hsn = product.hsn;
      item.unit = product.unit;
      item.price = product.price || 0;
      item.gst_percent = product.gst_percent;
    }
  }

  saveOrder(): void {
    if (!this.selectedContractorId() || !this.selectedSiteId() || !this.orderDate()) {
      this.notify.error('Contractor, site, and date are required.');
      return;
    }
    const validItems = this.items().filter(i => i.name && i.qty > 0);
    if (!validItems.length) {
      this.notify.error('Add at least one item.');
      return;
    }

    const body = {
      order_id: this.editingId() ? undefined : this.nextOrderId(),
      contractor_id: this.selectedContractorId(),
      site_id: this.selectedSiteId(),
      date: this.orderDate(),
      include_gst: this.includeGst(),
      items: validItems,
      total_base: this.totalBase(),
      total_gst: this.totalGstAmount(),
      tds_amount: this.tdsAmount(),
      grand_total: this.grandTotal(),
    };
    this.saving.set(true);
    if (this.editingId() !== null) {
      this.api.put<PurchaseOrder>(`/purchase-orders/${this.editingId()}`, body).subscribe({
        next: updated => {
          this.purchaseOrders.update(list => list.map(o => (o.id === updated.id ? updated : o)));
          this.notify.success('Order updated.');
          this.saving.set(false);
          this.resetForm();
        },
        error: err => { this.notify.error('Failed: ' + err.message); this.saving.set(false); },
      });
    } else {
      this.api.post<PurchaseOrder>('/purchase-orders', body).subscribe({
        next: created => {
          this.purchaseOrders.update(list => [...list, created]);
          this.notify.success('Order created.');
          this.saving.set(false);
          this.resetForm();
        },
        error: err => { this.notify.error('Failed: ' + err.message); this.saving.set(false); },
      });
    }
  }

  editOrder(o: PurchaseOrder): void {
    this.viewMode.set('entry');
    this.editingId.set(o.id);
    this.selectedContractorId.set(o.contractor_id);
    this.selectedSiteId.set(o.site_id);
    this.orderDate.set(o.date);
    this.includeGst.set(o.include_gst ?? true);
    this.items.set(o.items.length ? [...o.items] : [this.emptyItem()]);
  }

  async deleteOrder(o: PurchaseOrder): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Order',
      message: `Delete order ${o.order_id || '#' + o.id}?`,
      type: 'danger',
    });
    if (!confirmed) return;
    this.api.delete<void>(`/purchase-orders/${o.id}`).subscribe({
      next: () => {
        this.purchaseOrders.update(list => list.filter(x => x.id !== o.id));
        this.notify.success('Order deleted.');
      },
      error: err => this.notify.error('Failed: ' + err.message),
    });
  }

  resetForm(): void {
    this.editingId.set(null);
    this.selectedContractorId.set(null);
    this.selectedSiteId.set(null);
    this.orderDate.set(new Date().toISOString().slice(0, 10));
    this.includeGst.set(true);
    this.items.set([this.emptyItem()]);
  }

  contractorName(id: number): string {
    return this.contractors().find(c => c.id === id)?.name ?? String(id);
  }

  siteName(id: number): string {
    return this.sites().find(s => s.id === id)?.name ?? String(id);
  }

  formatCurrency(val: number): string {
    if (!val) return '--';
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Export
  exportExcel(): void {
    const data = this.filteredOrders().map(o => ({
      order_id: o.order_id || o.id,
      date: o.date,
      contractor: this.contractorName(o.contractor_id),
      site: this.siteName(o.site_id),
      items_count: o.items?.length || 0,
      total_base: o.total_base || 0,
      total_gst: o.total_gst || 0,
      tds_amount: o.tds_amount || 0,
      grand_total: o.grand_total || 0,
    }));
    this.exportService.exportToExcel(data, 'purchase_orders', 'Purchase Orders', [
      { key: 'order_id', header: 'Order ID' },
      { key: 'date', header: 'Date' },
      { key: 'contractor', header: 'Contractor' },
      { key: 'site', header: 'Site' },
      { key: 'items_count', header: 'Items' },
      { key: 'total_base', header: 'Base Amount' },
      { key: 'total_gst', header: 'GST' },
      { key: 'tds_amount', header: 'TDS' },
      { key: 'grand_total', header: 'Net Total' },
    ]);
  }

  // Reducer helpers for template tfoot
  sumBase = (acc: number, o: PurchaseOrder) => acc + (o.total_base || 0);
  sumGst = (acc: number, o: PurchaseOrder) => acc + (o.total_gst || 0);
  sumTds = (acc: number, o: PurchaseOrder) => acc + (o.tds_amount || 0);
  sumTotal = (acc: number, o: PurchaseOrder) => acc + (o.grand_total || 0);

  exportPdf(): void {
    const data = this.filteredOrders().map(o => ({
      order_id: o.order_id || o.id,
      date: o.date,
      contractor: this.contractorName(o.contractor_id),
      site: this.siteName(o.site_id),
      items_count: o.items?.length || 0,
      grand_total: o.grand_total || 0,
    }));
    this.exportService.exportToPDF({
      title: 'Purchase Orders Report',
      fileName: 'purchase_orders',
      data,
      columns: [
        { key: 'order_id', header: 'Order ID' },
        { key: 'date', header: 'Date' },
        { key: 'contractor', header: 'Contractor' },
        { key: 'site', header: 'Site' },
        { key: 'items_count', header: 'Items', align: 'center' },
        { key: 'grand_total', header: 'Net Total', format: 'currency', align: 'right' },
      ],
    });
  }
}
