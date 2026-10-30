require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { sendSuccess, sendError } = require('./src/utils/response');

const app = express();

// Security and parsing middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/employees', require('./src/routes/employees'));
app.use('/api/employee-categories', require('./src/routes/employeeCategories'));
app.use('/api/site-tagging', require('./src/routes/siteTagging'));
app.use('/api/attendance', require('./src/routes/attendance'));
app.use('/api/employee-ledger', require('./src/routes/employeeLedger'));
app.use('/api/site-leaves', require('./src/routes/siteLeaves'));

const { paymentsRouter, paymentModesRouter } = require('./src/routes/payments');
app.use('/api/payments', paymentsRouter);
app.use('/api/payment-modes', paymentModesRouter);
app.use('/api/approvals', require('./src/routes/approvals'));

// User management (aliased from auth router's /users endpoint)
app.get('/api/users', require('./src/middleware/auth').authenticateToken, async (req, res) => {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, display_id, role, status, created_at')
    .order('created_at', { ascending: false });
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data || []);
});

// Core entity routes (Task 7)
app.use('/api/companies', require('./src/routes/companies'));
app.use('/api/sites', require('./src/routes/sites'));
app.use('/api/banks', require('./src/routes/banks'));
app.use('/api/contractors', require('./src/routes/contractors'));

const { supervisorsRouter, supervisorSiteTaggingRouter } = require('./src/routes/supervisors');
app.use('/api/supervisors', supervisorsRouter);
app.use('/api/supervisor-site-tagging', supervisorSiteTaggingRouter);

const { retailersRouter, retailerCategoriesRouter } = require('./src/routes/retailers');
app.use('/api/retailers', retailersRouter);
app.use('/api/retailer-categories', retailerCategoriesRouter);

// Sales module routes (Task 8)
app.use('/api/purchase-orders', require('./src/routes/purchaseOrders'));
app.use('/api/invoices', require('./src/routes/invoices'));
app.use('/api/balance-received', require('./src/routes/balanceReceived'));
app.use('/api/retailer-bills', require('./src/routes/retailerBills'));
app.use('/api/loans', require('./src/routes/loans'));

// Stock, Equipment, Vehicles, Income/Expense routes (Task 9)
const { stockProductsRouter, siteInventoryRouter, stockTransfersRouter, damagedStocksRouter } = require('./src/routes/stock');
app.use('/api/stock-products', stockProductsRouter);
app.use('/api/site-inventory', siteInventoryRouter);
app.use('/api/stock-transfers', stockTransfersRouter);
app.use('/api/damaged-stocks', damagedStocksRouter);

const { equipmentCategoriesRouter, equipmentRouter, equipmentSiteAssignmentsRouter } = require('./src/routes/equipment');
app.use('/api/equipment-categories', equipmentCategoriesRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/equipment-site-assignments', equipmentSiteAssignmentsRouter);

app.use('/api/vehicles', require('./src/routes/vehicles'));
app.use('/api/income-expenses', require('./src/routes/incomeExpenses'));

// Settings, Documents, Backup routes (Task 10)
const { termsRouter, headsRouter, menusRouter } = require('./src/routes/settings');
app.use('/api/settings/terms', termsRouter);
app.use('/api/settings/heads', headsRouter);
app.use('/api/settings/menus', menusRouter);

// GET /api/settings/permissions — returns role→menuSlugs mapping
app.get('/api/settings/permissions', require('./src/middleware/auth').authenticateToken, async (req, res) => {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from('menu_allotments')
    .select('profile_id, menu_url, granted')
    .eq('granted', true);
  if (error) return sendError(res, error.message, 500);
  const perms = {};
  for (const row of (data || [])) {
    if (!perms[row.profile_id]) perms[row.profile_id] = [];
    if (row.menu_url) perms[row.profile_id].push(row.menu_url);
  }
  return sendSuccess(res, perms);
});

const { documentFoldersRouter, documentsRouter } = require('./src/routes/documents');
app.use('/api/document-folders', documentFoldersRouter);
app.use('/api/documents', documentsRouter);

app.use('/api/backup', require('./src/routes/backup'));

// Reports, Dashboard KPIs, and Ledger routes (Task 11)
const { dashboardRouter, reportsRouter, ledgerRouter } = require('./src/routes/reports');
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/ledger', ledgerRouter);

// Global error handler — keeps response envelope consistent on unhandled errors
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  sendError(res, 'Internal server error', 500);
});

// Start server only when not in test mode
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { app };
