/**
 * TDS Calculation Service
 *
 * Formula:
 *   tdsAmount = parseFloat((grossAmount * tdsPercentage / 100).toFixed(2))
 *   netAmount  = parseFloat((grossAmount - tdsAmount).toFixed(2))
 *
 * Review Focus: when tdsPercentage is 0, netAmount must equal grossAmount exactly
 * with no float drift (satisfied by the toFixed(2) → parseFloat pipeline).
 *
 * @param {number} grossAmount    - NUMERIC(15,2) — never raw float in storage
 * @param {number} tdsPercentage  - TDS rate (e.g. 2, 1.5, 0)
 * @returns {{ tdsAmount: number, netAmount: number }}
 */
function calculateTDS(grossAmount, tdsPercentage) {
  const tdsAmount = parseFloat((grossAmount * tdsPercentage / 100).toFixed(2));
  const netAmount = parseFloat((grossAmount - tdsAmount).toFixed(2));
  return { tdsAmount, netAmount };
}

module.exports = { calculateTDS };
