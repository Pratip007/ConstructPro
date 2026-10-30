/**
 * Supervisor routes
 *
 * GET    /api/supervisors              — list supervisors. Admin/office: all. Supervisor: read-only.
 * POST   /api/supervisors              — create supervisor (admin only). Creates auth user + profile + supervisor row.
 * PUT    /api/supervisors/:id          — update supervisor (admin only).
 * DELETE /api/supervisors/:id          — soft delete (admin only).
 *
 * Supervisor site-tagging (mounted at /api/supervisor-site-tagging):
 * POST   /api/supervisor-site-tagging  — tag supervisor to a site.
 */

const express = require('express');
const { body, param } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { generateDisplayId } = require('../utils/displayId');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /api/supervisors
// All authenticated roles can view supervisors.
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { status } = req.query;

  let q = supabase
    .from('supervisors')
    .select('id, display_id, name, contact, address, employee_id, profile_id, assigned_site_id, status, created_at')
    .order('name');

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// POST /api/supervisors
// Admin only. Creates:
//   1. Supabase Auth user (email = displayId@atr.local)
//   2. profiles row (role: 'supervisor')
//   3. supervisors row (linked to profile_id)
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin'),
  validate([
    body('name').notEmpty().withMessage('name is required'),
    body('siteId').optional().isUUID().withMessage('siteId must be a valid UUID'),
    body('password').notEmpty().isLength({ min: 8 }).withMessage('password is required (min 8 characters)'),
    body('employee_id').optional().isUUID().withMessage('employee_id must be a valid UUID'),
  ]),
  async (req, res) => {
    const { name, contact, address, siteId, employee_id, password } = req.body;

    // Generate display_id
    const { count, error: countError } = await supabase
      .from('supervisors')
      .select('id', { count: 'exact', head: true });

    if (countError) return sendError(res, countError.message, 500);
    const display_id = generateDisplayId('SUP', (count || 0) + 1);

    // Step 1: Create Supabase Auth user
    const email = `${display_id.toLowerCase().replace('-', '')}@atr.local`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'supervisor', display_id },
    });

    if (authError) {
      return sendError(res, `Auth user creation failed: ${authError.message}`, 500);
    }

    // Step 2: Create profiles row
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        auth_uid: authData.user.id,
        display_id,
        name,
        role: 'supervisor',
        assigned_site_id: siteId || null,
      })
      .select('id, display_id, name, role, assigned_site_id')
      .single();

    if (profileError) {
      // Cleanup auth user on profile creation failure
      await supabase.auth.admin.deleteUser(authData.user.id);
      return sendError(res, `Profile creation failed: ${profileError.message}`, 500);
    }

    // Step 3: Create supervisors row
    const { data: supervisor, error: supervisorError } = await supabase
      .from('supervisors')
      .insert({
        display_id,
        name,
        contact: contact || null,
        address: address || null,
        employee_id: employee_id || null,
        profile_id: profileData.id,
        assigned_site_id: siteId || null,
        status: 'active',
      })
      .select('id, display_id, name, contact, address, employee_id, profile_id, assigned_site_id, status, created_at')
      .single();

    if (supervisorError) {
      // Cleanup on supervisor row failure
      await supabase.from('profiles').delete().eq('id', profileData.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return sendError(res, `Supervisor creation failed: ${supervisorError.message}`, 500);
    }

    return sendSuccess(res, { supervisor, profile: profileData, email }, 201);
  }
);

// ---------------------------------------------------------------------------
// PUT /api/supervisors/:id
// Admin only: update supervisor fields, optionally reassign site.
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  requireRole('admin'),
  validate([
    param('id').isUUID().withMessage('Invalid supervisor ID'),
    body('siteId').optional().isUUID().withMessage('siteId must be a valid UUID'),
    body('employee_id').optional().isUUID().withMessage('employee_id must be a valid UUID'),
  ]),
  async (req, res) => {
    const { id } = req.params;
    const { name, contact, address, employee_id, siteId, status } = req.body;

    const supervisorUpdates = {};
    if (name !== undefined) supervisorUpdates.name = name;
    if (contact !== undefined) supervisorUpdates.contact = contact;
    if (address !== undefined) supervisorUpdates.address = address;
    if (employee_id !== undefined) supervisorUpdates.employee_id = employee_id;
    if (siteId !== undefined) supervisorUpdates.assigned_site_id = siteId;
    if (status !== undefined) supervisorUpdates.status = status;

    if (Object.keys(supervisorUpdates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('supervisors')
      .update(supervisorUpdates)
      .eq('id', id)
      .select('id, display_id, name, contact, address, employee_id, profile_id, assigned_site_id, status')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Supervisor not found', 404);

    // If site is being reassigned, update the linked profile's site_id too
    if (siteId !== undefined && data.profile_id) {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ assigned_site_id: siteId })
        .eq('id', data.profile_id);

      if (profileUpdateError) {
        return sendError(res, `Supervisor updated but profile site sync failed: ${profileUpdateError.message}`, 500);
      }
    }

    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/supervisors/:id
// Admin only: soft delete (status → 'inactive').
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireRole('admin'),
  validate([param('id').isUUID().withMessage('Invalid supervisor ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('supervisors')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('id, display_id, status')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Supervisor not found', 404);
    return sendSuccess(res, { message: 'Supervisor deactivated', supervisor: data });
  }
);

// ---------------------------------------------------------------------------
// Supervisor Site Tagging sub-router
// POST /api/supervisor-site-tagging
// Body: { supervisorId, siteId }
// Creates a tagging log entry and updates supervisor's assigned_site_id.
// ---------------------------------------------------------------------------
const supervisorSiteTaggingRouter = express.Router();
supervisorSiteTaggingRouter.use(authenticateToken);

supervisorSiteTaggingRouter.post(
  '/',
  requireRole('admin'),
  validate([
    body('supervisorId').isUUID().withMessage('supervisorId must be a valid UUID'),
    body('siteId').isUUID().withMessage('siteId must be a valid UUID'),
  ]),
  async (req, res) => {
    const { supervisorId, siteId } = req.body;

    // Fetch current supervisor to record from_site
    const { data: supervisor, error: supervisorError } = await supabase
      .from('supervisors')
      .select('id, display_id, assigned_site_id, profile_id, status')
      .eq('id', supervisorId)
      .single();

    if (supervisorError || !supervisor) {
      return sendError(res, 'Supervisor not found', 404);
    }

    const fromSite = supervisor.assigned_site_id || null;

    // Insert tagging log
    const { data: tagging, error: taggingError } = await supabase
      .from('supervisor_site_tagging')
      .insert({
        supervisor_id: supervisorId,
        site_id: siteId,
        from_site: fromSite,
        to_site: siteId,
        tagged_date: new Date().toISOString().split('T')[0],
        tagged_by: req.user.id,
        status: 'active',
      })
      .select('id, supervisor_id, site_id, from_site, to_site, tagged_date, tagged_by, status, created_at')
      .single();

    if (taggingError) {
      return sendError(res, taggingError.message, 400);
    }

    // Update supervisor's assigned_site_id
    const { error: supUpdateError } = await supabase
      .from('supervisors')
      .update({ assigned_site_id: siteId })
      .eq('id', supervisorId);

    if (supUpdateError) {
      return sendError(res, `Tagging saved but supervisor update failed: ${supUpdateError.message}`, 500);
    }

    // Update linked profile's site_id if available
    if (supervisor.profile_id) {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ assigned_site_id: siteId })
        .eq('id', supervisor.profile_id);

      if (profileUpdateError) {
        return sendError(res, `Tagging saved but profile site sync failed: ${profileUpdateError.message}`, 500);
      }
    }

    return sendSuccess(res, { tagging, message: 'Supervisor tagged to site' }, 201);
  }
);

module.exports = { supervisorsRouter: router, supervisorSiteTaggingRouter };
