import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';
import { SummaryCardsComponent, SummaryCard } from '../../../shared/summary-cards/summary-cards.component';
import { SearchableDropdownComponent, DropdownItem } from '../../../shared/searchable-dropdown/searchable-dropdown.component';
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
  remarks?: string;
}

interface Equipment { id: string; name: string; }
interface Site { id: string; name: string; }

@Component({
  selector: 'app-equipment-leave',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, SummaryCardsComponent, SearchableDropdownComponent, ModalDialogComponent],
  templateUrl: './equipment-leave.html',
  styleUrl: './equipment-leave.scss',
})
export class EquipmentLeaveComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotificationService);
  readonly role = inject(RoleService);
  private approval = inject(ApprovalService);

  loading = signal(false);
  allAssignments = signal<EquipmentAssignment[]>([]);
  equipmentOptions = signal<Equipment[]>([]);
  siteOptions = signal<Site[]>([]);
  activeTab = signal<'active' | 'released'>('active');

  showReleaseModal = signal(false);
  showTransferModal = signal(false);
  selectedAssignment = signal<EquipmentAssignment | null>(null);
  releaseDate = signal('');
  releaseCondition = signal<string>('Good');
  releaseRemarks = signal('');
  transferSiteId = signal('');
  transferDate = signal('');
  transferRemarks = signal('');

  activeAssignments = computed(() =>
    this.allAssignments().filter(a => a.status !== 'released')
  );

  releasedAssignments = computed(() =>
    this.allAssignments().filter(a => a.status === 'released')
  );

  siteItems = computed<DropdownItem[]>(() =>
    this.siteOptions().map(s => ({ value: s.id, label: s.name }))
  );

  summaryCards = computed<SummaryCard[]>(() => [
    { title: 'Active', value: this.activeAssignments().length, icon: 'ri-truck-line', color: 'success' },
    { title: 'Released', value: this.releasedAssignments().length, icon: 'ri-logout-box-line', color: 'info' },
    { title: 'Needs Repair', value: this.releasedAssignments().filter(a => a.condition === 'Needs Repair').length, icon: 'ri-tools-line', color: 'warning' },
    { title: 'Damaged', value: this.releasedAssignments().filter(a => a.condition === 'Damaged').length, icon: 'ri-error-warning-line', color: 'danger' },
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
    this.api.get<EquipmentAssignment[]>('/equipment-site-assignments').subscribe({
      next: data => { this.allAssignments.set(data); this.loading.set(false); },
      error: () => { this.notify.error('Failed to load assignments'); this.loading.set(false); },
    });
  }

  getDurationDays(a: EquipmentAssignment): number {
    if (!a.start_date) return 0;
    const start = new Date(a.start_date).getTime();
    const end = a.released_date ? new Date(a.released_date).getTime() : Date.now();
    return Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  }

  openReleaseModal(a: EquipmentAssignment): void {
    this.selectedAssignment.set(a);
    this.releaseDate.set(new Date().toISOString().split('T')[0]);
    this.releaseCondition.set('Good');
    this.releaseRemarks.set('');
    this.showReleaseModal.set(true);
  }

  openTransferModal(a: EquipmentAssignment): void {
    this.selectedAssignment.set(a);
    this.transferSiteId.set('');
    this.transferDate.set(new Date().toISOString().split('T')[0]);
    this.transferRemarks.set('');
    this.showTransferModal.set(true);
  }

  confirmRelease(): void {
    const a = this.selectedAssignment();
    if (!a) return;

    const body = {
      released_date: this.releaseDate(),
      status: 'released',
      condition: this.releaseCondition(),
      remarks: this.releaseRemarks(),
    };

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'EquipmentLeave',
        actionType: 'update',
        summary: `Release Equipment: ${a.equipment_name} from ${a.site_name} (${this.releaseCondition()})`,
        data: body,
        referenceId: a.id,
      }).subscribe({
        next: () => { this.notify.success('Release sent for approval'); this.showReleaseModal.set(false); },
        error: () => this.notify.error('Failed to submit release request'),
      });
      return;
    }

    this.api.put<EquipmentAssignment>(`/equipment-site-assignments/${a.id}`, body).subscribe({
      next: updated => {
        this.allAssignments.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.notify.success('Equipment released');
        this.showReleaseModal.set(false);
      },
      error: () => this.notify.error('Failed to release equipment'),
    });
  }

  confirmTransfer(): void {
    const a = this.selectedAssignment();
    if (!a) return;
    if (!this.transferSiteId()) {
      this.notify.error('Please select a destination site');
      return;
    }
    if (this.transferSiteId() === a.site_id) {
      this.notify.error('Equipment is already at this site');
      return;
    }

    const today = this.transferDate() || new Date().toISOString().split('T')[0];

    this.api.put<EquipmentAssignment>(`/equipment-site-assignments/${a.id}`, {
      released_date: today,
      status: 'released',
      condition: 'Good',
      remarks: `Transferred to new site. ${this.transferRemarks()}`.trim(),
    }).subscribe({
      next: () => {
        this.api.post<EquipmentAssignment>('/equipment-site-assignments', {
          equipment_id: a.equipment_id,
          site_id: this.transferSiteId(),
          start_date: today,
          rate: a.rate,
          rate_unit: a.rate_unit,
          purpose: a.purpose,
        }).subscribe({
          next: () => {
            this.notify.success('Equipment transferred to new site');
            this.showTransferModal.set(false);
            this.loadAssignments();
          },
          error: () => this.notify.error('Failed to create new assignment'),
        });
      },
      error: () => this.notify.error('Failed to release old assignment'),
    });
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
