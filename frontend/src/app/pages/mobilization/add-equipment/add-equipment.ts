import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { ExportService } from '../../../core/services/export.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';

interface Equipment {
  id: string;
  name: string;
  category_id: string;
  category_name?: string;
  registration_no: string;
  owner: string;
  rent_rate: number;
  site_id?: string;
  site_name?: string;
  duty_days?: number;
  per_day_rate?: number;
  tds_applicable?: boolean;
  tds_percent?: number;
  pending_status?: string | null;
}

interface EquipmentCategory { id: string; name: string; }
interface Site { id: string; name: string; }

@Component({
  selector: 'app-add-equipment',
  standalone: true,
  imports: [FormsModule, DecimalPipe, TitleCasePipe, SearchableDropdownComponent, SummaryCardsComponent, ModalDialogComponent],
  templateUrl: './add-equipment.html',
  styleUrl: './add-equipment.scss',
})
export class AddEquipmentComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotificationService);
  readonly role = inject(RoleService);
  readonly approval = inject(ApprovalService);
  private exportService = inject(ExportService);
  private confirm = inject(ConfirmDialogService);

  loading = signal(false);
  equipmentList = signal<Equipment[]>([]);
  categories = signal<EquipmentCategory[]>([]);
  sites = signal<Site[]>([]);
  searchQuery = signal('');
  showModal = signal(false);

  equipmentName = signal('');
  categoryId = signal('');
  registrationNo = signal('');
  owner = signal('');
  rentRate = signal<number | null>(null);
  siteId = signal('');
  dutyDays = signal<number | null>(null);
  perDayRate = signal<number | null>(null);
  tdsApplicable = signal(false);
  tdsPercent = signal<number | null>(null);

  editingId = signal<string | null>(null);

  categoryItems = computed<DropdownItem[]>(() =>
    this.categories().map(c => ({ value: c.id, label: c.name }))
  );

  siteItems = computed<DropdownItem[]>(() =>
    this.sites().map(s => ({ value: s.id, label: s.name }))
  );

  netTotal = computed(() => {
    const days = this.dutyDays() ?? 0;
    const rate = this.perDayRate() ?? 0;
    const base = days * rate;
    if (this.tdsApplicable() && this.tdsPercent()) {
      return base - (base * (this.tdsPercent()! / 100));
    }
    return base;
  });

  baseAmount = computed(() => (this.dutyDays() ?? 0) * (this.perDayRate() ?? 0));

  tdsAmount = computed(() => {
    if (!this.tdsApplicable() || !this.tdsPercent()) return 0;
    return this.baseAmount() * (this.tdsPercent()! / 100);
  });

  summaryCards = computed<SummaryCard[]>(() => {
    const list = this.equipmentList();
    const totalNet = list.reduce((s, e) => {
      const base = (e.duty_days ?? 0) * (e.per_day_rate ?? 0);
      const tds = e.tds_applicable ? base * ((e.tds_percent ?? 0) / 100) : 0;
      return s + (base - tds);
    }, 0);
    return [
      { title: 'Total Equipment', value: list.length, icon: 'ri-truck-line', color: 'primary' },
      { title: 'Total Net Value', value: totalNet, icon: 'ri-money-rupee-circle-line', color: 'success', prefix: '₹' },
      { title: 'With TDS', value: list.filter(e => e.tds_applicable).length, icon: 'ri-percent-line', color: 'warning' },
    ];
  });

  get filteredEquipment(): Equipment[] {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.equipmentList();
    return this.equipmentList().filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.category_name ?? '').toLowerCase().includes(q) ||
      e.registration_no.toLowerCase().includes(q) ||
      e.owner.toLowerCase().includes(q) ||
      (e.site_name ?? '').toLowerCase().includes(q)
    );
  }

  ngOnInit(): void {
    this.api.get<EquipmentCategory[]>('/equipment-categories').subscribe({
      next: data => this.categories.set(data),
      error: () => this.notify.error('Failed to load categories'),
    });
    this.api.get<Site[]>('/sites').subscribe({
      next: data => this.sites.set(data),
      error: () => this.notify.error('Failed to load sites'),
    });
    this.loadEquipment();
  }

  loadEquipment(): void {
    this.loading.set(true);
    this.api.get<Equipment[]>('/equipment').subscribe({
      next: data => { this.equipmentList.set(data); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load equipment'); this.loading.set(false); },
    });
  }

  openNewModal(): void {
    this.resetForm();
    this.showModal.set(true);
  }

  openEditModal(eq: Equipment): void {
    this.editingId.set(eq.id);
    this.equipmentName.set(eq.name);
    this.categoryId.set(eq.category_id);
    this.registrationNo.set(eq.registration_no);
    this.owner.set(eq.owner);
    this.rentRate.set(eq.rent_rate);
    this.siteId.set(eq.site_id ?? '');
    this.dutyDays.set(eq.duty_days ?? null);
    this.perDayRate.set(eq.per_day_rate ?? null);
    this.tdsApplicable.set(eq.tds_applicable ?? false);
    this.tdsPercent.set(eq.tds_percent ?? null);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  submitEquipment(): void {
    if (!this.equipmentName() || !this.categoryId()) {
      this.notify.error('Name and category are required');
      return;
    }
    const body: Record<string, any> = {
      name: this.equipmentName(),
      category_id: this.categoryId(),
      registration_no: this.registrationNo(),
      owner: this.owner(),
      rent_rate: this.rentRate(),
      site_id: this.siteId() || null,
      duty_days: this.dutyDays(),
      per_day_rate: this.perDayRate(),
      tds_applicable: this.tdsApplicable(),
      tds_percent: this.tdsApplicable() ? this.tdsPercent() : null,
    };

    if (this.approval.requiresApproval()) {
      const summary = `${this.editingId() ? 'Edit' : 'New'} Equipment: ${this.equipmentName()} (${this.registrationNo()})`;
      this.approval.submitForApproval({
        module: 'AddEquipment',
        actionType: this.editingId() ? 'update' : 'create',
        summary,
        data: body,
        referenceId: this.editingId() ?? undefined,
      }).subscribe({
        next: () => {
          this.notify.success('Sent for admin approval');
          this.closeModal();
          this.loadEquipment();
        },
        error: () => this.notify.error('Failed to submit for approval'),
      });
      return;
    }

    if (this.editingId()) {
      this.api.put<Equipment>(`/equipment/${this.editingId()}`, body).subscribe({
        next: updated => {
          this.equipmentList.update(list => list.map(e => e.id === updated.id ? updated : e));
          this.notify.success('Equipment updated');
          this.closeModal();
        },
        error: () => this.notify.error('Failed to update equipment'),
      });
    } else {
      this.api.post<Equipment>('/equipment', body).subscribe({
        next: created => {
          this.equipmentList.update(list => [created, ...list]);
          this.notify.success('Equipment added');
          this.closeModal();
        },
        error: () => this.notify.error('Failed to add equipment'),
      });
    }
  }

  async deleteEquipment(eq: Equipment): Promise<void> {
    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'AddEquipment',
        actionType: 'delete',
        summary: `Delete Equipment: ${eq.name} (${eq.registration_no})`,
        data: eq,
        referenceId: eq.id,
      }).subscribe({
        next: () => { this.notify.success('Delete request sent for approval'); this.loadEquipment(); },
        error: () => this.notify.error('Failed to submit delete request'),
      });
      return;
    }

    const result = await this.confirm.confirmWithPassword({
      title: 'Delete Equipment',
      message: `Are you sure you want to delete "${eq.name}" (${eq.registration_no})?`,
      type: 'danger',
      confirmText: 'Delete',
      passwordRequired: true,
    });
    if (!result.confirmed) return;

    this.api.delete<void>(`/equipment/${eq.id}`).subscribe({
      next: () => {
        this.equipmentList.update(list => list.filter(e => e.id !== eq.id));
        this.notify.success('Equipment deleted');
      },
      error: () => this.notify.error('Failed to delete equipment'),
    });
  }

  async addNewCategory(): Promise<void> {
    const name = prompt('Enter new equipment category name:');
    if (!name?.trim()) return;
    this.api.post<EquipmentCategory>('/equipment-categories', { name: name.trim() }).subscribe({
      next: created => {
        this.categories.update(list => [...list, created]);
        this.categoryId.set(created.id);
        this.notify.success(`Category "${created.name}" added`);
      },
      error: () => this.notify.error('Failed to create category'),
    });
  }

  exportExcel(): void {
    const data = this.filteredEquipment.map(e => {
      const base = (e.duty_days ?? 0) * (e.per_day_rate ?? 0);
      const tds = e.tds_applicable ? base * ((e.tds_percent ?? 0) / 100) : 0;
      return { ...e, base_amount: base, tds_amount: tds, net_total: base - tds };
    });
    this.exportService.exportToExcel(data, 'Equipment_List', 'Equipment', [
      { key: 'name', header: 'Party Name' },
      { key: 'category_name', header: 'Category' },
      { key: 'registration_no', header: 'Reg No' },
      { key: 'site_name', header: 'Site / Project' },
      { key: 'duty_days', header: 'Duty Days' },
      { key: 'per_day_rate', header: 'Rate/Day' },
      { key: 'tds_percent', header: 'TDS %' },
      { key: 'net_total', header: 'Net Total' },
    ]);
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.equipmentName.set('');
    this.categoryId.set('');
    this.registrationNo.set('');
    this.owner.set('');
    this.rentRate.set(null);
    this.siteId.set('');
    this.dutyDays.set(null);
    this.perDayRate.set(null);
    this.tdsApplicable.set(false);
    this.tdsPercent.set(null);
  }
}
