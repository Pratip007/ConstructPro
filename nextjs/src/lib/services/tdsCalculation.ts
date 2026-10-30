/**
 * TDS Calculation Service
 *
 * Formula:
 *   tdsAmount = parseFloat((grossAmount * tdsPercentage / 100).toFixed(2))
 *   netAmount  = parseFloat((grossAmount - tdsAmount).toFixed(2))
 *
 * When tdsPercentage is 0, netAmount equals grossAmount exactly
 * with no float drift (satisfied by the toFixed(2) -> parseFloat pipeline).
 */

export interface TDSResult {
  tdsAmount: number;
  netAmount: number;
}

export function calculateTDS(grossAmount: number, tdsPercentage: number): TDSResult {
  const tdsAmount = parseFloat((grossAmount * tdsPercentage / 100).toFixed(2));
  const netAmount = parseFloat((grossAmount - tdsAmount).toFixed(2));
  return { tdsAmount, netAmount };
}
