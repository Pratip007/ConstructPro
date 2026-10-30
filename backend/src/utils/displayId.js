/**
 * Generate a display ID with a prefix and sequence number.
 * Pads the sequence number to at least 3 digits.
 *
 * @param {string} prefix - e.g. "EMP", "PO"
 * @param {number} sequenceNum - integer sequence number
 * @returns {string} e.g. "EMP-101", "PO-001"
 */
function generateDisplayId(prefix, sequenceNum) {
  const padded = String(sequenceNum).padStart(3, '0');
  return `${prefix}-${padded}`;
}

/**
 * Generate a display ID that includes a year.
 *
 * @param {string} prefix - e.g. "INV"
 * @param {number|string} year - e.g. 2026
 * @param {number} seq - integer sequence number
 * @returns {string} e.g. "INV-2026-001"
 */
function generateDisplayIdWithYear(prefix, year, seq) {
  const padded = String(seq).padStart(3, '0');
  return `${prefix}-${year}-${padded}`;
}

module.exports = { generateDisplayId, generateDisplayIdWithYear };
