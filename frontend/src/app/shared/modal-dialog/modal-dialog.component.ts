import { Component, input, output, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen()) {
      <div class="modal-backdrop" (click)="onBackdropClick()" [@fadeIn]>
        <div
          class="modal-container"
          [class]="'modal-' + size()"
          (click)="$event.stopPropagation()"
        >
          <div class="modal-header">
            <h3 class="modal-title">{{ title() }}</h3>
            <button class="modal-close" (click)="close()">
              <i class="ri-close-line"></i>
            </button>
          </div>
          <div class="modal-body">
            <ng-content></ng-content>
          </div>
          <div class="modal-footer">
            <ng-content select="[modal-footer]"></ng-content>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 9000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.2s ease-out;
    }
    .modal-container {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      width: 100%;
      animation: scaleIn 0.2s ease-out;
    }
    .modal-sm { max-width: 420px; }
    .modal-md { max-width: 600px; }
    .modal-lg { max-width: 800px; }
    .modal-xl { max-width: 1100px; }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 24px;
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }
    .modal-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
    }
    .modal-close {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 22px;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      &:hover {
        color: var(--danger);
        background: rgba(231, 76, 60, 0.1);
      }
    }
    .modal-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }
    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-shrink: 0;
      &:empty { display: none; }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    @media (max-width: 768px) {
      .modal-container { max-width: 100% !important; margin: 10px; }
      .modal-body { padding: 16px; }
      .modal-header, .modal-footer { padding: 14px 16px; }
    }
  `]
})
export class ModalDialogComponent {
  isOpen = input(false);
  title = input('');
  size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  closeOnBackdrop = input(true);

  closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.isOpen()) this.close();
  }

  close() {
    this.closed.emit();
  }

  onBackdropClick() {
    if (this.closeOnBackdrop()) this.close();
  }
}
