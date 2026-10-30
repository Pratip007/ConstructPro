import {
  Component, input, output, signal, computed, effect,
  ElementRef, HostListener, forwardRef, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

export interface DropdownItem {
  value: any;
  label: string;
}

@Component({
  selector: 'app-searchable-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => SearchableDropdownComponent),
    multi: true
  }],
  template: `
    <div class="dropdown-wrapper" [class.disabled]="disabled()" [class.open]="isOpen()">
      @if (label()) {
        <label class="dropdown-label">
          {{ label() }}
          @if (required()) { <span class="req">*</span> }
        </label>
      }
      <div class="dropdown-control" (click)="toggle()">
        <input
          type="text"
          class="dropdown-input"
          [placeholder]="selectedLabel() || placeholder()"
          [value]="isOpen() ? searchText() : selectedLabel()"
          [disabled]="disabled()"
          [class.has-value]="!!selectedLabel() && !isOpen()"
          (input)="onSearch($event)"
          (focus)="open()"
          (keydown)="onKeydown($event)"
          autocomplete="off"
        />
        <span class="dropdown-arrow" [class.rotated]="isOpen()">
          <i class="ri-arrow-down-s-line"></i>
        </span>
        @if (selectedLabel() && !disabled()) {
          <span class="clear-btn" (click)="clear($event)">
            <i class="ri-close-line"></i>
          </span>
        }
      </div>
      @if (isOpen()) {
        <div class="dropdown-menu">
          @if (filteredItems().length === 0) {
            <div class="dropdown-empty">No results found</div>
          }
          @for (item of filteredItems(); track item.value; let i = $index) {
            <div
              class="dropdown-item"
              [class.highlighted]="i === highlightIndex()"
              [class.selected]="item.value === internalValue()"
              (click)="select(item)"
              (mouseenter)="highlightIndex.set(i)"
            >
              {{ item.label }}
            </div>
          }
          @if (allowAdd()) {
            <div class="dropdown-item add-new" (click)="onAddNew()">
              <i class="ri-add-line"></i> Add New
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .dropdown-wrapper {
      position: relative;
      width: 100%;
      &.disabled { opacity: 0.5; pointer-events: none; }
    }
    .dropdown-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 7px;
      display: flex;
      align-items: center;
      gap: 5px;
      .req { color: var(--danger); }
    }
    .dropdown-control {
      position: relative;
      display: flex;
      align-items: center;
    }
    .dropdown-input {
      width: 100%;
      padding: 11px 60px 11px 14px;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-main);
      font-size: 14px;
      font-weight: 500;
      font-family: 'Montserrat', sans-serif;
      outline: none;
      transition: all 0.25s;
      cursor: pointer;
      &:focus {
        border-color: var(--accent);
        background: var(--input-focus-bg);
        box-shadow: 0 0 0 3px var(--accent-glow);
      }
      &.has-value { color: var(--text-main); }
      &::placeholder { color: var(--text-muted); font-weight: 400; }
    }
    .dropdown-arrow {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 18px;
      pointer-events: none;
      transition: transform 0.2s;
      &.rotated { transform: translateY(-50%) rotate(180deg); }
    }
    .clear-btn {
      position: absolute;
      right: 34px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 16px;
      cursor: pointer;
      padding: 2px;
      border-radius: 50%;
      transition: all 0.15s;
      &:hover { color: var(--danger); background: rgba(231, 76, 60, 0.1); }
    }
    .dropdown-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: var(--shadow-lg);
      max-height: 240px;
      overflow-y: auto;
      z-index: 1000;
      animation: slideDown 0.15s ease-out;
    }
    .dropdown-item {
      padding: 10px 14px;
      font-size: 13px;
      color: var(--text-main);
      cursor: pointer;
      transition: background 0.1s;
      &:hover, &.highlighted {
        background: var(--hover-bg);
      }
      &.selected {
        color: var(--accent);
        font-weight: 600;
      }
      &.add-new {
        color: var(--accent);
        font-weight: 600;
        border-top: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        gap: 6px;
        i { font-size: 16px; }
      }
    }
    .dropdown-empty {
      padding: 14px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class SearchableDropdownComponent implements ControlValueAccessor, OnDestroy {
  items = input<DropdownItem[]>([]);
  placeholder = input('Select...');
  label = input('');
  required = input(false);
  disabled = input(false);
  allowAdd = input(false);

  selectionChange = output<any>();
  addNew = output<void>();

  isOpen = signal(false);
  searchText = signal('');
  highlightIndex = signal(0);
  internalValue = signal<any>(null);

  private onChange: (val: any) => void = () => {};
  private onTouched: () => void = () => {};
  private clickOutsideHandler: (e: MouseEvent) => void;

  selectedLabel = computed(() => {
    const val = this.internalValue();
    if (val == null) return '';
    const item = this.items().find(i => i.value === val);
    return item?.label ?? '';
  });

  filteredItems = computed(() => {
    const text = this.searchText().toLowerCase();
    if (!text) return this.items();
    return this.items().filter(i => i.label.toLowerCase().includes(text));
  });

  constructor(private elRef: ElementRef) {
    this.clickOutsideHandler = (e: MouseEvent) => {
      if (!this.elRef.nativeElement.contains(e.target)) {
        this.close();
      }
    };
    document.addEventListener('click', this.clickOutsideHandler, true);
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.clickOutsideHandler, true);
  }

  writeValue(val: any) {
    this.internalValue.set(val);
  }

  registerOnChange(fn: any) { this.onChange = fn; }
  registerOnTouched(fn: any) { this.onTouched = fn; }

  toggle() {
    if (this.isOpen()) this.close();
    else this.open();
  }

  open() {
    if (this.disabled()) return;
    this.isOpen.set(true);
    this.searchText.set('');
    this.highlightIndex.set(0);
  }

  close() {
    this.isOpen.set(false);
    this.searchText.set('');
    this.onTouched();
  }

  select(item: DropdownItem) {
    this.internalValue.set(item.value);
    this.onChange(item.value);
    this.selectionChange.emit(item.value);
    this.close();
  }

  clear(event: Event) {
    event.stopPropagation();
    this.internalValue.set(null);
    this.onChange(null);
    this.selectionChange.emit(null);
  }

  onSearch(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.searchText.set(val);
    this.highlightIndex.set(0);
  }

  onAddNew() {
    this.addNew.emit();
    this.close();
  }

  onKeydown(event: KeyboardEvent) {
    const items = this.filteredItems();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.isOpen()) { this.open(); return; }
        this.highlightIndex.update(i => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlightIndex.update(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (this.isOpen() && items[this.highlightIndex()]) {
          this.select(items[this.highlightIndex()]);
        }
        break;
      case 'Escape':
        this.close();
        break;
    }
  }
}
