/**
 * Settlement Calculation Service
 *
 * Determines how much of a payment remains after a partial or full payment.
 *
 * Formula:
 *   remaining       = totalDue - payingAmount
 *   isFullySettled  = remaining <= 0
 *
 * @param {number} totalDue      - Total amount owed
 * @param {number} payingAmount  - Amount being paid now
 * @returns {{ remaining: number, isFullySettled: boolean }}
 */
function calculateSettlement(totalDue, payingAmount) {
  const remaining = totalDue - payingAmount;
  const isFullySettled = remaining <= 0;
  return { remaining, isFullySettled };
}

module.exports = { calculateSettlement };
