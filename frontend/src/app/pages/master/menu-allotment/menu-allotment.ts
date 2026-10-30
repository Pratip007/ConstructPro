import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';

interface UserOption {
  id: string;
  name: string;
  role: string;
  status: string;
  menus: string[];
}

interface MenuSection {
  sectionName: string;
  expanded: boolean;
  selectAll: boolean;
  items: MenuItemConfig[];
}

interface MenuItemConfig {
  id: string;
  name: string;
  url: string;
  checked: boolean;
}

const MASTER_MENU_CONFIG = [
  {
    sectionName: 'Master Section',
    items: [
      { id: 'menu_new_user', name: 'New User Entry', url: 'NewUserEntry' },
      { id: 'menu_allotment', name: 'Menu Allotment', url: 'MenuAlotment' },
      { id: 'menu_head_entry', name: 'Head Entry', url: 'HeadAllotment' },
      { id: 'menu_bank_entry', name: 'Bank Entry', url: 'BankEntry' },
      { id: 'menu_tc_entry', name: 'Add T&C Entry', url: 'TCEntry' },
    ]
  },
  {
    sectionName: 'Approval Section',
    items: [
      { id: 'menu_apprv_office', name: 'Office User Requests', url: 'ApproveOffice' },
      { id: 'menu_apprv_supervisor', name: 'Supervisor Requests', url: 'ApproveSupervisor' },
      { id: 'menu_apprv_logs', name: 'Approval History', url: 'ApprovalLogs' },
    ]
  },
  {
    sectionName: 'Employee Section',
    items: [
      { id: 'menu_emp_category', name: 'Position Category', url: 'EmployeeCategory' },
      { id: 'menu_emp_joining', name: 'Employee Joining', url: 'RegisteredEmployeeRecords' },
      { id: 'menu_emp_sitetag', name: 'Site Tagging', url: 'SiteTagging' },
      { id: 'menu_emp_subid', name: 'Sub ID Create', url: 'EmployeeSubId' },
      { id: 'menu_emp_paymentlist', name: 'Payment List', url: 'Paymentlist' },
      { id: 'menu_emp_attendance', name: 'Attendance', url: 'EmployeeAttendance' },
      { id: 'menu_emp_leave', name: 'Site Leave Entry', url: 'SiteLeaveEntry' },
      { id: 'menu_emp_ledger', name: 'Employee Ledger', url: 'EmployeeLedger' },
    ]
  },
  {
    sectionName: 'Contractor Section',
    items: [
      { id: 'menu_cont_add', name: 'Add Contractor', url: 'AddContractor' },
      { id: 'menu_cont_siteorder', name: 'Site Order Entry', url: 'SiteOrderEntry' },
      { id: 'menu_cont_product', name: 'Product Entry', url: 'ProductEntry' },
      { id: 'menu_cont_ledger', name: 'Contractor Ledger', url: 'ContractorLedger' },
    ]
  },
  {
    sectionName: 'Mobilization Section',
    items: [
      { id: 'menu_mob_addequip', name: 'Add Equipment', url: 'AddEquipment' },
      { id: 'menu_mob_orderequip', name: 'Site Order Equipment', url: 'SiteOrderEquipment' },
      { id: 'menu_mob_leave', name: 'Equipment Leave', url: 'EquipmentLeave' },
      { id: 'menu_mob_sitetag', name: 'Site Tagging Equipment', url: 'SiteTaggingEquipment' },
    ]
  },
  {
    sectionName: 'Company Section',
    items: [
      { id: 'menu_comp_add', name: 'Add Company', url: 'AddCompany' },
      { id: 'menu_comp_bal', name: 'Balance Received', url: 'BalanceReceived' },
      { id: 'menu_comp_ledger', name: 'Company Ledger', url: 'CompanyLedger' },
      { id: 'menu_comp_loan', name: 'Company Loan Management', url: 'CompanyLoanManagement' },
      { id: 'menu_comp_vehicle', name: 'Vehicle Management', url: 'VehicleManagement' },
      { id: 'menu_comp_incexp', name: 'Income Expense Entry', url: 'IncomeExpenseEntry' },
      { id: 'menu_comp_bank', name: 'Bank Statement', url: 'BankStatement' },
    ]
  },
  {
    sectionName: 'Supervisor Section',
    items: [
      { id: 'menu_sup_add', name: 'Add Supervisor', url: 'AddSupervisor' },
      { id: 'menu_sup_tag', name: 'Site Tagging Supervisor', url: 'SiteTaggingSupervisor' },
      { id: 'menu_sup_ledger', name: 'Supervisor Ledger', url: 'SupervisorLedger' },
    ]
  },
  {
    sectionName: 'Sales Section',
    items: [
      { id: 'menu_sale_po', name: 'Purchase Order Entry', url: 'PurchaseOrderEntry' },
      { id: 'menu_sale_invoice', name: 'Invoice Entry', url: 'InvoiceEntry' },
      { id: 'menu_sale_viewsite', name: 'View Site', url: 'ViewSite' },
    ]
  },
  {
    sectionName: 'Purchase Section',
    items: [
      { id: 'menu_pur_addret', name: 'Add Retailer', url: 'AddRetailer' },
      { id: 'menu_pur_invoice', name: 'Retail Site Invoice', url: 'RetailSiteInvoice' },
      { id: 'menu_pur_gst', name: 'GST Report', url: 'GstReport' },
      { id: 'menu_pur_nongst', name: 'Non GST Report', url: 'NonGstReport' },
      { id: 'menu_pur_ledger', name: 'Retail Ledger', url: 'RetailLedger' },
    ]
  },
  {
    sectionName: 'Payment Section',
    items: [
      { id: 'menu_pay_all', name: 'All Type Payment', url: 'AllTypePayment' },
    ]
  },
  {
    sectionName: 'Report Section',
    items: [
      { id: 'menu_rpt_mob', name: 'Mobilization Report', url: 'MobilizationReport' },
      { id: 'menu_rpt_emp', name: 'Employee Report', url: 'EmployeeReport' },
      { id: 'menu_rpt_cont', name: 'Contractor Report', url: 'ContractorReport' },
      { id: 'menu_rpt_comp', name: 'Company Report', url: 'CompanyReport' },
      { id: 'menu_rpt_sup', name: 'Supervisor Report', url: 'SupervisorReport' },
      { id: 'menu_rpt_sales', name: 'Sales Report', url: 'SalesReport' },
      { id: 'menu_rpt_pur', name: 'Purchase Report', url: 'PurchaseReport' },
      { id: 'menu_rpt_gst', name: 'GST Bill Download', url: 'GstBillDownload' },
      { id: 'menu_rpt_nongst', name: 'Non GST Bill Download', url: 'NonGstBillDownload' },
      { id: 'menu_rpt_fullsite', name: 'Full Site Report Ledger', url: 'FullSiteLedger' },
    ]
  },
  {
    sectionName: 'Stock Management',
    items: [
      { id: 'menu_stk_view', name: 'Add/View Stock', url: 'StockView' },
      { id: 'menu_stk_current', name: 'Current Stock', url: 'CurrentStock' },
      { id: 'menu_stk_transfer', name: 'Stock Transfer', url: 'StockTransfer' },
      { id: 'menu_stk_report', name: 'Stock Report', url: 'StockReport' },
    ]
  },
  {
    sectionName: 'Company Document',
    items: [
      { id: 'menu_doc_list', name: 'Create Doc List', url: 'CreateDocList' },
      { id: 'menu_doc_backup', name: 'Company Full Backup', url: 'Backup' },
    ]
  },
];

const ROLES = ['Manager', 'Accountant', 'Site Supervisor', 'Admin', 'HR', 'Staff', 'Engineer', 'Office Staff'];

@Component({
  selector: 'app-menu-allotment',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalDialogComponent],
  templateUrl: './menu-allotment.html',
  styleUrl: './menu-allotment.scss',
})
export class MenuAllotmentComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  readonly role = inject(RoleService);
  readonly approval = inject(ApprovalService);

  users = signal<UserOption[]>([]);
  permissions = signal<Record<string, string[]>>({});
  menuSections = signal<MenuSection[]>([]);
  loadingUsers = signal(false);
  saving = signal(false);
  showModal = signal(false);
  searchQuery = signal('');

  selectedUserId = signal('');
  selectedRole = signal('');
  readonly roles = ROLES;

  readonly filteredUsers = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const perms = this.permissions();
    return this.users()
      .filter(u => u.status === 'Active')
      .filter(u => !q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))
      .map(u => ({ ...u, menus: perms[u.id] ?? [] }));
  });

  readonly roleBadge = computed(() => {
    if (this.role.isOffice()) return 'Office Mode - Requires Approval';
    if (this.role.isSupervisor()) return 'Supervisor Mode - View Only';
    return '';
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  private loadUsers(): void {
    this.loadingUsers.set(true);
    forkJoin({
      employees: this.api.get<any[]>('/employees'),
      supervisors: this.api.get<any[]>('/supervisors'),
    }).subscribe({
      next: ({ employees, supervisors }) => {
        const userList: UserOption[] = [];
        (employees ?? []).forEach(e => {
          if (e.profile_id || e.id) {
            userList.push({
              id: e.profile_id ?? e.id,
              name: e.name ?? '',
              role: e.designation ?? e.role ?? 'Office Staff',
              status: e.status ?? 'Active',
              menus: [],
            });
          }
        });
        (supervisors ?? []).forEach(s => {
          if (s.profile_id || s.id) {
            userList.push({
              id: s.profile_id ?? s.id,
              name: s.name ?? '',
              role: s.designation ?? 'Site Supervisor',
              status: s.status ?? 'Active',
              menus: [],
            });
          }
        });
        this.users.set(userList);
        this.loadingUsers.set(false);
        this.loadPermissions();
      },
      error: () => {
        this.notify.error('Failed to load user list');
        this.loadingUsers.set(false);
      },
    });
  }

  private loadPermissions(): void {
    this.api.get<Record<string, string[]>>('/settings/permissions').subscribe({
      next: (perms) => this.permissions.set(perms ?? {}),
      error: () => {},
    });
  }

  getMenuLabel(menuUrl: string): string {
    for (const sec of MASTER_MENU_CONFIG) {
      const item = sec.items.find(i => i.url === menuUrl || i.id === menuUrl);
      if (item) return item.name;
    }
    return menuUrl;
  }

  openModal(userId?: string): void {
    if (this.role.isSupervisor()) {
      this.notify.error('Supervisors cannot edit menu allotments');
      return;
    }

    const sections: MenuSection[] = MASTER_MENU_CONFIG.map(sec => ({
      sectionName: sec.sectionName,
      expanded: false,
      selectAll: false,
      items: sec.items.map(item => ({
        id: item.id,
        name: item.name,
        url: item.url,
        checked: false,
      })),
    }));
    this.menuSections.set(sections);

    if (userId) {
      this.selectedUserId.set(userId);
      this.loadUserMenus(userId);
    } else {
      this.selectedUserId.set('');
      this.selectedRole.set('');
    }
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  onUserChange(userId: string): void {
    this.selectedUserId.set(userId);
    if (userId) {
      this.loadUserMenus(userId);
    } else {
      this.resetMenuCheckboxes();
    }
  }

  private loadUserMenus(userId: string): void {
    const user = this.users().find(u => u.id === userId);
    if (user) {
      this.selectedRole.set(user.role);
    }
    const userMenus = this.permissions()[userId] ?? [];
    this.menuSections.update(sections =>
      sections.map(sec => {
        const items = sec.items.map(item => ({
          ...item,
          checked: userMenus.includes(item.url) || userMenus.includes(item.id),
        }));
        const hasChecked = items.some(i => i.checked);
        return {
          ...sec,
          expanded: hasChecked,
          selectAll: items.every(i => i.checked),
          items,
        };
      })
    );
  }

  private resetMenuCheckboxes(): void {
    this.menuSections.update(sections =>
      sections.map(sec => ({
        ...sec,
        selectAll: false,
        items: sec.items.map(item => ({ ...item, checked: false })),
      }))
    );
  }

  toggleSection(index: number): void {
    this.menuSections.update(sections => {
      const copy = [...sections];
      copy[index] = { ...copy[index], expanded: !copy[index].expanded };
      return copy;
    });
  }

  toggleSectionAll(index: number, checked: boolean): void {
    this.menuSections.update(sections => {
      const copy = [...sections];
      copy[index] = {
        ...copy[index],
        selectAll: checked,
        items: copy[index].items.map(item => ({ ...item, checked })),
      };
      return copy;
    });
  }

  toggleItem(sectionIndex: number, itemIndex: number, checked: boolean): void {
    this.menuSections.update(sections => {
      const copy = [...sections];
      const items = [...copy[sectionIndex].items];
      items[itemIndex] = { ...items[itemIndex], checked };
      const allChecked = items.every(i => i.checked);
      copy[sectionIndex] = { ...copy[sectionIndex], items, selectAll: allChecked };
      return copy;
    });
  }

  saveAllotment(): void {
    const userId = this.selectedUserId();
    const newRole = this.selectedRole();
    if (!userId) {
      this.notify.error('Please select a user first');
      return;
    }
    if (!newRole) {
      this.notify.error('Please assign a role');
      return;
    }

    const selectedMenus = this.menuSections()
      .flatMap(sec => sec.items.filter(i => i.checked).map(i => i.url));

    if (this.approval.requiresApproval()) {
      const user = this.users().find(u => u.id === userId);
      this.approval.submitForApproval({
        module: 'MenuAllotment',
        actionType: 'update',
        summary: `User: ${user?.name ?? userId} - Allotted ${selectedMenus.length} menus`,
        data: { id: userId, menus: selectedMenus, role: newRole },
        oldData: { id: userId, menus: this.permissions()[userId] ?? [] },
      }).subscribe({
        next: () => {
          this.notify.success('Menu allotment request sent for approval');
          this.closeModal();
          this.loadUsers();
        },
        error: (err) => this.notify.error(err?.message ?? 'Failed to submit request'),
      });
      return;
    }

    this.saving.set(true);
    this.api.put(`/settings/menus/${userId}`, {
      menuItems: selectedMenus.map(url => ({ menuUrl: url, granted: true })),
      role: newRole,
    }).subscribe({
      next: () => {
        this.notify.success('User role & access menus saved');
        this.permissions.update(p => ({ ...p, [userId]: selectedMenus }));
        this.closeModal();
        this.saving.set(false);
      },
      error: (err) => {
        this.notify.error(err?.message ?? 'Failed to save allotment');
        this.saving.set(false);
      },
    });
  }
}
