'use client';

import { amountInWords } from './gst-utils';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: string;
  align?: string;
  [extra: string]: unknown;
}

export interface PDFExportOptions {
  title: string;
  columns: ExportColumn[];
  data: Record<string, unknown>[];
  orientation?: 'portrait' | 'landscape';
  fileName?: string;
  subtitle?: string;
  summary?: Record<string, string | number>[];
  summaryRow?: Record<string, unknown>;
  companyName?: string;
  [extra: string]: unknown;
}

export interface InvoiceItem {
  sno: number;
  description: string;
  hsn?: string;
  qty: number;
  unit?: string;
  rate: number;
  amount: number;
  gstRate?: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  poNumber?: string;
  companyName: string;
  companyAddress: string;
  companyGSTIN?: string;
  companyPAN?: string;
  companyPhone?: string;
  companyEmail?: string;
  billedTo: {
    name: string;
    address: string;
    gstin?: string;
    state?: string;
    stateCode?: string;
  };
  shippedTo?: {
    name: string;
    address: string;
    gstin?: string;
    state?: string;
    stateCode?: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalGst: number;
  totalAmount: number;
  roundOff?: number;
  grandTotal: number;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branch?: string;
  };
  terms?: string[];
  notes?: string;
  isInterState?: boolean;
  supplierState?: string;
  supplierStateCode?: string;
  dualCopy?: boolean;
}

function formatCellValue(value: unknown, format?: string): string {
  if (value == null) return '';
  if (format === 'currency') return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (format === 'number') return Number(value).toLocaleString('en-IN');
  if (format === 'percentage') return `${Number(value).toFixed(2)}%`;
  if (format === 'date') {
    const d = new Date(value as string);
    return d.toLocaleDateString('en-IN');
  }
  return String(value);
}

export async function exportToExcel(
  dataOrColumns: any[] | Record<string, unknown>[],
  fileNameOrData?: string | Record<string, unknown>[],
  sheetNameOrFileName?: string,
  columnsArg?: ExportColumn[]
): Promise<void> {
  const XLSX = await import('xlsx');

  let data: Record<string, unknown>[];
  let fileName: string;
  let columns: ExportColumn[] | undefined;
  let sheetName = 'Sheet1';

  if (typeof fileNameOrData === 'string') {
    // Pattern: exportToExcel(data, fileName) or exportToExcel(data, fileName, sheetName, columns)
    data = dataOrColumns as Record<string, unknown>[];
    fileName = fileNameOrData;
    if (typeof sheetNameOrFileName === 'string') sheetName = sheetNameOrFileName;
    if (columnsArg) columns = columnsArg;
  } else if (Array.isArray(fileNameOrData)) {
    // Pattern: exportToExcel(columns, data, fileName)
    columns = dataOrColumns as ExportColumn[];
    data = fileNameOrData;
    fileName = (sheetNameOrFileName as string) || 'export';
  } else {
    data = dataOrColumns as Record<string, unknown>[];
    fileName = 'export';
  }

  if (columns && columns.length > 0) {
    const wsData: any[][] = [columns.map(c => c.header)];
    data.forEach(row => {
      wsData.push(columns!.map(c => formatCellValue(row[c.key], c.format)));
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    columns.forEach((col, i) => {
      if (!ws['!cols']) ws['!cols'] = [];
      ws['!cols'][i] = { wch: col.width || 15 };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  } else {
    // Auto-detect columns from data keys
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }
}

export async function exportMultiSheetExcel(
  sheets: { name: string; columns?: ExportColumn[]; data: Record<string, unknown>[] }[],
  fileName: string
): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  sheets.forEach(sheet => {
    if (sheet.columns && sheet.columns.length > 0) {
      const wsData: any[][] = [sheet.columns.map(c => c.header)];
      sheet.data.forEach(row => {
        wsData.push(sheet.columns!.map(c => formatCellValue(row[c.key], c.format)));
      });
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      sheet.columns.forEach((col, i) => {
        if (!ws['!cols']) ws['!cols'] = [];
        ws['!cols'][i] = { wch: col.width || 15 };
      });
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31));
    } else {
      const ws = XLSX.utils.json_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31));
    }
  });
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export async function exportToCSV(
  dataOrColumns: any[],
  fileNameOrData?: string | Record<string, unknown>[],
  columnsOrFileName?: ExportColumn[] | string,
): Promise<void> {
  const { saveAs } = await import('file-saver');

  let data: Record<string, unknown>[];
  let fileName: string;
  let columns: ExportColumn[] | undefined;

  if (typeof fileNameOrData === 'string') {
    data = dataOrColumns as Record<string, unknown>[];
    fileName = fileNameOrData;
    if (Array.isArray(columnsOrFileName)) columns = columnsOrFileName;
  } else if (Array.isArray(fileNameOrData)) {
    columns = dataOrColumns as ExportColumn[];
    data = fileNameOrData;
    fileName = (columnsOrFileName as string) || 'export';
  } else {
    data = dataOrColumns as Record<string, unknown>[];
    fileName = 'export';
  }

  if (columns && columns.length > 0) {
    const header = columns.map(c => `"${c.header}"`).join(',');
    const rows = data.map(row =>
      columns!.map(c => {
        const val = formatCellValue(row[c.key], c.format);
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${fileName}.csv`);
  } else {
    const keys = data.length > 0 ? Object.keys(data[0]) : [];
    const header = keys.map(k => `"${k}"`).join(',');
    const rows = data.map(row =>
      keys.map(k => {
        const val = String(row[k] ?? '');
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${fileName}.csv`);
  }
}

export async function exportToPDF(optionsOrTitle: PDFExportOptions | string, headers?: string[], bodyData?: any[][]): Promise<void> {
  if (typeof optionsOrTitle === 'string') {
    const { jsPDF } = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text(optionsOrTitle, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 21);
    autoTable(doc, {
      startY: 26,
      head: headers ? [headers] : [],
      body: bodyData || [],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    doc.save(`${optionsOrTitle.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    return;
  }
  const options = optionsOrTitle;
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default;

  const { title, columns, data, orientation = 'landscape', fileName, subtitle, summary, companyName } = options;
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  let yPos = 15;

  if (companyName) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' });
    yPos += 8;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' });
  yPos += 6;

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' });
    yPos += 6;
  }

  const tableData = data.map(row =>
    columns.map(c => formatCellValue(row[c.key], c.format))
  );

  autoTable(doc, {
    head: [columns.map(c => c.header)],
    body: tableData,
    startY: yPos,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: columns.reduce((acc: any, col: ExportColumn, i: number) => {
      if (col.format === 'currency' || col.format === 'number') {
        acc[i] = { halign: 'right' as const };
      }
      return acc;
    }, {} as any),
  });

  if (summary && summary.length > 0) {
    const finalY = (doc as any).lastAutoTable?.finalY || yPos + 20;
    let summaryY = finalY + 10;
    doc.setFontSize(9);
    summary.forEach(item => {
      Object.entries(item).forEach(([key, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${key}: `, 14, summaryY);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value), 60, summaryY);
        summaryY += 5;
      });
    });
  }

  doc.save(`${fileName || title}.pdf`);
}

export function printReport(titleOrElementId: string, contentOrTitle?: string, styles?: string): void {
  let title: string;
  let content: string;

  if (typeof window !== 'undefined' && contentOrTitle) {
    const el = document.getElementById(titleOrElementId);
    if (el) {
      title = contentOrTitle;
      content = `<h1>${title}</h1><p style="font-size:12px;color:#666;">Printed: ${new Date().toLocaleDateString('en-IN')}</p>${el.innerHTML}`;
    } else {
      title = titleOrElementId;
      content = contentOrTitle;
    }
  } else {
    title = titleOrElementId;
    const el = typeof window !== 'undefined' ? document.querySelector('table') : null;
    content = el ? `<h1>${title}</h1><p style="font-size:12px;color:#666;">Printed: ${new Date().toLocaleDateString('en-IN')}</p>${el.outerHTML}` : `<h1>${title}</h1>`;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #2c3e50; color: white; }
        tr:nth-child(even) { background-color: #f5f5f5; }
        h1 { font-size: 18px; text-align: center; margin-bottom: 5px; }
        h2 { font-size: 14px; text-align: center; color: #666; margin-top: 0; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        @media print { body { padding: 0; } }
        ${styles || ''}
      </style>
    </head>
    <body>${content}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 500);
}

export async function downloadAsZip(
  files: { name: string; content: Blob | string }[],
  zipFileName: string
): Promise<void> {
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default;
  const { saveAs } = await import('file-saver');

  const zip = new JSZip();
  files.forEach(file => {
    zip.file(file.name, file.content);
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${zipFileName}.zip`);
}

export async function generateInvoicePDF(invoice: InvoiceData): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  function drawInvoiceCopy(startY: number, copyLabel: string) {
    let y = startY;

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.companyName, pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.companyAddress, pageWidth / 2, y, { align: 'center' });
    y += 4;

    if (invoice.companyGSTIN) {
      doc.text(`GSTIN: ${invoice.companyGSTIN}`, pageWidth / 2, y, { align: 'center' });
      y += 4;
    }

    // Tax Invoice title
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TAX INVOICE', pageWidth / 2, y, { align: 'center' });
    y += 2;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text(`(${copyLabel})`, pageWidth / 2, y, { align: 'center' });
    y += 5;

    // Invoice details
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice No: ${invoice.invoiceNumber}`, margin, y);
    doc.text(`Date: ${invoice.invoiceDate}`, pageWidth - margin, y, { align: 'right' });
    y += 4;

    if (invoice.poNumber) {
      doc.text(`PO No: ${invoice.poNumber}`, margin, y);
      y += 4;
    }

    // Billed To / Shipped To
    const halfWidth = contentWidth / 2 - 2;
    doc.setDrawColor(200);
    doc.rect(margin, y, halfWidth, 20);
    doc.rect(margin + halfWidth + 4, y, halfWidth, 20);

    doc.setFont('helvetica', 'bold');
    doc.text('Billed To:', margin + 2, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(invoice.billedTo.name, margin + 2, y + 8);
    doc.text(invoice.billedTo.address, margin + 2, y + 12, { maxWidth: halfWidth - 4 });
    if (invoice.billedTo.gstin) doc.text(`GSTIN: ${invoice.billedTo.gstin}`, margin + 2, y + 18);

    const shipTo = invoice.shippedTo || invoice.billedTo;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Shipped To:', margin + halfWidth + 6, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(shipTo.name, margin + halfWidth + 6, y + 8);
    doc.text(shipTo.address, margin + halfWidth + 6, y + 12, { maxWidth: halfWidth - 4 });
    if (shipTo.gstin) doc.text(`GSTIN: ${shipTo.gstin}`, margin + halfWidth + 6, y + 18);

    y += 23;

    // Items table
    const itemsData = invoice.items.map(item => [
      item.sno,
      item.description,
      item.hsn || '',
      item.qty,
      item.unit || 'Nos',
      `₹${item.rate.toFixed(2)}`,
      `₹${item.amount.toFixed(2)}`,
    ]);

    autoTable(doc, {
      head: [['S.No', 'Description', 'HSN/SAC', 'Qty', 'Unit', 'Rate', 'Amount']],
      body: itemsData,
      startY: y,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 55 },
        4: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 3;

    // Totals
    const totalsX = pageWidth - margin - 60;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', totalsX, y);
    doc.text(`₹${invoice.subtotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 4;

    if (invoice.isInterState) {
      doc.text(`IGST:`, totalsX, y);
      doc.text(`₹${(invoice.igst || 0).toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
      y += 4;
    } else {
      doc.text(`CGST:`, totalsX, y);
      doc.text(`₹${(invoice.cgst || 0).toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
      y += 4;
      doc.text(`SGST:`, totalsX, y);
      doc.text(`₹${(invoice.sgst || 0).toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
      y += 4;
    }

    if (invoice.roundOff !== undefined && invoice.roundOff !== 0) {
      doc.text('Round Off:', totalsX, y);
      doc.text(`₹${invoice.roundOff.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
      y += 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Grand Total:', totalsX, y);
    doc.text(`₹${invoice.grandTotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 5;

    // Amount in words
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text(`Amount in Words: ${amountInWords(invoice.grandTotal)}`, margin, y);
    y += 5;

    // Bank details
    if (invoice.bankDetails) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Bank Details:', margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`Bank: ${invoice.bankDetails.bankName}`, margin, y); y += 3;
      doc.text(`A/C No: ${invoice.bankDetails.accountNumber}`, margin, y); y += 3;
      doc.text(`IFSC: ${invoice.bankDetails.ifscCode}`, margin, y); y += 3;
      if (invoice.bankDetails.branch) {
        doc.text(`Branch: ${invoice.bankDetails.branch}`, margin, y); y += 3;
      }
      y += 2;
    }

    // Terms
    if (invoice.terms && invoice.terms.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('Terms & Conditions:', margin, y);
      y += 3;
      doc.setFont('helvetica', 'normal');
      invoice.terms.forEach(term => {
        doc.text(`• ${term}`, margin + 2, y);
        y += 3;
      });
      y += 2;
    }

    // Signature
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`For ${invoice.companyName}`, pageWidth - margin, y, { align: 'right' });
    y += 12;
    doc.text('Authorised Signatory', pageWidth - margin, y, { align: 'right' });

    return y;
  }

  if (invoice.dualCopy) {
    drawInvoiceCopy(10, 'Office Copy');
    const midY = doc.internal.pageSize.getHeight() / 2;
    doc.setDrawColor(150);
    doc.setLineDashPattern([3, 3], 0);
    doc.line(margin, midY, pageWidth - margin, midY);
    doc.setFontSize(6);
    doc.text('--- Cut Here ---', pageWidth / 2, midY - 1, { align: 'center' });
    doc.setLineDashPattern([], 0);
    drawInvoiceCopy(midY + 5, 'Party Copy');
  } else {
    drawInvoiceCopy(10, 'Original');
  }

  doc.save(`${invoice.invoiceNumber || 'invoice'}.pdf`);
}
