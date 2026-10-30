import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';

interface SupervisorRequest {
  id: string;
  site: string;
  module: string;
  action: string;
  actionType: string;
  summary: string;
  requestedAt: string;
  status: string;
  newData: any;
  oldData: any;
  adminRemarks: string;
  _backendId: number;
}

@Component({
  selector: 'app-approve-supervisor',
  standalone: true,
  imports: [FormsModule, SummaryCardsComponent, ModalDialogComponent],
  templateUrl: './approve-supervisor.html',
  styleUrl: './approve-supervisor.scss',
})
export class ApproveSupervisorComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notifs = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  requests = signal<SupervisorRequest[]>([]);
  allRequests = signal<SupervisorRequest[]>([]);
  loading = signal(true);
  activeTab = signal<'pending' | 'history'>('pending');
  statusFilter = signal('pending');
  searchFilter = signal('');
  siteFilter = signal('');
  actionFilter = signal('');

  showDetailModal = signal(false);
  showDecisionModal = signal(false);
  selectedRequest = signal<SupervisorRequest | null>(null);
  decisionType = signal<'approve' | 'reject'>('approve');
  decisionRemarks = signal('');

  get summaryCards(): SummaryCard[] {
    const all = this.allRequests();
    const pending = all.filter(r => r.status === 'Pending').length;
    const approved = all.filter(r => r.status === 'Approved').length;
    const rejected = all.filter(r => r.status === 'Rejected').length;
    return [
      { title: 'Total Requests', value: all.length, icon: 'ri-file-list-line', color: 'primary' },
      { title: 'Pending', value: pending, icon: 'ri-time-line', color: pending > 0 ? 'warning' : 'success' },
      { title: 'Approved', value: approved, icon: 'ri-checkbox-circle-line', color: 'success' },
      { title: 'Rejected', value: rejected, icon: 'ri-close-circle-line', color: 'danger' },
    ];
  }

  get filteredRequests(): SupervisorRequest[] {
    let list = this.requests();
    const q = this.searchFilter().toLowerCase();
    const site = this.siteFilter();
    const action = this.actionFilter();
    if (q) list = list.filter(r =>
      r.module.toLowerCase().includes(q) || r.action.toLowerCase().includes(q) ||
      r.site.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
    );
    if (site) list = list.filter(r => r.site === site);
    if (action) list = list.filter(r => r.actionType === action);
    return list;
  }

  get uniqueSites(): string[] {
    return [...new Set(this.allRequests().map(r => r.site).filter(Boolean))];
  }

  get uniqueActions(): string[] {
    return [...new Set(this.allRequests().map(r => r.actionType).filter(Boolean))];
  }

  ngOnInit(): void {
    this.loadRequests();
  }

  switchTab(tab: 'pending' | 'history'): void {
    this.activeTab.set(tab);
    this.statusFilter.set(tab === 'pending' ? 'pending' : 'all');
    this.loadRequests();
  }

  loadRequests(): void {
    this.loading.set(true);
    const params: Record<string, string> = { source: 'supervisor' };
    const status = this.statusFilter();
    if (status !== 'all') params['status'] = status;

    this.api.get<any[]>('/approvals', params).subscribe({
      next: data => {
        const mapped = (data ?? []).map(r => this.mapRequest(r));
        this.allRequests.set(mapped);
        this.requests.set(mapped);
        this.loading.set(false);
      },
      error: () => { this.notifs.error('Failed to load requests'); this.loading.set(false); },
    });
  }

  private mapRequest(r: any): SupervisorRequest {
    return {
      _backendId: r.id,
      id: r.request_id ?? String(r.id),
      site: r.site_name ?? r.site ?? '',
      module: r.module ?? '',
      action: [r.action, r.summary].filter(Boolean).join(' - '),
      actionType: r.action ?? '',
      summary: r.summary ?? r.details ?? '',
      requestedAt: r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '',
      status: this.mapStatus(r.status),
      newData: r.new_data ?? null,
      oldData: r.old_data ?? null,
      adminRemarks: r.remarks ?? '',
    };
  }

  private mapStatus(status: string): string {
    const map: Record<string, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
    return map[status] ?? status ?? '';
  }

  viewDetails(req: SupervisorRequest): void {
    this.selectedRequest.set(req);
    this.showDetailModal.set(true);
  }

  openDecision(req: SupervisorRequest, type: 'approve' | 'reject'): void {
    this.selectedRequest.set(req);
    this.decisionType.set(type);
    this.decisionRemarks.set('');
    this.showDecisionModal.set(true);
  }

  submitDecision(): void {
    const req = this.selectedRequest();
    if (!req) return;
    if (this.decisionType() === 'reject' && !this.decisionRemarks().trim()) {
      this.notifs.error('Remarks required for rejection');
      return;
    }
    const endpoint = this.decisionType() === 'approve' ? 'approve' : 'reject';
    this.api.put<any>(`/approvals/${req._backendId}/${endpoint}`, { remarks: this.decisionRemarks() }).subscribe({
      next: () => {
        this.notifs.success(`Request ${endpoint}d`);
        this.showDecisionModal.set(false);
        this.loadRequests();
      },
      error: () => this.notifs.error(`Failed to ${endpoint} request`),
    });
  }

  objectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'Pending': return 'badge-warning';
      case 'Approved': return 'badge-success';
      case 'Rejected': return 'badge-danger';
      default: return 'badge-info';
    }
  }

  actionBadgeClass(action: string): string {
    switch (action?.toLowerCase()) {
      case 'create': return 'badge-success';
      case 'update': return 'badge-info';
      case 'delete': return 'badge-danger';
      default: return 'badge-info';
    }
  }

  exportToExcel(): void {
    this.exportService.exportToExcel(
      this.filteredRequests.map(r => ({
        id: r.id, site: r.site, module: r.module, action: r.action,
        date: r.requestedAt, status: r.status, remarks: r.adminRemarks,
      })) as any[],
      'supervisor-approvals', 'Supervisor Approvals'
    );
  }
}
