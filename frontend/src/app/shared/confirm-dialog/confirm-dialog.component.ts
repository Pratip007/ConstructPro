import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalDialogComponent } from '../modal-dialog/modal-dialog.component';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  passwordRequired?: boolean;
  passwordLabel?: string;
}

export interface ConfirmResult {
  confirmed: boolean;
  password?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalDialogComponent],
  template: `
    <app-modal-dialog
      [isOpen]="isVisible()"
      [title]="options().title"
      size="sm"
      (closed)="cancel()"
    >
      <div class="confirm-body">
        <div class="confirm-icon" [class]="'icon-' + (options().type || 'warning')">
          @switch (options().type) {
            @case ('danger') { <i class="ri-error-warning-fill"></i> }
            @case ('info') { <i class="ri-information-fill"></i> }
            @default { <i class="ri-alert-fill"></i> }
          }
        </div>
        <p class="confirm-message">{{ options().message }}</p>
        @if (options().passwordRequired) {
          <div class="password-field">
            <label>{{ options().passwordLabel || 'Admin Password' }}</label>
            <input
              type="password"
              [(ngModel)]="passwordValue"
              placeholder="Enter password to confirm"
              (keydown.enter)="confirmAction()"
              autocomplete="off"
            />
          </div>
        }
      </div>
      <div modal-footer>
        <button class="btn-secondary" (click)="cancel()">
          {{ options().cancelText || 'Cancel' }}
        </button>
        <button
          [class]="options().type === 'danger' ? 'btn-danger' : 'btn-primary'"
          (click)="confirmAction()"
          [disabled]="options().passwordRequired && !passwordValue"
        >
          {{ options().confirmText || 'Confirm' }}
        </button>
      </div>
    </app-modal-dialog>
  `,
  styles: [`
    .confirm-body {
      text-align: center;
      padding: 8px 0;
    }
    .confirm-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .icon-danger { color: var(--danger); }
    .icon-warning { color: var(--warning); }
    .icon-info { color: var(--info); }
    .confirm-message {
      font-size: 14px;
      color: var(--text-main);
      line-height: 1.6;
      margin-bottom: 8px;
    }
    .password-field {
      margin-top: 16px;
      text-align: left;
      label {
        font-size: 11px;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.6px;
        margin-bottom: 7px;
        display: block;
      }
      input {
        width: 100%;
        padding: 11px 14px;
        background: var(--input-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        color: var(--text-main);
        font-size: 14px;
        font-family: 'Montserrat', sans-serif;
        outline: none;
        transition: all 0.25s;
        &:focus {
          border-color: var(--accent);
          background: var(--input-focus-bg);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }
      }
    }
  `]
})
export class ConfirmDialogComponent {
  isVisible = signal(false);
  options = signal<ConfirmOptions>({ title: '', message: '' });
  passwordValue = '';

  private resolveRef?: (result: ConfirmResult) => void;

  show(opts: ConfirmOptions): Promise<ConfirmResult> {
    this.options.set(opts);
    this.passwordValue = '';
    this.isVisible.set(true);
    return new Promise(resolve => {
      this.resolveRef = resolve;
    });
  }

  confirmAction() {
    this.isVisible.set(false);
    this.resolveRef?.({
      confirmed: true,
      password: this.options().passwordRequired ? this.passwordValue : undefined
    });
  }

  cancel() {
    this.isVisible.set(false);
    this.resolveRef?.({ confirmed: false });
  }
}
