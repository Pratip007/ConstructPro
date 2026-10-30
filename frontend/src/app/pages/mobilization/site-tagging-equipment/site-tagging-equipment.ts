import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { ModalDialogComponent } from '../../../shared/modal-dialog/modal-dialog.component';

interface EquipmentAssignment {
  id: string;
  equipment_id: string;
  equipment_name?: string;
  site_id: string;
  site_name?: string;
  start_date: string;
  end_date: string;
  released_date: string | null;
  rate: number;
  rate_unit: string;
  purpose: string;
  status: string;
  condition?: string;
  pending_status?: string | null;
}

interface Equipment { id: string; name: string; }
interface Site { id: string; name: string; }

@Component({
  selector: 'app-site-tagging-equipment',
  standalone: true,
  imports: [FormsModule, SearchableDropdownComponent, SummaryCardsComponent, ModalDialogComponent, TitleCasePipe],
  templateUrl: './site-tagging-equipment.html',
  styleUrl: './site-tagging-equipment.scss',
})
export class SiteTaggingEquipmentComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotificationService);
  readonly role = inject(RoleService);
  private approval = inject(ApprovalService);
  private confirm = inject(ConfirmDialogService);

  loading = signal(false);
  assignments = signal<EquipmentAssignment[]>([]);
  equipmentOptions = signal<Equipment[]>([]);
  siteOptions = signal<Site[]>([]);

  filterSite = signal('');
  filterEquipment = signal('');
  activeTab = signal<'active' | 'released'>('active');

  reassigningId = signal<string | null>(null);
  reassigningSiteId = signal<string>('');

  showReleaseModal = signal(false);
  releaseTarget = signal<EquipmentAssignment | null>(null);
  releaseDate = signal('');
  releaseCondition = signal('Good');
  releaseRemarks = signal('');

  activeAssignments = computed(() =>
    this.assignments().filter(a => a.status !== 'released')
  );
  completedAssignments = computed(() =>
    this.assignments().filter(a => a.status === 'released')
  );

  equipmentItems = computed<DropdownItem[]>(() =>
    this.equipmentOptions().map(e => ({ value: e.id, label: e.name }))
  );
  siteItems = computed<DropdownItem[]>(() =>
    this.siteOptions().map(s => ({ value: s.id, label: s.name }))
  );

  summaryCards = computed<SummaryCard[]>(() => [
    { title: 'Active', value: this.activeAssignments().length, icon: 'ri-check-line', color: 'success' },
    { title: 'Released', value: this.completedAssignments().length, icon: 'ri-logout-box-line', color: 'info' },
    { title: 'Total Equipment', value: this.equipmentOptions().length, icon: 'ri-truck-line', color: 'primary' },
  ]);

  ngOnInit(): void {
    this.api.get<Equipment[]>('/equipment').subscribe({
      next: data => this.equipmentOptions.set(data),
      error: () => this.notify.error('Failed to load equipment'),
    });
    this.api.get<Site[]>('/sites').subscribe({
      next: data => this.siteOptions.set(data),
      error: () => this.notify.error('Failed to load sites'),
    });
    this.loadAssignments();
  }

  loadAssignments(): void {
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (this.filterSite()) params['site_id'] = this.filterSite();
    if (this.filterEquipment()) params['equipment_id'] = this.filterEquipment();
    this.api.get<EquipmentAssignment[]>('/equipment-site-assignments', params).subscribe({
      next: data => { this.assignments.set(data); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load tagging records'); this.loading.set(false); },
    });
  }

  startReassign(assignment: EquipmentAssignment): void {
    this.reassigningId.set(assignment.id);
    this.reassigningSiteId.set('');
  }

  cancelReassign(): void {
    this.reassigningId.set(null);
    this.reassigningSiteId.set('');
  }

  confirmReassign(assignment: EquipmentAssignment): void {
    if (!this.reassigningSiteId()) {
      this.notify.error('Please select a new site');
      return;
    }
    if (this.reassigningSiteId() === assignment.site_id) {
      this.notify.error('Equipment is already at this site');
      return;
    }
    const today = new Date().toISOString().split('T')[0];

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'SiteTaggingEquipment',
        actionType: 'update',
        summary: `Reassign ${assignment.equipment_name} from ${assignment.site_name} to ${this.siteName(this.reassigningSiteId())}`,
        data: { assignment_id: assignment.id, new_site_id: this.reassigningSiteId(), date: today },
        referenceId: assignment.id,
      }).subscribe({
        next: () => { this.notify.success('Reassignment sent for approval'); this.cancelReassign(); },
        error: () => this.notify.error('Failed to submit for approval'),
      });
      return;
    }

    this.api.put<EquipmentAssignment>(`/equipment-site-assignments/${assignment.id}`, {
      released_date: today, status: 'released',
    }).subscribe({
      next: () => {
        this.api.post<EquipmentAssignment>('/equipment-site-assignments', {
          equipment_id: assignment.equipment_id,
          site_id: this.reassigningSiteId(),
          start_date: today,
          rate: assignment.rate,
          rate_unit: assignment.rate_unit,
          purpose: assignment.purpose,
        }).subscribe({
          next: () => { this.notify.success('Equipment reassigned'); this.cancelReassign(); this.loadAssignments(); },
          error: () => this.notify.error('Failed to create new assignment'),
        });
      },
      error: () => this.notify.error('Failed to release old assignment'),
    });
  }

  openReleaseModal(a: EquipmentAssignment): void {
    this.releaseTarget.set(a);
    this.releaseDate.set(new Date().toISOString().split('T')[0]);
    this.releaseCondition.set('Good');
    this.releaseRemarks.set('');
    this.showReleaseModal.set(true);
  }

  confirmRelease(): void {
    const a = this.releaseTarget();
    if (!a) return;
    this.api.put<EquipmentAssignment>(`/equipment-site-assignments/${a.id}`, {
      released_date: this.releaseDate(),
      status: 'released',
      condition: this.releaseCondition(),
      remarks: this.releaseRemarks(),
    }).subscribe({
      next: updated => {
        this.assignments.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.notify.success('Equipment released');
        this.showReleaseModal.set(false);
      },
      error: () => this.notify.error('Failed to release equipment'),
    });
  }

  siteName(id: string): string {
    return this.siteOptions().find(s => s.id === id)?.name ?? id;
  }

  getConditionClass(condition: string): string {
    switch (condition) {
      case 'Good': return 'badge badge-success';
      case 'Needs Repair': return 'badge badge-warning';
      case 'Damaged': return 'badge badge-danger';
      default: return 'badge badge-info';
    }
  }
}
