import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface RecentActivity {
  id: string;
  module: string;
  action: string;
  timestamp: string;
  requestedBy: string;
  status: string;
}

@Component({
  selector: 'app-office-dashboard-home',
  standalone: true,
  imports: [FormsModule, RouterLink, SummaryCardsComponent],
  templateUrl: './office-dashboard-home.html',
  styleUrl: './office-dashboard-home.scss',
})
export class OfficeDashboardHomeComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly notifs = inject(NotificationService);

  kpiCards = signal<SummaryCard[]>([]);
  recentActivity = signal<RecentActivity[]>([]);
  loading = signal(true);

  readonly currentUser = this.auth.currentUser;

  readonly quickActions = [
    { label: 'Employee Joining', icon: 'ri-user-add-line', route: '/office/employee/registered-employees', color: '#4a7fc1' },
    { label: 'Site Tagging', icon: 'ri-map-pin-line', route: '/office/employee/site-tagging', color: '#28a745' },
    { label: 'Contractor Order', icon: 'ri-file-add-line', route: '/office/contractor/site-order-entry', color: '#ffc107' },
    { label: 'Invoice Entry', icon: 'ri-bill-line', route: '/office/purchase/retail-site-invoice', color: '#e74c3c' },
    { label: 'Retail Purchase', icon: 'ri-store-2-line', route: '/office/purchase/add-retailer', color: '#9b59b6' },
    { label: 'Attendance', icon: 'ri-calendar-check-line', route: '/office/employee/employee-attendance', color: '#17a2b8' },
    { label: 'Payment List', icon: 'ri-receipt-line', route: '/office/employee/payment-list', color: '#fd7e14' },
    { label: 'Stock View', icon: 'ri-stack-line', route: '/office/contractor/product-entry', color: '#20c997' },
  ];

  readonly quickLinks = [
    { label: 'Approve Office', icon: 'ri-checkbox-circle-line', route: '/admin/approval/approve-office' },
    { label: 'Approve Supervisor', icon: 'ri-shield-check-line', route: '/admin/approval/approve-supervisor' },
    { label: 'Invoice Entry', icon: 'ri-file-text-line', route: '/admin/company/invoice-entry' },
    { label: 'Payment View', icon: 'ri-money-dollar-circle-line', route: '/admin/company/payment-view' },
    { label: 'Employee Report', icon: 'ri-group-line', route: '/admin/reports/employee-report' },
    { label: 'New User', icon: 'ri-user-add-line', route: '/admin/master/new-user-entry' },
  ];

  ngOnInit(): void {
    this.loadPendingCounts();
    this.loadRecentActivity();
  }

  loadPendingCounts(): void {
    this.api.get<any>('/approvals/pending-counts').subscribe({
      next: (counts) => {
        this.kpiCards.set([
          { title: 'Office Pending Approvals', value: counts.office ?? 0, icon: 'ri-time-line', color: 'warning' },
          { title: 'Supervisor Pending', value: counts.supervisor ?? 0, icon: 'ri-shield-check-line', color: 'success' },
          { title: 'Loan Pending', value: counts.loans ?? 0, icon: 'ri-bank-line', color: 'info' },
          { title: 'Total Pending', value: (counts.office ?? 0) + (counts.supervisor ?? 0) + (counts.loans ?? 0), icon: 'ri-notification-3-line', color: 'danger' },
        ]);
        this.loading.set(false);
      },
      error: () => {
        this.notifs.error('Failed to load pending approval counts');
        this.loading.set(false);
      },
    });
  }

  loadRecentActivity(): void {
    this.api.get<any[]>('/approvals', { status: 'all' }).subscribe({
      next: (data) => {
        const items = (data ?? []).slice(0, 10).map(r => ({
          id: r.request_id ?? String(r.id),
          module: r.module ?? '',
          action: r.action ?? '',
          timestamp: r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '',
          requestedBy: r.requested_by_name ?? '',
          status: r.status ?? '',
        }));
        this.recentActivity.set(items);
      },
      error: () => {},
    });
  }
}
