import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SummaryCard {
  title: string;
  value: string | number;
  icon?: string;
  color?: 'success' | 'danger' | 'warning' | 'info' | 'primary';
  prefix?: string;
  suffix?: string;
  trend?: 'up' | 'down';
}

@Component({
  selector: 'app-summary-cards',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="summary-grid">
      @for (card of cards(); track card.title) {
        <div class="summary-card" [class]="'card-' + (card.color || 'primary')">
          <div class="card-icon-area">
            @if (card.icon) {
              <i [class]="card.icon"></i>
            }
          </div>
          <div class="card-content">
            <span class="card-title">{{ card.title }}</span>
            <span class="card-value">
              @if (card.prefix) { <span class="prefix">{{ card.prefix }}</span> }
              {{ formatNumber(card.value) }}
              @if (card.suffix) { <span class="suffix">{{ card.suffix }}</span> }
              @if (card.trend) {
                <i [class]="card.trend === 'up' ? 'ri-arrow-up-line trend-up' : 'ri-arrow-down-line trend-down'"></i>
              }
            </span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }
    .summary-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: var(--shadow);
      transition: transform 0.2s, box-shadow 0.2s;
      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
      }
    }
    .card-icon-area {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      flex-shrink: 0;
    }
    .card-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .card-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-value {
      font-size: 22px;
      font-weight: 800;
      color: var(--text-main);
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    .prefix, .suffix {
      font-size: 14px;
      font-weight: 600;
      opacity: 0.7;
    }
    .trend-up { color: var(--success); font-size: 16px; }
    .trend-down { color: var(--danger); font-size: 16px; }

    .card-success {
      border-left: 3px solid var(--success);
      .card-icon-area { background: rgba(46, 204, 113, 0.12); color: var(--success); }
    }
    .card-danger {
      border-left: 3px solid var(--danger);
      .card-icon-area { background: rgba(231, 76, 60, 0.12); color: var(--danger); }
    }
    .card-warning {
      border-left: 3px solid var(--warning);
      .card-icon-area { background: rgba(253, 126, 20, 0.12); color: var(--warning); }
    }
    .card-info {
      border-left: 3px solid var(--info);
      .card-icon-area { background: rgba(52, 152, 219, 0.12); color: var(--info); }
    }
    .card-primary {
      border-left: 3px solid var(--accent);
      .card-icon-area { background: var(--accent-glow); color: var(--accent); }
    }

    @media (max-width: 768px) {
      .summary-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .summary-card { padding: 14px; }
      .card-value { font-size: 18px; }
      .card-icon-area { width: 40px; height: 40px; font-size: 18px; }
    }
    @media (max-width: 480px) {
      .summary-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class SummaryCardsComponent {
  cards = input<SummaryCard[]>([]);

  formatNumber(val: string | number): string {
    if (typeof val === 'string') return val;
    if (val == null) return '0';
    return val.toLocaleString('en-IN');
  }
}
