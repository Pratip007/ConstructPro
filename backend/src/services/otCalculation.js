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
 *
 * @param {string} salaryBasis  - 'Per Day' | 'Monthly'
 * @param {number} baseDailyWage - base daily wage (NUMERIC, never float in storage)
 * @param {number} daysCount     - number of present days
 * @param {number} otHours       - overtime hours (0 if none)
 * @returns {{ presentWage: number, otRatePerHr: number, otAmount: number, totalAmount: number }}
 */
function calculateOT(salaryBasis, baseDailyWage, daysCount, otHours) {
  const presentWage = Math.round(baseDailyWage * daysCount);
  let otRatePerHr = 0;
  let otAmount = 0;
  if (salaryBasis === 'Per Day' && otHours > 0) {
    otRatePerHr = baseDailyWage / 8;
    otAmount = Math.round(otRatePerHr * otHours);
  }
  return { presentWage, otRatePerHr, otAmount, totalAmount: presentWage + otAmount };
}

module.exports = { calculateOT };
