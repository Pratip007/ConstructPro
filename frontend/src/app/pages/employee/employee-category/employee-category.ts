import { Component, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { RoleService } from '../../../core/services/role.service';
import { ApprovalService } from '../../../core/services/approval.service';

interface Category {
  id: number;
  name: string;
  working_days: number;
}

@Component({
  selector: 'app-employee-category',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './employee-category.html',
  styleUrl: './employee-category.scss',
})
export class EmployeeCategoryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotificationService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  readonly role = inject(RoleService);
  private readonly approval = inject(ApprovalService);

  categoryName = signal('');
  workingDays = signal<number>(26);
  categories = signal<Category[]>([]);
  editingId = signal<number | null>(null);
  loading = signal(false);

  ngOnInit(): void {
    this.loadCategories();
  }

  private loadCategories(): void {
    this.loading.set(true);
    this.api.get<Category[]>('/employee-categories').subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err.message ?? 'Failed to load categories');
        this.loading.set(false);
      },
    });
  }

  addCategory(): void {
    const name = this.categoryName().trim();
    if (!name) return;

    const body = { name, working_days: this.workingDays() };

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'employee-category',
        actionType: this.editingId() !== null ? 'update' : 'create',
        summary: `${this.editingId() !== null ? 'Update' : 'Create'} category: ${name}`,
        data: { ...body, id: this.editingId() },
      }).subscribe({
        next: () => {
          this.notify.success('Submitted for approval');
          this.editingId.set(null);
          this.categoryName.set('');
          this.workingDays.set(26);
        },
        error: (err) => this.notify.error(err.message ?? 'Failed to submit'),
      });
      return;
    }

    if (this.editingId() !== null) {
      this.api.put<Category>(`/employee-categories/${this.editingId()}`, body).subscribe({
        next: () => {
          this.notify.success('Category updated');
          this.editingId.set(null);
          this.categoryName.set('');
          this.workingDays.set(26);
          this.loadCategories();
        },
        error: (err) => this.notify.error(err.message ?? 'Failed to update category'),
      });
    } else {
      this.api.post<Category>('/employee-categories', body).subscribe({
        next: () => {
          this.notify.success('Category added');
          this.categoryName.set('');
          this.workingDays.set(26);
          this.loadCategories();
        },
        error: (err) => this.notify.error(err.message ?? 'Failed to add category'),
      });
    }
  }

  editCategory(cat: Category): void {
    this.categoryName.set(cat.name);
    this.workingDays.set(cat.working_days ?? 26);
    this.editingId.set(cat.id);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.categoryName.set('');
    this.workingDays.set(26);
  }

  async deleteCategory(id: number): Promise<void> {
    const confirmed = this.role.isAdmin()
      ? await this.confirmDialog.confirm({ title: 'Delete Category', message: 'Delete this category permanently?', type: 'danger' })
      : (await this.confirmDialog.confirmWithPassword({ title: 'Admin Verification', message: 'Enter admin password to delete.', confirmText: 'Delete', type: 'danger' })).confirmed;

    if (!confirmed) return;

    if (this.approval.requiresApproval()) {
      this.approval.submitForApproval({
        module: 'employee-category',
        actionType: 'delete',
        summary: `Delete category ID: ${id}`,
        data: { id },
      }).subscribe({
        next: () => this.notify.success('Delete request submitted for approval'),
        error: (err) => this.notify.error(err.message ?? 'Failed to submit'),
      });
      return;
    }

    this.api.delete<void>(`/employee-categories/${id}`).subscribe({
      next: () => {
        this.notify.success('Category deleted');
        this.loadCategories();
      },
      error: (err) => this.notify.error(err.message ?? 'Failed to delete category'),
    });
  }
}
