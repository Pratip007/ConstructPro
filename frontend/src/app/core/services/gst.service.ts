import { Injectable } from '@angular/core';

export interface GstBreakdown {
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  grossAmount: number;
  isIgst: boolean;
}

export interface TDSResult {
  tdsAmount: number;
  netPayable: number;
}

export interface IndianState {
  code: string;
  name: string;
  stateCode: string;
}

@Injectable({ providedIn: 'root' })
export class GstService {
  readonly GST_RATES = [0, 5, 12, 18, 28] as const;

  readonly INDIAN_STATES: IndianState[] = [
    { code: 'AN', name: 'Andaman and Nicobar Islands', stateCode: '35' },
    { code: 'AP', name: 'Andhra Pradesh', stateCode: '37' },
    { code: 'AR', name: 'Arunachal Pradesh', stateCode: '12' },
    { code: 'AS', name: 'Assam', stateCode: '18' },
    { code: 'BR', name: 'Bihar', stateCode: '10' },
    { code: 'CH', name: 'Chandigarh', stateCode: '04' },
    { code: 'CT', name: 'Chhattisgarh', stateCode: '22' },
    { code: 'DD', name: 'Dadra and Nagar Haveli and Daman and Diu', stateCode: '26' },
    { code: 'DL', name: 'Delhi', stateCode: '07' },
    { code: 'GA', name: 'Goa', stateCode: '30' },
    { code: 'GJ', name: 'Gujarat', stateCode: '24' },
    { code: 'HR', name: 'Haryana', stateCode: '06' },
    { code: 'HP', name: 'Himachal Pradesh', stateCode: '02' },
    { code: 'JK', name: 'Jammu and Kashmir', stateCode: '01' },
    { code: 'JH', name: 'Jharkhand', stateCode: '20' },
    { code: 'KA', name: 'Karnataka', stateCode: '29' },
    { code: 'KL', name: 'Kerala', stateCode: '32' },
    { code: 'LA', name: 'Ladakh', stateCode: '38' },
    { code: 'LD', name: 'Lakshadweep', stateCode: '31' },
    { code: 'MP', name: 'Madhya Pradesh', stateCode: '23' },
    { code: 'MH', name: 'Maharashtra', stateCode: '27' },
    { code: 'MN', name: 'Manipur', stateCode: '14' },
    { code: 'ML', name: 'Meghalaya', stateCode: '17' },
    { code: 'MZ', name: 'Mizoram', stateCode: '15' },
    { code: 'NL', name: 'Nagaland', stateCode: '13' },
    { code: 'OD', name: 'Odisha', stateCode: '21' },
    { code: 'PY', name: 'Puducherry', stateCode: '34' },
    { code: 'PB', name: 'Punjab', stateCode: '03' },
    { code: 'RJ', name: 'Rajasthan', stateCode: '08' },
    { code: 'SK', name: 'Sikkim', stateCode: '11' },
    { code: 'TN', name: 'Tamil Nadu', stateCode: '33' },
    { code: 'TG', name: 'Telangana', stateCode: '36' },
    { code: 'TR', name: 'Tripura', stateCode: '16' },
    { code: 'UP', name: 'Uttar Pradesh', stateCode: '09' },
    { code: 'UK', name: 'Uttarakhand', stateCode: '05' },
    { code: 'WB', name: 'West Bengal', stateCode: '19' },
  ];

  calculateGst(baseAmount: number, gstRate: number, sellerStateCode: string, buyerStateCode: string): GstBreakdown {
    const totalGst = this.round(baseAmount * gstRate / 100);
    const isIgst = sellerStateCode !== buyerStateCode;

    if (isIgst) {
      return {
        cgst: 0,
        sgst: 0,
        igst: totalGst,
        totalGst,
        grossAmount: this.round(baseAmount + totalGst),
        isIgst: true,
      };
    }

    const halfGst = this.round(totalGst / 2);
    return {
      cgst: halfGst,
      sgst: this.round(totalGst - halfGst),
      igst: 0,
      totalGst,
      grossAmount: this.round(baseAmount + totalGst),
      isIgst: false,
    };
  }

  calculateTDS(amount: number, tdsRate: number): TDSResult {
    const tdsAmount = this.round(amount * tdsRate / 100);
    return { tdsAmount, netPayable: this.round(amount - tdsAmount) };
  }

  getStateByCode(code: string): IndianState | undefined {
    return this.INDIAN_STATES.find(s => s.code === code || s.stateCode === code);
  }

  getStateFromGSTIN(gstin: string): IndianState | undefined {
    if (!gstin || gstin.length < 2) return undefined;
    return this.INDIAN_STATES.find(s => s.stateCode === gstin.substring(0, 2));
  }

  formatGSTIN(gstin: string): string {
    return gstin.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 15);
  }

  validateGSTIN(gstin: string): boolean {
    if (!gstin || gstin.length !== 15) return false;
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.toUpperCase());
  }

  getFinancialYear(date?: Date): string {
    const d = date ?? new Date();
    const year = d.getFullYear();
    const month = d.getMonth();
    const startYear = month >= 3 ? year : year - 1;
    const endYear = startYear + 1;
    return `${startYear}-${String(endYear).slice(2)}`;
  }

  getFinancialYearRange(fy: string): { start: Date; end: Date } {
    const startYear = parseInt(fy.split('-')[0], 10);
    return {
      start: new Date(startYear, 3, 1),
      end: new Date(startYear + 1, 2, 31, 23, 59, 59, 999),
    };
  }

  amountInWords(amount: number): string {
    if (amount === 0) return 'Zero Rupees Only';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const numToWords = (n: number): string => {
      if (n === 0) return '';
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + numToWords(n % 100) : '');
      if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
      if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
      return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '');
    };

    const rupees = Math.floor(amount);
    const paise = Math.round((amount - rupees) * 100);
    let result = numToWords(rupees) + ' Rupees';
    if (paise > 0) result += ' and ' + numToWords(paise) + ' Paise';
    return result + ' Only';
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
