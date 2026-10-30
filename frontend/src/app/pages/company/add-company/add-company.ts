import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { ExportService } from '../../../core/services/export.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

@Component({
  selector: 'app-add-company',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, ModalDialogComponent, SummaryCardsComponent],
  templateUrl: './add-company.html',
  styleUrl: './add-company.scss',
})
export class AddCompanyComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly role = inject(RoleService);
  private readonly approval = inject(ApprovalService);
  private readonly exportService = inject(ExportService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  companyName = signal('');
  companyType = signal('');
  contactPerson = signal('');
  phone = signal('');
  email = signal('');
  gstNo = signal('');
  pan = signal('');
  stateCode = signal('');
  address = signal('');
  customFields = signal<{key: string; value: string}[]>([]);

  companies = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);
  editingId = signal<string | null>(null);
  searchQuery = signal('');

  profileModalOpen = signal(false);
  profileCompany = signal<any>(null);

  companyTypes = ['Construction', 'Material Supplier', 'Transport', 'Consulting', 'Other'];

  stateItems: DropdownItem[] = [
    { value: '01', label: '01 - Jammu & Kashmir' },
    { value: '02', label: '02 - Himachal Pradesh' },
    { value: '03', label: '03 - Punjab' },
    { value: '04', label: '04 - Chandigarh' },
    { value: '05', label: '05 - Uttarakhand' },
    { value: '06', label: '06 - Haryana' },
    { value: '07', label: '07 - Delhi' },
    { value: '08', label: '08 - Rajasthan' },
    { value: '09', label: '09 - Uttar Pradesh' },
    { value: '10', label: '10 - Bihar' },
    { value: '11', label: '11 - Sikkim' },
    { value: '12', label: '12 - Arunachal Pradesh' },
    { value: '13', label: '13 - Nagaland' },
    { value: '14', label: '14 - Manipur' },
    { value: '15', label: '15 - Mizoram' },
    { value: '16', label: '16 - Tripura' },
    { value: '17', label: '17 - Meghalaya' },
    { value: '18', label: '18 - Assam' },
    { value: '19', label: '19 - West Bengal' },
    { value: '20', label: '20 - Jharkhand' },
    { value: '21', label: '21 - Odisha' },
    { value: '22', label: '22 - Chhattisgarh' },
    { value: '23', label: '23 - Madhya Pradesh' },
    { value: '24', label: '24 - Gujarat' },
    { value: '26', label: '26 - Dadra & Nagar Haveli and Daman & Diu' },
    { value: '27', label: '27 - Maharashtra' },
    { value: '29', label: '29 - Karnataka' },
    { value: '30', label: '30 - Goa' },
    { value: '31', label: '31 - Lakshadweep' },
    { value: '32', label: '32 - Kerala' },
    { value: '33', label: '33 - Tamil Nadu' },
    { value: '34', label: '34 - Puducherry' },
    { value: '35', label: '35 - Andaman & Nicobar Islands' },
    { value: '36', label: '36 - Telangana' },
    { value: '37', label: '37 - Andhra Pradesh' },
    { value: '38', label: '38 - Ladakh' },
  ];

  filteredCompanies = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const list = this.companies();
    if (!q) return list;
    return list.filter(c =>
      (c.name ?? '').toLowerCase().includes(q) ||
      (c.gst_number ?? '').toLowerCase().includes(q) ||
      (c.pan_number ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q)
    );
  });

  summaryCards = computed<SummaryCard[]>(() => {
    const list = this.companies();
    return [
      { title: 'Total Companies', value: list.length, icon: 'ri-building-2-line', color: 'primary' },
      { title: 'Construction', value: list.filter(c => c.custom_fields?.type === 'Construction').length, icon: 'ri-hammer-line', color: 'info' },
      { title: 'Material Supplier', value: list.filter(c => c.custom_fields?.type === 'Material Supplier').length, icon: 'ri-truck-line', color: 'success' },
    ];
  });

  isAdmin = computed(() => this.role.isAdmin());

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.loading.set(true);
    this.api.get<any[]>('/companies').subscribe({
      next: (data) => {
        this.companies.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error('Failed to load companies: ' + err.message);
        this.loading.set(false);
      },
    });
  }

  saveCompany(): void {
    if (!this.companyName() || !this.companyType()) return;

    const body = {
      name: this.companyName(),
      phone: this.phone(),
      email: this.email(),
      gst_number: this.gstNo().toUpperCase(),
      pan_number: this.pan().toUpperCase(),
      state_code: this.stateCode(),
      address: this.address(),
      custom_fields: {
        type: this.companyType(),
        contact_person: this.contactPerson(),
        pan: this.pan().toUpperCase(),
        ...Object.fromEntries(this.customFields().filter(f => f.key).map(f => [f.key, f.value]))
      },
    };

    if (this.role.isAdmin() || !this.approval.requiresApproval()) {
      this.saving.set(true);
      const id = this.editingId();
      const request = id
        ? this.api.put<any>(`/companies/${id}`, body)
        : this.api.post<any>('/companies', body);

      request.subscribe({
        next: (result) => {
          if (id) {
            this.companies.update(list => list.map(c => c.id === id ? { ...c, ...result } : c));
            this.notify.success('Company updated successfully');
          } else {
            this.companies.update(list => [result, ...list]);
            this.notify.success('Company added successfully');
          }
          this.resetForm();
          this.saving.set(false);
        },
        error: (err) => {
          this.notify.error('Failed to save company: ' + err.message);
          this.saving.set(false);
        },
      });
    } else {
      this.approval.submitForApproval({
        module: 'Company',
        actionType: this.editingId() ? 'update' : 'create',
        summary: `${this.editingId() ? 'Update' : 'Add'} company: ${this.companyName()}`,
        data: body,
        referenceId: this.editingId() ?? undefined,
      }).subscribe({
        next: () => {
          this.notify.success('Submitted for approval');
          this.resetForm();
        },
        error: (err) => this.notify.error('Failed to submit: ' + err.message),
      });
    }
  }

  editCompany(c: any): void {
    this.editingId.set(c.id);
    this.companyName.set(c.name ?? '');
    this.companyType.set(c.custom_fields?.type ?? '');
    this.contactPerson.set(c.custom_fields?.contact_person ?? '');
    this.phone.set(c.phone ?? '');
    this.email.set(c.email ?? '');
    this.gstNo.set(c.gst_number ?? '');
    this.pan.set(c.pan_number ?? c.custom_fields?.pan ?? '');
    this.stateCode.set(c.state_code ?? '');
    this.address.set(c.address ?? '');

    const cf = c.custom_fields ?? {};
    const reserved = ['type', 'contact_person', 'pan'];
    const fields = Object.entries(cf)
      .filter(([k]) => !reserved.includes(k))
      .map(([key, value]) => ({ key, value: String(value) }));
    this.customFields.set(fields);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async deleteCompany(c: any): Promise<void> {
    if (this.role.isAdmin()) {
      const result = await this.confirmDialog.confirmWithPassword({
        title: 'Delete Company',
        message: `Are you sure you want to delete "${c.name}"? This action cannot be undone.`,
        type: 'danger',
        confirmText: 'Delete',
      });
      if (!result.confirmed) return;
    } else if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'Company',
        actionType: 'delete',
        summary: `Delete company: ${c.name}`,
        data: c,
        referenceId: c.id,
      }).subscribe({
        next: () => this.notify.success('Delete request submitted for approval'),
        error: (err) => this.notify.error('Failed to submit: ' + err.message),
      });
      return;
    }

    this.api.delete<any>(`/companies/${c.id}`).subscribe({
      next: () => {
        this.companies.update(list => list.filter(co => co.id !== c.id));
        this.notify.success('Company deleted');
      },
      error: (err) => this.notify.error('Failed to delete company: ' + err.message),
    });
  }

  viewProfile(c: any): void {
    this.profileCompany.set(c);
    this.profileModalOpen.set(true);
  }

  closeProfile(): void {
    this.profileModalOpen.set(false);
    this.profileCompany.set(null);
  }

  addCustomField(): void {
    this.customFields.update(f => [...f, { key: '', value: '' }]);
  }

  removeCustomField(index: number): void {
    this.customFields.update(f => f.filter((_, i) => i !== index));
  }

  updateCustomFieldKey(index: number, key: string): void {
    this.customFields.update(f => f.map((item, i) => i === index ? { ...item, key } : item));
  }

  updateCustomFieldValue(index: number, value: string): void {
    this.customFields.update(f => f.map((item, i) => i === index ? { ...item, value } : item));
  }

  cancelEdit(): void {
    this.resetForm();
  }

  exportExcel(): void {
    this.exportService.exportToExcel(
      this.filteredCompanies().map(c => ({
        Name: c.name,
        Type: c.custom_fields?.type,
        Contact: c.custom_fields?.contact_person,
        Phone: c.phone,
        Email: c.email,
        GST: c.gst_number,
        PAN: c.pan_number ?? c.custom_fields?.pan,
        State: c.state_code,
        Address: c.address,
      })),
      'companies'
    );
  }

  getStateName(code: string): string {
    return this.stateItems.find(s => s.value === code)?.label ?? code ?? '—';
  }

  getCustomFieldEntries(cf: any): {key: string; value: string}[] {
    if (!cf) return [];
    const reserved = ['type', 'contact_person', 'pan'];
    return Object.entries(cf)
      .filter(([k]) => !reserved.includes(k))
      .map(([key, value]) => ({ key, value: String(value) }));
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.companyName.set('');
    this.companyType.set('');
    this.contactPerson.set('');
    this.phone.set('');
    this.email.set('');
    this.gstNo.set('');
    this.pan.set('');
    this.stateCode.set('');
    this.address.set('');
    this.customFields.set([]);
  }
}
