'use client';

import { useCallback } from 'react';

interface ColumnDef {
  key: string;
  header: string;
}

export function useExport() {
  const exportExcel = useCallback(async (data: any[], fileName: string, sheetName: string = 'Sheet1', columns?: ColumnDef[]) => {
    const XLSX = (await import('xlsx')).default || await import('xlsx');
    const cols = columns || (data.length > 0 ? Object.keys(data[0]).map(k => ({ key: k, header: k })) : []);
    const wsData = [cols.map(c => c.header)];
    for (const row of data) {
      wsData.push(cols.map(c => row[c.key] ?? ''));
    }
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const colWidths = cols.map(c => ({
      wch: Math.max(c.header.length, ...data.slice(0, 100).map(r => String(r[c.key] ?? '').length)) + 2,
    }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }, []);

  const exportCSV = useCallback((data: any[], fileName: string, columns?: ColumnDef[]) => {
    const cols = columns || (data.length > 0 ? Object.keys(data[0]).map(k => ({ key: k, header: k })) : []);
    const headers = cols.map(c => c.header);
    const rows = data.map(row =>
      cols.map(c => {
        const val = String(row[c.key] ?? '');
        return val.includes(',') || val.includes('"') || val.includes('\n')
          ? `"${val.replace(/"/g, '""')}"`
          : val;
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${fileName}.csv`);
  }, []);

  const exportPDF = useCallback(async (data: any[], fileName: string, title: string, columns?: ColumnDef[]) => {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const cols = columns || (data.length > 0 ? Object.keys(data[0]).map(k => ({ key: k, header: k })) : []);
    const doc = new jsPDF('p', 'mm', 'a4');

    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 21);

    autoTable(doc, {
      startY: 26,
      head: [cols.map(c => c.header)],
      body: data.map(row => cols.map(c => String(row[c.key] ?? ''))),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 32, 53], textColor: [232, 234, 240], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
    });

    doc.save(`${fileName}.pdf`);
  }, []);

  const printTable = useCallback((elementId: string, title: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 20px; }
        h2 { margin-bottom: 4px; }
        .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px 10px; font-size: 12px; text-align: left; }
        th { background: #1a2035; color: #fff; font-weight: 700; }
        tr:nth-child(even) { background: #f5f7fa; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h2>${title}</h2>
      <p class="meta">Printed: ${new Date().toLocaleDateString('en-IN')}</p>
      ${element.innerHTML}
      </body></html>
    `);
    w.document.close();
    w.onload = () => { w.print(); w.close(); };
  }, []);

  const exportInvoicePDF = useCallback(async (invoiceData: any) => {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const { saveAs } = await import('file-saver');
    const doc = new jsPDF('p', 'mm', 'a4');

    const {
      company, billedTo, shippedTo, items, totals,
      bankDetails, terms, invoiceNo, invoiceDate, dueDate,
      isSameState,
    } = invoiceData;

    // Company header
    let y = 15;
    doc.setFontSize(16);
    doc.text(company?.name || 'Company', 14, y);
    y += 6;
    doc.setFontSize(9);
    if (company?.address) { doc.text(company.address, 14, y); y += 4; }
    if (company?.gstin) { doc.text(`GSTIN: ${company.gstin}`, 14, y); y += 4; }
    if (company?.phone) { doc.text(`Phone: ${company.phone}`, 14, y); y += 4; }

    // Invoice title + meta (right side)
    doc.setFontSize(14);
    doc.text('TAX INVOICE', 196, 15, { align: 'right' });
    doc.setFontSize(9);
    if (invoiceNo) doc.text(`Invoice #: ${invoiceNo}`, 196, 21, { align: 'right' });
    if (invoiceDate) doc.text(`Date: ${invoiceDate}`, 196, 25, { align: 'right' });
    if (dueDate) doc.text(`Due: ${dueDate}`, 196, 29, { align: 'right' });

    y += 2;
    doc.setDrawColor(200);
    doc.line(14, y, 196, y);
    y += 6;

    // Billed To
    if (billedTo) {
      doc.setFontSize(10);
      doc.text('Billed To:', 14, y);
      y += 4;
      doc.setFontSize(9);
      doc.text(billedTo.name || '', 14, y); y += 4;
      if (billedTo.address) { doc.text(billedTo.address, 14, y); y += 4; }
      if (billedTo.gstin) { doc.text(`GSTIN: ${billedTo.gstin}`, 14, y); y += 4; }
    }

    // Shipped To
    if (shippedTo) {
      const shipStartY = billedTo ? y - 12 : y;
      doc.setFontSize(10);
      doc.text('Shipped To:', 110, shipStartY);
      doc.setFontSize(9);
      doc.text(shippedTo.name || '', 110, shipStartY + 4);
      if (shippedTo.address) doc.text(shippedTo.address, 110, shipStartY + 8);
      if (shippedTo.gstin) doc.text(`GSTIN: ${shippedTo.gstin}`, 110, shipStartY + 12);
    }

    y += 6;

    // Items table
    if (items?.length) {
      const head = [['#', 'Description', 'HSN', 'Qty', 'Unit', 'Rate', 'GST%', 'Amount']];
      const body = items.map((item: any, i: number) => [
        i + 1,
        item.description || item.name,
        item.hsn || '-',
        item.qty || item.quantity,
        item.unit || '-',
        `₹${Number(item.rate || item.price || 0).toFixed(2)}`,
        item.gstRate ? `${item.gstRate}%` : '-',
        `₹${Number(item.amount || item.total || 0).toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: y,
        head,
        body,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [26, 32, 53], textColor: [232, 234, 240] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // GST breakdown (CGST/SGST or IGST)
    if (totals) {
      const totalsData: string[][] = [];
      if (totals.subtotal != null) totalsData.push(['Subtotal', `₹${Number(totals.subtotal).toFixed(2)}`]);

      if (isSameState !== false) {
        // Intra-state: CGST + SGST
        if (totals.cgst != null) totalsData.push(['CGST', `₹${Number(totals.cgst).toFixed(2)}`]);
        if (totals.sgst != null) totalsData.push(['SGST', `₹${Number(totals.sgst).toFixed(2)}`]);
      } else {
        // Inter-state: IGST
        if (totals.igst != null) totalsData.push(['IGST', `₹${Number(totals.igst).toFixed(2)}`]);
      }

      if (totals.tds != null) totalsData.push(['TDS', `- ₹${Number(totals.tds).toFixed(2)}`]);
      if (totals.total != null) totalsData.push(['Grand Total', `₹${Number(totals.total).toFixed(2)}`]);

      autoTable(doc, {
        startY: y,
        body: totalsData,
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'right' },
          1: { halign: 'right' },
        },
        margin: { left: 120, right: 14 },
        theme: 'plain',
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Amount in words
    if (totals?.total != null) {
      const words = amountInWordsHelper(totals.total);
      doc.setFontSize(9);
      doc.text(`Amount in Words: ${words}`, 14, y);
      y += 8;
    }

    // Bank details
    if (bankDetails) {
      doc.setFontSize(10);
      doc.text('Bank Details:', 14, y);
      y += 4;
      doc.setFontSize(8);
      if (bankDetails.bankName) { doc.text(`Bank: ${bankDetails.bankName}`, 14, y); y += 3.5; }
      if (bankDetails.accountNo) { doc.text(`A/C: ${bankDetails.accountNo}`, 14, y); y += 3.5; }
      if (bankDetails.ifsc) { doc.text(`IFSC: ${bankDetails.ifsc}`, 14, y); y += 3.5; }
      if (bankDetails.branch) { doc.text(`Branch: ${bankDetails.branch}`, 14, y); y += 3.5; }
    }

    // Terms & Conditions
    if (terms?.length) {
      y += 4;
      doc.setFontSize(10);
      doc.text('Terms & Conditions:', 14, y);
      y += 4;
      doc.setFontSize(7);
      terms.forEach((t: string) => { doc.text(`- ${t}`, 14, y); y += 3; });
    }

    doc.save(`${invoiceData.fileName || 'invoice'}.pdf`);
  }, []);

  return {
    exportExcel, exportCSV, exportPDF, printTable, exportInvoicePDF,
    exportToExcel: exportExcel, exportToCSV: exportCSV, exportToPDF: exportPDF, printReport: printTable,
  };
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function amountInWordsHelper(amount: number): string {
  if (amount === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const numToWords = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + numToWords(n % 100) : '');
  };

  const abs = Math.abs(Math.floor(amount));
  const paise = Math.round((amount - Math.floor(amount)) * 100);

  let result = '';
  const crore = Math.floor(abs / 10000000);
  const lakh = Math.floor((abs % 10000000) / 100000);
  const thousand = Math.floor((abs % 100000) / 1000);
  const remainder = abs % 1000;

  if (crore) result += numToWords(crore) + ' Crore ';
  if (lakh) result += numToWords(lakh) + ' Lakh ';
  if (thousand) result += numToWords(thousand) + ' Thousand ';
  if (remainder) result += numToWords(remainder);

  result = result.trim() + ' Rupees';
  if (paise > 0) result += ' and ' + numToWords(paise) + ' Paise';
  return result + ' Only';
}
