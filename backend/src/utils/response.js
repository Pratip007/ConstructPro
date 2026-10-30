/**
 * Send a successful JSON response.
 * @param {import('express').Response} res
 * @param {*} data
 * @param {number} statusCode
 */
function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

/**
 * Send an error JSON response.
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} statusCode
 */
function sendError(res, message, statusCode = 400) {
  return res.status(statusCode).json({ success: false, error: message });
}

module.exports = { sendSuccess, sendError };
