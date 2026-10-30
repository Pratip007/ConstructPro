import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

interface Product {
  id: string;
  name: string;
  unit: string;
  category: string;
  description: string;
  display_id?: string;
  hsn_code?: string;
  gst_rate?: number;
}

@Component({
  selector: 'app-stock-view',
  standalone: true,
  imports: [FormsModule, SummaryCardsComponent, ModalDialogComponent],
  templateUrl: './stock-view.html',
  styleUrl: './stock-view.scss',
})
export class StockViewComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotificationService);
  private exportService = inject(ExportService);
  private confirm = inject(ConfirmDialogService);

  loading = signal(false);
  products = signal<Product[]>([]);
  searchQuery = signal('');
  categoryFilter = signal('');

  showFormModal = signal(false);
  editingProduct = signal<Product | null>(null);
  formName = signal('');
  formUnit = signal('');
  formCategory = signal('');
  formDescription = signal('');
  formHsn = signal('');
  formGstRate = signal<number | null>(null);
  saving = signal(false);

  get summaryCards(): SummaryCard[] {
    const all = this.products();
    const cats = new Set(all.map(p => p.category).filter(Boolean)).size;
    const withHsn = all.filter(p => p.hsn_code).length;
    return [
      { title: 'Total Products', value: all.length, icon: 'ri-archive-line', color: 'primary' },
      { title: 'Categories', value: cats, icon: 'ri-folder-line', color: 'info' },
      { title: 'With HSN', value: withHsn, icon: 'ri-barcode-line', color: 'success' },
      { title: 'Filtered', value: this.filteredProducts.length, icon: 'ri-filter-line', color: 'warning' },
    ];
  }

  get categories(): string[] {
    return [...new Set(this.products().map(p => p.category).filter(Boolean))].sort();
  }

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading.set(true);
    this.api.get<Product[]>('/stock-products').subscribe({
      next: (data) => { this.products.set(data); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load product catalog'); this.loading.set(false); },
    });
  }

  get filteredProducts(): Product[] {
    let list = this.products();
    const q = this.searchQuery().toLowerCase();
    const cat = this.categoryFilter();
    if (q) list = list.filter(p =>
      p.name.toLowerCase().includes(q) || (p.hsn_code ?? '').toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
    if (cat) list = list.filter(p => p.category === cat);
    return list;
  }

  openAddForm(): void {
    this.editingProduct.set(null);
    this.formName.set('');
    this.formUnit.set('');
    this.formCategory.set('');
    this.formDescription.set('');
    this.formHsn.set('');
    this.formGstRate.set(null);
    this.showFormModal.set(true);
  }

  openEditForm(p: Product): void {
    this.editingProduct.set(p);
    this.formName.set(p.name);
    this.formUnit.set(p.unit);
    this.formCategory.set(p.category);
    this.formDescription.set(p.description);
    this.formHsn.set(p.hsn_code ?? '');
    this.formGstRate.set(p.gst_rate ?? null);
    this.showFormModal.set(true);
  }

  saveProduct(): void {
    if (!this.formName().trim()) { this.notify.error('Product name is required'); return; }
    if (!this.formUnit().trim()) { this.notify.error('Unit is required'); return; }
    this.saving.set(true);
    const body: any = {
      name: this.formName().trim(),
      unit: this.formUnit().trim(),
      category: this.formCategory().trim(),
      description: this.formDescription().trim(),
      hsn_code: this.formHsn().trim() || null,
      gst_rate: this.formGstRate() ?? null,
    };
    const editing = this.editingProduct();
    const req = editing
      ? this.api.put<Product>(`/stock-products/${editing.id}`, body)
      : this.api.post<Product>('/stock-products', body);

    req.subscribe({
      next: (result) => {
        if (editing) {
          this.products.update(list => list.map(p => p.id === editing.id ? { ...p, ...result } : p));
          this.notify.success('Product updated');
        } else {
          this.products.update(list => [result, ...list]);
          this.notify.success('Product added');
        }
        this.showFormModal.set(false);
        this.saving.set(false);
      },
      error: () => { this.notify.error('Failed to save product'); this.saving.set(false); },
    });
  }

  async deleteProduct(p: Product): Promise<void> {
    const ok = await this.confirm.confirm({ title: 'Delete Product', message: `Delete "${p.name}"? This cannot be undone.`, confirmText: 'Delete', type: 'danger' });
    if (!ok) return;
    this.api.delete<void>(`/stock-products/${p.id}`).subscribe({
      next: () => { this.products.update(list => list.filter(x => x.id !== p.id)); this.notify.success('Product deleted'); },
      error: () => this.notify.error('Failed to delete product'),
    });
  }

  exportProducts(): void {
    this.exportService.exportToExcel(this.filteredProducts as any[], 'product-catalog', 'Product Catalog', [
      { key: 'display_id', header: 'Display ID' },
      { key: 'name', header: 'Name' },
      { key: 'category', header: 'Category' },
      { key: 'unit', header: 'Unit' },
      { key: 'hsn_code', header: 'HSN Code' },
      { key: 'gst_rate', header: 'GST Rate (%)' },
      { key: 'description', header: 'Description' },
    ]);
  }
}
