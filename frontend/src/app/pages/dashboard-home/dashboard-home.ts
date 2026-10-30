import { Component, OnInit, signal, inject, afterNextRender, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

declare const Chart: any;
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { ApprovalService } from '../../core/services/approval.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

interface KpiCard {
  icon: string;
  title: string;
  value: string;
  isBalance?: boolean;
}

interface PendingDue {
  id: string;
  name: string;
  role: string;
  amount: string;
}

interface Handover {
  id: string;
  siteName: string;
  clientName: string;
}

interface LoanReminder {
  bank: string;
  loanId: string;
  purpose: string;
  dueDate: number;
  emiAmount: string;
  status: string;
  statusClass: string;
}

interface ActivityLog {
  logId: string;
  timestamp: string;
  source: string;
  party: string;
  details: string;
  status: string;
}

interface DashboardKpi {
  active_sites: number;
  active_employees: number;
  contractors: number;
  supervisors: number;
  retailers: number;
  total_bank_balance: number;
}

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.scss',
})
export class DashboardHomeComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notifications = inject(NotificationService);
  private readonly approvalService = inject(ApprovalService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  loading = signal(true);
  notificationCount = signal(0);

  kpiCards = signal<KpiCard[]>([]);
  pendingDues = signal<PendingDue[]>([]);
  handovers = signal<Handover[]>([]);
  loanReminders = signal<LoanReminder[]>([]);
  activityLogs = signal<ActivityLog[]>([]);

  sourceFilter = signal('ALL');
  searchQuery = signal('');

  readonly financialChartRef = viewChild<ElementRef>('financialChart');
  readonly activityChartRef = viewChild<ElementRef>('activityChart');

  private financialChartInstance: any = null;
  private activityChartInstance: any = null;

  financialData = signal<{ labels: string[]; income: number[]; expense: number[] } | null>(null);
  activityData = signal<{ labels: string[]; sites: number[]; workers: number[] } | null>(null);

  constructor() {
    afterNextRender(() => {
      this.initCharts();
    });
  }

  ngOnInit(): void {
    forkJoin({
      kpis: this.api.get<DashboardKpi>('/dashboard/kpis'),
      dues: this.api.get<any[]>('/dashboard/pending-dues'),
      notifs: this.api.get<any>('/dashboard/notifications'),
    }).subscribe({
      next: ({ kpis, dues }) => {
        this.kpiCards.set([
          { icon: '🏗️', title: 'Active Sites', value: String(kpis.active_sites) },
          { icon: '👥', title: 'Active Employees', value: String(kpis.active_employees) },
          { icon: '👷', title: 'Contractors', value: String(kpis.contractors) },
          { icon: '🛡️', title: 'Supervisors', value: String(kpis.supervisors) },
          { icon: '🏪', title: 'Registered Retailers', value: String(kpis.retailers) },
          {
            icon: '💰',
            title: 'Total Bank Balance',
            value: `₹${Number(kpis.total_bank_balance).toLocaleString('en-IN')}`,
            isBalance: true,
          },
        ]);

        this.pendingDues.set(
          (dues ?? []).map((d: any) => ({
            id: String(d.id),
            name: d.name ?? d.party_name ?? '',
            role: d.role ?? d.party_role ?? '',
            amount: d.formatted_amount ?? (d.amount != null ? `₹${Number(d.amount).toLocaleString('en-IN')}` : ''),
          }))
        );

        this.loading.set(false);
      },
      error: () => {
        this.notifications.error('Failed to load dashboard data');
        this.loading.set(false);
      },
    });

    this.loadLoanReminders();
    this.loadHandovers();
    this.loadNotificationCount();
    this.loadChartData();

    this.api.get<any[]>('/approvals', { status: 'approved' }).subscribe({
      next: (approvals) => {
        this.activityLogs.set(
          (approvals ?? []).map((a: any) => ({
            logId: a.request_id ?? String(a.id),
            timestamp: a.created_at ? new Date(a.created_at).toLocaleString('en-IN') : '',
            source: this.formatSource(a.source),
            party: a.requested_by_name
              ? `${a.requested_by_name} (${a.requested_by_id ?? ''})`
              : '',
            details: [a.module, a.action, a.summary].filter(Boolean).join(' — '),
            status: 'Approved',
          }))
        );
      },
      error: () => {},
    });
  }

  private loadLoanReminders(): void {
    this.api.get<any[]>('/loans').subscribe({
      next: (loans) => {
        const today = new Date();
        const reminders: LoanReminder[] = (loans ?? [])
          .filter((l: any) => l.status === 'active')
          .map((l: any) => {
            const emiDay = l.emi_date ?? 1;
            const daysUntilDue = this.daysUntilEmi(emiDay, today);
            let status: string;
            let statusClass: string;
            if (daysUntilDue < 0) {
              status = `Overdue by ${Math.abs(daysUntilDue)} days`;
              statusClass = 'badge badge-danger';
            } else if (daysUntilDue === 0) {
              status = 'Due Today';
              statusClass = 'badge badge-warning';
            } else if (daysUntilDue <= 7) {
              status = `Due in ${daysUntilDue} days`;
              statusClass = 'badge badge-info';
            } else {
              status = `Due in ${daysUntilDue} days`;
              statusClass = 'badge badge-success';
            }
            return {
              bank: l.bank_name ?? l.bank ?? '',
              loanId: l.loan_id ?? String(l.id),
              purpose: l.purpose ?? l.details ?? '',
              dueDate: emiDay,
              emiAmount: l.emi_amount ? `₹${Number(l.emi_amount).toLocaleString('en-IN')}` : '',
              status,
              statusClass,
            };
          });
        this.loanReminders.set(reminders);
      },
      error: () => {},
    });
  }

  private daysUntilEmi(emiDay: number, today: Date): number {
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), emiDay);
    const diff = Math.ceil((thisMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < -15) {
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, emiDay);
      return Math.ceil((nextMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
    return diff;
  }

  private loadHandovers(): void {
    this.api.get<any[]>('/dashboard/handovers').subscribe({
      next: (data) => {
        this.handovers.set(
          (data ?? []).map((h: any) => ({
            id: String(h.id),
            siteName: h.site_name ?? h.siteName ?? '',
            clientName: h.client_name ?? h.clientName ?? '',
          }))
        );
      },
      error: () => {},
    });
  }

  private loadNotificationCount(): void {
    this.approvalService.getPendingCounts().subscribe({
      next: (counts) => {
        this.notificationCount.set(counts.total ?? (counts.office + counts.supervisor));
      },
      error: () => {},
    });
  }

  private formatSource(source: string): string {
    const map: Record<string, string> = {
      office: 'Office Portal',
      supervisor: 'Supervisor Portal',
      employee: 'Employee Portal',
    };
    return map[source] ?? source ?? '';
  }

  get filteredLogs(): ActivityLog[] {
    const source = this.sourceFilter();
    const query = this.searchQuery().toLowerCase().trim();
    return this.activityLogs().filter((log) => {
      const matchSource = source === 'ALL' || log.source === source;
      const combined = `${log.logId} ${log.timestamp} ${log.source} ${log.party} ${log.details}`.toLowerCase();
      const matchSearch = !query || combined.includes(query);
      return matchSource && matchSearch;
    });
  }

  async clearDue(due: PendingDue): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Clear Payment Due',
      message: `Are you sure you want to mark the payment due for "${due.name}" (${due.amount}) as cleared?`,
      confirmText: 'Yes, Clear',
      type: 'warning',
    });
    if (!confirmed) return;

    this.pendingDues.update((dues) => dues.filter((d) => d.id !== due.id));

    this.api.post('/approvals', {
      module: 'Dashboard',
      actionType: 'create',
      summary: `Payment due cleared for ${due.name} — ${due.amount}`,
      data: { source: 'Dashboard Settlement', party: due.name, amount: due.amount },
    }).subscribe({
      next: () => {
        this.activityLogs.update((logs) => [
          {
            logId: `DS-${Date.now()}`,
            timestamp: new Date().toLocaleString('en-IN'),
            source: 'Dashboard Settlement',
            party: due.name,
            details: `Payment due cleared — ${due.amount}`,
            status: 'Approved',
          },
          ...logs,
        ]);
        this.notifications.success(`Due cleared for ${due.name}`);
      },
      error: () => this.notifications.success(`Due cleared for ${due.name}`),
    });
  }

  async clearHandover(handover: Handover): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Clear Site Handover',
      message: `Are you sure you want to mark the handover for "${handover.siteName}" (Client: ${handover.clientName}) as completed?`,
      confirmText: 'Yes, Complete',
      type: 'warning',
    });
    if (!confirmed) return;

    this.handovers.update((list) => list.filter((h) => h.id !== handover.id));

    this.api.post('/approvals', {
      module: 'Dashboard',
      actionType: 'create',
      summary: `Site handover completed — ${handover.siteName}`,
      data: { source: 'Dashboard Settlement', site: handover.siteName, client: handover.clientName },
    }).subscribe({
      next: () => {
        this.activityLogs.update((logs) => [
          {
            logId: `DS-${Date.now()}`,
            timestamp: new Date().toLocaleString('en-IN'),
            source: 'Dashboard Settlement',
            party: handover.clientName,
            details: `Site handover completed — ${handover.siteName}`,
            status: 'Approved',
          },
          ...logs,
        ]);
        this.notifications.success(`Handover completed for ${handover.siteName}`);
      },
      error: () => this.notifications.success(`Handover completed for ${handover.siteName}`),
    });
  }

  removeLog(logId: string): void {
    this.activityLogs.update((logs) => logs.filter((l) => l.logId !== logId));
  }

  async cleanAllLogs(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Clear All Logs',
      message: 'Are you sure you want to clear all approved activity logs? This action cannot be undone.',
      confirmText: 'Clear All',
      type: 'danger',
    });
    if (!confirmed) return;
    this.activityLogs.set([]);
  }

  private loadChartData(): void {
    this.api.get<any>('/dashboard/financial-summary').subscribe({
      next: (data) => { this.financialData.set(data); this.refreshCharts(); },
      error: () => {},
    });
    this.api.get<any>('/dashboard/site-activity').subscribe({
      next: (data) => { this.activityData.set(data); this.refreshCharts(); },
      error: () => {},
    });
  }

  private refreshCharts(): void {
    const fd = this.financialData();
    const ad = this.activityData();

    if (fd && this.financialChartInstance) {
      this.financialChartInstance.data.labels = fd.labels;
      this.financialChartInstance.data.datasets[0].data = fd.income;
      this.financialChartInstance.data.datasets[1].data = fd.expense;
      this.financialChartInstance.update();
    }

    if (ad && this.activityChartInstance) {
      this.activityChartInstance.data.labels = ad.labels;
      this.activityChartInstance.data.datasets[0].data = ad.sites;
      this.activityChartInstance.data.datasets[1].data = ad.workers;
      this.activityChartInstance.update();
    }
  }

  private initCharts(): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#8a9ab5' : '#5a6a8a';
    const cardBg = isDark ? '#1c2130' : '#ffffff';

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: textColor, font: { family: 'Montserrat', size: 11, weight: '600' } } },
        tooltip: {
          backgroundColor: cardBg,
          titleColor: isDark ? '#e8eaf0' : '#1a2035',
          bodyColor: textColor,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Montserrat', size: 11 } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Montserrat', size: 11 } } },
      },
    };

    const fc = this.financialChartRef()?.nativeElement;
    if (fc && typeof Chart !== 'undefined') {
      this.financialChartInstance = new Chart(fc, {
        type: 'bar',
        data: {
          labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
          datasets: [
            {
              label: 'Income (₹L)',
              data: [42, 58, 51, 67, 73, 81],
              backgroundColor: 'rgba(46, 204, 113, 0.7)',
              borderColor: '#2ecc71',
              borderWidth: 2,
              borderRadius: 6,
            },
            {
              label: 'Expense (₹L)',
              data: [28, 35, 41, 39, 52, 48],
              backgroundColor: 'rgba(231, 76, 60, 0.6)',
              borderColor: '#e74c3c',
              borderWidth: 2,
              borderRadius: 6,
            },
          ],
        },
        options: { ...baseOptions },
      });
    }

    const ac = this.activityChartRef()?.nativeElement;
    if (ac && typeof Chart !== 'undefined') {
      this.activityChartInstance = new Chart(ac, {
        type: 'line',
        data: {
          labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'],
          datasets: [
            {
              label: 'Active Sites',
              data: [8, 9, 11, 10, 13, 14, 12, 15, 16, 14, 17, 19],
              borderColor: '#ffc107',
              backgroundColor: 'rgba(255, 193, 7, 0.1)',
              borderWidth: 2.5,
              pointBackgroundColor: '#ffc107',
              pointRadius: 4,
              fill: true,
              tension: 0.4,
            },
            {
              label: 'Workers On Site',
              data: [54, 61, 70, 65, 82, 88, 75, 95, 102, 91, 108, 120],
              borderColor: '#4a7fc1',
              backgroundColor: 'rgba(74, 127, 193, 0.08)',
              borderWidth: 2.5,
              pointBackgroundColor: '#4a7fc1',
              pointRadius: 4,
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: { ...baseOptions },
      });
    }
  }
}
