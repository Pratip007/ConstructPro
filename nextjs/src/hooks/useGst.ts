'use client';

import { useCallback } from 'react';

export const GST_RATES = [0, 5, 12, 18, 28];

export const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' },
  { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
];

export interface GstBreakdown {
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  total: number;
}

export function useGst() {
  const calculateGST = useCallback((baseAmount: number, gstRate: number, isSameState: boolean): GstBreakdown => {
    const totalGst = Math.round(baseAmount * gstRate / 100 * 100) / 100;
    const halfGst = Math.round(totalGst / 2 * 100) / 100;

    return {
      cgst: isSameState ? halfGst : 0,
      sgst: isSameState ? halfGst : 0,
      igst: isSameState ? 0 : totalGst,
      totalGst,
      total: Math.round((baseAmount + totalGst) * 100) / 100,
    };
  }, []);

  const validateGSTIN = useCallback((gstin: string): boolean => {
    if (!gstin) return false;
    const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return pattern.test(gstin.toUpperCase());
  }, []);

  const getStateFromGSTIN = useCallback((gstin: string) => {
    if (!gstin || gstin.length < 2) return null;
    const code = gstin.substring(0, 2);
    return INDIAN_STATES.find(s => s.code === code) || null;
  }, []);

  const getFinancialYear = useCallback((): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (month >= 3) return `${year}-${(year + 1).toString().slice(-2)}`;
    return `${year - 1}-${year.toString().slice(-2)}`;
  }, []);

  const amountInWords = useCallback((amount: number): string => {
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
  }, []);

  return {
    calculateGST,
    validateGSTIN,
    getStateFromGSTIN,
    getFinancialYear,
    amountInWords,
    GST_RATES,
    INDIAN_STATES,
  };
}
