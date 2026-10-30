const { sendError } = require('../utils/response');

/**
 * Returns middleware that checks req.user.role against the allowed roles.
 * Returns 403 if the role is not in the list.
 *
 * Usage: requireRole('admin', 'office')
 *
 * @param {...string} allowedRoles
 * @returns {Function} Express middleware
 */
function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }
    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, 'Access denied: insufficient role', 403);
    }
    return next();
  };
}

module.exports = { requireRole };
