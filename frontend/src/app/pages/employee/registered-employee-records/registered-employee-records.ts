import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { RoleService } from '../../../core/services/role.service';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';

interface ApiEmployee {
  id: string;
  display_id?: string;
  name: string;
  designation?: string;
  working_positions?: string;
  position_type?: string;
  aadhaar?: string;
  phone?: string;
  address?: string;
  current_site_id?: string;
  site_name?: string;
  created_at?: string;
  status?: string;
  category_id?: string;
  category_name?: string;
  photo_url?: string;
  employee_categories?: { name?: string };
  father_name?: string;
  dob?: string;
  bank_name?: string;
  account_no?: string;
  ifsc?: string;
}

interface Employee {
  id: string;
  displayId: string;
  name: string;
  position: string;
  positionType: string;
  aadhaar: string;
  contact: string;
  address: string;
  site: string;
  siteId: string;
  joinDate: string;
  status: string;
  categoryId: string;
  categoryName: string;
  photoUrl: string;
  fatherName: string;
  dob: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
}

function mapEmployee(e: ApiEmployee): Employee {
  return {
    id: e.id,
    displayId: e.display_id ?? e.id,
    name: e.name,
    position: e.designation ?? '',
    positionType: e.position_type ?? e.working_positions ?? '',
    aadhaar: e.aadhaar ?? '',
    contact: e.phone ?? '',
    address: e.address ?? '',
    site: e.site_name ?? e.current_site_id ?? '',
    siteId: e.current_site_id ?? '',
    joinDate: e.created_at ? e.created_at.split('T')[0] : '',
    status: e.status ?? 'Active',
    categoryId: e.category_id ?? '',
    categoryName: e.employee_categories?.name ?? e.category_name ?? '',
    photoUrl: e.photo_url ?? '',
    fatherName: e.father_name ?? '',
    dob: e.dob ?? '',
    bankName: e.bank_name ?? '',
    accountNo: e.account_no ?? '',
    ifsc: e.ifsc ?? '',
  };
}

@Component({
  selector: 'app-registered-employee-records',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe, SummaryCardsComponent, ModalDialogComponent],
  templateUrl: './registered-employee-records.html',
  styleUrl: './registered-employee-records.scss',
})
export class RegisteredEmployeeRecordsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  readonly role = inject(RoleService);

  searchQuery = signal('');
  categoryFilter = signal('');
  siteFilterValue = signal('');
  activeTab = signal<'Active' | 'Inactive'>('Active');
  employees = signal<Employee[]>([]);
  loading = signal(false);
  editingEmployee = signal<Employee | null>(null);
  viewingEmployee = signal<Employee | null>(null);
  showExportMenu = signal(false);

  uniqueCategories = computed(() => {
    const cats = [...new Set(this.employees().map(e => e.categoryName).filter(Boolean))];
    return cats.sort();
  });

  uniqueSites = computed(() => {
    const sites = [...new Set(this.employees().map(e => e.site).filter(Boolean))];
    return sites.sort();
  });

  activeCount = computed(() => this.employees().filter(e => e.status === 'Active').length);
  inactiveCount = computed(() => this.employees().filter(e => e.status !== 'Active').length);

  filteredEmployees = computed(() => {
    let result = this.employees();
    result = result.filter(e => this.activeTab() === 'Active' ? e.status === 'Active' : e.status !== 'Active');
    const q = this.searchQuery().toLowerCase();
    if (q) {
      result = result.filter(e =>
        e.displayId.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.contact.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q) ||
        e.site.toLowerCase().includes(q)
      );
    }
    const cat = this.categoryFilter();
    if (cat) result = result.filter(e => e.categoryName === cat);
    const site = this.siteFilterValue();
    if (site) result = result.filter(e => e.site === site);
    if (this.role.isSiteLocked()) {
      const lockedSite = this.role.getSupervisorSiteId();
      if (lockedSite) result = result.filter(e => e.siteId === String(lockedSite));
    }
    return result;
  });

  employeeCount = computed(() => this.filteredEmployees().length);

  summaryCards = computed<SummaryCard[]>(() => [
    { title: 'Total Employees', value: this.employees().length, icon: 'ri-team-line', color: 'primary' },
    { title: 'Active', value: this.activeCount(), icon: 'ri-user-follow-line', color: 'success' },
    { title: 'Inactive', value: this.inactiveCount(), icon: 'ri-user-unfollow-line', color: 'danger' },
    { title: 'Showing', value: this.employeeCount(), icon: 'ri-filter-line', color: 'info' },
  ]);

  ngOnInit(): void {
    this.loadEmployees();
  }

  private loadEmployees(): void {
    this.loading.set(true);
    this.api.get<ApiEmployee[]>('/employees').subscribe({
      next: (emps) => {
        this.employees.set(emps.map(mapEmployee));
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err.message ?? 'Failed to load employees');
        this.loading.set(false);
      },
    });
  }

  setTab(tab: 'Active' | 'Inactive'): void {
    this.activeTab.set(tab);
  }

  viewProfile(emp: Employee): void {
    this.viewingEmployee.set(emp);
  }

  closeProfile(): void {
    this.viewingEmployee.set(null);
  }

  editEmployee(emp: Employee): void {
    this.editingEmployee.set({ ...emp });
  }

  saveEmployee(): void {
    const emp = this.editingEmployee();
    if (!emp) return;
    this.api.put<ApiEmployee>(`/employees/${emp.id}`, {
      name: emp.name,
      designation: emp.position,
      phone: emp.contact,
      address: emp.address,
    }).subscribe({
      next: () => {
        this.notify.success('Employee updated');
        this.editingEmployee.set(null);
        this.loadEmployees();
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to update employee'),
    });
  }

  cancelEdit(): void {
    this.editingEmployee.set(null);
  }

  async deleteEmployee(id: string): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Employee',
      message: 'This will permanently delete the employee record. Continue?',
      type: 'danger',
    });
    if (!confirmed) return;
    this.api.delete<void>(`/employees/${id}`).subscribe({
      next: () => {
        this.notify.success('Employee deleted');
        this.loadEmployees();
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to delete employee'),
    });
  }

  async toggleStatus(emp: Employee): Promise<void> {
    const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
    const confirmed = await this.confirmDialog.confirm({
      title: `${newStatus === 'Active' ? 'Activate' : 'Deactivate'} Employee`,
      message: `Set ${emp.name} as ${newStatus}?`,
      type: newStatus === 'Active' ? 'info' : 'warning',
    });
    if (!confirmed) return;
    this.api.put(`/employees/${emp.id}`, { status: newStatus }).subscribe({
      next: () => {
        this.notify.success(`Employee ${newStatus === 'Active' ? 'activated' : 'deactivated'}`);
        this.loadEmployees();
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to update status'),
    });
  }

  exportCSV(): void {
    this.showExportMenu.set(false);
    this.exportService.exportToCSV(this.filteredEmployees(), 'employee-records', [
      { key: 'displayId', header: 'Employee ID' },
      { key: 'name', header: 'Name' },
      { key: 'position', header: 'Position' },
      { key: 'contact', header: 'Contact' },
      { key: 'categoryName', header: 'Category' },
      { key: 'site', header: 'Site' },
      { key: 'joinDate', header: 'Join Date' },
      { key: 'status', header: 'Status' },
    ]);
  }

  exportExcel(): void {
    this.showExportMenu.set(false);
    this.exportService.exportToExcel(
      this.filteredEmployees().map(e => ({
        'Employee ID': e.displayId, 'Name': e.name, 'Position': e.position,
        'Position Type': e.positionType, 'Category': e.categoryName,
        'Aadhaar': e.aadhaar, 'Contact': e.contact, 'Address': e.address,
        'Site': e.site, 'Join Date': e.joinDate, 'Status': e.status,
      })),
      'Employee_Records', 'Employees'
    );
  }

  exportPDF(): void {
    this.showExportMenu.set(false);
    this.exportService.exportToPDF({
      title: 'Registered Employee Records',
      fileName: 'Employee_Records',
      companyName: 'ATR Construction Pvt. Ltd.',
      data: this.filteredEmployees() as any[],
      columns: [
        { key: 'displayId', header: 'ID' },
        { key: 'name', header: 'Name' },
        { key: 'position', header: 'Position' },
        { key: 'categoryName', header: 'Category' },
        { key: 'site', header: 'Site' },
        { key: 'status', header: 'Status' },
      ],
    });
  }

  downloadTemplate(): void {
    this.exportService.exportToExcel([{
      'Name': '', 'Designation': '', 'Aadhaar': '', 'Phone': '',
      'Address': '', 'Category': '', 'Father Name': '', 'DOB': '',
      'Bank Name': '', 'Account No': '', 'IFSC': '',
    }], 'Employee_Import_Template', 'Template');
  }

  onImportExcel(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    this.api.post('/employees/import', formData).subscribe({
      next: () => {
        this.notify.success('Employees imported successfully');
        this.loadEmployees();
      },
      error: (err) => this.notify.error(err.message ?? 'Import failed'),
    });
    input.value = '';
  }

  toggleExportMenu(): void {
    this.showExportMenu.update(v => !v);
  }
}
