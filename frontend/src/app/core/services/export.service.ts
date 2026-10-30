import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable, { type UserOptions } from 'jspdf-autotable';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { amountInWords } from '../utils/amount-in-words';

export interface ExportColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: 'currency' | 'date' | 'number' | 'percent';
}

export interface PDFExportOptions {
  title: string;
  data: Record<string, any>[];
  columns: ExportColumn[];
  fileName: string;
  orientation?: 'portrait' | 'landscape';
  companyName?: string;
  companyAddress?: string;
  companyGstin?: string;
  dateRange?: { from: string; to: string };
  summaryRow?: Record<string, any>;
  footerLeft?: string;
  footerRight?: string;
  dualCopy?: { partyLabel: string };
}

export interface InvoiceItem {
  sno: number;
  description: string;
  hsnSac?: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
  gstRate?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
}

export interface InvoiceData {
  invoiceNo: string;
  invoiceDate: string;
  financialYear?: string;
  poRef?: string;
  companyName: string;
  companyAddress: string;
  companyGstin: string;
  companyPan?: string;
  companyStateCode?: string;
  billedTo: { name: string; address: string; gstin?: string; stateCode?: string };
  shippedTo?: { name: string; address: string; gstin?: string; stateCode?: string };
  items: InvoiceItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff?: number;
  grandTotal: number;
  isIgst: boolean;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  bankBranch?: string;
  termsAndConditions?: string[];
  reverseCharge?: boolean;
  challanNo?: string;
  transportMode?: string;
  eWayBill?: string;
}

@Injectable({ providedIn: 'root' })
export class ExportService {

  exportToExcel(data: Record<string, any>[], fileName: string, sheetName = 'Sheet1', columns?: ExportColumn[]): void {
    if (!data.length) return;
    const ws = this.buildWorksheet(data, columns);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }

  exportMultiSheetExcel(sheets: { name: string; data: Record<string, any>[]; columns?: ExportColumn[] }[], fileName: string): void {
    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
      const ws = this.buildWorksheet(sheet.data, sheet.columns);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31));
    }
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }

  exportToCSV(data: Record<string, any>[], fileName: string, columns?: ExportColumn[]): void {
    if (!data.length) return;
    const cols = columns ?? Object.keys(data[0]).map(key => ({ key, header: key }));
    const headerRow = cols.map(c => this.escapeCsv(c.header)).join(',');
    const rows = data.map(row =>
      cols.map(c => this.escapeCsv(this.formatValue(row[c.key], (c as ExportColumn).format))).join(',')
    );
    const bom = '﻿';
    const csv = bom + [headerRow, ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `${fileName}.csv`);
  }

  exportToPDF(options: PDFExportOptions): void {
    const { orientation = 'portrait', dualCopy } = options;

    if (dualCopy) {
      this.generateDualCopyPDF(options);
      return;
    }

    const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
    this.renderReportPage(doc, options, 0);
    doc.save(`${options.fileName}.pdf`);
  }

  printReport(elementId: string, title?: string): void {
    const element = document.getElementById(elementId);
    if (!element) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title ?? 'Print'}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 15mm; font-size: 11px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #333; padding: 4px 8px; font-size: 10px; }
  th { background: #f0f0f0; font-weight: 600; }
  td.number { text-align: right; }
  .title { font-size: 16px; font-weight: 700; margin-bottom: 8px; text-align: center; }
  .subtitle { font-size: 11px; color: #555; text-align: center; margin-bottom: 12px; }
  @page { size: A4; margin: 15mm; }
  @media print { body { padding: 0; } }
</style></head><body>`);

    if (title) {
      printWindow.document.write(`<div class="title">${title}</div>`);
    }
    printWindow.document.write(element.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  }

  async downloadAsZip(files: { name: string; content: Blob }[], zipName: string): Promise<void> {
    const zip = new JSZip();
    for (const file of files) {
      zip.file(file.name, file.content);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${zipName}.zip`);
  }

  generateInvoicePDF(invoice: InvoiceData): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // Border
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.rect(margin, margin, contentWidth, doc.internal.pageSize.getHeight() - margin * 2);

    // Header — Company
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.companyName, pageWidth / 2, y + 8, { align: 'center' });
    y += 12;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.companyAddress, pageWidth / 2, y + 3, { align: 'center' });
    y += 6;

    if (invoice.companyGstin) {
      doc.text(`GSTIN: ${invoice.companyGstin}`, pageWidth / 2, y + 3, { align: 'center' });
      y += 5;
    }
    if (invoice.companyPan) {
      doc.text(`PAN: ${invoice.companyPan}`, pageWidth / 2, y + 3, { align: 'center' });
      y += 5;
    }

    // Title
    y += 2;
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TAX INVOICE', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.line(margin, y, margin + contentWidth, y);
    y += 4;

    // Invoice Meta — left and right columns
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const leftX = margin + 3;
    const rightX = pageWidth / 2 + 3;

    doc.text(`Invoice No: ${invoice.invoiceNo}`, leftX, y);
    doc.text(`Date: ${invoice.invoiceDate}`, rightX, y);
    y += 5;
    if (invoice.financialYear) {
      doc.text(`F.Y.: ${invoice.financialYear}`, leftX, y);
    }
    if (invoice.poRef) {
      doc.text(`PO Ref: ${invoice.poRef}`, rightX, y);
    }
    y += 4;
    if (invoice.reverseCharge !== undefined) {
      doc.text(`Reverse Charge: ${invoice.reverseCharge ? 'Yes' : 'No'}`, leftX, y);
      y += 4;
    }

    // Billed To / Shipped To
    y += 2;
    doc.line(margin, y, margin + contentWidth, y);
    y += 4;

    const halfWidth = contentWidth / 2;

    doc.setFont('helvetica', 'bold');
    doc.text('Billed To:', leftX, y);
    if (invoice.shippedTo) {
      doc.text('Shipped To:', rightX, y);
    }
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(invoice.billedTo.name, leftX, y);
    if (invoice.shippedTo) doc.text(invoice.shippedTo.name, rightX, y);
    y += 4;

    const billedAddrLines = doc.splitTextToSize(invoice.billedTo.address, halfWidth - 6);
    doc.text(billedAddrLines, leftX, y);
    if (invoice.shippedTo) {
      const shippedAddrLines = doc.splitTextToSize(invoice.shippedTo.address, halfWidth - 6);
      doc.text(shippedAddrLines, rightX, y);
    }
    y += Math.max(billedAddrLines.length, invoice.shippedTo ? doc.splitTextToSize(invoice.shippedTo.address, halfWidth - 6).length : 0) * 4;

    if (invoice.billedTo.gstin) {
      doc.text(`GSTIN: ${invoice.billedTo.gstin}`, leftX, y);
    }
    if (invoice.shippedTo?.gstin) {
      doc.text(`GSTIN: ${invoice.shippedTo.gstin}`, rightX, y);
    }
    y += 5;

    // Items Table
    y += 2;
    const itemColumns: any[] = [
      { header: 'S.No', dataKey: 'sno' },
      { header: 'Description', dataKey: 'description' },
      { header: 'HSN/SAC', dataKey: 'hsnSac' },
      { header: 'Qty', dataKey: 'qty' },
      { header: 'Unit', dataKey: 'unit' },
      { header: 'Rate (₹)', dataKey: 'rate' },
      { header: 'Amount (₹)', dataKey: 'amount' },
    ];

    if (invoice.isIgst) {
      itemColumns.push({ header: 'IGST %', dataKey: 'gstRate' });
      itemColumns.push({ header: 'IGST (₹)', dataKey: 'igst' });
    } else {
      itemColumns.push({ header: 'CGST %', dataKey: 'cgstRate' });
      itemColumns.push({ header: 'CGST (₹)', dataKey: 'cgst' });
      itemColumns.push({ header: 'SGST %', dataKey: 'sgstRate' });
      itemColumns.push({ header: 'SGST (₹)', dataKey: 'sgst' });
    }

    const itemRows: Record<string, any>[] = invoice.items.map(item => ({
      ...item,
      rate: this.formatCurrency(item.rate),
      amount: this.formatCurrency(item.amount),
      cgstRate: item.gstRate ? (item.gstRate / 2).toFixed(1) : '',
      cgst: item.cgst ? this.formatCurrency(item.cgst) : '',
      sgstRate: item.gstRate ? (item.gstRate / 2).toFixed(1) : '',
      sgst: item.sgst ? this.formatCurrency(item.sgst) : '',
      igst: item.igst ? this.formatCurrency(item.igst) : '',
      gstRate: item.gstRate ?? '',
    }));

    autoTable(doc, {
      startY: y,
      head: [itemColumns.map(c => c.header)],
      body: itemRows.map(row => itemColumns.map(c => (row as any)[c.dataKey] ?? '')),
      margin: { left: margin + 1, right: margin + 1 },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto' },
        3: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      theme: 'grid',
    });

    y = (doc as any).lastAutoTable.finalY + 5;

    // Totals Section
    const totalsX = pageWidth - margin - 65;
    doc.setFontSize(9);

    const addTotalRow = (label: string, value: string, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(label, totalsX, y);
      doc.text(value, pageWidth - margin - 3, y, { align: 'right' });
      y += 5;
    };

    addTotalRow('Subtotal:', this.formatCurrency(invoice.subtotal));

    if (invoice.isIgst) {
      addTotalRow('IGST:', this.formatCurrency(invoice.igst));
    } else {
      addTotalRow('CGST:', this.formatCurrency(invoice.cgst));
      addTotalRow('SGST:', this.formatCurrency(invoice.sgst));
    }

    if (invoice.roundOff !== undefined && invoice.roundOff !== 0) {
      addTotalRow('Round Off:', (invoice.roundOff >= 0 ? '+' : '') + invoice.roundOff.toFixed(2));
    }

    addTotalRow('Grand Total:', '₹ ' + this.formatCurrency(invoice.grandTotal), true);
    y += 2;

    // Amount in Words
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Amount in Words: ${amountInWords(invoice.grandTotal)}`, margin + 3, y);
    y += 8;

    // Bank Details
    if (invoice.bankName) {
      doc.line(margin, y, margin + contentWidth, y);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Bank Details:', margin + 3, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Bank: ${invoice.bankName}`, margin + 3, y);
      y += 4;
      if (invoice.bankAccount) {
        doc.text(`A/C No: ${invoice.bankAccount}`, margin + 3, y);
        y += 4;
      }
      if (invoice.bankIfsc) {
        doc.text(`IFSC: ${invoice.bankIfsc}`, margin + 3, y);
        y += 4;
      }
      if (invoice.bankBranch) {
        doc.text(`Branch: ${invoice.bankBranch}`, margin + 3, y);
        y += 4;
      }
    }

    // Terms
    if (invoice.termsAndConditions?.length) {
      y += 3;
      doc.line(margin, y, margin + contentWidth, y);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Terms & Conditions:', margin + 3, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      for (const tc of invoice.termsAndConditions) {
        const lines = doc.splitTextToSize(`• ${tc}`, contentWidth - 6);
        doc.text(lines, margin + 3, y);
        y += lines.length * 3.5;
      }
    }

    // Signature
    const pageHeight = doc.internal.pageSize.getHeight();
    const sigY = pageHeight - margin - 20;
    doc.line(margin, sigY, margin + contentWidth, sigY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Receiver\'s Signature', margin + 3, sigY + 15);
    doc.setFont('helvetica', 'bold');
    doc.text(`For ${invoice.companyName}`, pageWidth - margin - 3, sigY + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text('Authorized Signatory', pageWidth - margin - 3, sigY + 15, { align: 'right' });

    doc.save(`Invoice_${invoice.invoiceNo}.pdf`);
  }

  // --- Private helpers ---

  private buildWorksheet(data: Record<string, any>[], columns?: ExportColumn[]): XLSX.WorkSheet {
    if (!columns) {
      return XLSX.utils.json_to_sheet(data);
    }
    const headers = columns.map(c => c.header);
    const rows = data.map(row => columns.map(c => {
      const val = row[c.key];
      if (c.format === 'currency' && typeof val === 'number') return val;
      if (c.format === 'percent' && typeof val === 'number') return val / 100;
      return val ?? '';
    }));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    if (columns.some(c => c.width)) {
      ws['!cols'] = columns.map(c => ({ wch: c.width ?? 15 }));
    }
    return ws;
  }

  private generateDualCopyPDF(options: PDFExportOptions): void {
    const doc = new jsPDF({ orientation: options.orientation ?? 'portrait', unit: 'mm', format: 'a4' });
    const pageHeight = doc.internal.pageSize.getHeight();

    this.renderReportPage(doc, options, 0, 'Office Copy');

    const midY = pageHeight / 2;
    doc.setLineDashPattern([3, 2], 0);
    doc.setDrawColor(150);
    doc.line(10, midY, doc.internal.pageSize.getWidth() - 10, midY);
    doc.setFontSize(6);
    doc.text('✂ Cut Here', doc.internal.pageSize.getWidth() / 2, midY - 1, { align: 'center' });
    doc.setLineDashPattern([], 0);

    this.renderReportPage(doc, options, midY + 3, `${options.dualCopy!.partyLabel} Copy`);

    doc.save(`${options.fileName}.pdf`);
  }

  private renderReportPage(doc: jsPDF, options: PDFExportOptions, startY: number, copyLabel?: string): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 12;
    let y = startY + 8;

    // Company Header
    if (options.companyName) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(options.companyName, pageWidth / 2, y, { align: 'center' });
      y += 6;
    }
    if (options.companyAddress) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(options.companyAddress, pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    if (options.companyGstin) {
      doc.text(`GSTIN: ${options.companyGstin}`, pageWidth / 2, y, { align: 'center' });
      y += 4;
    }

    // Title + copy label
    y += 2;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const titleText = copyLabel ? `${options.title} — ${copyLabel}` : options.title;
    doc.text(titleText, pageWidth / 2, y, { align: 'center' });
    y += 5;

    // Date range
    if (options.dateRange) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Period: ${options.dateRange.from} to ${options.dateRange.to}`, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }

    // Table
    const cols = options.columns;
    const head = [cols.map(c => c.header)];
    const body = options.data.map(row =>
      cols.map(c => this.formatValue(row[c.key], c.format))
    );

    if (options.summaryRow) {
      body.push(cols.map(c => {
        const val = options.summaryRow![c.key];
        return val !== undefined ? this.formatValue(val, c.format) : '';
      }));
    }

    const columnStyles: Record<number, any> = {};
    cols.forEach((c, i) => {
      if (c.align) columnStyles[i] = { halign: c.align };
      if (c.format === 'currency' || c.format === 'number') columnStyles[i] = { ...columnStyles[i], halign: 'right' };
    });

    autoTable(doc, {
      startY: y,
      head,
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      columnStyles,
      theme: 'grid',
      didParseCell: (data) => {
        if (options.summaryRow && data.section === 'body' && data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
    } as UserOptions);

    y = (doc as any).lastAutoTable.finalY + 8;

    // Footer signatures
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(options.footerLeft ?? 'Prepared By', margin, y);
    doc.text(options.footerRight ?? 'Authorized Signatory', pageWidth - margin, y, { align: 'right' });
  }

  private formatValue(val: any, format?: string): string {
    if (val == null) return '';
    if (format === 'currency' && typeof val === 'number') return this.formatCurrency(val);
    if (format === 'percent' && typeof val === 'number') return val.toFixed(2) + '%';
    if (format === 'number' && typeof val === 'number') return val.toLocaleString('en-IN');
    if (format === 'date' && val) {
      const d = val instanceof Date ? val : new Date(val);
      return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('en-IN');
    }
    if (typeof val === 'number') return val.toLocaleString('en-IN');
    if (val instanceof Date) return val.toLocaleDateString('en-IN');
    return String(val);
  }

  private formatCurrency(val: number): string {
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private escapeCsv(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }
}
