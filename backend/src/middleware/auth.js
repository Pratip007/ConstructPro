const { supabase } = require('../config/supabase');
const { sendError } = require('../utils/response');

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Sets req.user = { id, authUid, displayId, name, role, siteId } on success.
 * Returns 401 on failure.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Missing or malformed Authorization header', 401);
  }

  const token = authHeader.slice(7); // remove "Bearer "

  // Verify the JWT with Supabase
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) {
    return sendError(res, 'Invalid or expired token', 401);
  }

  // Look up the profiles row by auth_uid
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, auth_uid, display_id, name, role, assigned_site_id')
    .eq('auth_uid', authUser.id)
    .single();

  if (profileError || !profile) {
    return sendError(res, 'User profile not found', 401);
  }

  req.user = {
    id: profile.id,
    authUid: profile.auth_uid,
    displayId: profile.display_id,
    name: profile.name,
    role: profile.role,
    siteId: profile.assigned_site_id,
  };

  return next();
}

module.exports = { authenticateToken };
