import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';

@Component({
  selector: 'app-add-retailer',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent, ModalDialogComponent],
  templateUrl: './add-retailer.html',
  styleUrl: './add-retailer.scss',
})
export class AddRetailerComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly role = inject(RoleService);
  private readonly approval = inject(ApprovalService);
  private readonly confirm = inject(ConfirmDialogService);

  retailerName = signal('');
  shopName = signal('');
  contact = signal('');
  gstApplicable = signal<'YES' | 'NO'>('NO');
  gstNo = signal('');
  address = signal('');
  selectedCategory = signal('');
  selectedSite = signal('');

  editingId = signal<string | null>(null);
  showModal = signal(false);

  categories = signal<any[]>([]);
  sites = signal<any[]>([]);
  retailers = signal<any[]>([]);

  loading = signal(false);
  activeTab = signal<'active' | 'inactive'>('active');
  searchQuery = signal('');
  filterCategory = signal('');
  filterGstStatus = signal('');

  categoryItems = computed<DropdownItem[]>(() =>
    this.categories().map(c => ({ value: c.id, label: c.name }))
  );

  siteItems = computed<DropdownItem[]>(() =>
    this.sites().map(s => ({ value: s.id, label: s.name }))
  );

  filteredRetailers = computed(() => {
    let list = this.retailers();
    const tab = this.activeTab();
    list = list.filter(r => (tab === 'active' ? r.status !== 'inactive' : r.status === 'inactive'));

    const cat = this.filterCategory();
    if (cat) list = list.filter(r => r.category_id === cat || r.category_name === cat);

    const gst = this.filterGstStatus();
    if (gst === 'yes') list = list.filter(r => r.gst_status === true || r.gst_status === 'GST YES');
    else if (gst === 'no') list = list.filter(r => !r.gst_status || r.gst_status === 'GST NO');

    const q = this.searchQuery().toLowerCase();
    if (q) {
      list = list.filter(r =>
        (r.name ?? '').toLowerCase().includes(q) ||
        (r.phone ?? r.contact ?? '').toLowerCase().includes(q) ||
        (r.gst_number ?? '').toLowerCase().includes(q) ||
        (r.category_name ?? '').toLowerCase().includes(q) ||
        (r.address ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  });

  activeCount = computed(() => this.retailers().filter(r => r.status !== 'inactive').length);
  inactiveCount = computed(() => this.retailers().filter(r => r.status === 'inactive').length);

  summaryCards = computed<SummaryCard[]>(() => [
    { title: 'Active Retailers', value: this.activeCount(), color: 'success', icon: 'ri-store-2-line' },
    { title: 'Inactive Retailers', value: this.inactiveCount(), color: 'danger', icon: 'ri-store-2-line' },
    { title: 'GST Registered', value: this.retailers().filter(r => r.gst_status === true || r.gst_status === 'GST YES').length, color: 'info', icon: 'ri-file-list-3-line' },
    { title: 'Total Retailers', value: this.retailers().length, color: 'primary', icon: 'ri-group-line' },
  ]);

  ngOnInit(): void {
    this.loadDropdowns();
    this.loadRetailers();
  }

  private loadDropdowns(): void {
    this.api.get<any[]>('/retailer-categories').subscribe({
      next: data => this.categories.set(data),
      error: () => this.notify.error('Failed to load categories'),
    });
    this.api.get<any[]>('/sites').subscribe({
      next: data => this.sites.set(data),
      error: () => this.notify.error('Failed to load sites'),
    });
  }

  private loadRetailers(): void {
    this.loading.set(true);
    this.api.get<any[]>('/retailers').subscribe({
      next: data => { this.retailers.set(data); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load retailers'); this.loading.set(false); },
    });
  }

  openAddModal(): void {
    this.resetForm();
    this.showModal.set(true);
  }

  editRetailer(retailer: any): void {
    this.editingId.set(retailer.id);
    this.retailerName.set(retailer.name ?? '');
    this.shopName.set(retailer.shop ?? retailer.shop_name ?? '');
    this.contact.set(retailer.phone ?? retailer.contact ?? '');
    this.gstApplicable.set((retailer.gst_status === true || retailer.gst_status === 'GST YES') ? 'YES' : 'NO');
    this.gstNo.set(retailer.gst_number ?? retailer.gst ?? '');
    this.address.set(retailer.address ?? '');
    this.selectedCategory.set(retailer.category_id ?? '');
    this.selectedSite.set(retailer.site_id ?? '');
    this.showModal.set(true);
  }

  async deleteRetailer(retailer: any): Promise<void> {
    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'AddRetailer',
        actionType: 'delete',
        summary: `Delete Retailer: ${retailer.name}`,
        data: null,
        oldData: retailer,
        referenceId: retailer.id,
      }).subscribe({
        next: () => this.notify.success('Delete request sent for approval'),
        error: () => this.notify.error('Failed to submit approval request'),
      });
      return;
    }

    const result = await this.confirm.confirmWithPassword({
      title: 'Delete Retailer',
      message: `Are you sure you want to delete "${retailer.name}"?`,
      type: 'danger',
      confirmText: 'Delete',
      passwordRequired: true,
    });
    if (!result.confirmed) return;

    this.api.delete<any>(`/retailers/${retailer.id}`).subscribe({
      next: () => { this.notify.success('Retailer deleted'); this.loadRetailers(); },
      error: () => this.notify.error('Failed to delete retailer'),
    });
  }

  async toggleStatus(retailer: any): Promise<void> {
    const newStatus = retailer.status === 'inactive' ? 'active' : 'inactive';

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'AddRetailer',
        actionType: 'update',
        summary: `${newStatus === 'active' ? 'Activate' : 'Deactivate'} Retailer: ${retailer.name}`,
        data: { ...retailer, status: newStatus },
        oldData: retailer,
        referenceId: retailer.id,
      }).subscribe({
        next: () => this.notify.success('Status change request sent for approval'),
        error: () => this.notify.error('Failed to submit approval request'),
      });
      return;
    }

    this.api.put<any>(`/retailers/${retailer.id}`, { status: newStatus }).subscribe({
      next: () => { this.notify.success(`Retailer ${newStatus === 'active' ? 'activated' : 'deactivated'}`); this.loadRetailers(); },
      error: () => this.notify.error('Failed to update status'),
    });
  }

  onSubmit(): void {
    const body: any = {
      name: this.retailerName(),
      shop_name: this.shopName(),
      phone: this.contact(),
      address: this.address(),
      gst_status: this.gstApplicable() === 'YES',
      gst_number: this.gstApplicable() === 'YES' ? this.gstNo().toUpperCase() : null,
      category_id: this.selectedCategory(),
      site_id: this.selectedSite(),
    };

    const id = this.editingId();

    if (this.approval.requiresApproval()) {
      const oldData = id ? this.retailers().find(r => r.id === id) : null;
      this.approval.submitForApproval({
        module: 'AddRetailer',
        actionType: id ? 'update' : 'create',
        summary: `${id ? 'Edit' : 'Add'} Retailer: ${this.retailerName()}`,
        data: body,
        oldData,
        referenceId: id ?? undefined,
      }).subscribe({
        next: () => {
          this.notify.success('Request sent for approval');
          this.showModal.set(false);
          this.resetForm();
        },
        error: () => this.notify.error('Failed to submit approval request'),
      });
      return;
    }

    const request = id
      ? this.api.put<any>(`/retailers/${id}`, body)
      : this.api.post<any>('/retailers', body);

    request.subscribe({
      next: () => {
        this.notify.success(id ? 'Retailer updated' : 'Retailer added');
        this.showModal.set(false);
        this.resetForm();
        this.loadRetailers();
      },
      error: () => this.notify.error(id ? 'Failed to update retailer' : 'Failed to add retailer'),
    });
  }

  onGstToggle(): void {
    if (this.gstApplicable() === 'NO') {
      this.gstNo.set('');
    }
  }

  switchTab(tab: 'active' | 'inactive'): void {
    this.activeTab.set(tab);
  }

  onAddCategory(): void {
    const name = prompt('Enter new category name:');
    if (name?.trim()) {
      this.api.post<any>('/retailer-categories', { name: name.trim() }).subscribe({
        next: cat => {
          this.categories.update(list => [...list, cat]);
          this.selectedCategory.set(cat.id);
          this.notify.success('Category added');
        },
        error: () => this.notify.error('Failed to add category'),
      });
    }
  }

  exportRetailers(): void {
    this.exportService.exportToExcel(this.filteredRetailers(), 'retailers', 'Retailers', [
      { key: 'id', header: 'ID' },
      { key: 'category_name', header: 'Category' },
      { key: 'name', header: 'Retailer Name' },
      { key: 'shop_name', header: 'Shop Name' },
      { key: 'address', header: 'Address' },
      { key: 'phone', header: 'Phone' },
      { key: 'gst_status', header: 'GST Status' },
      { key: 'gst_number', header: 'GSTIN' },
      { key: 'status', header: 'Status' },
    ]);
  }

  cancelEdit(): void {
    this.showModal.set(false);
    this.resetForm();
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.retailerName.set('');
    this.shopName.set('');
    this.contact.set('');
    this.gstApplicable.set('NO');
    this.gstNo.set('');
    this.address.set('');
    this.selectedCategory.set('');
    this.selectedSite.set('');
  }
}
