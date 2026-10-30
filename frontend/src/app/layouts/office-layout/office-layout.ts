import { Component, signal, inject, HostListener, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { ApprovalService } from '../../core/services/approval.service';
import { ApiService } from '../../core/services/api.service';

interface MenuSection {
  id: string;
  label: string;
  icon: string;
  items: { label: string; icon: string; route: string }[];
}

@Component({
  selector: 'app-office-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './office-layout.html',
  styleUrl: './office-layout.scss',
})
export class OfficeLayoutComponent implements OnInit {
  sidebarHidden = signal(false);
  profileMenuOpen = signal(false);
  notifMenuOpen = signal(false);
  openTrees = signal<Set<string>>(new Set());
  readonly isMobile = signal(false);
  notifCount = signal(0);

  profileImage = signal(
    localStorage.getItem('atr_office_avatar') ||
      'https://ui-avatars.com/api/?name=Office+Staff&background=2b2b2b&color=ffc107'
  );

  menuSections = signal<MenuSection[]>([]);

  private readonly platformId = inject(PLATFORM_ID);
  private readonly api = inject(ApiService);
  private readonly approvals = inject(ApprovalService);

  constructor(
    public theme: ThemeService,
    public auth: AuthService
  ) {
    if (isPlatformBrowser(this.platformId) && window.innerWidth < 768) {
      this.sidebarHidden.set(true);
      this.isMobile.set(true);
    }
  }

  ngOnInit(): void {
    this.loadMenuSections();
    this.loadNotificationCount();
  }

  private loadMenuSections(): void {
    const userId = this.auth.currentUser()?.id;
    if (userId) {
      this.api.get<any>(`/settings/menus/${userId}`).subscribe({
        next: (allotment) => {
          const allottedSlugs: string[] = allotment?.menus ?? allotment ?? [];
          if (Array.isArray(allottedSlugs) && allottedSlugs.length > 0) {
            this.menuSections.set(this.allSections.filter(s => allottedSlugs.includes(s.id)));
          } else {
            this.menuSections.set(this.defaultSections);
          }
        },
        error: () => this.menuSections.set(this.defaultSections),
      });
    } else {
      this.menuSections.set(this.defaultSections);
    }
  }

  private loadNotificationCount(): void {
    this.approvals.getPendingCounts().subscribe({
      next: (counts) => this.notifCount.set(counts.total ?? (counts.office + counts.supervisor)),
      error: () => {},
    });
  }

  private readonly allSections: MenuSection[] = [
    { id: 'employee', label: 'Employee Section', icon: 'ri-team-line', items: [
      { label: 'Position Category', icon: 'ri-award-line', route: 'employee/employee-category' },
      { label: 'Employee Joining', icon: 'ri-user-received-line', route: 'employee/registered-employees' },
      { label: 'Site Tagging', icon: 'ri-map-pin-line', route: 'employee/site-tagging' },
      { label: 'Sub ID Create', icon: 'ri-id-card-line', route: 'employee/employee-sub-id' },
      { label: 'Payment List', icon: 'ri-receipt-line', route: 'employee/payment-list' },
      { label: 'Attendance', icon: 'ri-calendar-check-line', route: 'employee/employee-attendance' },
      { label: 'Site Leave Entry', icon: 'ri-door-open-line', route: 'employee/site-leave-entry' },
      { label: 'Employee Ledger', icon: 'ri-book-open-line', route: 'employee/employee-ledger' },
    ]},
    { id: 'contractor', label: 'Contractor Section', icon: 'ri-user-settings-line', items: [
      { label: 'Add Contractor', icon: 'ri-user-star-line', route: 'contractor/add-contractor' },
      { label: 'Site Order Entry', icon: 'ri-file-add-line', route: 'contractor/site-order-entry' },
      { label: 'Product Entry', icon: 'ri-grid-line', route: 'contractor/product-entry' },
      { label: 'Contractor Ledger', icon: 'ri-book-2-line', route: 'contractor/contractor-ledger' },
    ]},
    { id: 'mobilization', label: 'Mobilization Section', icon: 'ri-truck-line', items: [
      { label: 'Add Equipment', icon: 'ri-tools-line', route: 'mobilization/add-equipment' },
      { label: 'Site Order Equipment', icon: 'ri-file-list-2-line', route: 'mobilization/site-order-equipment' },
      { label: 'Equipment Leave', icon: 'ri-time-line', route: 'mobilization/equipment-leave' },
      { label: 'Site Tagging Equipment', icon: 'ri-map-pin-line', route: 'mobilization/site-tagging-equipment' },
    ]},
    { id: 'company', label: 'Company Section', icon: 'ri-building-line', items: [
      { label: 'Add Company', icon: 'ri-building-2-line', route: 'company/add-company' },
      { label: 'Balance Received', icon: 'ri-money-dollar-circle-line', route: 'company/balance-received' },
      { label: 'Company Ledger', icon: 'ri-line-chart-line', route: 'company/company-ledger' },
      { label: 'Company Loan Mgmt', icon: 'ri-bank-card-line', route: 'company/company-loan-management' },
      { label: 'Vehicle Management', icon: 'ri-car-line', route: 'company/vehicle-management' },
      { label: 'Income Expense', icon: 'ri-exchange-dollar-line', route: 'company/income-expense-entry' },
      { label: 'Bank Statement', icon: 'ri-file-chart-line', route: 'company/bank-statement' },
    ]},
    { id: 'purchase', label: 'Purchase Section', icon: 'ri-store-line', items: [
      { label: 'Add Retailer', icon: 'ri-store-2-line', route: 'purchase/add-retailer' },
      { label: 'Retail Site Invoice', icon: 'ri-receipt-line', route: 'purchase/retail-site-invoice' },
      { label: 'GST Report', icon: 'ri-line-chart-line', route: 'purchase/gst-report' },
      { label: 'Non GST Report', icon: 'ri-bar-chart-line', route: 'purchase/non-gst-report' },
      { label: 'Retail Ledger', icon: 'ri-book-open-line', route: 'purchase/retail-ledger' },
    ]},
    { id: 'payment', label: 'Payment Section', icon: 'ri-send-plane-line', items: [
      { label: 'All Type Payment', icon: 'ri-money-cny-circle-line', route: 'payment/all-type-payment' },
    ]},
    { id: 'sales', label: 'Sales Section', icon: 'ri-shopping-bag-line', items: [
      { label: 'Purchase Order Entry', icon: 'ri-file-paper-2-line', route: 'sales/purchase-order-entry' },
      { label: 'Invoice Entry', icon: 'ri-bill-line', route: 'sales/invoice-entry' },
      { label: 'Site Management', icon: 'ri-map-pin-line', route: 'sales/view-site' },
    ]},
    { id: 'supervisor', label: 'Supervisor Section', icon: 'ri-shield-user-line', items: [
      { label: 'Add Supervisor', icon: 'ri-user-add-line', route: 'supervisor/add-supervisor' },
      { label: 'Site Tagging Supervisor', icon: 'ri-map-pin-2-line', route: 'supervisor/site-tagging-supervisor' },
      { label: 'Supervisor Ledger', icon: 'ri-book-line', route: 'supervisor/supervisor-ledger' },
    ]},
    { id: 'stock', label: 'Stock Management', icon: 'ri-stack-line', items: [
      { label: 'Add / View Stock', icon: 'ri-search-eye-line', route: 'stock/stock-view' },
      { label: 'Current Stock', icon: 'ri-archive-line', route: 'stock/current-stock' },
      { label: 'Stock Transfer', icon: 'ri-arrow-left-right-line', route: 'stock/stock-transfer' },
      { label: 'Stock Report', icon: 'ri-clipboard-line', route: 'stock/stock-report' },
    ]},
    { id: 'report', label: 'Report Section', icon: 'ri-bar-chart-box-line', items: [
      { label: 'Employee Report', icon: 'ri-group-line', route: 'reports/employee-report' },
      { label: 'Contractor Report', icon: 'ri-user-star-line', route: 'reports/contractor-report' },
      { label: 'Company Report', icon: 'ri-building-line', route: 'reports/company-report' },
      { label: 'Purchase Report', icon: 'ri-shopping-bag-3-line', route: 'reports/purchase-report' },
      { label: 'Full Site Ledger', icon: 'ri-pie-chart-2-line', route: 'reports/full-site-ledger' },
    ]},
    { id: 'doc', label: 'Company Document', icon: 'ri-folder-open-line', items: [
      { label: 'Create Doc List', icon: 'ri-folder-add-line', route: 'documents/create-doc-list' },
      { label: 'Company Full Backup', icon: 'ri-save-line', route: 'documents/backup' },
    ]},
  ];

  private readonly defaultSections = this.allSections.filter(s =>
    ['employee', 'contractor', 'purchase', 'payment', 'supervisor'].includes(s.id)
  );

  toggleSidebar(): void {
    this.sidebarHidden.update((v) => !v);
  }

  toggleProfileMenu(event: Event): void {
    event.stopPropagation();
    this.notifMenuOpen.set(false);
    this.profileMenuOpen.update((v) => !v);
  }

  toggleNotification(event: Event): void {
    event.stopPropagation();
    this.profileMenuOpen.set(false);
    this.notifMenuOpen.update((v) => !v);
  }

  closeDropdowns(): void {
    this.profileMenuOpen.set(false);
    this.notifMenuOpen.set(false);
  }

  toggleTree(treeId: string): void {
    this.openTrees.update((trees) => {
      const next = new Set(trees);
      if (next.has(treeId)) {
        next.delete(treeId);
      } else {
        next.add(treeId);
      }
      return next;
    });
  }

  isTreeOpen(treeId: string): boolean {
    return this.openTrees().has(treeId);
  }

  onProfileImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      this.profileImage.set(result);
      try { localStorage.setItem('atr_office_avatar', result); } catch {}
    };
    reader.readAsDataURL(input.files[0]);
  }

  logout(): void {
    this.auth.logout();
  }

  @HostListener('window:resize')
  onResize(): void {
    const mobile = window.innerWidth < 768;
    this.isMobile.set(mobile);
    if (mobile && !this.sidebarHidden()) {
      this.sidebarHidden.set(true);
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeDropdowns();
  }
}
