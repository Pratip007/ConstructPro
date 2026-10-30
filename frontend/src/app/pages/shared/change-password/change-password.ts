import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './change-password.html',
  styleUrl: './change-password.scss',
})
export class ChangePasswordComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  currentPassword = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  message = signal('');
  messageType = signal<'success' | 'error' | ''>('');
  loading = signal(false);

  showCurrentPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);

  selectedUserId = signal('');
  users = signal<{ id: string; name: string; role: string }[]>([]);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');
  readonly currentUser = this.auth.currentUser;

  readonly submitButtonText = computed(() => {
    if (this.selectedUserId() && this.isAdmin()) {
      const user = this.users().find(u => u.id === this.selectedUserId());
      return user ? `Update ${user.name}'s Password` : 'Update Password';
    }
    return 'Update My Password';
  });

  ngOnInit(): void {
    if (this.isAdmin()) {
      this.loadUsers();
    }
  }

  private loadUsers(): void {
    this.api.get<any[]>('/users').subscribe({
      next: (data) => {
        this.users.set(
          (data ?? [])
            .filter((u: any) => String(u.id) !== String(this.auth.currentUser()?.id))
            .map((u: any) => ({
              id: String(u.id),
              name: u.name ?? u.display_id ?? '',
              role: u.role ?? '',
            }))
        );
      },
      error: () => {},
    });
  }

  onSubmit(): void {
    if (!this.currentPassword() || !this.newPassword() || !this.confirmPassword()) {
      this.message.set('All fields are required.');
      this.messageType.set('error');
      return;
    }
    if (this.newPassword().length < 4) {
      this.message.set('New password must be at least 4 characters.');
      this.messageType.set('error');
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.message.set('New password and confirm password do not match.');
      this.messageType.set('error');
      return;
    }

    this.loading.set(true);
    this.message.set('');

    const body: any = {
      currentPassword: this.currentPassword(),
      newPassword: this.newPassword(),
    };
    if (this.selectedUserId() && this.isAdmin()) {
      body.targetUserId = this.selectedUserId();
    }

    this.api.put<void>('/auth/password', body).subscribe({
      next: () => {
        this.loading.set(false);
        const targetName = this.selectedUserId()
          ? this.users().find(u => u.id === this.selectedUserId())?.name ?? 'User'
          : 'Your';
        this.message.set(`${targetName}'s password changed successfully!`);
        this.messageType.set('success');
        this.notifications.success('Password changed successfully.');
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
      },
      error: (err: Error) => {
        this.loading.set(false);
        const errMsg = err.message || 'Failed to change password.';
        this.message.set(errMsg);
        this.messageType.set('error');
        this.notifications.error(errMsg);
      },
    });
  }
}
