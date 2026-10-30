export const GST_RATES = [0, 5, 12, 18, 28];

export interface IndianState {
  code: string;
  name: string;
  tin: string;
}

export const INDIAN_STATES: IndianState[] = [
  { code: '01', name: 'Jammu & Kashmir', tin: '01' },
  { code: '02', name: 'Himachal Pradesh', tin: '02' },
  { code: '03', name: 'Punjab', tin: '03' },
  { code: '04', name: 'Chandigarh', tin: '04' },
  { code: '05', name: 'Uttarakhand', tin: '05' },
  { code: '06', name: 'Haryana', tin: '06' },
  { code: '07', name: 'Delhi', tin: '07' },
  { code: '08', name: 'Rajasthan', tin: '08' },
  { code: '09', name: 'Uttar Pradesh', tin: '09' },
  { code: '10', name: 'Bihar', tin: '10' },
  { code: '11', name: 'Sikkim', tin: '11' },
  { code: '12', name: 'Arunachal Pradesh', tin: '12' },
  { code: '13', name: 'Nagaland', tin: '13' },
  { code: '14', name: 'Manipur', tin: '14' },
  { code: '15', name: 'Mizoram', tin: '15' },
  { code: '16', name: 'Tripura', tin: '16' },
  { code: '17', name: 'Meghalaya', tin: '17' },
  { code: '18', name: 'Assam', tin: '18' },
  { code: '19', name: 'West Bengal', tin: '19' },
  { code: '20', name: 'Jharkhand', tin: '20' },
  { code: '21', name: 'Odisha', tin: '21' },
  { code: '22', name: 'Chhattisgarh', tin: '22' },
  { code: '23', name: 'Madhya Pradesh', tin: '23' },
  { code: '24', name: 'Gujarat', tin: '24' },
  { code: '25', name: 'Daman & Diu', tin: '25' },
  { code: '26', name: 'Dadra & Nagar Haveli', tin: '26' },
  { code: '27', name: 'Maharashtra', tin: '27' },
  { code: '29', name: 'Karnataka', tin: '29' },
  { code: '30', name: 'Goa', tin: '30' },
  { code: '31', name: 'Lakshadweep', tin: '31' },
  { code: '32', name: 'Kerala', tin: '32' },
  { code: '33', name: 'Tamil Nadu', tin: '33' },
  { code: '34', name: 'Puducherry', tin: '34' },
  { code: '35', name: 'Andaman & Nicobar Islands', tin: '35' },
  { code: '36', name: 'Telangana', tin: '36' },
  { code: '37', name: 'Andhra Pradesh', tin: '37' },
];

export interface GstCalculation {
  baseAmount: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  totalAmount: number;
  isInterState: boolean;
}

export function calculateGst(
  baseAmount: number,
  gstRate: number,
  supplierState: string,
  buyerState: string
): GstCalculation {
  const isInterState = supplierState !== buyerState;
  const totalGst = (baseAmount * gstRate) / 100;
  return {
    baseAmount,
    gstRate,
    cgst: isInterState ? 0 : totalGst / 2,
    sgst: isInterState ? 0 : totalGst / 2,
    igst: isInterState ? totalGst : 0,
    totalGst,
    totalAmount: baseAmount + totalGst,
    isInterState,
  };
}

export interface TdsCalculation {
  baseAmount: number;
  tdsRate: number;
  tdsAmount: number;
  netAmount: number;
}

export function calculateTDS(baseAmount: number, tdsRate: number): TdsCalculation {
  const tdsAmount = (baseAmount * tdsRate) / 100;
  return {
    baseAmount,
    tdsRate,
    tdsAmount,
    netAmount: baseAmount - tdsAmount,
  };
}

export function getStateByCode(code: string): IndianState | undefined {
  return INDIAN_STATES.find(s => s.code === code);
}

export function getStateFromGSTIN(gstin: string): IndianState | undefined {
  if (!gstin || gstin.length < 2) return undefined;
  return getStateByCode(gstin.substring(0, 2));
}

export function formatGSTIN(gstin: string): string {
  if (!gstin) return '';
  const clean = gstin.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length <= 2) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
  if (clean.length <= 11) return `${clean.slice(0, 2)}-${clean.slice(2, 6)}-${clean.slice(6)}`;
  return `${clean.slice(0, 2)}-${clean.slice(2, 6)}-${clean.slice(6, 11)}-${clean.slice(11)}`;
}

export function validateGSTIN(gstin: string): boolean {
  if (!gstin) return false;
  const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return pattern.test(gstin.toUpperCase());
}

export function getFinancialYear(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  if (month >= 3) return `${year}-${(year + 1).toString().slice(2)}`;
  return `${year - 1}-${year.toString().slice(2)}`;
}

export function getFinancialYearRange(fy?: string): { start: Date; end: Date } {
  const financialYear = fy || getFinancialYear();
  const [startYear] = financialYear.split('-').map(Number);
  return {
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 2, 31),
  };
}

export function amountInWords(amount: number): string {
  if (amount === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertToWords(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertToWords(n % 100) : '');
    if (n < 100000) return convertToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convertToWords(n % 1000) : '');
    if (n < 10000000) return convertToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convertToWords(n % 100000) : '');
    return convertToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convertToWords(n % 10000000) : '');
  }

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let result = convertToWords(rupees) + ' Rupees';
  if (paise > 0) result += ' and ' + convertToWords(paise) + ' Paise';
  result += ' Only';
  return result;
}
