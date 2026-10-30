const { sendError } = require('../utils/response');

/**
 * Enforces site-level access control for supervisors.
 *
 * If req.user.role === 'supervisor':
 *   - Extracts siteId from req.query.site_id || req.body.site_id || req.params.siteId
 *   - If a siteId is present in the request and does NOT match the supervisor's siteId → 403
 *   - If no siteId in the request, injects req.user.siteId into both query and body
 *
 * Non-supervisor roles pass through unmodified.
 */
function enforceSiteLock(req, res, next) {
  if (!req.user) {
    return sendError(res, 'Unauthorized', 401);
  }

  if (req.user.role !== 'supervisor') {
    return next();
  }

  const requestedSiteId =
    req.query.site_id ||
    (req.body && req.body.site_id) ||
    (req.params && req.params.siteId);

  if (requestedSiteId) {
    // Compare as strings to avoid type mismatches
    if (String(requestedSiteId) !== String(req.user.siteId)) {
      return sendError(res, 'Access denied: site not assigned to this supervisor', 403);
    }
  } else {
    // Inject the supervisor's siteId so downstream handlers don't need to look it up
    req.query.site_id = req.user.siteId;
    if (req.body) {
      req.body.site_id = req.user.siteId;
    }
  }

  return next();
}

module.exports = { enforceSiteLock };
