export interface TdsBreakdown {
  tdsAmount: number;
  netAmount: number;
}

export function calculateTds(grossAmount: number, tdsPercentage: number): TdsBreakdown {
  const tdsAmount = Math.round(grossAmount * tdsPercentage / 100 * 100) / 100;
  return {
    tdsAmount,
    netAmount: Math.round((grossAmount - tdsAmount) * 100) / 100,
  };
}
