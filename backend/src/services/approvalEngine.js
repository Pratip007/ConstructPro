/**
 * Approval Engine Service
 *
 * createApprovalRequest — validates and inserts into approval_requests with status 'pending'
 * processApproval       — approve/reject with optimistic locking + ledger sync
 *
 * Concurrent-access guard: the WHERE clause of the UPDATE includes status='pending',
 * so a second admin who approves the same request will get 0 rows back → 409.
 */

const { supabase } = require('../config/supabase');
const { generateDisplayId } = require('../utils/displayId');
const { calculateOT } = require('./otCalculation');

// ---------------------------------------------------------------------------
// Module → table mapping for entity-CRUD approvals
// ---------------------------------------------------------------------------
const MODULE_TO_TABLE = {
  Employee: 'employees',
  Contractor: 'contractors',
  Retailer: 'retailers',
  Site: 'sites',
  Supervisor: 'supervisors',
  Company: 'companies',
};

// ---------------------------------------------------------------------------
// createApprovalRequest
// ---------------------------------------------------------------------------

/**
 * Insert a new approval request with status='pending'.
 *
 * @param {object} data
 * @param {'office'|'supervisor'} data.source
 * @param {number}  data.requesterId
 * @param {string}  data.requesterName
 * @param {number}  [data.siteId]
 * @param {string}  data.module        - e.g. 'Attendance', 'Payment', 'Employee'
 * @param {string}  data.actionType    - 'new_entry'|'edit'|'delete'|'status_toggle'
 * @param {string}  [data.referenceId]
 * @param {number}  [data.amount]
 * @param {object}  [data.oldData]
 * @param {object}  [data.newData]
 * @param {string}  [data.reason]
 * @returns {Promise<object>} inserted approval_requests row
 * @throws {{ status: number, message: string }}
 */
async function createApprovalRequest({
  source,
  requesterId,
  requesterName,
  siteId,
  module,
  actionType,
  referenceId,
  amount,
  oldData,
  newData,
  reason,
}) {
  const { count } = await supabase
    .from('approval_requests')
    .select('id', { count: 'exact', head: true });

  const displayId = generateDisplayId('APR', (count || 0) + 1);

  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      display_id: displayId,
      source,
      requester_id: requesterId,
      requester_name: requesterName || null,
      site_id: siteId || null,
      module,
      action_type: actionType,
      reference_id: referenceId != null ? String(referenceId) : null,
      amount: amount != null ? parseFloat(Number(amount).toFixed(2)) : null,
      old_data: oldData || null,
      new_data: newData || null,
      reason: reason || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw { status: 500, message: error.message };
  return data;
}

// ---------------------------------------------------------------------------
// processApproval
// ---------------------------------------------------------------------------

/**
 * Approve or reject a pending approval request.
 *
 * Optimistic locking: the UPDATE WHERE clause includes `status = 'pending'`.
 * If another admin already processed the request, the UPDATE matches 0 rows
 * (PostgREST PGRST116) → 409.
 *
 * @param {number}              requestId
 * @param {'approved'|'rejected'} action
 * @param {string|null}         adminRemarks
 * @param {number}              adminId
 * @returns {Promise<object>} updated approval_requests row
 * @throws {{ status: number, message: string }}
 */
async function processApproval(requestId, action, adminRemarks, adminId) {
  if (!['approved', 'rejected'].includes(action)) {
    throw { status: 400, message: 'action must be approved or rejected' };
  }

  if (action === 'rejected' && !adminRemarks) {
    throw { status: 400, message: 'Remarks required for rejection' };
  }

  // Optimistic lock — only update rows still in 'pending' state.
  // If status has already been changed (concurrent approve / already processed),
  // the WHERE matches 0 rows → Supabase returns PGRST116 with .single().
  const { data: updated, error: updateError } = await supabase
    .from('approval_requests')
    .update({
      status: action,
      admin_remarks: adminRemarks || null,
      admin_action_date: new Date().toISOString(),
      approved_by: adminId,
    })
    .eq('id', requestId)
    .eq('status', 'pending') // ← optimistic lock
    .select()
    .single();

  if (updateError) {
    // PGRST116: zero rows matched — already processed or not found
    if (updateError.code === 'PGRST116') {
      throw { status: 409, message: 'Already processed' };
    }
    throw { status: 500, message: updateError.message };
  }

  if (!updated) {
    throw { status: 409, message: 'Already processed' };
  }

  // Post-approval side effects (only when approved)
  if (action === 'approved') {
    if (updated.module === 'Attendance') {
      await _handleAttendanceApproval(updated);
    } else if (updated.module === 'Payment') {
      await _handlePaymentApproval(updated);
    } else if (MODULE_TO_TABLE[updated.module]) {
      await _handleEntityCrudApproval(updated);
    }
  }

  // Activity log (non-fatal — don't throw if logging fails)
  await supabase.from('activity_logs').insert({
    profile_id: adminId,
    action,
    module: updated.module,
    reference_id: String(requestId),
    description: `Approval request ${updated.display_id} ${action}${adminRemarks ? ': ' + adminRemarks : ''}`,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Private: Attendance approval handler
// ---------------------------------------------------------------------------

/**
 * When an Attendance approval is approved:
 * 1. Re-compute OT from new_data
 * 2. Insert attendance record
 * 3. Insert employee_ledger Credit entry
 * 4. Mark ledger_synced = true
 *
 * new_data shape: { employeeId, subId, siteId, month, presentDays, otHours, salaryBasis, baseDailyWage }
 */
async function _handleAttendanceApproval(approvalRequest) {
  const nd = approvalRequest.new_data;
  if (!nd) return;

  const {
    employeeId,
    subId,
    siteId,
    month,
    presentDays,
    otHours,
    salaryBasis,
    baseDailyWage,
  } = nd;

  // Re-compute OT from raw inputs
  const { presentWage, otRatePerHr, otAmount, totalAmount } = calculateOT(
    salaryBasis,
    Number(baseDailyWage),
    Number(presentDays),
    Number(otHours)
  );

  // Insert attendance record
  const { data: att, error: attError } = await supabase
    .from('attendance')
    .insert({
      employee_id: employeeId,
      sub_id: subId,
      site_id: siteId,
      month: month.length === 7 ? `${month}-01` : month, // normalise YYYY-MM to YYYY-MM-01
      present_days: presentDays,
      ot_hours: otHours,
      salary_basis: salaryBasis,
      base_daily_wage: baseDailyWage,
      present_wage: presentWage,
      ot_rate_per_hr: otRatePerHr,
      ot_amount: otAmount,
      total_amount: totalAmount,
    })
    .select('id')
    .single();

  if (attError) throw { status: 500, message: `Attendance insert failed: ${attError.message}` };

  // Generate display_id for ledger entry
  const { count: ledgerCount } = await supabase
    .from('employee_ledger')
    .select('id', { count: 'exact', head: true });
  const ledgerDisplayId = generateDisplayId('EL', (ledgerCount || 0) + 1);

  // Insert employee_ledger Credit entry
  const { error: ledgerError } = await supabase
    .from('employee_ledger')
    .insert({
      display_id: ledgerDisplayId,
      date: new Date().toISOString().split('T')[0],
      employee_id: employeeId,
      sub_id: subId,
      site_id: siteId,
      type: 'credit',
      credit_amount: totalAmount,
      debit_amount: 0,
      particulars: `Attendance for ${month.length === 7 ? month : month.slice(0, 7)} (approved)`,
      reference_id: String(att.id),
    });

  if (ledgerError) throw { status: 500, message: `Ledger insert failed: ${ledgerError.message}` };

  // Mark ledger_synced
  await supabase
    .from('approval_requests')
    .update({ ledger_synced: true })
    .eq('id', approvalRequest.id);
}

// ---------------------------------------------------------------------------
// Private: Payment approval handler
// ---------------------------------------------------------------------------

/**
 * When a Payment approval is approved:
 * 1. Update payment status to 'cleared'
 * 2. Insert employee_ledger Debit entry (for employee-category payments)
 * 3. Mark ledger_synced = true
 *
 * new_data shape: { employeeId } (optional — only needed to create ledger entry)
 * reference_id  : payment ID (string)
 * amount        : payment amount (from approval_requests.amount)
 */
async function _handlePaymentApproval(approvalRequest) {
  const nd = approvalRequest.new_data;
  const referenceId = approvalRequest.reference_id;
  const amount = approvalRequest.amount;

  // Update payment status to cleared
  if (referenceId) {
    const { error: payUpdateError } = await supabase
      .from('payments')
      .update({ status: 'cleared' })
      .eq('id', referenceId);

    if (payUpdateError) throw { status: 500, message: `Payment update failed: ${payUpdateError.message}` };
  }

  // Insert employee_ledger Debit for employee payments
  const employeeId = nd && nd.employeeId;
  if (employeeId && amount) {
    // Generate display_id for ledger entry
    const { count: ledgerCount } = await supabase
      .from('employee_ledger')
      .select('id', { count: 'exact', head: true });
    const ledgerDisplayId = generateDisplayId('EL', (ledgerCount || 0) + 1);

    const { error: ledgerError } = await supabase
      .from('employee_ledger')
      .insert({
        display_id: ledgerDisplayId,
        date: new Date().toISOString().split('T')[0],
        employee_id: employeeId,
        type: 'debit',
        debit_amount: parseFloat(Number(amount).toFixed(2)),
        credit_amount: 0,
        particulars: `Payment approved: ${approvalRequest.display_id}`,
        reference_id: referenceId || null,
      });

    if (ledgerError) throw { status: 500, message: `Ledger insert failed: ${ledgerError.message}` };
  }

  // Mark ledger_synced
  await supabase
    .from('approval_requests')
    .update({ ledger_synced: true })
    .eq('id', approvalRequest.id);
}

// ---------------------------------------------------------------------------
// Private: Entity CRUD approval handler
// ---------------------------------------------------------------------------

/**
 * When an entity-CRUD approval is approved, apply new_data to the target table.
 * action_type 'new_entry' → INSERT
 * action_type 'edit'      → UPDATE by reference_id
 * action_type 'delete'    → soft-delete (status = 'deleted')
 */
async function _handleEntityCrudApproval(approvalRequest) {
  const tableName = MODULE_TO_TABLE[approvalRequest.module];
  if (!tableName) return;

  const { action_type, new_data, reference_id } = approvalRequest;

  let crudError;
  if (action_type === 'new_entry' && new_data) {
    ({ error: crudError } = await supabase.from(tableName).insert(new_data));
  } else if (action_type === 'edit' && new_data && reference_id) {
    ({ error: crudError } = await supabase.from(tableName).update(new_data).eq('id', reference_id));
  } else if (action_type === 'delete' && reference_id) {
    ({ error: crudError } = await supabase.from(tableName).update({ status: 'deleted' }).eq('id', reference_id));
  }

  if (crudError) throw { status: 500, message: `Entity ${action_type} failed: ${crudError.message}` };
}

module.exports = { createApprovalRequest, processApproval };
