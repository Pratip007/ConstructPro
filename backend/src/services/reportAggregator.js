'use strict';

/**
 * Report Aggregator Service
 *
 * Provides reusable data-aggregation functions consumed by the reports router.
 *
 * Exports:
 *   getDashboardKPIs()
 *   getPendingDues()
 *   getNotificationCounts()
 *   getSiteLedger(companyId, siteId)
 *   getEntityLedger(entityType, entityId, dateFrom, dateTo)
 */

const { supabase } = require('../config/supabase');

// ---------------------------------------------------------------------------
// getDashboardKPIs
// ---------------------------------------------------------------------------
/**
 * Counts of active entities and total bank balance.
 * @returns {Promise<{activeSites, activeEmployees, contractors, supervisors, retailers, totalBankBalance}>}
 */
async function getDashboardKPIs() {
  const [sitesRes, empRes, conRes, supRes, retRes, banksRes] = await Promise.all([
    supabase.from('sites').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('contractors').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('supervisors').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('retailers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('banks').select('opening_balance').eq('status', 'active'),
  ]);

  const checks = [
    ['sites', sitesRes],
    ['employees', empRes],
    ['contractors', conRes],
    ['supervisors', supRes],
    ['retailers', retRes],
    ['banks', banksRes],
  ];
  for (const [name, res] of checks) {
    if (res.error) throw new Error(`getDashboardKPIs (${name}): ${res.error.message}`);
  }

  const totalBankBalance = (banksRes.data || []).reduce(
    (sum, b) => sum + Number(b.opening_balance || 0),
    0
  );

  return {
    activeSites: sitesRes.count || 0,
    activeEmployees: empRes.count || 0,
    contractors: conRes.count || 0,
    supervisors: supRes.count || 0,
    retailers: retRes.count || 0,
    totalBankBalance,
  };
}

// ---------------------------------------------------------------------------
// getPendingDues
// ---------------------------------------------------------------------------
/**
 * Returns entities that have outstanding balances.
 *
 * employees  — positive balance (credits – debits > 0) in employee_ledger
 * retailers  — sum of due_amount on retailer_bills WHERE status='DUE'
 * contractors — sum(site_orders.net_amount) minus sum(payments.amount WHERE category='contractor') > 0
 *
 * @returns {Promise<{employees, retailers, contractors}>}
 */
async function getPendingDues() {
  // ---- Employee dues ----
  const { data: ledgerData, error: ledgerErr } = await supabase
    .from('employee_ledger')
    .select('employee_id, credit_amount, debit_amount');

  if (ledgerErr) throw new Error(`getPendingDues (employee_ledger): ${ledgerErr.message}`);

  const empBalMap = {};
  for (const e of (ledgerData || [])) {
    const empId = e.employee_id;
    empBalMap[empId] = (empBalMap[empId] || 0)
      + Number(e.credit_amount || 0)
      - Number(e.debit_amount || 0);
  }
  const employees = Object.entries(empBalMap)
    .filter(([, bal]) => bal > 0)
    .map(([employee_id, balance]) => ({ employee_id, balance }));

  // ---- Retailer dues ----
  const { data: billsData, error: billsErr } = await supabase
    .from('retailer_bills')
    .select('retailer_id, retailer_name, due_amount')
    .eq('status', 'DUE');

  if (billsErr) throw new Error(`getPendingDues (retailer_bills): ${billsErr.message}`);

  const retailerMap = {};
  for (const b of (billsData || [])) {
    const rId = b.retailer_id;
    if (!retailerMap[rId]) {
      retailerMap[rId] = { retailer_id: rId, retailer_name: b.retailer_name, total_due: 0 };
    }
    retailerMap[rId].total_due += Number(b.due_amount || 0);
  }
  const retailers = Object.values(retailerMap);

  // ---- Contractor dues ----
  const [ordersRes, cPayRes] = await Promise.all([
    supabase.from('site_orders').select('contractor_id, net_amount').eq('status', 'active'),
    supabase.from('payments').select('party_id, amount').eq('category', 'contractor'),
  ]);

  if (ordersRes.error) throw new Error(`getPendingDues (site_orders): ${ordersRes.error.message}`);
  if (cPayRes.error) throw new Error(`getPendingDues (payments/contractor): ${cPayRes.error.message}`);

  const contractorBilled = {};
  for (const o of (ordersRes.data || [])) {
    const cId = o.contractor_id;
    contractorBilled[cId] = (contractorBilled[cId] || 0) + Number(o.net_amount || 0);
  }
  const contractorPaid = {};
  for (const p of (cPayRes.data || [])) {
    const cId = p.party_id;
    contractorPaid[cId] = (contractorPaid[cId] || 0) + Number(p.amount || 0);
  }
  const contractors = Object.keys(contractorBilled)
    .map((cId) => ({
      contractor_id: cId,
      billed: contractorBilled[cId],
      paid: contractorPaid[cId] || 0,
      balance: contractorBilled[cId] - (contractorPaid[cId] || 0),
    }))
    .filter((c) => c.balance > 0);

  return { employees, retailers, contractors };
}

// ---------------------------------------------------------------------------
// getNotificationCounts
// ---------------------------------------------------------------------------
/**
 * Pending approval_request counts grouped by source (office / supervisor).
 * @returns {Promise<{office, supervisor, total}>}
 */
async function getNotificationCounts() {
  const [officeRes, supervisorRes] = await Promise.all([
    supabase
      .from('approval_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('source', 'office'),
    supabase
      .from('approval_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('source', 'supervisor'),
  ]);

  if (officeRes.error) throw new Error(`getNotificationCounts (office): ${officeRes.error.message}`);
  if (supervisorRes.error) throw new Error(`getNotificationCounts (supervisor): ${supervisorRes.error.message}`);

  return {
    office: officeRes.count || 0,
    supervisor: supervisorRes.count || 0,
    total: (officeRes.count || 0) + (supervisorRes.count || 0),
  };
}

// ---------------------------------------------------------------------------
// getSiteLedger
// ---------------------------------------------------------------------------
/**
 * 4-section monthly aggregation for a site:
 *   employee    — attendance.total_amount
 *   mobilization — equipment_site_assignments.rate (grouped by assigned_date month)
 *   retailer    — retailer_bills.total_amount
 *   contractor  — payments WHERE category='contractor'
 *
 * @param {string|number} companyId  — used for context / future company-level validation
 * @param {string|number} siteId
 * @returns {Promise<{ sections: object, grandTotal: object }>}
 */
async function getSiteLedger(companyId, siteId) {
  const [attendanceRes, mobilizationRes, retailerRes, contractorRes] = await Promise.all([
    supabase.from('attendance').select('month, total_amount').eq('site_id', siteId),
    supabase.from('equipment_site_assignments').select('assigned_date, rate').eq('site_id', siteId),
    supabase.from('retailer_bills').select('date, total_amount').eq('site_id', siteId),
    supabase
      .from('payments')
      .select('date, amount')
      .eq('site_id', siteId)
      .eq('category', 'contractor'),
  ]);

  if (attendanceRes.error) throw new Error(`getSiteLedger (attendance): ${attendanceRes.error.message}`);
  if (mobilizationRes.error) throw new Error(`getSiteLedger (equipment_site_assignments): ${mobilizationRes.error.message}`);
  if (retailerRes.error) throw new Error(`getSiteLedger (retailer_bills): ${retailerRes.error.message}`);
  if (contractorRes.error) throw new Error(`getSiteLedger (payments): ${contractorRes.error.message}`);

  /** Extract YYYY-MM prefix from any date/month string. */
  const toMonth = (s) => (s ? String(s).substring(0, 7) : null);

  const employeeMap = {};
  for (const r of (attendanceRes.data || [])) {
    const m = toMonth(r.month);
    if (m) employeeMap[m] = (employeeMap[m] || 0) + Number(r.total_amount || 0);
  }

  const mobilizationMap = {};
  for (const r of (mobilizationRes.data || [])) {
    const m = toMonth(r.assigned_date);
    if (m) mobilizationMap[m] = (mobilizationMap[m] || 0) + Number(r.rate || 0);
  }

  const retailerMap = {};
  for (const r of (retailerRes.data || [])) {
    const m = toMonth(r.date);
    if (m) retailerMap[m] = (retailerMap[m] || 0) + Number(r.total_amount || 0);
  }

  const contractorMap = {};
  for (const r of (contractorRes.data || [])) {
    const m = toMonth(r.date);
    if (m) contractorMap[m] = (contractorMap[m] || 0) + Number(r.amount || 0);
  }

  const allMonths = [
    ...new Set([
      ...Object.keys(employeeMap),
      ...Object.keys(mobilizationMap),
      ...Object.keys(retailerMap),
      ...Object.keys(contractorMap),
    ]),
  ].sort();

  const sections = {
    employee: allMonths.map((m) => ({ month: m, amount: employeeMap[m] || 0 })),
    mobilization: allMonths.map((m) => ({ month: m, amount: mobilizationMap[m] || 0 })),
    retailer: allMonths.map((m) => ({ month: m, amount: retailerMap[m] || 0 })),
    contractor: allMonths.map((m) => ({ month: m, amount: contractorMap[m] || 0 })),
  };

  const sumMap = (map) => Object.values(map).reduce((a, b) => a + b, 0);
  const grandTotal = {
    employee: sumMap(employeeMap),
    mobilization: sumMap(mobilizationMap),
    retailer: sumMap(retailerMap),
    contractor: sumMap(contractorMap),
  };
  grandTotal.total =
    grandTotal.employee + grandTotal.mobilization + grandTotal.retailer + grandTotal.contractor;

  return { sections, grandTotal };
}

// ---------------------------------------------------------------------------
// getEntityLedger
// ---------------------------------------------------------------------------
/**
 * Builds a Tally-style running-balance ledger for any supported entity.
 *
 * entityType: 'employee' | 'contractor' | 'retailer' | 'supervisor' | 'company'
 *
 * Returns array of: { date, particulars, debit, credit, balance }
 *
 * @param {string} entityType
 * @param {string|number} entityId
 * @param {string|null} dateFrom  ISO date (inclusive)
 * @param {string|null} dateTo    ISO date (inclusive)
 */
async function getEntityLedger(entityType, entityId, dateFrom, dateTo) {
  let raw = []; // [{ date, particulars, debit, credit }]

  switch (entityType) {
    // ---- Employee ----
    case 'employee': {
      let q = supabase
        .from('employee_ledger')
        .select('type, credit_amount, debit_amount, description, transaction_date, created_at')
        .eq('employee_id', entityId)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (dateFrom) q = q.gte('transaction_date', dateFrom);
      if (dateTo) q = q.lte('transaction_date', dateTo);

      const { data, error } = await q;
      if (error) throw new Error(`getEntityLedger (employee): ${error.message}`);

      raw = (data || []).map((e) => ({
        date: e.transaction_date,
        particulars: e.description || (e.type === 'credit' ? 'Credit' : 'Debit'),
        credit: Number(e.credit_amount || 0),
        debit: Number(e.debit_amount || 0),
      }));
      break;
    }

    // ---- Contractor ----
    case 'contractor': {
      let soQ = supabase
        .from('site_orders')
        .select('display_id, date, net_amount')
        .eq('contractor_id', entityId);

      let pmQ = supabase
        .from('payments')
        .select('display_id, date, amount, remarks')
        .eq('category', 'contractor')
        .eq('party_id', entityId);

      if (dateFrom) { soQ = soQ.gte('date', dateFrom); pmQ = pmQ.gte('date', dateFrom); }
      if (dateTo) { soQ = soQ.lte('date', dateTo); pmQ = pmQ.lte('date', dateTo); }

      const [soRes, pmRes] = await Promise.all([soQ, pmQ]);
      if (soRes.error) throw new Error(`getEntityLedger (site_orders): ${soRes.error.message}`);
      if (pmRes.error) throw new Error(`getEntityLedger (payments/contractor): ${pmRes.error.message}`);

      const credits = (soRes.data || []).map((r) => ({
        date: r.date,
        particulars: `Order ${r.display_id}`,
        credit: Number(r.net_amount || 0),
        debit: 0,
      }));
      const debits = (pmRes.data || []).map((r) => ({
        date: r.date,
        particulars: r.remarks || `Payment ${r.display_id}`,
        credit: 0,
        debit: Number(r.amount || 0),
      }));

      raw = [...credits, ...debits].sort(
        (a, b) => String(a.date).localeCompare(String(b.date))
      );
      break;
    }

    // ---- Retailer ----
    case 'retailer': {
      let billQ = supabase
        .from('retailer_bills')
        .select('display_id, date, total_amount')
        .eq('retailer_id', entityId);

      let pmQ = supabase
        .from('payments')
        .select('display_id, date, amount, remarks')
        .eq('category', 'retailer')
        .eq('party_id', entityId);

      if (dateFrom) { billQ = billQ.gte('date', dateFrom); pmQ = pmQ.gte('date', dateFrom); }
      if (dateTo) { billQ = billQ.lte('date', dateTo); pmQ = pmQ.lte('date', dateTo); }

      const [billRes, pmRes] = await Promise.all([billQ, pmQ]);
      if (billRes.error) throw new Error(`getEntityLedger (retailer_bills): ${billRes.error.message}`);
      if (pmRes.error) throw new Error(`getEntityLedger (payments/retailer): ${pmRes.error.message}`);

      const credits = (billRes.data || []).map((r) => ({
        date: r.date,
        particulars: `Bill ${r.display_id}`,
        credit: Number(r.total_amount || 0),
        debit: 0,
      }));
      const debits = (pmRes.data || []).map((r) => ({
        date: r.date,
        particulars: r.remarks || `Payment ${r.display_id}`,
        credit: 0,
        debit: Number(r.amount || 0),
      }));

      raw = [...credits, ...debits].sort(
        (a, b) => String(a.date).localeCompare(String(b.date))
      );
      break;
    }

    // ---- Supervisor ----
    case 'supervisor': {
      let q = supabase
        .from('payments')
        .select('display_id, date, amount, remarks')
        .eq('category', 'supervisor_fund')
        .eq('party_id', entityId)
        .order('date', { ascending: true });

      if (dateFrom) q = q.gte('date', dateFrom);
      if (dateTo) q = q.lte('date', dateTo);

      const { data, error } = await q;
      if (error) throw new Error(`getEntityLedger (supervisor): ${error.message}`);

      raw = (data || []).map((r) => ({
        date: r.date,
        particulars: r.remarks || `Payment ${r.display_id}`,
        credit: 0,
        debit: Number(r.amount || 0),
      }));
      break;
    }

    // ---- Company ----
    case 'company': {
      // Fetch all invoice IDs for this company first (needed for balance_received IN filter)
      const { data: invIds, error: invIdsErr } = await supabase
        .from('invoices')
        .select('id')
        .eq('company_id', entityId);

      if (invIdsErr) throw new Error(`getEntityLedger (invoices IDs): ${invIdsErr.message}`);

      // Credits: invoices for company
      let invQ = supabase
        .from('invoices')
        .select('display_id, date, gross_amount')
        .eq('company_id', entityId)
        .order('date', { ascending: true });

      if (dateFrom) invQ = invQ.gte('date', dateFrom);
      if (dateTo) invQ = invQ.lte('date', dateTo);

      const { data: invData, error: invErr } = await invQ;
      if (invErr) throw new Error(`getEntityLedger (invoices): ${invErr.message}`);

      const credits = (invData || []).map((r) => ({
        date: r.date,
        particulars: `Invoice ${r.display_id}`,
        credit: Number(r.gross_amount || 0),
        debit: 0,
      }));

      // Debits: payments received against those invoices
      let debits = [];
      const allInvIds = (invIds || []).map((r) => r.id);

      if (allInvIds.length > 0) {
        let brQ = supabase
          .from('balance_received')
          .select('invoice_id, date, amount')
          .in('invoice_id', allInvIds)
          .order('date', { ascending: true });

        if (dateFrom) brQ = brQ.gte('date', dateFrom);
        if (dateTo) brQ = brQ.lte('date', dateTo);

        const { data: brData, error: brErr } = await brQ;
        if (brErr) throw new Error(`getEntityLedger (balance_received): ${brErr.message}`);

        debits = (brData || []).map((r) => ({
          date: r.date,
          particulars: `Payment received (Invoice #${r.invoice_id})`,
          credit: 0,
          debit: Number(r.amount || 0),
        }));
      }

      raw = [...credits, ...debits].sort(
        (a, b) => String(a.date).localeCompare(String(b.date))
      );
      break;
    }

    default:
      throw new Error(`Unknown entityType: ${entityType}`);
  }

  // Compute Tally-style running balance
  let runningBalance = 0;
  return raw.map((e) => {
    runningBalance += e.credit - e.debit;
    return {
      date: e.date,
      particulars: e.particulars,
      debit: e.debit,
      credit: e.credit,
      balance: runningBalance,
    };
  });
}

// ---------------------------------------------------------------------------
// getFinancialSummary
// ---------------------------------------------------------------------------
/**
 * Returns last 6 months of income vs expense totals.
 * NOTE: income_expenses.type values are 'Income' / 'Expense' (capitalised).
 *       amount is stored in plain rupees; divide by 100000 to get lakhs.
 */
async function getFinancialSummary() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data, error } = await supabase
    .from('income_expenses')
    .select('type, amount, date')
    .neq('status', 'inactive')
    .gte('date', sixMonthsAgo.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) throw new Error(`getFinancialSummary: ${error.message}`);

  // Group by month label (e.g. "Oct")
  const months = {};
  for (const row of data || []) {
    const d = new Date(row.date);
    const label = d.toLocaleString('en-IN', { month: 'short' });
    if (!months[label]) months[label] = { income: 0, expense: 0 };
    const amt = Number(row.amount || 0) / 100000; // convert to lakhs
    if (row.type === 'Income') months[label].income += amt;
    else if (row.type === 'Expense') months[label].expense += amt;
  }

  const labels = Object.keys(months);
  return {
    labels,
    income: labels.map((l) => parseFloat(months[l].income.toFixed(2))),
    expense: labels.map((l) => parseFloat(months[l].expense.toFixed(2))),
  };
}

// ---------------------------------------------------------------------------
// getSiteActivity
// ---------------------------------------------------------------------------
/**
 * Returns weekly active site and worker counts for the last 12 weeks.
 */
async function getSiteActivity() {
  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

  const [sitesRes, empRes] = await Promise.all([
    supabase
      .from('sites')
      .select('created_at, status')
      .gte('created_at', twelveWeeksAgo.toISOString()),
    supabase
      .from('employees')
      .select('created_at, status')
      .eq('status', 'active')
      .gte('created_at', twelveWeeksAgo.toISOString()),
  ]);

  if (sitesRes.error) throw new Error(`getSiteActivity sites: ${sitesRes.error.message}`);
  if (empRes.error) throw new Error(`getSiteActivity employees: ${empRes.error.message}`);

  // Build 12 week buckets
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (11 - i) * 7);
    return { label: `W${i + 1}`, date: d, sites: 0, workers: 0 };
  });

  for (const site of sitesRes.data || []) {
    const created = new Date(site.created_at);
    for (let i = weeks.length - 1; i >= 0; i--) {
      if (created <= weeks[i].date) { weeks[i].sites++; break; }
    }
  }
  for (const emp of empRes.data || []) {
    const created = new Date(emp.created_at);
    for (let i = weeks.length - 1; i >= 0; i--) {
      if (created <= weeks[i].date) { weeks[i].workers++; break; }
    }
  }

  return {
    labels: weeks.map((w) => w.label),
    sites: weeks.map((w) => w.sites),
    workers: weeks.map((w) => w.workers),
  };
}

module.exports = {
  getDashboardKPIs,
  getPendingDues,
  getNotificationCounts,
  getSiteLedger,
  getEntityLedger,
  getFinancialSummary,
  getSiteActivity,
};
