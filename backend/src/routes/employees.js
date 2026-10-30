const express = require('express');
const { body, param } = require('express-validator');
const bcrypt = require('bcryptjs');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { generateDisplayId } = require('../utils/displayId');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { enforceSiteLock } = require('../middleware/sitelock');
const { validate } = require('../middleware/validate');
const { createApprovalRequest } = require('../services/approvalEngine');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /api/employees
// Returns employee list (no aadhaar_hash). Supervisor: own site only.
// Query: site_id, status, category_id
// ---------------------------------------------------------------------------
router.get('/', enforceSiteLock, async (req, res) => {
  const { site_id, status, category_id } = req.query;

  let query = supabase
    .from('employees')
    .select(`
      id, display_id, name, phone, designation,
      working_positions, current_site_id, status,
      category_id, profile_id, created_at, updated_at,
      employee_categories(id, name, description, status)
    `);

  if (site_id) query = query.eq('current_site_id', site_id);
  if (status) query = query.eq('status', status);
  if (category_id) query = query.eq('category_id', category_id);

  query = query.order('name');

  const { data, error } = await query;

  if (error) {
    return sendError(res, error.message, 500);
  }

  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// GET /api/employees/next-id
// Returns the next auto-generated employee display_id.
// ---------------------------------------------------------------------------
router.get('/next-id', requireRole('admin', 'office'), async (req, res) => {
  const { count, error } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true });

  if (error) return sendError(res, error.message, 500);
  const next = generateDisplayId('EMP', (count || 0) + 1);
  return sendSuccess(res, { next_id: next });
});

// ---------------------------------------------------------------------------
// GET /api/employees/check-aadhaar?aadhaar=XXXX
// Checks if an Aadhaar number is already registered.
// ---------------------------------------------------------------------------
router.get('/check-aadhaar', requireRole('admin', 'office'), async (req, res) => {
  const { aadhaar } = req.query;
  if (!aadhaar) return sendError(res, 'aadhaar parameter is required', 400);

  const { data, error } = await supabase
    .from('employees')
    .select('id, display_id, name')
    .eq('aadhaar_last4', String(aadhaar).slice(-4))
    .limit(5);

  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, { exists: (data || []).length > 0, matches: data || [] });
});

// ---------------------------------------------------------------------------
// POST /api/employees/import
// Bulk import employees from an array.
// ---------------------------------------------------------------------------
router.post('/import', requireRole('admin'), async (req, res) => {
  const { employees } = req.body;
  if (!Array.isArray(employees) || !employees.length) {
    return sendError(res, 'employees array is required', 400);
  }

  const results = { created: 0, errors: [] };
  for (const emp of employees) {
    const { count } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true });
    const display_id = generateDisplayId('EMP', (count || 0) + 1);

    const { error } = await supabase.from('employees').insert({
      display_id,
      name: emp.name,
      phone: emp.phone || null,
      category_id: emp.category_id || null,
      site_id: emp.site_id || null,
      rate: emp.rate || 0,
      salary_basis: emp.salary_basis || 'Per Day',
      status: 'active',
    });

    if (error) {
      results.errors.push({ name: emp.name, error: error.message });
    } else {
      results.created++;
    }
  }

  return sendSuccess(res, results, 201);
});

// ---------------------------------------------------------------------------
// POST /api/employees
// Admin: inserts + creates auth user (email = displayId@atr.local, password = aadhaar).
// Office/Supervisor: creates approval request.
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin', 'office', 'supervisor'),
  enforceSiteLock,
  validate([
    body('name').notEmpty().withMessage('Name is required'),
    body('aadhaar')
      .notEmpty()
      .isLength({ min: 4 })
      .withMessage('Aadhaar must be at least 4 digits'),
  ]),
  async (req, res) => {
    const {
      name,
      phone,
      designation,
      category_id,
      current_site_id,
      working_positions,
      aadhaar,
    } = req.body;

    const role = req.user.role;

    // Compute display_id for employee
    const { count } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true });

    const seq = (count || 0) + 101; // starts at EMP-101
    const display_id = generateDisplayId('EMP', seq);

    const aadhaarStr = String(aadhaar);
    const aadhaar_hash = await bcrypt.hash(aadhaarStr, 12);
    const aadhaar_last4 = aadhaarStr.slice(-4);

    const employeeRow = {
      display_id,
      name,
      phone: phone || null,
      designation: designation || null,
      working_positions: working_positions || null,
      category_id: category_id || null,
      current_site_id: current_site_id || null,
      aadhaar_hash,
      aadhaar_last4,
      status: 'active',
    };

    if (role === 'admin') {
      // Insert employee directly
      const { data: emp, error: empError } = await supabase
        .from('employees')
        .insert(employeeRow)
        .select('id, display_id, name, phone, designation, working_positions, current_site_id, status, category_id, created_at')
        .single();

      if (empError) {
        return sendError(res, empError.message, 400);
      }

      // Create Supabase Auth user (email = displayId@atr.local, password = raw aadhaar)
      const email = `${display_id.toLowerCase().replace('-', '')}@atr.local`;
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: aadhaarStr,
        email_confirm: true,
        user_metadata: { name, role: 'employee', display_id },
      });

      if (authError) {
        // Log but don't fail employee creation — auth can be created separately
        console.warn(`Auth user creation failed for ${display_id}: ${authError.message}`);
      } else {
        // Create profiles row
        const profileRow = {
          auth_uid: authData.user.id,
          display_id,
          name,
          role: 'employee',
          assigned_site_id: current_site_id || null,
          aadhaar_hash,
          aadhaar_last4,
        };
        const { error: profileError } = await supabase.from('profiles').insert(profileRow);
        if (profileError) {
          console.warn(`Profile creation failed for ${display_id}: ${profileError.message}`);
        }
      }

      return sendSuccess(res, emp, 201);
    }

    // Office/Supervisor: create approval request
    try {
      const approval = await createApprovalRequest({
        source: role === 'office' ? 'office' : 'supervisor',
        requesterId: req.user.id,
        requesterName: req.user.name,
        siteId: employeeRow.current_site_id || null,
        module: 'Employee',
        actionType: 'new_entry',
        newData: employeeRow,
      });
      return sendSuccess(res, { approval, message: 'Approval request submitted' }, 202);
    } catch (err) {
      return sendError(res, err.message, 500);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /api/employees/:id
// Admin: direct update. Office/Supervisor: approval request.
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  requireRole('admin', 'office', 'supervisor'),
  validate([
    param('id').isUUID().withMessage('Invalid employee ID'),
    body('salary_basis')
      .optional()
      .isIn(['Per Day', 'Monthly'])
      .withMessage('salary_basis must be Per Day or Monthly'),
    body('base_daily_wage')
      .optional()
      .isNumeric()
      .withMessage('base_daily_wage must be numeric'),
  ]),
  async (req, res) => {
    const { id } = req.params;
    const role = req.user.role;

    const allowedFields = [
      'name', 'phone', 'designation', 'working_positions',
      'category_id', 'current_site_id', 'status',
    ];

    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    if (role === 'admin') {
      const { data, error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', id)
        .select('id, display_id, name, phone, designation, working_positions, current_site_id, status, category_id, updated_at')
        .single();

      if (error) return sendError(res, error.message, 400);
      if (!data) return sendError(res, 'Employee not found', 404);

      return sendSuccess(res, data);
    }

    // Office/Supervisor: approval request
    try {
      const approval = await createApprovalRequest({
        source: role === 'office' ? 'office' : 'supervisor',
        requesterId: req.user.id,
        requesterName: req.user.name,
        module: 'Employee',
        actionType: 'edit',
        referenceId: id,
        newData: updates,
      });
      return sendSuccess(res, { approval, message: 'Approval request submitted' }, 202);
    } catch (err) {
      return sendError(res, err.message, 500);
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/employees/:id
// Admin only: soft delete (status → 'inactive')
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireRole('admin'),
  validate([param('id').isUUID().withMessage('Invalid employee ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('employees')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('id, display_id, status')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Employee not found', 404);

    return sendSuccess(res, { message: 'Employee deactivated', employee: data });
  }
);

// ---------------------------------------------------------------------------
// GET /api/employees/:id/sub-ids
// List all sub-IDs for an employee.
// ---------------------------------------------------------------------------
router.get(
  '/:id/sub-ids',
  requireRole('admin', 'office', 'supervisor'),
  validate([param('id').isUUID().withMessage('Invalid employee ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('employee_sub_ids')
      .select('id, display_id, employee_id, site_id, rate, salary_basis, status, created_at')
      .eq('employee_id', id)
      .order('created_at', { ascending: false });

    if (error) return sendError(res, error.message, 500);

    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// POST /api/employees/:id/sub-ids
// Create a sub-ID record linked to an employee and site.
// Auto-generates display_id SUB-XXXX.
// ---------------------------------------------------------------------------
router.post(
  '/:id/sub-ids',
  requireRole('admin', 'office'),
  validate([
    param('id').isUUID().withMessage('Invalid employee ID'),
    body('site_id').isUUID().withMessage('site_id must be a valid UUID'),
    body('rate').isNumeric().withMessage('rate must be numeric'),
    body('salary_basis')
      .isIn(['Per Day', 'Monthly'])
      .withMessage('salary_basis must be Per Day or Monthly'),
  ]),
  async (req, res) => {
    const { id: employee_id } = req.params;
    const { site_id, rate, salary_basis } = req.body;

    // Verify employee exists
    const { data: emp, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employee_id)
      .single();

    if (empError || !emp) {
      return sendError(res, 'Employee not found', 404);
    }

    // Get next sequence for SUB display_id
    const { count } = await supabase
      .from('employee_sub_ids')
      .select('id', { count: 'exact', head: true });

    const seq = (count || 0) + 1;
    const display_id = generateDisplayId('SUB', seq);

    const { data, error } = await supabase
      .from('employee_sub_ids')
      .insert({
        display_id,
        employee_id,
        site_id,
        rate,
        salary_basis,
        status: 'active',
      })
      .select('id, display_id, employee_id, site_id, rate, salary_basis, status, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);

    return sendSuccess(res, data, 201);
  }
);

module.exports = router;
