/**
 * OT Calculation Service
 *
 * Computes present wage, OT rate per hour, OT amount, and total amount.
 *
 * Formula:
 *   presentWage = Math.round(baseDailyWage * daysCount)
 *   if Per Day and otHours > 0:
 *     otRatePerHr = baseDailyWage / 8
 *     otAmount = Math.round(otRatePerHr * otHours)
 *   if Monthly:
 *     otAmount = 0
 */

export interface OTResult {
  presentWage: number;
  otRatePerHr: number;
  otAmount: number;
  totalAmount: number;
}

export function calculateOT(
  salaryBasis: string,
  baseDailyWage: number,
  daysCount: number,
  otHours: number
): OTResult {
  const presentWage = Math.round(baseDailyWage * daysCount);
  let otRatePerHr = 0;
  let otAmount = 0;
  if (salaryBasis === 'Per Day' && otHours > 0) {
    otRatePerHr = baseDailyWage / 8;
    otAmount = Math.round(otRatePerHr * otHours);
  }
  return { presentWage, otRatePerHr, otAmount, totalAmount: presentWage + otAmount };
}
