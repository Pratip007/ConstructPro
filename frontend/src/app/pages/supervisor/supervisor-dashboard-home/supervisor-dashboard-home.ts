import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface PendingAction {
  id: string;
  label: string;
  icon: string;
  route: string;
  count: number;
}

@Component({
  selector: 'app-supervisor-dashboard-home',
  standalone: true,
  imports: [FormsModule, RouterLink, SummaryCardsComponent],
  templateUrl: './supervisor-dashboard-home.html',
  styleUrl: './supervisor-dashboard-home.scss',
})
export class SupervisorDashboardHomeComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly notifs = inject(NotificationService);

  employeeCount = signal(0);
  siteName = signal('');
  siteLocation = signal('');
  todayPresent = signal(0);
  todayAbsent = signal(0);
  loading = signal(true);

  kpiCards = signal<SummaryCard[]>([]);
  pendingActions = signal<PendingAction[]>([]);

  readonly currentUser = this.auth.currentUser;

  readonly quickActions = [
    { label: 'Mark Attendance', icon: 'ri-calendar-check-line', route: '/supervisor/employee/employee-attendance', color: '#4a7fc1' },
    { label: 'Retail Invoice', icon: 'ri-receipt-line', route: '/supervisor/purchase/retail-site-invoice', color: '#28a745' },
    { label: 'Stock Request', icon: 'ri-stack-line', route: '/supervisor/payment/all-type-payment', color: '#ffc107' },
    { label: 'Site Leave Entry', icon: 'ri-calendar-close-line', route: '/supervisor/employee/site-leave-entry', color: '#e74c3c' },
    { label: 'Employee Ledger', icon: 'ri-book-open-line', route: '/supervisor/employee/employee-ledger', color: '#9b59b6' },
    { label: 'Supervisor Ledger', icon: 'ri-book-line', route: '/supervisor/supervisor/supervisor-ledger', color: '#17a2b8' },
  ];

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (user?.siteId != null) {
      this.loadSiteInfo(String(user.siteId));
      this.loadEmployees(String(user.siteId));
      this.loadAttendanceSummary(String(user.siteId));
      this.loadPendingActions();
    } else {
      this.loading.set(false);
    }
  }

  private loadSiteInfo(siteId: string): void {
    this.api.get<any[]>('/sites').subscribe({
      next: (sites) => {
        const site = (sites ?? []).find((s: any) => String(s.id) === siteId);
        if (site) {
          this.siteName.set(site.name ?? `Site #${siteId}`);
          this.siteLocation.set(site.address ?? site.location ?? '');
        } else {
          this.siteName.set(`Site #${siteId}`);
        }
      },
      error: () => this.siteName.set(`Site #${siteId}`),
    });
  }

  private loadEmployees(siteId: string): void {
    this.api.get<any[]>('/employees', { site_id: siteId }).subscribe({
      next: (employees) => {
        this.employeeCount.set((employees ?? []).length);
        this.loading.set(false);
        this.updateKpiCards();
      },
      error: () => {
        this.notifs.error('Failed to load employee data for site');
        this.loading.set(false);
      },
    });
  }

  private loadAttendanceSummary(siteId: string): void {
    const today = new Date().toISOString().split('T')[0];
    this.api.get<any[]>('/attendance', { site_id: siteId, date: today }).subscribe({
      next: (records) => {
        const list = Array.isArray(records) ? records : [];
        this.todayPresent.set(list.filter(r => r.status === 'present' || r.status === 'P').length);
        this.todayAbsent.set(list.filter(r => r.status === 'absent' || r.status === 'A').length);
        this.updateKpiCards();
      },
      error: () => {},
    });
  }

  private loadPendingActions(): void {
    this.api.get<any[]>('/approvals', { status: 'pending', source: 'supervisor' }).subscribe({
      next: (data) => {
        const count = (data ?? []).length;
        const actions: PendingAction[] = [];
        if (count > 0) {
          actions.push({
            id: 'pending-approvals',
            label: 'Pending Approval Requests',
            icon: 'ri-time-line',
            route: '/supervisor/supervisor/supervisor-ledger',
            count,
          });
        }
        this.pendingActions.set(actions);
      },
      error: () => {},
    });
  }

  private updateKpiCards(): void {
    this.kpiCards.set([
      { title: 'Employees at Site', value: this.employeeCount(), icon: 'ri-team-line', color: 'primary' },
      { title: 'Today Present', value: this.todayPresent(), icon: 'ri-checkbox-circle-line', color: 'success' },
      { title: 'Today Absent', value: this.todayAbsent(), icon: 'ri-close-circle-line', color: 'danger' },
      {
        title: 'Attendance Rate',
        value: this.employeeCount() > 0
          ? Math.round((this.todayPresent() / this.employeeCount()) * 100)
          : 0,
        suffix: '%',
        icon: 'ri-pie-chart-line',
        color: 'info',
      },
    ]);
  }
}
