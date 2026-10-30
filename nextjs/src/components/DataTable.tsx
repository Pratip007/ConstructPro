'use client';

import React, { useState, useMemo, useCallback, useEffect, ReactNode } from 'react';
import styles from './DataTable.module.scss';

export type TableColumn = {
  key: string;
  label: string;
  sortable?: boolean;
  type?: string;
  badgeMap?: Record<string, string | undefined>;
  format?: string;
  visible?: boolean;
};

export interface TableAction {
  label: string;
  icon?: string;
  class?: string;
  action: string;
  show?: (row: any) => boolean;
}

interface DataTableProps {
  columns: TableColumn[];
  data: any[];
  fileName?: string;
  loading?: boolean;
  emptyMessage?: string;
  actions?: TableAction[];
  showFooterTotals?: boolean;
  selectable?: boolean;
  bulkActions?: { label: string; action: string }[];
  onActionClick?: (event: { action: string; row: any }) => void;
  onSelectionChange?: (rows: any[]) => void;
  onBulkAction?: (event: { action: string; rows: any[] }) => void;
  renderCell?: (row: any, col: TableColumn) => ReactNode | null;
}

function formatCurrency(value: any): string {
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: any): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function getBadgeClass(value: any, col: TableColumn): string {
  if (!col.badgeMap) return 'badge badge-info';
  const v = String(value ?? '').toLowerCase();
  for (const [key, cls] of Object.entries(col.badgeMap)) {
    if (key.toLowerCase() === v) return `badge badge-${cls}`;
  }
  return 'badge badge-info';
}

function getCellValue(row: any, col: TableColumn): string {
  const val = row[col.key];
  if (val == null) return '—';
  switch (col.type) {
    case 'currency': return formatCurrency(val);
    case 'date': return formatDate(val);
    default: return String(val);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isNumericColumn(data: any[], key: string): boolean {
  const sample = data.slice(0, 20);
  if (!sample.length) return false;
  return sample.every(row => {
    const v = row[key];
    return v == null || v === '' || !isNaN(parseFloat(v));
  });
}

export default function DataTable({
  columns,
  data,
  fileName = 'export',
  loading = false,
  emptyMessage = 'No records found.',
  actions = [],
  showFooterTotals = false,
  selectable = false,
  bulkActions = [],
  onActionClick,
  onSelectionChange,
  onBulkAction,
  renderCell,
}: DataTableProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    setCurrentPage(1);
    setSelectedRows(new Set());
  }, [data]);

  const visibleColumns = useMemo(() => columns.filter(c => c.visible !== false), [columns]);

  const colSpan = useMemo(() => {
    let span = visibleColumns.length + 1;
    if (selectable) span++;
    if (actions.length) span++;
    return span;
  }, [visibleColumns.length, selectable, actions.length]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return data;
    return data.filter(row =>
      Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }, [data, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
      pages.push(i);
    }
    return pages;
  }, [totalPages, currentPage]);

  const startRow = (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, sorted.length);
  const allSelected = paginated.length > 0 && selectedRows.size === paginated.length;

  const selectedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.filter((_, i) => selectedRows.has(i - start));
  }, [sorted, selectedRows, currentPage, pageSize]);

  const footerTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const col of visibleColumns) {
      if (col.type === 'currency' || isNumericColumn(data, col.key)) {
        totals[col.key] = sorted.reduce((sum, row) => {
          const v = parseFloat(row[col.key]);
          return sum + (isNaN(v) ? 0 : v);
        }, 0);
      }
    }
    return totals;
  }, [visibleColumns, sorted, data]);

  const toggleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortAsc(v => !v);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
    setCurrentPage(1);
  }, [sortKey]);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  }, [totalPages]);

  const onSearchChange = useCallback((value: string) => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  const onPageSizeChange = useCallback((size: number) => {
    setPageSize(Number(size));
    setCurrentPage(1);
  }, []);

  const toggleSelectAll = useCallback(() => {
    const sel = new Set<number>();
    if (!allSelected) {
      for (let i = 0; i < paginated.length; i++) sel.add(i);
    }
    setSelectedRows(sel);
    const start = (currentPage - 1) * pageSize;
    const items = sorted.filter((_, i) => sel.has(i - start));
    onSelectionChange?.(items);
  }, [allSelected, paginated.length, sorted, currentPage, pageSize, onSelectionChange]);

  const toggleRowSelect = useCallback((index: number) => {
    setSelectedRows(prev => {
      const sel = new Set(prev);
      if (sel.has(index)) sel.delete(index); else sel.add(index);
      const start = (currentPage - 1) * pageSize;
      const items = sorted.filter((_, i) => sel.has(i - start));
      onSelectionChange?.(items);
      return sel;
    });
  }, [sorted, currentPage, pageSize, onSelectionChange]);

  const isRowSelected = useCallback((index: number): boolean => selectedRows.has(index), [selectedRows]);

  const isActionVisible = useCallback((action: TableAction, row: any): boolean =>
    action.show ? action.show(row) : true, []);

  const exportCsv = useCallback(() => {
    if (!data.length) return;
    const cols = visibleColumns;
    const headers = cols.map(c => c.label);
    const keys = cols.map(c => c.key);
    const rows = filtered.map(row =>
      keys.map(k => {
        const val = String(row[k] ?? '');
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${fileName}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [data, visibleColumns, filtered, fileName]);

  const exportToExcel = useCallback(async () => {
    if (!data.length) return;
    const XLSX = await import('xlsx');
    const cols = visibleColumns;
    const wsData = [cols.map(c => c.label)];
    for (const row of filtered) wsData.push(cols.map(c => row[c.key] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = cols.map(c => ({
      wch: Math.max(c.label.length, ...filtered.slice(0, 100).map(r => String(r[c.key] ?? '').length)) + 2
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }, [data, visibleColumns, filtered, fileName]);

  const exportToPdf = useCallback(async () => {
    if (!data.length) return;
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF('p', 'mm', 'a4');
    const cols = visibleColumns;
    doc.setFontSize(14);
    doc.text(fileName, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 21);
    autoTable(doc, {
      startY: 26,
      head: [cols.map(c => c.label)],
      body: filtered.map(row => cols.map(c => {
        if (c.type === 'currency') return formatCurrency(row[c.key]);
        if (c.type === 'date') return formatDate(row[c.key]);
        return String(row[c.key] ?? '');
      })),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 32, 53], textColor: [232, 234, 240], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
    });
    doc.save(`${fileName}.pdf`);
  }, [data, visibleColumns, filtered, fileName]);

  const printTable = useCallback(() => {
    const cols = visibleColumns;
    const rows = filtered;
    const html = `<html><head><title>${escapeHtml(fileName)}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 20px; }
        h2 { margin-bottom: 4px; }
        .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px 10px; font-size: 12px; text-align: left; }
        th { background: #1a2035; color: #fff; font-weight: 700; }
        tr:nth-child(even) { background: #f5f7fa; }
      </style></head><body>
      <h2>${escapeHtml(fileName)}</h2>
      <p class="meta">Printed: ${new Date().toLocaleDateString('en-IN')} | Records: ${rows.length}</p>
      <table><thead><tr>${cols.map(c => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${escapeHtml(getCellValue(r, c))}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.onload = () => { w.print(); w.close(); }; }
  }, [visibleColumns, filtered, fileName]);

  return (
    <>
      {selectable && selectedRows.size > 0 && bulkActions.length > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selectedRows.size} selected</span>
          {bulkActions.map(ba => (
            <button key={ba.action} className={`btn-secondary ${styles.btnSm}`}
              onClick={() => onBulkAction?.({ action: ba.action, rows: selectedItems })}>{ba.label}</button>
          ))}
        </div>
      )}

      <div className="table-toolbar">
        <div className="toolbar-search-wrap">
          <i className="ri-search-line search-icon"></i>
          <input className="toolbar-search" type="text" placeholder="Search all columns..."
            value={search} onChange={e => onSearchChange(e.target.value)} />
        </div>
        <select className="toolbar-select" value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))}>
          <option value={10}>10 / page</option>
          <option value={20}>20 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
        <div className="spacer"></div>
        <button className="btn-export" onClick={exportCsv} disabled={!data.length}>
          <i className="ri-file-text-line"></i> CSV</button>
        <button className="btn-export" onClick={exportToExcel} disabled={!data.length}>
          <i className="ri-file-excel-2-line"></i> Excel</button>
        <button className={`btn-export ${styles.btnExportPdf}`} onClick={exportToPdf} disabled={!data.length}>
          <i className="ri-file-pdf-2-line"></i> PDF</button>
        <button className={`btn-export ${styles.btnExportPrint}`} onClick={printTable} disabled={!data.length}>
          <i className="ri-printer-line"></i> Print</button>
      </div>

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              {selectable && (
                <th className={styles.thCheckbox}>
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                </th>
              )}
              <th>#</th>
              {visibleColumns.map(col => (
                <th key={col.key}
                  className={[
                    col.sortable !== false ? 'sortable' : '',
                    sortKey === col.key && sortAsc ? 'sort-asc' : '',
                    sortKey === col.key && !sortAsc ? 'sort-desc' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => col.sortable !== false && toggleSort(col.key)}
                >{col.label}</th>
              ))}
              {actions.length > 0 && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colSpan} className="empty-state">
                <i className="ri-loader-4-line"></i> Loading...</td></tr>
            ) : !paginated.length ? (
              <tr><td colSpan={colSpan} className="empty-state">
                <i className="ri-inbox-line"></i> {emptyMessage}</td></tr>
            ) : paginated.map((row, i) => (
              <tr key={i} className={selectable && isRowSelected(i) ? styles.rowSelected : ''}>
                {selectable && (
                  <td className={styles.tdCheckbox}>
                    <input type="checkbox" checked={isRowSelected(i)} onChange={() => toggleRowSelect(i)} />
                  </td>
                )}
                <td>{startRow + i}</td>
                {visibleColumns.map(col => (
                  <td key={col.key}>
                    {renderCell && renderCell(row, col) !== null ? renderCell(row, col)
                    : col.type === 'badge' ? (
                      <span className={getBadgeClass(row[col.key], col)}>{row[col.key] ?? '—'}</span>
                    ) : col.type === 'image' ? (
                      row[col.key]
                        ? <img src={row[col.key]} className={styles.avatarImg} alt="avatar" />
                        : <span className={styles.avatarPlaceholder}><i className="ri-user-line"></i></span>
                    ) : col.type === 'currency' ? (
                      <span className={styles.currencyCell}>{formatCurrency(row[col.key])}</span>
                    ) : col.type === 'date' ? formatDate(row[col.key])
                    : (row[col.key] ?? '—')}
                  </td>
                ))}
                {actions.length > 0 && (
                  <td className={styles.tdActions}>
                    {actions.map(act => isActionVisible(act, row) ? (
                      <button key={act.action} className={act.class || styles.btnAction}
                        onClick={() => onActionClick?.({ action: act.action, row })}>
                        {act.icon && <i className={act.icon}></i>}{act.label}
                      </button>
                    ) : null)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {showFooterTotals && sorted.length > 0 && (
            <tfoot>
              <tr className={styles.footerTotals}>
                {selectable && <td></td>}
                <td></td>
                {visibleColumns.map(col => (
                  <td key={col.key}>
                    {footerTotals[col.key] !== undefined && (
                      <strong>{col.type === 'currency'
                        ? formatCurrency(footerTotals[col.key])
                        : footerTotals[col.key].toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                      }</strong>
                    )}
                  </td>
                ))}
                {actions.length > 0 && <td></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {sorted.length > pageSize && (
        <div className="pagination-bar">
          <span className="pag-info">Showing {startRow}&ndash;{endRow} of {sorted.length} records</span>
          <div className="pag-controls">
            <button className="pag-btn" onClick={() => goToPage(1)} disabled={currentPage === 1}>
              <i className="ri-arrow-left-double-line"></i></button>
            <button className="pag-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
              <i className="ri-arrow-left-s-line"></i></button>
            {pageNumbers.map(p => (
              <button key={p} className={`pag-btn ${p === currentPage ? 'active' : ''}`} onClick={() => goToPage(p)}>{p}</button>
            ))}
            <button className="pag-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
              <i className="ri-arrow-right-s-line"></i></button>
            <button className="pag-btn" onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>
              <i className="ri-arrow-right-double-line"></i></button>
          </div>
        </div>
      )}
    </>
  );
}
