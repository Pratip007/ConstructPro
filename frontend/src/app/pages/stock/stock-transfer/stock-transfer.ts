import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { SearchableDropdownComponent } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

interface StockTransfer {
  id: string;
  date: string;
  from_site_id: string;
  from_site_name: string;
  to_site_id: string;
  to_site_name: string;
  items: TransferItem[];
  status: string;
  challan_no?: string;
  remarks?: string;
}

interface TransferItem {
  product_id: string;
  product_name?: string;
  quantity: number;
  unit: string;
}

interface Product { id: string; name: string; unit: string; }
interface Site { id: string; name: string; }

@Component({
  selector: 'app-stock-transfer',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent, ModalDialogComponent],
  templateUrl: './stock-transfer.html',
  styleUrl: './stock-transfer.scss',
})
export class StockTransferComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotificationService);
  private exportService = inject(ExportService);
  private confirmService = inject(ConfirmDialogService);

  loading = signal(false);
  transfers = signal<StockTransfer[]>([]);
  sites = signal<Site[]>([]);
  products = signal<Product[]>([]);
  inventory = signal<any[]>([]);
  searchQuery = signal('');

  date = signal('');
  fromSiteId = signal('');
  toSiteId = signal('');
  remarks = signal('');
  items = signal<TransferItem[]>([{ product_id: '', quantity: 0, unit: '' }]);
  showForm = signal(false);

  showDetailModal = signal(false);
  selectedTransfer = signal<StockTransfer | null>(null);

  get siteItems() { return this.sites().map(s => ({ value: s.id, label: s.name })); }
  get productItems() { return this.products().map(p => ({ value: p.id, label: p.name })); }

  get summaryCards(): SummaryCard[] {
    const all = this.transfers();
    const totalItems = all.reduce((s, t) => s + (t.items?.length ?? 0), 0);
    const pending = all.filter(t => t.status === 'pending').length;
    return [
      { title: 'Total Transfers', value: all.length, icon: 'ri-swap-line', color: 'primary' },
      { title: 'Total Items', value: totalItems, icon: 'ri-archive-line', color: 'info' },
      { title: 'Pending', value: pending, icon: 'ri-time-line', color: 'warning' },
      { title: 'Completed', value: all.length - pending, icon: 'ri-checkbox-circle-line', color: 'success' },
    ];
  }

  get filteredTransfers(): StockTransfer[] {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.transfers();
    return this.transfers().filter(t =>
      t.from_site_name?.toLowerCase().includes(q) || t.to_site_name?.toLowerCase().includes(q) ||
      (t.challan_no ?? '').toLowerCase().includes(q)
    );
  }

  ngOnInit(): void {
    this.api.get<Site[]>('/sites').subscribe({ next: d => this.sites.set(d), error: () => {} });
    this.api.get<Product[]>('/stock-products').subscribe({ next: d => this.products.set(d), error: () => {} });
    this.loadTransfers();
  }

  loadTransfers(): void {
    this.loading.set(true);
    this.api.get<StockTransfer[]>('/stock-transfers').subscribe({
      next: d => { this.transfers.set(d); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load transfers'); this.loading.set(false); },
    });
  }

  onFromSiteChange(siteId: string): void {
    this.fromSiteId.set(siteId);
    if (siteId) {
      this.api.get<any[]>('/site-inventory', { site_id: siteId }).subscribe({
        next: d => this.inventory.set(d),
        error: () => this.inventory.set([]),
      });
    } else {
      this.inventory.set([]);
    }
  }

  getAvailableStock(productId: string): number {
    return this.inventory().find(i => i.product_id === productId)?.quantity ?? 0;
  }

  addItem(): void {
    this.items.update(list => [...list, { product_id: '', quantity: 0, unit: '' }]);
  }

  removeItem(index: number): void {
    this.items.update(list => list.filter((_, i) => i !== index));
  }

  onQuantityChange(index: number, quantity: number): void {
    this.items.update(list => { const u = [...list]; u[index] = { ...u[index], quantity }; return u; });
  }

  onProductChange(index: number, productId: string): void {
    const product = this.products().find(p => p.id === productId);
    this.items.update(list => { const u = [...list]; u[index] = { ...u[index], product_id: productId, unit: product?.unit ?? '' }; return u; });
  }

  submitTransfer(): void {
    if (!this.date() || !this.fromSiteId() || !this.toSiteId()) {
      this.notify.error('Date, from-site, and to-site are required'); return;
    }
    if (this.fromSiteId() === this.toSiteId()) {
      this.notify.error('From and to sites must be different'); return;
    }
    const validItems = this.items().filter(i => i.product_id && i.quantity > 0);
    if (!validItems.length) { this.notify.error('At least one valid item is required'); return; }
    for (const item of validItems) {
      const available = this.getAvailableStock(item.product_id);
      if (item.quantity > available) {
        const product = this.products().find(p => p.id === item.product_id);
        this.notify.error(`Insufficient stock for ${product?.name ?? item.product_id}. Available: ${available}`);
        return;
      }
    }
    const body = {
      date: this.date(), from_site_id: this.fromSiteId(), to_site_id: this.toSiteId(),
      items: validItems, remarks: this.remarks(),
    };
    this.api.post<StockTransfer>('/stock-transfers', body).subscribe({
      next: created => { this.transfers.update(list => [created, ...list]); this.notify.success('Stock transfer created'); this.resetForm(); },
      error: () => this.notify.error('Failed to create stock transfer'),
    });
  }

  viewDetails(t: StockTransfer): void {
    this.selectedTransfer.set(t);
    this.showDetailModal.set(true);
  }

  printChallan(t: StockTransfer): void {
    const items = (t.items ?? []).map((item, i) => {
      const prodName = item.product_name ?? this.products().find(p => p.id === item.product_id)?.name ?? item.product_id;
      return `<tr><td>${i + 1}</td><td>${prodName}</td><td>${item.unit}</td><td style="text-align:right;">${item.quantity}</td></tr>`;
    }).join('');
    const html = `<html><head><title>Transfer Challan</title><style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #333;padding:6px 10px;font-size:13px}th{background:#f0f0f0;text-align:left}.header{text-align:center;margin-bottom:16px}h2{margin:0}p{margin:4px 0;font-size:13px}.sig{display:flex;justify-content:space-between;margin-top:60px;font-size:13px}</style></head><body>
      <div class="header"><h2>Stock Transfer Challan</h2><p>Challan No: ${t.challan_no ?? t.id}</p><p>Date: ${t.date}</p></div>
      <p><strong>From:</strong> ${t.from_site_name}</p><p><strong>To:</strong> ${t.to_site_name}</p>
      ${t.remarks ? `<p><strong>Remarks:</strong> ${t.remarks}</p>` : ''}
      <table><thead><tr><th>#</th><th>Product</th><th>Unit</th><th style="text-align:right;">Qty</th></tr></thead><tbody>${items}</tbody></table>
      <div class="sig"><div>Prepared By: ____________</div><div>Received By: ____________</div></div>
      <script>window.print();</script></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  }

  async deleteTransfer(t: StockTransfer): Promise<void> {
    const ok = await this.confirmService.confirm({ title: 'Delete Transfer', message: `Delete transfer ${t.challan_no ?? t.id}?`, confirmText: 'Delete', type: 'danger' });
    if (!ok) return;
    this.api.delete<void>(`/stock-transfers/${t.id}`).subscribe({
      next: () => { this.transfers.update(list => list.filter(x => x.id !== t.id)); this.notify.success('Transfer deleted'); },
      error: () => this.notify.error('Failed to delete transfer'),
    });
  }

  exportTransfers(): void {
    const rows = this.filteredTransfers.map(t => ({
      challan_no: t.challan_no ?? t.id, date: t.date, from_site: t.from_site_name,
      to_site: t.to_site_name, items: t.items?.length ?? 0, status: t.status, remarks: t.remarks ?? '',
    }));
    this.exportService.exportToExcel(rows as any[], 'stock-transfers', 'Stock Transfers', [
      { key: 'challan_no', header: 'Challan No' }, { key: 'date', header: 'Date' },
      { key: 'from_site', header: 'From Site' }, { key: 'to_site', header: 'To Site' },
      { key: 'items', header: 'Items' }, { key: 'status', header: 'Status' }, { key: 'remarks', header: 'Remarks' },
    ]);
  }

  private resetForm(): void {
    this.date.set(''); this.fromSiteId.set(''); this.toSiteId.set(''); this.remarks.set('');
    this.items.set([{ product_id: '', quantity: 0, unit: '' }]); this.inventory.set([]);
    this.showForm.set(false);
  }
}
