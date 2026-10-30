import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// getDashboardKPIs
// ---------------------------------------------------------------------------
export async function getDashboardKPIs() {
  const [sitesRes, empRes, conRes, supRes, retRes, banksRes] = await Promise.all([
    supabase.from('sites').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('contractors').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('supervisors').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('retailers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('banks').select('opening_balance').eq('status', 'active'),
  ]);

  const checks: [string, { error: any }][] = [
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
    (sum: number, b: Record<string, unknown>) => sum + Number(b.opening_balance || 0),
    0
  );

  return {
    active_sites: sitesRes.count || 0,
    active_employees: empRes.count || 0,
    contractors: conRes.count || 0,
    supervisors: supRes.count || 0,
    retailers: retRes.count || 0,
    total_bank_balance: totalBankBalance,
  };
}

// ---------------------------------------------------------------------------
// getPendingDues — returns a flat array of { id, name, role, formatted_amount }
// ---------------------------------------------------------------------------
export async function getPendingDues() {
  const dues: Array<{ id: string; name: string; role: string; amount: number }> = [];

  // ---- Retailer dues (bills with DUE status) ----
  const { data: billsData, error: billsErr } = await supabase
    .from('retailer_bills')
    .select('retailer_id, retailer_name, due_amount')
    .eq('status', 'DUE');

  if (billsErr) throw new Error(`getPendingDues (retailer_bills): ${billsErr.message}`);

  const retailerMap: Record<string, { name: string; total: number }> = {};
  for (const b of billsData || []) {
    const rId = String(b.retailer_id);
    if (!retailerMap[rId]) retailerMap[rId] = { name: b.retailer_name, total: 0 };
    retailerMap[rId].total += Number(b.due_amount || 0);
  }
  for (const [rId, r] of Object.entries(retailerMap)) {
    if (r.total > 0) dues.push({ id: `ret-${rId}`, name: r.name, role: 'Retailer', amount: r.total });
  }

  // ---- Employee dues (net credit balance from ledger) ----
  const { data: ledgerData, error: ledgerErr } = await supabase
    .from('employee_ledger')
    .select('employee_id, credit_amount, debit_amount');

  if (ledgerErr) throw new Error(`getPendingDues (employee_ledger): ${ledgerErr.message}`);

  const empBalMap: Record<string, number> = {};
  for (const e of ledgerData || []) {
    const empId = String(e.employee_id);
    empBalMap[empId] = (empBalMap[empId] || 0) + Number(e.credit_amount || 0) - Number(e.debit_amount || 0);
  }
  const empIdsWithDues = Object.entries(empBalMap).filter(([, bal]) => bal > 0).map(([id]) => id);

  if (empIdsWithDues.length > 0) {
    const { data: empData } = await supabase
      .from('employees')
      .select('id, name')
      .in('id', empIdsWithDues);

    const empNameMap: Record<string, string> = {};
    for (const e of empData || []) empNameMap[String(e.id)] = e.name;

    for (const empId of empIdsWithDues) {
      dues.push({
        id: `emp-${empId}`,
        name: empNameMap[empId] || `Employee #${empId}`,
        role: 'Employee',
        amount: empBalMap[empId],
      });
    }
  }

  return dues.map((d) => ({
    id: d.id,
    name: d.name,
    role: d.role,
    amount: d.amount,
    formatted_amount: `₹${Number(d.amount).toLocaleString('en-IN')}`,
  }));
}

// ---------------------------------------------------------------------------
// getNotificationCounts
// ---------------------------------------------------------------------------
export async function getNotificationCounts() {
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
export async function getSiteLedger(companyId: string | null, siteId: string) {
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

  const toMonth = (s: string | null) => (s ? String(s).substring(0, 7) : null);

  const employeeMap: Record<string, number> = {};
  for (const r of attendanceRes.data || []) {
    const m = toMonth(r.month);
    if (m) employeeMap[m] = (employeeMap[m] || 0) + Number(r.total_amount || 0);
  }

  const mobilizationMap: Record<string, number> = {};
  for (const r of mobilizationRes.data || []) {
    const m = toMonth(r.assigned_date);
    if (m) mobilizationMap[m] = (mobilizationMap[m] || 0) + Number(r.rate || 0);
  }

  const retailerMapLedger: Record<string, number> = {};
  for (const r of retailerRes.data || []) {
    const m = toMonth(r.date);
    if (m) retailerMapLedger[m] = (retailerMapLedger[m] || 0) + Number(r.total_amount || 0);
  }

  const contractorMap: Record<string, number> = {};
  for (const r of contractorRes.data || []) {
    const m = toMonth(r.date);
    if (m) contractorMap[m] = (contractorMap[m] || 0) + Number(r.amount || 0);
  }

  const allMonths = [
    ...new Set([
      ...Object.keys(employeeMap),
      ...Object.keys(mobilizationMap),
      ...Object.keys(retailerMapLedger),
      ...Object.keys(contractorMap),
    ]),
  ].sort();

  const sections = {
    employee: allMonths.map((m) => ({ month: m, amount: employeeMap[m] || 0 })),
    mobilization: allMonths.map((m) => ({ month: m, amount: mobilizationMap[m] || 0 })),
    retailer: allMonths.map((m) => ({ month: m, amount: retailerMapLedger[m] || 0 })),
    contractor: allMonths.map((m) => ({ month: m, amount: contractorMap[m] || 0 })),
  };

  const sumMap = (map: Record<string, number>) => Object.values(map).reduce((a, b) => a + b, 0);
  const grandTotal: Record<string, number> = {
    employee: sumMap(employeeMap),
    mobilization: sumMap(mobilizationMap),
    retailer: sumMap(retailerMapLedger),
    contractor: sumMap(contractorMap),
  };
  grandTotal.total =
    grandTotal.employee + grandTotal.mobilization + grandTotal.retailer + grandTotal.contractor;

  return { sections, grandTotal };
}

// ---------------------------------------------------------------------------
// getEntityLedger
// ---------------------------------------------------------------------------
export async function getEntityLedger(
  entityType: string,
  entityId: string,
  dateFrom: string | null,
  dateTo: string | null
) {
  let raw: { date: string; particulars: string; debit: number; credit: number }[] = [];

  switch (entityType) {
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

    case 'contractor': {
      // Contractor ledger: payments made to contractors (no separate work-order table)
      let pmQ = supabase
        .from('payments')
        .select('display_id, date, amount, remarks')
        .eq('category', 'contractor')
        .eq('party_id', entityId)
        .order('date', { ascending: true });

      if (dateFrom) pmQ = pmQ.gte('date', dateFrom);
      if (dateTo) pmQ = pmQ.lte('date', dateTo);

      const { data: pmData, error: pmErr } = await pmQ;
      if (pmErr) throw new Error(`getEntityLedger (payments/contractor): ${pmErr.message}`);

      raw = (pmData || []).map((r) => ({
        date: r.date,
        particulars: r.remarks || `Payment ${r.display_id}`,
        credit: 0,
        debit: Number(r.amount || 0),
      }));
      break;
    }

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

    case 'company': {
      const { data: invIds, error: invIdsErr } = await supabase
        .from('invoices')
        .select('id')
        .eq('company_id', entityId);

      if (invIdsErr) throw new Error(`getEntityLedger (invoices IDs): ${invIdsErr.message}`);

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

      let debits: { date: string; particulars: string; credit: number; debit: number }[] = [];
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
export async function getFinancialSummary() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data, error } = await supabase
    .from('income_expenses')
    .select('type, amount, date')
    .neq('status', 'inactive')
    .gte('date', sixMonthsAgo.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) throw new Error(`getFinancialSummary: ${error.message}`);

  const months: Record<string, { income: number; expense: number }> = {};
  for (const row of data || []) {
    const d = new Date(row.date);
    const label = d.toLocaleString('en-IN', { month: 'short' });
    if (!months[label]) months[label] = { income: 0, expense: 0 };
    const amt = Number(row.amount || 0) / 100000;
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
export async function getSiteActivity() {
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
