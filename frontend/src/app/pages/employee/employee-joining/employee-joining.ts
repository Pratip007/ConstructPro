import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { ExportService } from '../../../core/services/export.service';

interface CategoryItem {
  id: string | number;
  name: string;
}

@Component({
  selector: 'app-employee-joining',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent],
  templateUrl: './employee-joining.html',
  styleUrl: './employee-joining.scss',
})
export class EmployeeJoiningComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  name = signal('');
  fatherName = signal('');
  dob = signal('');
  religion = signal('');
  aadhaar = signal('');
  contact = signal('');
  whatsapp = signal('');
  emergencyContactName = signal('');
  emergencyContactNumber = signal('');
  photoPreview = signal<string | null>(null);

  village = signal('');
  post = signal('');
  ps = signal('');
  district = signal('');
  pin = signal('');

  bankName = signal('');
  accountHolder = signal('');
  accountNumber = signal('');
  ifscCode = signal('');
  uan = signal('');

  designation = signal('');
  positionErection = signal(false);
  positionSheeting = signal(false);
  positionCategory = signal('');
  site = signal('');
  joinDate = signal(new Date().toISOString().substring(0, 10));
  termsAccepted = signal(false);

  loading = signal(false);
  nextAutoId = signal('ATR-EMP-001');
  aadhaarError = signal('');

  categories: CategoryItem[] = [];
  sites: CategoryItem[] = [];
  religions = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'];

  categoryDropdownItems = signal<DropdownItem[]>([]);
  siteDropdownItems = signal<DropdownItem[]>([]);
  religionDropdownItems: DropdownItem[] = this.religions.map(r => ({ value: r, label: r }));

  calculatedAge = computed(() => {
    const dob = this.dob();
    if (!dob) return null;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  });

  workingPositions = computed(() => {
    const positions: string[] = [];
    if (this.positionErection()) positions.push('Erection');
    if (this.positionSheeting()) positions.push('Sheeting');
    return positions.join(', ');
  });

  ngOnInit(): void {
    this.api.get<CategoryItem[]>('/employee-categories').subscribe({
      next: (cats) => {
        this.categories = cats;
        this.categoryDropdownItems.set(cats.map(c => ({ value: c.id, label: c.name })));
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to load categories'),
    });
    this.api.get<CategoryItem[]>('/sites').subscribe({
      next: (siteList) => {
        this.sites = siteList;
        this.siteDropdownItems.set(siteList.map(s => ({ value: s.id, label: s.name })));
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to load sites'),
    });
    this.loadNextAutoId();
  }

  private loadNextAutoId(): void {
    this.api.get<{ next_id?: string }>('/employees/next-id').subscribe({
      next: (res) => {
        if (res?.next_id) this.nextAutoId.set(res.next_id);
      },
      error: () => {},
    });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        this.notify.error('Photo must be under 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => this.photoPreview.set(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  handleAadhaarInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').substring(0, 12);
    input.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    this.aadhaar.set(input.value);
    this.aadhaarError.set('');
    if (digits.length === 12) {
      this.validateAadhaar(digits);
    }
  }

  private validateAadhaar(digits: string): void {
    if (digits.length !== 12 || /^0/.test(digits)) {
      this.aadhaarError.set('Invalid Aadhaar number');
      return;
    }
    this.api.get<{ exists?: boolean }>('/employees/check-aadhaar', { aadhaar: digits }).subscribe({
      next: (res) => {
        if (res?.exists) this.aadhaarError.set('Aadhaar already registered');
      },
      error: () => {},
    });
  }

  submitForm(): void {
    if (!this.name() || !this.aadhaar() || !this.positionCategory() || !this.site()) {
      this.notify.error('Please fill all required fields.');
      return;
    }
    if (this.aadhaarError()) {
      this.notify.error(this.aadhaarError());
      return;
    }
    if (!this.termsAccepted()) {
      this.notify.error('Please accept Terms & Conditions.');
      return;
    }
    this.loading.set(true);
    const body = {
      name: this.name(),
      father_name: this.fatherName(),
      aadhaar: this.aadhaar().replace(/\s/g, ''),
      phone: this.contact(),
      dob: this.dob() || null,
      religion: this.religion(),
      village: this.village(),
      post: this.post(),
      ps: this.ps(),
      district: this.district(),
      pin: this.pin(),
      uan: this.uan(),
      whatsapp: this.whatsapp(),
      emergency_contact_name: this.emergencyContactName(),
      emergency_contact_number: this.emergencyContactNumber(),
      bank_name: this.bankName(),
      account_holder: this.accountHolder(),
      account_number: this.accountNumber(),
      ifsc_code: this.ifscCode(),
      category_id: this.positionCategory(),
      current_site_id: this.site(),
      designation: this.designation(),
      working_positions: this.workingPositions(),
      join_date: this.joinDate() || null,
      photo: this.photoPreview(),
    };
    this.api.post('/employees', body).subscribe({
      next: (res: any) => {
        const empId = res?.display_id || this.nextAutoId();
        this.notify.success(`Employee "${this.name()}" registered as ${empId}`);
        this.resetForm();
        this.loading.set(false);
        this.loadNextAutoId();
      },
      error: (err) => {
        this.notify.error(err.message ?? 'Failed to register employee');
        this.loading.set(false);
      },
    });
  }

  downloadRegistrationPDF(): void {
    this.exportService.exportToPDF({
      title: 'Employee Registration Form',
      fileName: `Registration_${this.name()}`,
      data: [{
        'Name': this.name(),
        'Father\'s Name': this.fatherName(),
        'DOB': this.dob(),
        'Religion': this.religion(),
        'Aadhaar': this.aadhaar(),
        'Contact': this.contact(),
        'WhatsApp': this.whatsapp(),
        'Village': this.village(),
        'Post': this.post(),
        'PS': this.ps(),
        'District': this.district(),
        'PIN': this.pin(),
        'Bank': this.bankName(),
        'Account': this.accountNumber(),
        'IFSC': this.ifscCode(),
        'UAN': this.uan(),
        'Designation': this.designation(),
        'Positions': this.workingPositions(),
      }],
      columns: [
        { key: 'Name', header: 'Field' },
        { key: 'Father\'s Name', header: 'Value' },
      ],
      companyName: 'ATR Construction Pvt. Ltd.',
      footerLeft: 'Employee Signature',
      footerRight: 'Authorized Signatory',
    });
  }

  resetForm(): void {
    this.name.set('');
    this.fatherName.set('');
    this.dob.set('');
    this.religion.set('');
    this.aadhaar.set('');
    this.contact.set('');
    this.whatsapp.set('');
    this.emergencyContactName.set('');
    this.emergencyContactNumber.set('');
    this.photoPreview.set(null);
    this.village.set('');
    this.post.set('');
    this.ps.set('');
    this.district.set('');
    this.pin.set('');
    this.bankName.set('');
    this.accountHolder.set('');
    this.accountNumber.set('');
    this.ifscCode.set('');
    this.uan.set('');
    this.designation.set('');
    this.positionErection.set(false);
    this.positionSheeting.set(false);
    this.positionCategory.set('');
    this.site.set('');
    this.joinDate.set(new Date().toISOString().substring(0, 10));
    this.termsAccepted.set(false);
    this.aadhaarError.set('');
  }
}
