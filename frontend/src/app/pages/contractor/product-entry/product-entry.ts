import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

const GST_SLABS = [0, 5, 12, 18, 28];

interface StockProduct {
  id: number;
  name: string;
  unit: string;
  hsn: string;
  category: string;
  gst_percent: number;
  price: number;
}

@Component({
  selector: 'app-product-entry',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './product-entry.html',
  styleUrl: './product-entry.scss',
})
export class ProductEntryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly gstSlabs = GST_SLABS;

  searchQuery = signal('');
  name = signal('');
  unit = signal('');
  hsn = signal('');
  category = signal('');
  gstPercent = signal(18);
  price = signal<number>(0);

  products = signal<StockProduct[]>([]);
  loading = signal(false);
  saving = signal(false);
  editingId = signal<number | null>(null);

  filteredProducts = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const list = this.products();
    if (!q) return list;
    return list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.hsn.toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading.set(true);
    this.api.get<StockProduct[]>('/stock-products').subscribe({
      next: data => { this.products.set(data); this.loading.set(false); },
      error: err => { this.notify.error('Failed to load products: ' + err.message); this.loading.set(false); },
    });
  }

  addProduct(): void {
    if (!this.name() || !this.unit()) {
      this.notify.error('Name and unit are required.');
      return;
    }

    if (!this.editingId()) {
      const dup = this.products().find(
        p => p.name.toLowerCase() === this.name().toLowerCase() &&
          p.unit.toLowerCase() === this.unit().toLowerCase() &&
          p.price === this.price()
      );
      if (dup) {
        this.notify.error(`Duplicate product: "${dup.name}" with same unit and price already exists.`);
        return;
      }
    }

    const body = {
      name: this.name(),
      unit: this.unit(),
      hsn: this.hsn(),
      category: this.category(),
      gst_percent: this.gstPercent(),
      price: this.price(),
    };
    this.saving.set(true);
    if (this.editingId() !== null) {
      this.api.put<StockProduct>(`/stock-products/${this.editingId()}`, body).subscribe({
        next: updated => {
          this.products.update(list => list.map(p => (p.id === updated.id ? updated : p)));
          this.notify.success('Product updated.');
          this.saving.set(false);
          this.resetForm();
        },
        error: err => { this.notify.error('Failed to update: ' + err.message); this.saving.set(false); },
      });
    } else {
      this.api.post<StockProduct>('/stock-products', body).subscribe({
        next: created => {
          this.products.update(list => [...list, created]);
          this.notify.success('Product added successfully!');
          this.saving.set(false);
          this.resetForm();
        },
        error: err => { this.notify.error('Failed to add: ' + err.message); this.saving.set(false); },
      });
    }
  }

  editProduct(p: StockProduct): void {
    this.editingId.set(p.id);
    this.name.set(p.name);
    this.unit.set(p.unit);
    this.hsn.set(p.hsn);
    this.category.set(p.category);
    this.gstPercent.set(p.gst_percent);
    this.price.set(p.price || 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async deleteProduct(p: StockProduct): Promise<void> {
    const result = await this.confirmDialog.confirmWithPassword({
      title: 'Delete Product',
      message: `Delete "${p.name}"? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!result.confirmed) return;

    this.api.delete<void>(`/stock-products/${p.id}`).subscribe({
      next: () => {
        this.products.update(list => list.filter(x => x.id !== p.id));
        this.notify.success('Product deleted.');
      },
      error: err => this.notify.error('Failed to delete: ' + err.message),
    });
  }

  exportExcel(): void {
    this.exportService.exportToExcel(this.filteredProducts() as any, 'products', 'Products', [
      { key: 'name', header: 'Name' },
      { key: 'unit', header: 'Unit' },
      { key: 'hsn', header: 'HSN' },
      { key: 'category', header: 'Category' },
      { key: 'price', header: 'Price (₹)' },
      { key: 'gst_percent', header: 'GST %' },
    ]);
  }

  formatCurrency(val: number): string {
    if (!val) return '--';
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  resetForm(): void {
    this.editingId.set(null);
    this.name.set('');
    this.unit.set('');
    this.hsn.set('');
    this.category.set('');
    this.gstPercent.set(18);
    this.price.set(0);
  }
}
