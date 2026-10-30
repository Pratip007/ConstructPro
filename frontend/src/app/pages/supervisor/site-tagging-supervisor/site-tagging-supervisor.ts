import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';

interface SupervisorTag {
  id: number;
  supervisor_id: number;
  supervisor_name?: string;
  from_site_id: number | null;
  from_site_name?: string;
  to_site_id: number;
  to_site_name?: string;
  tagged_at?: string;
  status?: string;
}

interface Supervisor { id: number; name: string; contact: string; }
interface Site { id: number; name: string; }

@Component({
  selector: 'app-site-tagging-supervisor',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, SearchableDropdownComponent, SummaryCardsComponent],
  templateUrl: './site-tagging-supervisor.html',
  styleUrl: './site-tagging-supervisor.scss',
})
export class SiteTaggingSupervisorComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  readonly role = inject(RoleService);
  readonly approval = inject(ApprovalService);
  private readonly confirm = inject(ConfirmDialogService);

  searchQuery = signal('');
  activeTab = signal<'active' | 'history'>('active');

  supervisors = signal<Supervisor[]>([]);
  sites = signal<Site[]>([]);
  tags = signal<SupervisorTag[]>([]);

  selectedSupervisorId = signal<string>('');
  selectedSiteId = signal<string>('');
  tagDate = signal(new Date().toISOString().split('T')[0]);

  loading = signal(false);
  saving = signal(false);

  supervisorItems = computed<DropdownItem[]>(() =>
    this.supervisors().map(s => ({ value: String(s.id), label: s.name }))
  );
  siteItems = computed<DropdownItem[]>(() =>
    this.sites().map(s => ({ value: String(s.id), label: s.name }))
  );

  currentAssignments = computed(() => {
    const supMap = new Map<number, SupervisorTag>();
    const sorted = [...this.tags()].sort((a, b) => {
      const aDate = a.tagged_at ? new Date(a.tagged_at).getTime() : 0;
      const bDate = b.tagged_at ? new Date(b.tagged_at).getTime() : 0;
      return bDate - aDate;
    });
    for (const tag of sorted) {
      if (!supMap.has(tag.supervisor_id)) {
        supMap.set(tag.supervisor_id, tag);
      }
    }
    return Array.from(supMap.values());
  });

  allHistory = computed(() => {
    const q = this.searchQuery().toLowerCase();
    let list = [...this.tags()].sort((a, b) => {
      const aDate = a.tagged_at ? new Date(a.tagged_at).getTime() : 0;
      const bDate = b.tagged_at ? new Date(b.tagged_at).getTime() : 0;
      return bDate - aDate;
    });
    if (q) {
      list = list.filter(t =>
        (t.supervisor_name ?? this.supervisorName(t.supervisor_id)).toLowerCase().includes(q) ||
        (t.to_site_name ?? this.siteName(t.to_site_id)).toLowerCase().includes(q)
      );
    }
    return list;
  });

  currentSiteAssignment = computed(() => {
    const supId = this.selectedSupervisorId();
    if (!supId) return null;
    return this.currentAssignments().find(t => String(t.supervisor_id) === supId) ?? null;
  });

  summaryCards = computed<SummaryCard[]>(() => {
    const uniqueSites = new Set(this.currentAssignments().map(t => t.to_site_id));
    return [
      { title: 'Active Tags', value: this.currentAssignments().length, icon: 'ri-user-location-line', color: 'success' },
      { title: 'Total Records', value: this.tags().length, icon: 'ri-file-list-3-line', color: 'primary' },
      { title: 'Sites Covered', value: uniqueSites.size, icon: 'ri-building-line', color: 'info' },
    ];
  });

  ngOnInit(): void {
    this.loadDropdowns();
    this.loadTags();
  }

  loadDropdowns(): void {
    this.api.get<Supervisor[]>('/supervisors').subscribe({
      next: data => this.supervisors.set(data),
      error: () => this.notify.error('Failed to load supervisors'),
    });
    this.api.get<Site[]>('/sites').subscribe({
      next: data => this.sites.set(data),
      error: () => this.notify.error('Failed to load sites'),
    });
  }

  loadTags(): void {
    this.loading.set(true);
    this.api.get<SupervisorTag[]>('/supervisor-site-tagging').subscribe({
      next: data => { this.tags.set(data); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load tagging records'); this.loading.set(false); },
    });
  }

  addTag(): void {
    if (!this.selectedSupervisorId() || !this.selectedSiteId()) {
      this.notify.error('Please select both a supervisor and a site');
      return;
    }
    const body = {
      supervisor_id: Number(this.selectedSupervisorId()),
      site_id: Number(this.selectedSiteId()),
      tagged_at: this.tagDate(),
    };

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'SiteTaggingSupervisor',
        actionType: 'create',
        summary: `Tag ${this.supervisorName(Number(this.selectedSupervisorId()))} to ${this.siteName(Number(this.selectedSiteId()))}`,
        data: body,
      }).subscribe({
        next: () => { this.notify.success('Tagging sent for approval'); this.resetForm(); },
        error: () => this.notify.error('Failed to submit for approval'),
      });
      return;
    }

    this.saving.set(true);
    this.api.post<SupervisorTag>('/supervisor-site-tagging', body).subscribe({
      next: created => {
        this.tags.update(list => [...list, created]);
        this.notify.success('Supervisor tagged to site');
        this.saving.set(false);
        this.resetForm();
      },
      error: () => { this.notify.error('Failed to tag supervisor'); this.saving.set(false); },
    });
  }

  supervisorName(id: number): string {
    return this.supervisors().find(s => s.id === id)?.name ?? String(id);
  }

  siteName(id: number | null): string {
    if (!id) return '-';
    return this.sites().find(s => s.id === id)?.name ?? String(id);
  }

  resetForm(): void {
    this.selectedSupervisorId.set('');
    this.selectedSiteId.set('');
    this.tagDate.set(new Date().toISOString().split('T')[0]);
  }
}
