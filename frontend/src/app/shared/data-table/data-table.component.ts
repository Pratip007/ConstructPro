import {
  Component, ContentChildren, Directive, EventEmitter, Input, OnChanges, Output,
  QueryList, TemplateRef, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  type?: 'text' | 'badge' | 'currency' | 'date' | 'image';
  badgeMap?: { [value: string]: 'success' | 'danger' | 'warning' | 'info' };
  format?: string;
  visible?: boolean;
}

export interface TableAction {
  label: string;
  icon?: string;
  class?: string;
  action: string;
  show?: (row: any) => boolean;
}

@Directive({ selector: '[appCellTemplate]', standalone: true })
export class CellTemplateDirective {
  @Input('appCellTemplate') columnKey!: string;
  constructor(public templateRef: TemplateRef<any>) {}
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
})
export class DataTableComponent implements OnChanges {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() fileName = 'export';
  @Input() loading = false;
  @Input() emptyMessage = 'No records found.';
  @Input() actions: TableAction[] = [];
  @Input() showFooterTotals = false;
  @Input() selectable = false;
  @Input() bulkActions: { label: string; action: string }[] = [];

  @Output() actionClick = new EventEmitter<{ action: string; row: any }>();
  @Output() selectionChange = new EventEmitter<any[]>();
  @Output() bulkActionClick = new EventEmitter<{ action: string; rows: any[] }>();

  @ContentChildren(CellTemplateDirective) cellTemplates!: QueryList<CellTemplateDirective>;

  search = signal('');
  sortKey = signal('');
  sortAsc = signal(true);
  currentPage = signal(1);
  pageSize = signal(20);
  selectedRows = signal<Set<number>>(new Set());

  ngOnChanges(): void {
    this.currentPage.set(1);
    this.selectedRows.set(new Set());
  }

  get visibleColumns(): TableColumn[] {
    return this.columns.filter(c => c.visible !== false);
  }

  get colSpan(): number {
    let span = this.visibleColumns.length + 1;
    if (this.selectable) span++;
    if (this.actions.length) span++;
    return span;
  }

  get filtered(): any[] {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.data;
    return this.data.filter(row =>
      Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }

  get sorted(): any[] {
    const key = this.sortKey();
    if (!key) return this.filtered;
    return [...this.filtered].sort((a, b) => {
      const av = a[key] ?? '';
      const bv = b[key] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return this.sortAsc() ? cmp : -cmp;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.sorted.length / this.pageSize()));
  }

  get paginated(): any[] {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.sorted.slice(start, start + this.pageSize());
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const cur = this.currentPage();
    const pages: number[] = [];
    for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) {
      pages.push(i);
    }
    return pages;
  }

  get startRow(): number { return (this.currentPage() - 1) * this.pageSize() + 1; }
  get endRow(): number { return Math.min(this.currentPage() * this.pageSize(), this.sorted.length); }

  get allSelected(): boolean {
    return this.paginated.length > 0 && this.selectedRows().size === this.paginated.length;
  }

  get selectedItems(): any[] {
    const sel = this.selectedRows();
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.sorted.filter((_, i) => sel.has(i - start));
  }

  get footerTotals(): { [key: string]: number } {
    const totals: { [key: string]: number } = {};
    for (const col of this.visibleColumns) {
      if (col.type === 'currency' || this.isNumericColumn(col.key)) {
        totals[col.key] = this.sorted.reduce((sum, row) => {
          const v = parseFloat(row[col.key]);
          return sum + (isNaN(v) ? 0 : v);
        }, 0);
      }
    }
    return totals;
  }

  getCellTemplate(key: string): TemplateRef<any> | null {
    if (!this.cellTemplates) return null;
    const t = this.cellTemplates.find(ct => ct.columnKey === key);
    return t ? t.templateRef : null;
  }

  toggleSort(key: string): void {
    if (this.sortKey() === key) {
      this.sortAsc.update(v => !v);
    } else {
      this.sortKey.set(key);
      this.sortAsc.set(true);
    }
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage.set(page);
    }
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    this.currentPage.set(1);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
  }

  toggleSelectAll(): void {
    const sel = new Set<number>();
    if (!this.allSelected) {
      for (let i = 0; i < this.paginated.length; i++) sel.add(i);
    }
    this.selectedRows.set(sel);
    this.selectionChange.emit(this.selectedItems);
  }

  toggleRowSelect(index: number): void {
    const sel = new Set(this.selectedRows());
    if (sel.has(index)) sel.delete(index);
    else sel.add(index);
    this.selectedRows.set(sel);
    this.selectionChange.emit(this.selectedItems);
  }

  isRowSelected(index: number): boolean {
    return this.selectedRows().has(index);
  }

  onActionClick(action: string, row: any): void {
    this.actionClick.emit({ action, row });
  }

  onBulkAction(action: string): void {
    this.bulkActionClick.emit({ action, rows: this.selectedItems });
  }

  isActionVisible(action: TableAction, row: any): boolean {
    return action.show ? action.show(row) : true;
  }

  formatCurrency(value: any): string {
    const num = parseFloat(value);
    if (isNaN(num)) return '—';
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(value: any): string {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  getBadgeClass(value: any, col: TableColumn): string {
    if (!col.badgeMap) return 'badge badge-info';
    const v = String(value ?? '').toLowerCase();
    for (const [key, cls] of Object.entries(col.badgeMap)) {
      if (key.toLowerCase() === v) return `badge badge-${cls}`;
    }
    return 'badge badge-info';
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  getCellValue(row: any, col: TableColumn): string {
    const val = row[col.key];
    if (val == null) return '—';
    switch (col.type) {
      case 'currency': return this.formatCurrency(val);
      case 'date': return this.formatDate(val);
      default: return String(val);
    }
  }

  exportCsv(): void {
    if (!this.data.length) return;
    const cols = this.visibleColumns;
    const headers = cols.map(c => c.label);
    const keys = cols.map(c => c.key);
    const rows = this.filtered.map(row =>
      keys.map(k => {
        const val = String(row[k] ?? '');
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    this.downloadBlob(blob, `${this.fileName}.csv`);
  }

  async exportToExcel(): Promise<void> {
    if (!this.data.length) return;
    const XLSX = await import('xlsx');
    const cols = this.visibleColumns;
    const wsData = [cols.map(c => c.label)];
    for (const row of this.filtered) {
      wsData.push(cols.map(c => row[c.key] ?? ''));
    }
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const colWidths = cols.map(c => ({
      wch: Math.max(c.label.length, ...this.filtered.slice(0, 100).map(r => String(r[c.key] ?? '').length)) + 2
    }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${this.fileName}.xlsx`);
  }

  async exportToPdf(): Promise<void> {
    if (!this.data.length) return;
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF('p', 'mm', 'a4');
    const cols = this.visibleColumns;
    doc.setFontSize(14);
    doc.text(this.fileName, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 21);
    autoTable(doc, {
      startY: 26,
      head: [cols.map(c => c.label)],
      body: this.filtered.map(row => cols.map(c => {
        if (c.type === 'currency') return this.formatCurrency(row[c.key]);
        if (c.type === 'date') return this.formatDate(row[c.key]);
        return String(row[c.key] ?? '');
      })),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 32, 53], textColor: [232, 234, 240], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
    });
    doc.save(`${this.fileName}.pdf`);
  }

  printTable(): void {
    const cols = this.visibleColumns;
    const rows = this.filtered;
    const html = `
      <html><head><title>${this.escapeHtml(this.fileName)}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 20px; }
        h2 { margin-bottom: 4px; }
        .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px 10px; font-size: 12px; text-align: left; }
        th { background: #1a2035; color: #fff; font-weight: 700; }
        tr:nth-child(even) { background: #f5f7fa; }
      </style></head><body>
      <h2>${this.escapeHtml(this.fileName)}</h2>
      <p class="meta">Printed: ${new Date().toLocaleDateString('en-IN')} | Records: ${rows.length}</p>
      <table><thead><tr>${cols.map(c => `<th>${this.escapeHtml(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${this.escapeHtml(this.getCellValue(r, c))}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onload = () => { w.print(); w.close(); };
    }
  }

  private isNumericColumn(key: string): boolean {
    const sample = this.data.slice(0, 20);
    if (!sample.length) return false;
    return sample.every(row => {
      const v = row[key];
      return v == null || v === '' || !isNaN(parseFloat(v));
    });
  }

  private downloadBlob(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
}
