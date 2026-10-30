const express = require('express');
const { body } = require('express-validator');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const { supabase, supabaseAnon } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later' },
});

// ---------------------------------------------------------------------------
// POST /api/auth/signup  (admin only)
// Creates a Supabase Auth user + profiles row.
// ---------------------------------------------------------------------------
router.post(
  '/signup',
  authenticateToken,
  requireRole('admin'),
  validate([
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('role')
      .isIn(['admin', 'office', 'supervisor', 'employee'])
      .withMessage('Invalid role'),
    body('displayId').notEmpty().withMessage('displayId is required'),
  ]),
  async (req, res) => {
    const { email, password, name, role, displayId, siteId, aadhaar } = req.body;

    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, display_id: displayId },
    });

    if (authError) {
      return sendError(res, authError.message, 400);
    }

    const authUid = authData.user.id;

    // Build profiles row
    const profileRow = {
      auth_uid: authUid,
      display_id: displayId,
      name,
      role,
      assigned_site_id: siteId || null,
    };

    // Hash aadhaar if provided (employee signup)
    if (aadhaar) {
      if (String(aadhaar).length < 4) {
        // Clean up the auth user we just created
        await supabase.auth.admin.deleteUser(authUid);
        return sendError(res, 'Aadhaar must be at least 4 digits', 400);
      }
      const saltRounds = 12;
      profileRow.aadhaar_hash = await bcrypt.hash(String(aadhaar), saltRounds);
      profileRow.aadhaar_last4 = String(aadhaar).slice(-4);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert(profileRow)
      .select('id, display_id, name, role, assigned_site_id, created_at')
      .single();

    if (profileError) {
      // Attempt cleanup of the auth user
      await supabase.auth.admin.deleteUser(authUid);
      return sendError(res, profileError.message, 400);
    }

    return sendSuccess(res, { user: profile }, 201);
  }
);

// ---------------------------------------------------------------------------
// POST /api/auth/login
// Authenticates with Supabase and returns session tokens + profile.
// ---------------------------------------------------------------------------
router.post(
  '/login',
  authLimiter,
  validate([
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  async (req, res) => {
    const { email, password } = req.body;

    const { data: sessionData, error: sessionError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError || !sessionData.session) {
      return sendError(res, sessionError ? sessionError.message : 'Login failed', 400);
    }

    const { access_token, refresh_token } = sessionData.session;
    const authUid = sessionData.user.id;

    // Fetch profile (exclude aadhaar_hash)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_id, name, role, assigned_site_id, created_at')
      .eq('auth_uid', authUid)
      .single();

    if (profileError || !profile) {
      return sendError(res, 'Profile not found', 400);
    }

    return sendSuccess(res, { access_token, refresh_token, user: profile });
  }
);

// ---------------------------------------------------------------------------
// GET /api/auth/me  (authenticated)
// Returns the current user's profile, never exposes aadhaar_hash.
// ---------------------------------------------------------------------------
router.get('/me', authenticateToken, async (req, res) => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, auth_uid, display_id, name, role, assigned_site_id, created_at, updated_at')
    .eq('id', req.user.id)
    .single();

  if (error || !profile) {
    return sendError(res, 'Profile not found', 404);
  }

  return sendSuccess(res, profile);
});

// ---------------------------------------------------------------------------
// PUT /api/auth/password  (authenticated)
// Changes the current user's password.
// ---------------------------------------------------------------------------
router.put(
  '/password',
  authLimiter,
  authenticateToken,
  validate([
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters'),
  ]),
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', req.user.id)
      .single();

    if (profileError || !profile || !profile.email) {
      return sendError(res, 'Could not verify identity', 400);
    }

    const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

    if (signInError) {
      return sendError(res, 'Current password is incorrect', 403);
    }

    const { error } = await supabase.auth.admin.updateUserById(req.user.authUid, {
      password: newPassword,
    });

    if (error) {
      return sendError(res, error.message, 400);
    }

    return sendSuccess(res, { message: 'Password updated successfully' });
  }
);

// ---------------------------------------------------------------------------
// GET /api/auth/users — list all users (admin only)
// ---------------------------------------------------------------------------
router.get('/users', authenticateToken, requireRole('admin'), async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, display_id, role, status, created_at')
    .order('created_at', { ascending: false });

  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data || []);
});

module.exports = router;
