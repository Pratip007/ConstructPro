import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExportService } from '../../../core/services/export.service';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';

interface ApprovalLog {
  logId: string;
  timestamp: string;
  rawDate: string;
  source: string;
  module: string;
  requestedBy: string;
  action: string;
  status: string;
  remarks: string;
  newData: any;
  oldData: any;
  _backendId: number;
}

const SOURCE_MAP: Record<string, string> = {
  office: 'Office Portal',
  supervisor: 'Supervisor Portal',
  employee: 'Employee Portal',
};

const STATUS_MAP: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

@Component({
  selector: 'app-approval-logs',
  standalone: true,
  imports: [FormsModule, SummaryCardsComponent, ModalDialogComponent],
  templateUrl: './approval-logs.html',
  styleUrl: './approval-logs.scss',
})
export class ApprovalLogsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notifs = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  sourceFilter = signal('ALL');
  statusFilter = signal('ALL');
  moduleFilter = signal('');
  searchQuery = signal('');
  dateFrom = signal('');
  dateTo = signal('');

  logs = signal<ApprovalLog[]>([]);
  loading = signal(true);
  modules: string[] = [];

  showDetailModal = signal(false);
  selectedLog = signal<ApprovalLog | null>(null);

  get summaryCards(): SummaryCard[] {
    const all = this.logs();
    const pending = all.filter(l => l.status === 'Pending').length;
    const approved = all.filter(l => l.status === 'Approved').length;
    const rejected = all.filter(l => l.status === 'Rejected').length;
    return [
      { title: 'Total Logs', value: all.length, icon: 'ri-file-list-line', color: 'primary' },
      { title: 'Pending', value: pending, icon: 'ri-time-line', color: 'warning' },
      { title: 'Approved', value: approved, icon: 'ri-checkbox-circle-line', color: 'success' },
      { title: 'Rejected', value: rejected, icon: 'ri-close-circle-line', color: 'danger' },
    ];
  }

  ngOnInit(): void {
    this.api.get<any[]>('/approvals').subscribe({
      next: (data) => {
        const mapped = (data ?? []).map((r) => this.mapLog(r));
        this.logs.set(mapped);
        const mods = new Set<string>();
        mapped.forEach(l => { if (l.module) mods.add(l.module); });
        this.modules = [...mods].sort();
        this.loading.set(false);
      },
      error: () => {
        this.notifs.error('Failed to load approval logs');
        this.loading.set(false);
      },
    });
  }

  private mapLog(r: any): ApprovalLog {
    return {
      _backendId: r.id,
      logId: r.request_id ?? String(r.id),
      timestamp: r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '',
      rawDate: r.created_at ? r.created_at.split('T')[0] : '',
      source: SOURCE_MAP[r.source] ?? r.source ?? '',
      module: r.module ?? '',
      requestedBy: r.requested_by_name
        ? `${r.requested_by_name} (${r.requested_by_id ?? ''})`
        : '',
      action: [r.module, r.action].filter(Boolean).join(' -- '),
      status: STATUS_MAP[r.status] ?? r.status ?? '',
      remarks: r.remarks ?? '',
      newData: r.new_data ?? null,
      oldData: r.old_data ?? null,
    };
  }

  get filteredLogs(): ApprovalLog[] {
    const source = this.sourceFilter();
    const status = this.statusFilter();
    const mod = this.moduleFilter();
    const query = this.searchQuery().toLowerCase().trim();
    const from = this.dateFrom();
    const to = this.dateTo();

    return this.logs().filter((log) => {
      if (source !== 'ALL' && log.source !== source) return false;
      if (status !== 'ALL' && log.status !== status) return false;
      if (mod && log.module !== mod) return false;
      if (from && log.rawDate < from) return false;
      if (to && log.rawDate > to) return false;
      if (query) {
        const combined = `${log.logId} ${log.timestamp} ${log.source} ${log.requestedBy} ${log.action}`.toLowerCase();
        if (!combined.includes(query)) return false;
      }
      return true;
    });
  }

  viewDetail(log: ApprovalLog): void {
    this.selectedLog.set(log);
    this.showDetailModal.set(true);
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

  exportExcel(): void {
    this.exportService.exportToExcel(this.filteredLogs as any[], 'approval-logs', 'Approval Logs', [
      { key: 'logId', header: 'Log ID' },
      { key: 'timestamp', header: 'Date & Time' },
      { key: 'source', header: 'Source' },
      { key: 'module', header: 'Module' },
      { key: 'requestedBy', header: 'Requested By' },
      { key: 'action', header: 'Action' },
      { key: 'status', header: 'Status' },
      { key: 'remarks', header: 'Remarks' },
    ]);
  }

  printReport(): void {
    this.exportService.printReport('approval-logs-table', 'Approval Logs');
  }
}
