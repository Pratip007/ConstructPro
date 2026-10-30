'use strict';

/**
 * Report + Dashboard + Ledger routes
 *
 * Three routers are exported and mounted separately in server.js:
 *
 * dashboardRouter  → /api/dashboard
 *   GET /kpis           — admin only; active-entity counts + bank balance
 *   GET /pending-dues   — admin only; outstanding employee/retailer/contractor balances
 *   GET /notifications  — admin only; pending approval counts by source
 *
 * reportsRouter    → /api/reports
 *   GET /site-ledger    — admin/office; 4-section monthly site aggregation
 *   GET /mobilization   — admin/office; equipment assignments with duration + cost
 *   GET /sales          — admin/office; invoices grouped by month for a fiscal year
 *
 * ledgerRouter     → /api/ledger
 *   GET /employee/:id   — all roles (employee: own ledger only)
 *   GET /contractor/:id — admin/office
 *   GET /retailer/:id   — admin/office
 *   GET /supervisor/:id — admin/office
 *   GET /company/:id    — admin/office
 */

const express = require('express');
const { param, query } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');
const {
  getDashboardKPIs,
  getPendingDues,
  getNotificationCounts,
  getSiteLedger,
  getEntityLedger,
  getFinancialSummary,
  getSiteActivity,
} = require('../services/reportAggregator');

// ===========================================================================
// Dashboard router
// ===========================================================================
const dashboardRouter = express.Router();
dashboardRouter.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /api/dashboard/kpis
// ---------------------------------------------------------------------------
dashboardRouter.get('/kpis', requireRole('admin'), async (req, res) => {
  try {
    const data = await getDashboardKPIs();
    return sendSuccess(res, data);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/pending-dues
// ---------------------------------------------------------------------------
dashboardRouter.get('/pending-dues', requireRole('admin'), async (req, res) => {
  try {
    const data = await getPendingDues();
    return sendSuccess(res, data);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/notifications
// ---------------------------------------------------------------------------
dashboardRouter.get('/notifications', requireRole('admin'), async (req, res) => {
  try {
    const data = await getNotificationCounts();
    return sendSuccess(res, data);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/financial-summary
// ---------------------------------------------------------------------------
dashboardRouter.get('/financial-summary', requireRole('admin'), async (req, res) => {
  try {
    const data = await getFinancialSummary();
    return sendSuccess(res, data);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/site-activity
// ---------------------------------------------------------------------------
dashboardRouter.get('/site-activity', requireRole('admin'), async (req, res) => {
  try {
    const data = await getSiteActivity();
    return sendSuccess(res, data);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/handovers
// ---------------------------------------------------------------------------
dashboardRouter.get('/handovers', requireRole('admin'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sites')
      .select('id, display_id, name, client_name, handover_date, status')
      .eq('status', 'completed')
      .order('handover_date', { ascending: false })
      .limit(20);
    if (error) return sendError(res, error.message, 500);
    return sendSuccess(res, data || []);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
});

// ===========================================================================
// Reports router
// ===========================================================================
const reportsRouter = express.Router();
reportsRouter.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /api/reports/site-ledger?company_id=X&site_id=Y
// ---------------------------------------------------------------------------
reportsRouter.get(
  '/site-ledger',
  requireRole('admin', 'office'),
  validate([
    query('site_id').notEmpty().withMessage('site_id is required'),
  ]),
  async (req, res) => {
    const { company_id, site_id } = req.query;
    try {
      const data = await getSiteLedger(company_id, site_id);
      return sendSuccess(res, data);
    } catch (err) {
      return sendError(res, err.message, 500);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/reports/mobilization?site_id=X&party_id=Y&from=DATE&to=DATE
// Returns equipment_site_assignments with computed duration_days and total_cost.
// ---------------------------------------------------------------------------
reportsRouter.get(
  '/mobilization',
  requireRole('admin', 'office'),
  async (req, res) => {
    const { site_id, party_id, from: dateFrom, to: dateTo } = req.query;

    let q = supabase
      .from('equipment_site_assignments')
      .select(
        'id, display_id, equipment_party_id, site_id, assigned_date, released_date, rate, rate_unit, status, remarks, created_at'
      )
      .order('assigned_date', { ascending: false });

    if (site_id) q = q.eq('site_id', site_id);
    if (party_id) q = q.eq('equipment_party_id', party_id);
    if (dateFrom) q = q.gte('assigned_date', dateFrom);
    if (dateTo) q = q.lte('assigned_date', dateTo);

    const { data, error } = await q;
    if (error) return sendError(res, error.message, 500);

    // Enrich with computed fields
    const enriched = (data || []).map((row) => {
      let duration_days = null;
      let total_cost = null;

      if (row.assigned_date && row.released_date) {
        const start = new Date(row.assigned_date);
        const end = new Date(row.released_date);
        duration_days = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
        total_cost = Number(row.rate || 0) * duration_days;
      }

      return { ...row, duration_days, total_cost };
    });

    return sendSuccess(res, enriched);
  }
);

// ---------------------------------------------------------------------------
// GET /api/reports/sales?company_id=X&fy=YYYY
// Indian fiscal year: April 1 of fy to March 31 of fy+1.
// ---------------------------------------------------------------------------
reportsRouter.get(
  '/sales',
  requireRole('admin', 'office'),
  validate([
    query('fy')
      .optional()
      .matches(/^\d{4}$/)
      .withMessage('fy must be a 4-digit year (e.g., 2026)'),
  ]),
  async (req, res) => {
    const { company_id, fy } = req.query;

    let q = supabase
      .from('invoices')
      .select('id, display_id, company_id, date, base_amount, gst_amount, gross_amount, is_gst, status')
      .order('date', { ascending: true });

    if (company_id) q = q.eq('company_id', company_id);

    if (fy) {
      const fyStart = `${fy}-04-01`;
      const fyEnd = `${parseInt(fy, 10) + 1}-03-31`;
      q = q.gte('date', fyStart).lte('date', fyEnd);
    }

    const { data, error } = await q;
    if (error) return sendError(res, error.message, 500);

    // Group by month
    const byMonth = {};
    for (const inv of (data || [])) {
      const month = String(inv.date).substring(0, 7);
      if (!byMonth[month]) {
        byMonth[month] = { month, invoices: [], total_gross: 0, total_base: 0, total_gst: 0 };
      }
      byMonth[month].invoices.push(inv);
      byMonth[month].total_gross += Number(inv.gross_amount || 0);
      byMonth[month].total_base += Number(inv.base_amount || 0);
      byMonth[month].total_gst += Number(inv.gst_amount || 0);
    }

    const monthly = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
    const grandTotal = {
      gross: monthly.reduce((s, m) => s + m.total_gross, 0),
      base: monthly.reduce((s, m) => s + m.total_base, 0),
      gst: monthly.reduce((s, m) => s + m.total_gst, 0),
    };

    return sendSuccess(res, { monthly, grandTotal });
  }
);

// ===========================================================================
// Ledger router
// ===========================================================================
const ledgerRouter = express.Router();
ledgerRouter.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /api/ledger/employee/:id
// All roles can call. Employee role restricted to own ID.
// ---------------------------------------------------------------------------
ledgerRouter.get(
  '/employee/:id',
  validate([param('id').isUUID().withMessage('id must be a valid UUID')]),
  async (req, res) => {
    const { id } = req.params;
    const { from: dateFrom, to: dateTo } = req.query;

    // Employees may only view their own ledger
    if (req.user.role === 'employee' && String(req.user.id) !== String(id)) {
      return sendError(res, 'Access denied: can only view your own ledger', 403);
    }

    try {
      const data = await getEntityLedger('employee', id, dateFrom || null, dateTo || null);
      return sendSuccess(res, data);
    } catch (err) {
      return sendError(res, err.message, 500);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/ledger/contractor/:id
// ---------------------------------------------------------------------------
ledgerRouter.get(
  '/contractor/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('id must be a valid UUID')]),
  async (req, res) => {
    const { id } = req.params;
    const { from: dateFrom, to: dateTo } = req.query;
    try {
      const data = await getEntityLedger('contractor', id, dateFrom || null, dateTo || null);
      return sendSuccess(res, data);
    } catch (err) {
      return sendError(res, err.message, 500);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/ledger/retailer/:id
// ---------------------------------------------------------------------------
ledgerRouter.get(
  '/retailer/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('id must be a valid UUID')]),
  async (req, res) => {
    const { id } = req.params;
    const { from: dateFrom, to: dateTo } = req.query;
    try {
      const data = await getEntityLedger('retailer', id, dateFrom || null, dateTo || null);
      return sendSuccess(res, data);
    } catch (err) {
      return sendError(res, err.message, 500);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/ledger/supervisor/:id
// ---------------------------------------------------------------------------
ledgerRouter.get(
  '/supervisor/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('id must be a valid UUID')]),
  async (req, res) => {
    const { id } = req.params;
    const { from: dateFrom, to: dateTo } = req.query;
    try {
      const data = await getEntityLedger('supervisor', id, dateFrom || null, dateTo || null);
      return sendSuccess(res, data);
    } catch (err) {
      return sendError(res, err.message, 500);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/ledger/company/:id
// ---------------------------------------------------------------------------
ledgerRouter.get(
  '/company/:id',
  requireRole('admin', 'office'),
  validate([param('id').isUUID().withMessage('id must be a valid UUID')]),
  async (req, res) => {
    const { id } = req.params;
    const { from: dateFrom, to: dateTo } = req.query;
    try {
      const data = await getEntityLedger('company', id, dateFrom || null, dateTo || null);
      return sendSuccess(res, data);
    } catch (err) {
      return sendError(res, err.message, 500);
    }
  }
);

module.exports = { dashboardRouter, reportsRouter, ledgerRouter };
