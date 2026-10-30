const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = ONES[n % 10];
  return o ? `${t} ${o}` : t;
}

function threeDigits(n: number): string {
  if (n === 0) return '';
  if (n < 100) return twoDigits(n);
  const h = ONES[Math.floor(n / 100)];
  const rem = n % 100;
  return rem ? `${h} Hundred ${twoDigits(rem)}` : `${h} Hundred`;
}

// Indian numbering: Crore (10^7), Lakh (10^5), Thousand (10^3), Hundred (10^2)
export function amountInWords(amount: number): string {
  if (amount === 0) return 'Zero Rupees Only';

  const isNegative = amount < 0;
  amount = Math.abs(amount);

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let words = '';

  if (rupees > 0) {
    const parts: string[] = [];
    let remaining = rupees;

    const crore = Math.floor(remaining / 10000000);
    remaining %= 10000000;
    if (crore > 0) parts.push(`${threeDigits(crore)} Crore`);

    const lakh = Math.floor(remaining / 100000);
    remaining %= 100000;
    if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`);

    const thousand = Math.floor(remaining / 1000);
    remaining %= 1000;
    if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);

    if (remaining > 0) parts.push(threeDigits(remaining));

    words = parts.join(' ') + ' Rupees';
  }

  if (paise > 0) {
    const paiseWords = twoDigits(paise) + ' Paise';
    words = words ? `${words} and ${paiseWords}` : paiseWords;
  } else if (words) {
    // no paise
  }

  words += ' Only';

  return (isNegative ? 'Minus ' : '') + words;
}
