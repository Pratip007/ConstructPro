'use client';

import { useCallback } from 'react';

/**
 * Format a number in the Indian numbering system.
 * Example: 1234567.89 -> "12,34,567.89"
 */
function formatIndian(num: number | string | null | undefined): string {
  if (num == null || num === '') return '0';

  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '0';

  const isNegative = n < 0;
  const abs = Math.abs(n);

  // Split into integer and decimal parts
  const parts = abs.toFixed(2).split('.');
  const intPart = parts[0];
  const decPart = parts[1];

  // Apply Indian grouping: last 3 digits, then groups of 2
  let formatted = '';
  if (intPart.length <= 3) {
    formatted = intPart;
  } else {
    // Last 3 digits
    formatted = intPart.slice(-3);
    let remaining = intPart.slice(0, -3);

    // Group remaining digits in pairs from right
    while (remaining.length > 2) {
      formatted = remaining.slice(-2) + ',' + formatted;
      remaining = remaining.slice(0, -2);
    }
    if (remaining.length > 0) {
      formatted = remaining + ',' + formatted;
    }
  }

  const result = formatted + '.' + decPart;
  return isNegative ? '-' + result : result;
}

/**
 * Format a number as Indian currency with Rupee symbol.
 * Example: 1234567.89 -> "₹12,34,567.89"
 */
function formatCurrency(num: number | string | null | undefined): string {
  return '₹' + formatIndian(num);
}

export function useIndianNumber() {
  const formatIndianCb = useCallback((num: number | string | null | undefined) => formatIndian(num), []);
  const formatCurrencyCb = useCallback((num: number | string | null | undefined) => formatCurrency(num), []);

  return {
    formatIndian: formatIndianCb,
    formatCurrency: formatCurrencyCb,
  };
}

// Also export standalone functions for non-hook usage
export { formatIndian, formatCurrency };
