/**
 * Backup routes — admin only
 *
 * POST /api/backup/export — export all major tables as JSON
 * POST /api/backup/import — accept JSON body, validate structure, delete+reinsert in FK order
 *
 * FK-safe import order (parents before children):
 *   companies → banks → equipment_categories → head_allotments → terms_conditions
 *   → sites (depends on companies) → contractors → retailers → supervisors → employees
 *   → stock_products → vehicles
 */

const express = require('express');
const { body } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

const router = express.Router();

// All backup routes require authentication + admin role
router.use(authenticateToken);
router.use(requireRole('admin'));

// ---------------------------------------------------------------------------
// Tables included in export/import (in FK-safe order for import)
// ---------------------------------------------------------------------------
const BACKUP_TABLES = [
  'companies',
  'banks',
  'equipment_categories',
  'head_allotments',
  'terms_conditions',
  'sites',
  'contractors',
  'retailers',
  'supervisors',
  'employees',
  'stock_products',
  'vehicles',
];

// ---------------------------------------------------------------------------
// POST /api/backup/export
// Query all major tables and return as JSON.
// ---------------------------------------------------------------------------
router.post('/export', async (req, res) => {
  const EMPLOYEE_COLUMNS = 'id, display_id, name, father_name, dob, religion, village, post, ps, district, pin, aadhaar_last4, uan, phone, whatsapp, emergency_contact, bank_name, account_holder, account_number, ifsc_code, designation, category_id, working_positions, photo_url, current_site_id, status, profile_id, registered_by, created_at, updated_at';

  const result = {};

  for (const table of BACKUP_TABLES) {
    const columns = table === 'employees' ? EMPLOYEE_COLUMNS : '*';
    const { data, error } = await supabase.from(table).select(columns).order('created_at');

    if (error) return sendError(res, `Export failed for table ${table}: ${error.message}`, 500);
    result[table] = data || [];
  }

  result._meta = {
    exported_at: new Date().toISOString(),
    tables: BACKUP_TABLES,
    version: 1,
  };

  return sendSuccess(res, result);
});

// ---------------------------------------------------------------------------
// POST /api/backup/import
// Accept JSON body with table data. Validate structure. Delete+reinsert in FK order.
//
// Expected body: { companies: [...], banks: [...], ... }
// All keys are optional — only tables present in the payload are restored.
// ---------------------------------------------------------------------------
router.post(
  '/import',
  validate([
    body().isObject().withMessage('Request body must be a JSON object'),
  ]),
  async (req, res) => {
    const payload = req.body;

    // Validate that any provided keys are known table names
    const unknownKeys = Object.keys(payload).filter(
      (k) => k !== '_meta' && !BACKUP_TABLES.includes(k)
    );
    if (unknownKeys.length > 0) {
      return sendError(res, `Unknown tables in payload: ${unknownKeys.join(', ')}`, 400);
    }

    // Validate each value is an array
    for (const table of BACKUP_TABLES) {
      if (payload[table] !== undefined && !Array.isArray(payload[table])) {
        return sendError(res, `Value for table '${table}' must be an array`, 400);
      }
    }

    const report = {};

    // Delete in reverse FK order (children before parents)
    const tablesToRestore = BACKUP_TABLES.filter((t) => payload[t]);
    for (const table of [...tablesToRestore].reverse()) {
      const { error: deleteError } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) {
        return sendError(res, `Import failed: could not clear table ${table}: ${deleteError.message}`, 500);
      }
    }

    // Insert in FK order (parents before children)
    for (const table of BACKUP_TABLES) {
      if (!payload[table]) {
        report[table] = { skipped: true };
        continue;
      }

      const rows = payload[table];

      if (rows.length > 0) {
        const { error: insertError } = await supabase.from(table).insert(rows);

        if (insertError) {
          return sendError(res, `Import failed: could not insert into ${table}: ${insertError.message}`, 500);
        }
      }

      report[table] = { restored: rows.length };
    }

    return sendSuccess(res, {
      message: 'Import completed',
      report,
      imported_at: new Date().toISOString(),
    });
  }
);

module.exports = router;
