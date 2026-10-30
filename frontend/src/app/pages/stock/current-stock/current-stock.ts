import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { RoleService } from '../../../core/services/role.service';
import { DocumentService } from '../../../core/services/document.service';
import { SearchableDropdownComponent } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';

interface InventoryItem {
  id: string;
  product_id: string;
  product_name: string;
  site_id: string;
  site_name: string;
  quantity: number;
  total_in: number;
  total_out: number;
  damaged: number;
  unit: string;
}

interface DamageRecord {
  id: string;
  date: string;
  product_name: string;
  site_name: string;
  quantity: number;
  unit: string;
  reason: string;
  proof_url?: string;
}

interface Site { id: string; name: string; }
interface Product { id: string; name: string; unit: string; }

@Component({
  selector: 'app-current-stock',
  standalone: true,
  imports: [FormsModule, DecimalPipe, SearchableDropdownComponent, SummaryCardsComponent, ModalDialogComponent],
  templateUrl: './current-stock.html',
  styleUrl: './current-stock.scss',
})
export class CurrentStockComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotificationService);
  private exportService = inject(ExportService);
  readonly role = inject(RoleService);
  private docService = inject(DocumentService);

  loading = signal(false);
  inventory = signal<InventoryItem[]>([]);
  damageRecords = signal<DamageRecord[]>([]);
  sites = signal<Site[]>([]);
  products = signal<Product[]>([]);
  selectedSite = signal('');
  selectedProduct = signal('');
  searchQuery = signal('');
  activeTab = signal<'stock' | 'damage'>('stock');
  lowStockThreshold = 10;

  showDamageModal = signal(false);
  showProofModal = signal(false);
  proofUrl = signal('');
  dmgDate = signal('');
  dmgProductId = signal('');
  dmgSiteId = signal('');
  dmgQty = signal<number>(0);
  dmgUnit = signal('');
  dmgReason = signal('');
  dmgProofFile = signal<File | null>(null);

  get siteItems() { return this.sites().map(s => ({ value: s.id, label: s.name })); }
  get productItems() { return this.products().map(p => ({ value: p.id, label: p.name })); }

  get summaryCards(): SummaryCard[] {
    const inv = this.filteredInventory;
    const totalItems = inv.length;
    const totalQty = inv.reduce((s, i) => s + (i.quantity || 0), 0);
    const lowStock = inv.filter(i => i.quantity < this.lowStockThreshold).length;
    const totalDamaged = this.damageRecords().reduce((s, d) => s + d.quantity, 0);
    return [
      { title: 'Product Lines', value: totalItems, icon: 'ri-stack-line', color: 'primary' },
      { title: 'Total Quantity', value: totalQty, icon: 'ri-archive-line', color: 'info' },
      { title: 'Low Stock Items', value: lowStock, icon: 'ri-error-warning-line', color: lowStock > 0 ? 'danger' : 'success' },
      { title: 'Total Damaged', value: totalDamaged, icon: 'ri-close-circle-line', color: 'warning' },
    ];
  }

  get filteredInventory(): InventoryItem[] {
    let list = this.inventory();
    const q = this.searchQuery().toLowerCase();
    const site = this.selectedSite();
    const prod = this.selectedProduct();
    if (site) list = list.filter(i => i.site_id === site);
    if (prod) list = list.filter(i => i.product_id === prod);
    if (q) list = list.filter(i => i.product_name.toLowerCase().includes(q) || i.site_name.toLowerCase().includes(q));
    return list;
  }

  ngOnInit(): void {
    this.api.get<Site[]>('/sites').subscribe({ next: d => this.sites.set(d), error: () => {} });
    this.api.get<Product[]>('/stock-products').subscribe({ next: d => this.products.set(d), error: () => {} });
    this.loadInventory();
    this.loadDamageRecords();
    if (this.role.isSupervisor()) {
      const siteId = this.role.getSupervisorSiteId();
      if (siteId) this.selectedSite.set(String(siteId));
    }
  }

  loadInventory(): void {
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.selectedSite()) params['site_id'] = this.selectedSite();
    this.api.get<InventoryItem[]>('/site-inventory', params).subscribe({
      next: d => { this.inventory.set(d); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load inventory'); this.loading.set(false); },
    });
  }

  loadDamageRecords(): void {
    this.api.get<DamageRecord[]>('/damaged-stocks').subscribe({
      next: d => this.damageRecords.set(d),
      error: () => {},
    });
  }

  isLowStock(item: InventoryItem): boolean {
    return item.quantity < this.lowStockThreshold;
  }

  openDamageModal(): void {
    this.dmgDate.set(new Date().toISOString().split('T')[0]);
    this.showDamageModal.set(true);
  }

  onDmgProductChange(productId: string): void {
    this.dmgProductId.set(productId);
    const prod = this.products().find(p => p.id === productId);
    if (prod) this.dmgUnit.set(prod.unit);
  }

  onDmgFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.dmgProofFile.set(input.files[0]);
  }

  submitDamage(): void {
    if (!this.dmgDate() || !this.dmgProductId() || !this.dmgSiteId() || !this.dmgQty()) {
      this.notify.error('Date, product, site, and quantity are required');
      return;
    }
    const body: any = {
      date: this.dmgDate(), product_id: this.dmgProductId(), site_id: this.dmgSiteId(),
      quantity: this.dmgQty(), unit: this.dmgUnit(), reason: this.dmgReason(),
    };
    this.api.post<DamageRecord>('/damaged-stocks', body).subscribe({
      next: created => {
        this.damageRecords.update(l => [created, ...l]);
        this.notify.success('Damage recorded');
        this.showDamageModal.set(false);
        this.loadInventory();
      },
      error: () => this.notify.error('Failed to record damage'),
    });
  }

  viewProof(url: string): void {
    this.proofUrl.set(url);
    this.showProofModal.set(true);
  }

  exportInventory(): void {
    this.exportService.exportToExcel(this.filteredInventory as any[], 'current-stock', 'Current Stock', [
      { key: 'product_name', header: 'Product' },
      { key: 'site_name', header: 'Site' },
      { key: 'quantity', header: 'Available Qty' },
      { key: 'unit', header: 'Unit' },
    ]);
  }

  exportDamage(): void {
    this.exportService.exportToExcel(this.damageRecords() as any[], 'damage-report', 'Damage Report', [
      { key: 'date', header: 'Date' },
      { key: 'product_name', header: 'Product' },
      { key: 'site_name', header: 'Site' },
      { key: 'quantity', header: 'Qty' },
      { key: 'unit', header: 'Unit' },
      { key: 'reason', header: 'Reason' },
    ]);
  }
}
