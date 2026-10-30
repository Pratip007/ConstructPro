import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ExportService } from '../../../core/services/export.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { DocumentService, DocumentInfo } from '../../../core/services/document.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { CommonModule } from '@angular/common';

const WORK_TYPES = [
  'Civil Work', 'Plumbing', 'Electrical', 'Painting',
  'Material Supplier', 'Fabrication', 'Carpentry', 'Flooring', 'Other'
];

interface Contractor {
  id: number;
  name: string;
  company: string;
  contact: string;
  email: string;
  pan: string;
  gst: string;
  address: string;
  work_type: string;
  tds_applicable: boolean;
  tds_percent: number;
  status?: string;
}

interface ContractorPayload {
  name: string;
  phone: string;
  email: string;
  pan: string;
  gst_number: string;
  category: string;
  address: string;
  tds_applicable: boolean;
  tds_percent: number;
  work_type?: string;
}

interface ContractorResponse {
  id: number;
  name: string;
  phone: string;
  email: string;
  pan: string;
  gst_number: string;
  category: string;
  address: string;
  tds_applicable: boolean;
  tds_percent: number;
  work_type?: string;
  status?: string;
}

function toFrontend(r: ContractorResponse): Contractor {
  return {
    id: r.id,
    name: r.name,
    company: r.category,
    contact: r.phone,
    email: r.email,
    pan: r.pan,
    gst: r.gst_number,
    address: r.address,
    work_type: r.work_type || '',
    tds_applicable: r.tds_applicable,
    tds_percent: r.tds_percent,
    status: r.status,
  };
}

@Component({
  selector: 'app-add-contractor',
  standalone: true,
  imports: [FormsModule, CommonModule, SearchableDropdownComponent, ModalDialogComponent, SummaryCardsComponent],
  templateUrl: './add-contractor.html',
  styleUrl: './add-contractor.scss',
})
export class AddContractorComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  readonly role = inject(RoleService);
  private readonly approval = inject(ApprovalService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly docService = inject(DocumentService);

  readonly workTypes = WORK_TYPES;
  readonly workTypeItems: DropdownItem[] = WORK_TYPES.map(w => ({ value: w, label: w }));

  name = signal('');
  company = signal('');
  contact = signal('');
  email = signal('');
  pan = signal('');
  gst = signal('');
  address = signal('');
  workType = signal('');
  tdsApplicable = signal<'yes' | 'no'>('no');
  tdsPercent = signal(0);
  avatarFile = signal<File | null>(null);
  avatarPreview = signal<string | null>(null);

  searchQuery = signal('');
  contractors = signal<Contractor[]>([]);
  loading = signal(false);
  saving = signal(false);
  editingId = signal<number | null>(null);

  // Profile modal
  profileModalOpen = signal(false);
  selectedProfile = signal<Contractor | null>(null);
  profileDocuments = signal<DocumentInfo[]>([]);
  uploadingDoc = signal(false);

  // KYC document categories
  readonly kycCategories = [
    { key: 'photo', label: 'Profile Photo', accept: 'image/*' },
    { key: 'aadhaar', label: 'Aadhaar Card', accept: 'image/*,.pdf' },
    { key: 'pan_card', label: 'PAN Card', accept: 'image/*,.pdf' },
    { key: 'bank_passbook', label: 'Bank Passbook', accept: 'image/*,.pdf' },
    { key: 'agreement', label: 'Agreement Copy', accept: 'image/*,.pdf' },
  ];

  filteredContractors = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const list = this.contractors();
    if (!q) return list;
    return list.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.contact.includes(q) ||
        c.pan.toLowerCase().includes(q) ||
        c.gst.toLowerCase().includes(q) ||
        c.work_type.toLowerCase().includes(q)
    );
  });

  summaryCards = computed<SummaryCard[]>(() => {
    const list = this.contractors();
    return [
      { title: 'Total Contractors', value: list.length, icon: 'ri-group-line', color: 'primary' },
      { title: 'TDS Applicable', value: list.filter(c => c.tds_applicable).length, icon: 'ri-percent-line', color: 'warning' },
      { title: 'Active', value: list.filter(c => c.status !== 'pending').length, icon: 'ri-checkbox-circle-line', color: 'success' },
    ];
  });

  ngOnInit(): void {
    this.loadContractors();
  }

  loadContractors(): void {
    this.loading.set(true);
    this.api.get<ContractorResponse[]>('/contractors').subscribe({
      next: data => {
        this.contractors.set(data.map(toFrontend));
        this.loading.set(false);
      },
      error: err => {
        this.notify.error('Failed to load contractors: ' + err.message);
        this.loading.set(false);
      },
    });
  }

  addContractor(): void {
    if (!this.name() || !this.contact()) {
      this.notify.error('Name and contact are required.');
      return;
    }
    const payload: ContractorPayload = {
      name: this.name(),
      phone: this.contact(),
      email: this.email(),
      pan: this.pan().toUpperCase(),
      gst_number: this.gst().toUpperCase(),
      category: this.company(),
      address: this.address(),
      tds_applicable: this.tdsApplicable() === 'yes',
      tds_percent: this.tdsApplicable() === 'yes' ? this.tdsPercent() : 0,
      work_type: this.workType(),
    };

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'contractors',
        actionType: this.editingId() ? 'update' : 'create',
        summary: `${this.editingId() ? 'Update' : 'Add'} contractor: ${payload.name}`,
        data: payload,
        referenceId: this.editingId()?.toString(),
      }).subscribe({
        next: () => {
          this.notify.success('Submitted for approval.');
          this.resetForm();
        },
        error: err => this.notify.error('Approval submission failed: ' + err.message),
      });
      return;
    }

    this.saving.set(true);
    if (this.editingId() !== null) {
      this.api.put<ContractorResponse>(`/contractors/${this.editingId()}`, payload).subscribe({
        next: updated => {
          this.contractors.update(list => list.map(c => (c.id === updated.id ? toFrontend(updated) : c)));
          this.notify.success('Contractor updated.');
          this.saving.set(false);
          this.resetForm();
        },
        error: err => {
          this.notify.error('Failed to update contractor: ' + err.message);
          this.saving.set(false);
        },
      });
    } else {
      this.api.post<ContractorResponse>('/contractors', payload).subscribe({
        next: created => {
          this.contractors.update(list => [...list, toFrontend(created)]);
          this.notify.success('Contractor added.');
          this.saving.set(false);
          this.resetForm();
        },
        error: err => {
          this.notify.error('Failed to add contractor: ' + err.message);
          this.saving.set(false);
        },
      });
    }
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.avatarFile.set(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => this.avatarPreview.set(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      this.avatarPreview.set(null);
    }
  }

  editContractor(c: Contractor): void {
    this.editingId.set(c.id);
    this.name.set(c.name);
    this.company.set(c.company);
    this.contact.set(c.contact);
    this.email.set(c.email);
    this.pan.set(c.pan);
    this.gst.set(c.gst);
    this.address.set(c.address);
    this.workType.set(c.work_type);
    this.tdsApplicable.set(c.tds_applicable ? 'yes' : 'no');
    this.tdsPercent.set(c.tds_percent ?? 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async deleteContractor(c: Contractor): Promise<void> {
    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'contractors',
        actionType: 'delete',
        summary: `Delete contractor: ${c.name}`,
        data: c,
        referenceId: c.id.toString(),
      }).subscribe({
        next: () => this.notify.success('Delete request submitted for approval.'),
        error: err => this.notify.error('Failed: ' + err.message),
      });
      return;
    }

    const result = await this.confirmDialog.confirmWithPassword({
      title: 'Delete Contractor',
      message: `Are you sure you want to delete "${c.name}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!result.confirmed) return;

    this.api.delete<void>(`/contractors/${c.id}`).subscribe({
      next: () => {
        this.contractors.update(list => list.filter(x => x.id !== c.id));
        this.notify.success('Contractor deleted.');
      },
      error: err => this.notify.error('Failed to delete: ' + err.message),
    });
  }

  // Profile modal
  viewProfile(c: Contractor): void {
    this.selectedProfile.set(c);
    this.profileModalOpen.set(true);
    this.loadDocuments(c.id);
  }

  closeProfile(): void {
    this.profileModalOpen.set(false);
    this.selectedProfile.set(null);
    this.profileDocuments.set([]);
  }

  loadDocuments(contractorId: number): void {
    this.docService.getDocuments(`contractor-${contractorId}`).subscribe({
      next: docs => this.profileDocuments.set(docs),
      error: () => this.profileDocuments.set([]),
    });
  }

  uploadKycDocument(event: Event, category: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const contractor = this.selectedProfile();
    if (!file || !contractor) return;

    this.uploadingDoc.set(true);
    this.docService.uploadDocument(file, category, `contractor-${contractor.id}`).subscribe({
      next: doc => {
        this.profileDocuments.update(list => [...list, doc]);
        this.notify.success(`${category} uploaded successfully.`);
        this.uploadingDoc.set(false);
        input.value = '';
      },
      error: err => {
        this.notify.error('Upload failed: ' + err.message);
        this.uploadingDoc.set(false);
      },
    });
  }

  viewDocument(doc: DocumentInfo): void {
    this.docService.previewDocument(doc);
  }

  deleteDocument(doc: DocumentInfo): void {
    this.docService.deleteDocument(doc.id).subscribe({
      next: () => {
        this.profileDocuments.update(list => list.filter(d => d.id !== doc.id));
        this.notify.success('Document deleted.');
      },
      error: err => this.notify.error('Failed: ' + err.message),
    });
  }

  getDocsByCategory(category: string): DocumentInfo[] {
    return this.profileDocuments().filter(d => d.category === category);
  }

  // Export
  exportExcel(): void {
    this.exportService.exportToExcel(this.filteredContractors() as any, 'contractors', 'Contractors', [
      { key: 'name', header: 'Name' },
      { key: 'company', header: 'Company' },
      { key: 'work_type', header: 'Work Type' },
      { key: 'contact', header: 'Contact' },
      { key: 'pan', header: 'PAN' },
      { key: 'gst', header: 'GST' },
      { key: 'tds_percent', header: 'TDS %' },
    ]);
  }

  exportCsv(): void {
    this.exportService.exportToCSV(this.filteredContractors() as any, 'contractors', [
      { key: 'name', header: 'Name' },
      { key: 'company', header: 'Company' },
      { key: 'work_type', header: 'Work Type' },
      { key: 'contact', header: 'Contact' },
      { key: 'pan', header: 'PAN' },
      { key: 'gst', header: 'GST' },
      { key: 'tds_percent', header: 'TDS %' },
    ]);
  }

  printContractors(): void {
    this.exportService.printReport('contractorTable', 'Contractor List');
  }

  resetForm(): void {
    this.editingId.set(null);
    this.name.set('');
    this.company.set('');
    this.contact.set('');
    this.email.set('');
    this.pan.set('');
    this.gst.set('');
    this.address.set('');
    this.workType.set('');
    this.tdsApplicable.set('no');
    this.tdsPercent.set(0);
    this.avatarFile.set(null);
    this.avatarPreview.set(null);
  }
}
