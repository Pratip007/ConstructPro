/**
 * Settlement Calculation Service
 *
 * Determines how much of a payment remains after a partial or full payment.
 *
 * Formula:
 *   remaining       = totalDue - payingAmount
 *   isFullySettled  = remaining <= 0
 */

export interface SettlementResult {
  remaining: number;
  isFullySettled: boolean;
}

export function calculateSettlement(totalDue: number, payingAmount: number): SettlementResult {
  const remaining = totalDue - payingAmount;
  const isFullySettled = remaining <= 0;
  return { remaining, isFullySettled };
}
