import { Injectable, signal, Component, inject } from '@angular/core';

export interface Notification {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly notifications = signal<Notification[]>([]);

  private nextId = 0;

  success(message: string): void {
    this.add({ type: 'success', message, dismissAfter: 3000 });
  }

  error(message: string): void {
    this.add({ type: 'error', message, dismissAfter: 5000 });
  }

  warning(message: string): void {
    this.add({ type: 'warning', message, dismissAfter: 4000 });
  }

  info(message: string): void {
    this.add({ type: 'info', message, dismissAfter: 3000 });
  }

  private add(opts: { type: 'success' | 'error' | 'warning' | 'info'; message: string; dismissAfter: number }): void {
    const id = ++this.nextId;
    this.notifications.update(list => [...list, { id, type: opts.type, message: opts.message }]);
    setTimeout(() => this.remove(id), opts.dismissAfter);
  }

  remove(id: number): void {
    this.notifications.update(list => list.filter(n => n.id !== id));
  }
}

@Component({
  selector: 'app-notification-toast',
  standalone: true,
  imports: [],
  template: `
    <div class="toast-container">
      @for (n of notificationService.notifications(); track n.id) {
        <div
          class="toast"
          [class.toast-success]="n.type === 'success'"
          [class.toast-error]="n.type === 'error'"
          [class.toast-warning]="n.type === 'warning'"
          [class.toast-info]="n.type === 'info'"
        >
          <span class="toast-message">{{ n.message }}</span>
          <button class="toast-close" (click)="notificationService.remove(n.id)">✕</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 360px;
    }

    .toast {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slide-in 0.2s ease-out;
    }

    .toast-success {
      background-color: #16a34a;
      color: #fff;
    }

    .toast-error {
      background-color: #dc2626;
      color: #fff;
    }

    .toast-warning {
      background-color: #d97706;
      color: #fff;
    }

    .toast-info {
      background-color: #2563eb;
      color: #fff;
    }

    .toast-message {
      flex: 1;
      line-height: 1.4;
    }

    .toast-close {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      font-size: 0.875rem;
      opacity: 0.8;
      padding: 0;
      line-height: 1;
      flex-shrink: 0;
    }

    .toast-close:hover {
      opacity: 1;
    }

    @keyframes slide-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `],
})
export class NotificationToastComponent {
  protected notificationService = inject(NotificationService);
}
