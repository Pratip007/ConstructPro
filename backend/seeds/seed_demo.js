/**
 * Demo data seeder for ATR ConstructPro.
 *
 * Creates 4 auth users + profile rows, then inserts all demo reference data
 * via supabase.from().insert() in FK-safe order.
 *
 * Idempotent: each entity is checked by display_id / name / account_number
 * before inserting — existing rows are skipped.
 *
 * Usage:
 *   node seeds/seed_demo.js
 */

require('dotenv').config();

const { supabase } = require('../src/config/supabase');

// ---------------------------------------------------------------------------
// Helper: log progress
// ---------------------------------------------------------------------------
function log(msg) {
  console.log(`[seed_demo] ${msg}`);
}

// ---------------------------------------------------------------------------
// Helper: create auth user + profile (skip if email already in auth)
// ---------------------------------------------------------------------------
async function createAuthUser({ email, password, name, role, displayId }) {
  // Check if profile with this display_id already exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('display_id', displayId)
    .maybeSingle();

  if (existingProfile) {
    log(`  SKIP: profile ${displayId} already exists.`);
    return;
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role, display_id: displayId },
  });

  if (authError) {
    // If user already exists in auth (duplicate email), fetch and reuse
    if (authError.message && authError.message.toLowerCase().includes('already')) {
      log(`  SKIP auth user ${email}: already exists in Supabase Auth.`);
      return;
    }
    throw new Error(`Auth user creation failed for ${email}: ${authError.message}`);
  }

  const authUid = authData.user.id;

  const { error: profileError } = await supabase.from('profiles').insert({
    auth_uid: authUid,
    display_id: displayId,
    name,
    role,
    email,
  });

  if (profileError) {
    // Attempt cleanup
    await supabase.auth.admin.deleteUser(authUid);
    throw new Error(`Profile creation failed for ${displayId}: ${profileError.message}`);
  }

  log(`  CREATED: ${role} user ${email} (${displayId})`);
}

// ---------------------------------------------------------------------------
// Helper: insert rows that don't already exist (idempotent upsert-by-display_id)
// ---------------------------------------------------------------------------
async function insertIfMissing(table, rows, uniqueField = 'display_id') {
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const keyVal = row[uniqueField];

    const { data: existing } = await supabase
      .from(table)
      .select('id')
      .eq(uniqueField, keyVal)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from(table).insert(row);
    if (error) {
      throw new Error(`Insert failed on ${table} (${uniqueField}=${keyVal}): ${error.message}`);
    }
    inserted++;
  }

  log(`  ${table}: ${inserted} inserted, ${skipped} skipped.`);
}

// ---------------------------------------------------------------------------
// Helper: look up a row's internal id by display_id
// ---------------------------------------------------------------------------
async function getId(table, displayId) {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('display_id', displayId)
    .single();

  if (error || !data) {
    throw new Error(`Could not find ${table} with display_id=${displayId}: ${error ? error.message : 'not found'}`);
  }
  return data.id;
}

// ---------------------------------------------------------------------------
// Helper: look up a row's internal id by name
// ---------------------------------------------------------------------------
async function getIdByName(table, name) {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('name', name)
    .single();

  if (error || !data) {
    throw new Error(`Could not find ${table} with name="${name}": ${error ? error.message : 'not found'}`);
  }
  return data.id;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function seedDemo() {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production') {
    console.error('[seed_demo] Refusing to run in production. Set NODE_ENV to something else or unset it.');
    process.exit(1);
  }

  log('Starting demo seed…');

  // =========================================================================
  // 1. Auth users + profiles
  // =========================================================================
  log('--- Auth users ---');

  const DEMO_ADMIN_PASS = process.env.DEMO_ADMIN_PASSWORD || 'Admin@123';
  const DEMO_OFFICE_PASS = process.env.DEMO_OFFICE_PASSWORD || 'Office@123';
  const DEMO_SUP1_PASS = process.env.DEMO_SUP1_PASSWORD || 'Sup1@123';
  const DEMO_SUP2_PASS = process.env.DEMO_SUP2_PASSWORD || 'Sup2@123';

  await createAuthUser({
    email: 'admin@atr.com',
    password: DEMO_ADMIN_PASS,
    name: 'Admin',
    role: 'admin',
    displayId: 'ADM-001',
  });

  await createAuthUser({
    email: 'office@atr.com',
    password: DEMO_OFFICE_PASS,
    name: 'Office User',
    role: 'office',
    displayId: 'OFF-001',
  });

  await createAuthUser({
    email: 'sup1@atr.com',
    password: DEMO_SUP1_PASS,
    name: 'Supervisor One',
    role: 'supervisor',
    displayId: 'SUP-001',
  });

  await createAuthUser({
    email: 'sup2@atr.com',
    password: DEMO_SUP2_PASS,
    name: 'Supervisor Two',
    role: 'supervisor',
    displayId: 'SUP-002',
  });

  // =========================================================================
  // 2. Companies
  // =========================================================================
  log('--- Companies ---');
  await insertIfMissing('companies', [
    {
      display_id: 'COMP-001',
      name: 'ATR Construction',
      gst_number: '19AABCU9603R1ZN',
      state_code: 'WB',
      phone: '9800000001',
      email: 'atr@atr.com',
      address: 'Dum Dum, Kolkata, WB',
      status: 'active',
    },
    {
      display_id: 'COMP-002',
      name: 'Silvergate Infra',
      gst_number: '19BBDCS1234R5ZM',
      state_code: 'WB',
      phone: '9800000002',
      email: 'sg@silvergate.com',
      address: 'Salt Lake, Kolkata, WB',
      status: 'active',
    },
  ]);

  // =========================================================================
  // 3. Sites
  // =========================================================================
  log('--- Sites ---');
  const companyId1 = await getId('companies', 'COMP-001');
  const companyId2 = await getId('companies', 'COMP-002');

  await insertIfMissing('sites', [
    { display_id: 'SITE-001', name: 'Dum Dum Project',      company_id: companyId1, address: 'Dum Dum, Kolkata',     status: 'active' },
    { display_id: 'SITE-002', name: 'Salt Lake Sector V',   company_id: companyId1, address: 'Sector V, Salt Lake',  status: 'active' },
    { display_id: 'SITE-003', name: 'Rajarhat Township',    company_id: companyId2, address: 'Rajarhat, Kolkata',    status: 'active' },
    { display_id: 'SITE-004', name: 'Howrah Bridge Repair', company_id: companyId2, address: 'Howrah, WB',           status: 'upcoming' },
    { display_id: 'SITE-005', name: 'Barrackpore Complex',  company_id: companyId1, address: 'Barrackpore, WB',      status: 'completed' },
  ]);

  // =========================================================================
  // 4. Banks
  // =========================================================================
  log('--- Banks ---');
  await insertIfMissing('banks', [
    {
      bank_name: 'State Bank of India',
      branch_name: 'Dum Dum Branch',
      account_number: '32145678901',
      ifsc_code: 'SBIN0001234',
      account_type: 'Current',
      holder_name: 'ATR Construction',
      opening_balance: 500000.00,
      status: 'active',
    },
    {
      bank_name: 'HDFC Bank',
      branch_name: 'Salt Lake Branch',
      account_number: '50100245678',
      ifsc_code: 'HDFC0001567',
      account_type: 'Current',
      holder_name: 'ATR Construction',
      opening_balance: 750000.00,
      status: 'active',
    },
    {
      bank_name: 'Punjab National Bank',
      branch_name: 'Barrackpore Branch',
      account_number: '0987654321',
      ifsc_code: 'PUNB0009876',
      account_type: 'Savings',
      holder_name: 'Silvergate Infra',
      opening_balance: 250000.00,
      status: 'active',
    },
  ], 'account_number');

  // =========================================================================
  // 5. Payment modes
  // =========================================================================
  log('--- Payment modes ---');
  for (const name of ['NEFT', 'UPI', 'Cash']) {
    const { data: existing } = await supabase
      .from('payment_modes')
      .select('id')
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      log(`  SKIP payment_modes name=${name}: already exists.`);
      continue;
    }
    const { error } = await supabase.from('payment_modes').insert({ name, is_active: true });
    if (error) throw new Error(`Insert failed on payment_modes (name=${name}): ${error.message}`);
    log(`  CREATED payment_modes: ${name}`);
  }

  // =========================================================================
  // 6. Employee categories
  // =========================================================================
  log('--- Employee categories ---');
  for (const cat of [
    { name: 'Mason',       description: 'Masonry work',     status: 'active' },
    { name: 'Helper',      description: 'General helper',   status: 'active' },
    { name: 'Electrician', description: 'Electrical work',  status: 'active' },
  ]) {
    const { data: existing } = await supabase
      .from('employee_categories')
      .select('id')
      .eq('name', cat.name)
      .maybeSingle();

    if (existing) {
      log(`  SKIP employee_categories name=${cat.name}: already exists.`);
      continue;
    }
    const { error } = await supabase.from('employee_categories').insert(cat);
    if (error) throw new Error(`Insert failed on employee_categories (name=${cat.name}): ${error.message}`);
    log(`  CREATED employee_categories: ${cat.name}`);
  }

  // =========================================================================
  // 7. Contractors
  // =========================================================================
  log('--- Contractors ---');
  await insertIfMissing('contractors', [
    { display_id: 'CONT-001', name: 'Rajesh Kumar', phone: '9100000001', pan: 'ABCPK1234F', tds_applicable: true,  tds_percent: 2.00, status: 'active' },
    { display_id: 'CONT-002', name: 'Sanjay Das',   phone: '9100000002', pan: 'DEFPD5678G', tds_applicable: true,  tds_percent: 1.00, status: 'active' },
    { display_id: 'CONT-003', name: 'Amit Singh',   phone: '9100000003', pan: null,         tds_applicable: false, tds_percent: null, status: 'active' },
  ]);

  // =========================================================================
  // 8. Retailer categories
  // =========================================================================
  log('--- Retailer categories ---');
  for (const cat of [
    { name: 'Building Materials',  description: 'Cement, sand, bricks, rods', status: 'active' },
    { name: 'Electrical Supplies', description: 'Wires, switches, fittings',  status: 'active' },
  ]) {
    const { data: existing } = await supabase
      .from('retailer_categories')
      .select('id')
      .eq('name', cat.name)
      .maybeSingle();

    if (existing) {
      log(`  SKIP retailer_categories name=${cat.name}: already exists.`);
      continue;
    }
    const { error } = await supabase.from('retailer_categories').insert(cat);
    if (error) throw new Error(`Insert failed on retailer_categories (name=${cat.name}): ${error.message}`);
    log(`  CREATED retailer_categories: ${cat.name}`);
  }

  // =========================================================================
  // 9. Retailers
  // =========================================================================
  log('--- Retailers ---');
  const catBuildingId   = await getIdByName('retailer_categories', 'Building Materials');
  const catElectricalId = await getIdByName('retailer_categories', 'Electrical Supplies');
  const site1Id = await getId('sites', 'SITE-001');
  const site2Id = await getId('sites', 'SITE-002');
  const site3Id = await getId('sites', 'SITE-003');

  await insertIfMissing('retailers', [
    { display_id: 'RET-001', category_id: catBuildingId,   name: 'Bengal Cement House',   phone: '9200000001', gst_status: 'YES', gst_number: '19BCHEM1234R1ZA', site_id: site1Id, status: 'active' },
    { display_id: 'RET-002', category_id: catBuildingId,   name: 'Eastern Hardware',      phone: '9200000002', gst_status: 'YES', gst_number: '19EHRDW5678R2ZB', site_id: site2Id, status: 'active' },
    { display_id: 'RET-003', category_id: catElectricalId, name: 'Lightning Electricals', phone: '9200000003', gst_status: 'YES', gst_number: '19LGTEL9012R3ZC', site_id: site3Id, status: 'active' },
    { display_id: 'RET-004', category_id: catBuildingId,   name: 'Local Sand Supplier',   phone: '9200000004', gst_status: 'NO',  gst_number: null,              site_id: site1Id, status: 'active' },
    { display_id: 'RET-005', category_id: catElectricalId, name: 'Quick Plumbing',        phone: '9200000005', gst_status: 'NO',  gst_number: null,              site_id: site2Id, status: 'active' },
  ]);

  // =========================================================================
  // 10. Stock products
  // =========================================================================
  log('--- Stock products ---');
  await insertIfMissing('stock_products', [
    { display_id: 'SP-001', name: 'Cement',        unit: 'Bag',   category: 'Building',   gst_percent: 18.00, status: 'active' },
    { display_id: 'SP-002', name: 'TMT Rod',       unit: 'KG',    category: 'Building',   gst_percent: 18.00, status: 'active' },
    { display_id: 'SP-003', name: 'Sand',          unit: 'CFT',   category: 'Building',   gst_percent:  0.00, status: 'active' },
    { display_id: 'SP-004', name: 'Bricks',        unit: 'Pcs',   category: 'Building',   gst_percent:  5.00, status: 'active' },
    { display_id: 'SP-005', name: 'Electric Wire', unit: 'Meter', category: 'Electrical', gst_percent: 18.00, status: 'active' },
  ]);

  // =========================================================================
  // 11. Equipment categories
  // =========================================================================
  log('--- Equipment categories ---');
  for (const cat of [
    { name: 'Crane',     description: 'Crane equipment',     status: 'active' },
    { name: 'Excavator', description: 'Excavator equipment', status: 'active' },
  ]) {
    const { data: existing } = await supabase
      .from('equipment_categories')
      .select('id')
      .eq('name', cat.name)
      .maybeSingle();

    if (existing) {
      log(`  SKIP equipment_categories name=${cat.name}: already exists.`);
      continue;
    }
    const { error } = await supabase.from('equipment_categories').insert(cat);
    if (error) throw new Error(`Insert failed on equipment_categories (name=${cat.name}): ${error.message}`);
    log(`  CREATED equipment_categories: ${cat.name}`);
  }

  // =========================================================================
  // 12. Head allotments
  // =========================================================================
  log('--- Head allotments ---');
  for (const head of [
    { name: 'Site Expense',         type: 'Expense', description: 'General site expenses',    status: 'active' },
    { name: 'Office Expense',       type: 'Expense', description: 'Office overhead expenses', status: 'active' },
    { name: 'Invoice Revenue',      type: 'Income',  description: 'Revenue from invoices',    status: 'active' },
    { name: 'Miscellaneous Income', type: 'Income',  description: 'Other income sources',     status: 'active' },
  ]) {
    const { data: existing } = await supabase
      .from('head_allotments')
      .select('id')
      .eq('name', head.name)
      .maybeSingle();

    if (existing) {
      log(`  SKIP head_allotments name=${head.name}: already exists.`);
      continue;
    }
    const { error } = await supabase.from('head_allotments').insert(head);
    if (error) throw new Error(`Insert failed on head_allotments (name=${head.name}): ${error.message}`);
    log(`  CREATED head_allotments: ${head.name}`);
  }

  // =========================================================================
  // 13. Terms & conditions
  // =========================================================================
  log('--- Terms & conditions ---');
  for (const tc of [
    { title: 'Payment Terms',  content: 'Payment due within 30 days of invoice',  module: 'invoice',        status: 'active' },
    { title: 'Delivery Terms', content: 'Delivery at site within 7 working days', module: 'purchase_order', status: 'active' },
  ]) {
    const { data: existing } = await supabase
      .from('terms_conditions')
      .select('id')
      .eq('title', tc.title)
      .maybeSingle();

    if (existing) {
      log(`  SKIP terms_conditions title="${tc.title}": already exists.`);
      continue;
    }
    const { error } = await supabase.from('terms_conditions').insert(tc);
    if (error) throw new Error(`Insert failed on terms_conditions (title=${tc.title}): ${error.message}`);
    log(`  CREATED terms_conditions: ${tc.title}`);
  }

  // =========================================================================
  // 14. Vehicles
  // =========================================================================
  log('--- Vehicles ---');
  await insertIfMissing('vehicles', [
    { display_id: 'VEH-001', vehicle_number: 'WB-26-1234', vehicle_type: 'Truck', make: 'Tata', model: '407',  year: 2022, owner_name: 'ATR Construction', owner_contact: '9300000001', assigned_site_id: site1Id, status: 'active' },
    { display_id: 'VEH-002', vehicle_number: 'WB-26-5678', vehicle_type: 'JCB',   make: 'JCB',  model: '3DX', year: 2023, owner_name: 'Rented',           owner_contact: '9300000002', assigned_site_id: site3Id, status: 'active' },
  ], 'vehicle_number');

  log('Demo seed completed successfully.');
}

seedDemo().catch((err) => {
  console.error('[seed_demo] Fatal error:', err.message);
  process.exit(1);
});
