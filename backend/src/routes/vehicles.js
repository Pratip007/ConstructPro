/**
 * Vehicle routes
 *
 * GET    /                    — list all, filter by status, assigned_site_id
 * POST   /                    — create. Admin only. Display_id prefix: VEH
 * PUT    /:id                 — update vehicle fields. Admin/office.
 * DELETE /:id                 — soft delete (status → 'inactive'). Admin only.
 * GET    /:id/service-logs    — list service logs for a vehicle
 * POST   /:id/service-logs    — add a service log entry
 *
 * NOTE: /:id/service-logs routes are declared BEFORE /:id param routes
 * to avoid Express matching "service-logs" as an :id value.
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
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /api/vehicles
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { status, assigned_site_id } = req.query;

  let q = supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) q = q.eq('status', status);
  if (assigned_site_id) q = q.eq('assigned_site_id', assigned_site_id);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// GET /api/vehicles/:id/service-logs — declared BEFORE /:id
// ---------------------------------------------------------------------------
router.get(
  '/:id/service-logs',
  validate([param('id').isUUID().withMessage('Invalid vehicle ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('vehicle_service_logs')
      .select('id, vehicle_id, service_date, service_type, description, cost, odometer_reading, next_service_date, serviced_by, remarks, created_at')
      .eq('vehicle_id', id)
      .order('service_date', { ascending: false });

    if (error) return sendError(res, error.message, 500);
    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// POST /api/vehicles/:id/service-logs — declared BEFORE /:id
// ---------------------------------------------------------------------------
router.post(
  '/:id/service-logs',
  requireRole('admin', 'office'),
  validate([
    param('id').isUUID().withMessage('Invalid vehicle ID'),
    body('service_date').notEmpty().withMessage('service_date is required'),
    body('service_type').notEmpty().withMessage('service_type is required'),
    body('cost').optional().isNumeric().withMessage('cost must be numeric'),
    body('odometer_reading').optional().isNumeric().withMessage('odometer_reading must be numeric'),
  ]),
  async (req, res) => {
    const { id } = req.params;
    const {
      service_date,
      service_type,
      description,
      cost,
      odometer_reading,
      next_service_date,
      serviced_by,
      remarks,
    } = req.body;

    const { data, error } = await supabase
      .from('vehicle_service_logs')
      .insert({
        vehicle_id: id,
        service_date,
        service_type,
        description: description || null,
        cost: cost != null ? parseFloat(Number(cost).toFixed(2)) : null,
        odometer_reading: odometer_reading != null ? parseFloat(Number(odometer_reading).toFixed(2)) : null,
        next_service_date: next_service_date || null,
        serviced_by: serviced_by || null,
        remarks: remarks || null,
      })
      .select('id, vehicle_id, service_date, service_type, description, cost, odometer_reading, next_service_date, serviced_by, remarks, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, data, 201);
  }
);

// ---------------------------------------------------------------------------
// POST /api/vehicles
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('admin'),
  validate([
    body('vehicle_number').notEmpty().withMessage('vehicle_number is required'),
    body('vehicle_type').notEmpty().withMessage('vehicle_type is required'),
    body('assigned_site_id').optional().isUUID().withMessage('assigned_site_id must be a valid UUID'),
  ]),
  async (req, res) => {
    const {
      vehicle_number,
      vehicle_type,
      make,
      model,
      year,
      owner_name,
      owner_contact,
      driver_name,
      fuel_type,
      insurance_expiry,
      assigned_site_id,
    } = req.body;

    const { count, error: countError } = await supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true });

    if (countError) return sendError(res, countError.message, 500);
    const display_id = generateDisplayId('VEH', (count || 0) + 1);

    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        display_id,
        vehicle_number,
        vehicle_type,
        make: make || null,
        model: model || null,
        year: year ? parseInt(year, 10) : null,
        owner_name: owner_name || null,
        owner_contact: owner_contact || null,
        driver_name: driver_name || null,
        fuel_type: fuel_type || null,
        insurance_expiry: insurance_expiry || null,
        assigned_site_id: assigned_site_id || null,
        status: 'active',
      })
      .select('*')
      .single();

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, data, 201);
  }
);

// ---------------------------------------------------------------------------
// PUT /api/vehicles/:id
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  requireRole('admin', 'office'),
  validate([
    param('id').isUUID().withMessage('Invalid vehicle ID'),
    body('assigned_site_id').optional().isUUID().withMessage('assigned_site_id must be a valid UUID'),
  ]),
  async (req, res) => {
    const { id } = req.params;
    const allowedFields = [
      'vehicle_number',
      'vehicle_type',
      'make',
      'model',
      'year',
      'owner_name',
      'owner_contact',
      'driver_name',
      'fuel_type',
      'insurance_expiry',
      'assigned_site_id',
      'status',
    ];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    if (updates.year !== undefined) updates.year = updates.year ? parseInt(updates.year, 10) : null;

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id)
      .select('id, display_id, vehicle_number, vehicle_type, make, model, year, owner_name, owner_contact, assigned_site_id, status, updated_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Vehicle not found', 404);
    return sendSuccess(res, data);
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/vehicles/:id
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireRole('admin'),
  validate([param('id').isUUID().withMessage('Invalid vehicle ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('vehicles')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('id, display_id, status')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Vehicle not found', 404);
    return sendSuccess(res, { message: 'Vehicle deactivated', vehicle: data });
  }
);

module.exports = router;
