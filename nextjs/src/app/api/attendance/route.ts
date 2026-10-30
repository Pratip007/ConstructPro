import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  enforceSiteLock,
  getSearchParams,
  handleApiError,
} from '@/lib/api-utils';
import { calculateOT } from '@/lib/services/otCalculation';
import { createApprovalRequest } from '@/lib/services/approvalEngine';

// ---------------------------------------------------------------------------
// GET /api/attendance
// Filters: employee_id, site_id, month (YYYY-MM)
// Supervisor: auto-filtered to own site via enforceSiteLock.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const searchParams = getSearchParams(request);

    // enforceSiteLock: if supervisor, locks to their site
    const effectiveSiteId = enforceSiteLock(
      user,
      searchParams.site_id ? Number(searchParams.site_id) : null
    );

    let query = supabase
      .from('attendance')
      .select(`
        id, employee_id, sub_id, site_id, month, present_days, ot_hours,
        present_wage, ot_rate_per_hr, ot_amount, total_amount,
        created_at, updated_at
      `)
      .order('month', { ascending: false });

    if (searchParams.employee_id) query = query.eq('employee_id', searchParams.employee_id);
    if (effectiveSiteId) query = query.eq('site_id', effectiveSiteId);
    if (searchParams.month) query = query.like('month', `${searchParams.month}%`);

    const { data, error } = await query;
    if (error) return sendError(error.message, 500);

    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/attendance
// Body: { employeeId, subId, siteId, month, presentDays, otHours }
// Looks up sub-ID for rate & salary_basis, computes OT.
// Admin: saves directly + creates employee_ledger Credit.
// Supervisor: creates approval request.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin', 'supervisor');
    if (roleCheck) return roleCheck;

    const body = await request.json();
    const { employeeId, subId, siteId, month, presentDays, otHours } = body;

    // enforceSiteLock for supervisors
    enforceSiteLock(user, siteId || null);

    // Validation
    if (!employeeId) return sendError('employeeId must be a valid UUID', 400);
    if (!subId) return sendError('subId must be a valid UUID', 400);
    if (!siteId) return sendError('siteId must be a valid UUID', 400);
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return sendError('month must be in YYYY-MM format', 400);

    // Look up the sub-ID to get rate and salary_basis
    const { data: subRecord, error: subError } = await supabase
      .from('employee_sub_ids')
      .select('id, rate, salary_basis')
      .eq('id', subId)
      .eq('employee_id', employeeId)
      .single();

    if (subError || !subRecord) {
      return sendError('Sub-ID not found or does not belong to employee', 404);
    }

    const { rate: baseDailyWage, salary_basis: salaryBasis } = subRecord;

    // Compute OT
    const { presentWage, otRatePerHr, otAmount, totalAmount } = calculateOT(
      salaryBasis,
      Number(baseDailyWage),
      Number(presentDays),
      Number(otHours)
    );

    const attendanceRow = {
      employee_id: employeeId,
      sub_id: subId,
      site_id: siteId,
      month: `${month}-01`, // store as date
      present_days: presentDays,
      ot_hours: otHours,
      present_wage: presentWage,
      ot_rate_per_hr: otRatePerHr,
      ot_amount: otAmount,
      total_amount: totalAmount,
    };

    if (user.role === 'admin') {
      // Save attendance directly
      const { data: att, error: attError } = await supabase
        .from('attendance')
        .insert(attendanceRow)
        .select('id, employee_id, sub_id, site_id, month, present_days, ot_hours, present_wage, ot_rate_per_hr, ot_amount, total_amount, created_at')
        .single();

      if (attError) return sendError(attError.message, 400);

      // Create employee_ledger Credit entry
      const { error: ledgerError } = await supabase
        .from('employee_ledger')
        .insert({
          employee_id: employeeId,
          attendance_id: att.id,
          type: 'credit',
          credit_amount: totalAmount,
          debit_amount: 0,
          description: `Attendance for ${month}`,
          transaction_date: new Date().toISOString().split('T')[0],
        });

      if (ledgerError) {
        return sendError(`Attendance saved but ledger entry failed: ${ledgerError.message}`, 500);
      }

      return sendSuccess(att, 201);
    }

    // Supervisor: approval request
    const approval = await createApprovalRequest({
      source: 'supervisor',
      requesterId: user.id,
      requesterName: user.name,
      siteId: siteId,
      module: 'Attendance',
      actionType: 'new_entry',
      newData: attendanceRow,
    });
    return sendSuccess({ approval, message: 'Attendance approval request submitted' }, 202);
  } catch (error) {
    return handleApiError(error);
  }
}
