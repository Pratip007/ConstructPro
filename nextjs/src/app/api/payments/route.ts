import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  enforceSiteLock,
  generateDisplayId,
  getSearchParams,
  handleApiError,
} from '@/lib/api-utils';
import { calculateTDS } from '@/lib/services/tdsCalculation';

/** Categories that trigger TDS calculation */
const TDS_CATEGORIES = ['contractor', 'mobilization'];

/** Categories that supervisors are allowed to create */
const SUPERVISOR_ALLOWED_CATEGORIES = ['employee', 'retailer'];

/** All valid payment categories */
const VALID_CATEGORIES = ['employee', 'retailer', 'contractor', 'mobilization', 'office', 'other'];

// ---------------------------------------------------------------------------
// GET /api/payments - list payments with optional filters
// Supervisor: auto-filtered to own site via enforceSiteLock
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const params = getSearchParams(request);
    const { category, status, from, to } = params;

    const siteId = enforceSiteLock(user, params.site_id ? Number(params.site_id) : null);

    let q = supabase
      .from('payments')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (category) q = q.eq('category', category);
    if (siteId) q = q.eq('site_id', siteId);
    if (status) q = q.eq('status', status);
    if (from) q = q.gte('date', from);
    if (to) q = q.lte('date', to);

    const { data, error } = await q;
    if (error) return sendError(error.message, 500);

    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/payments - create a payment
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const body = await request.json();

    const {
      date,
      category,
      partyId,
      partyName,
      partyType,
      siteId,
      amount,
      tdsPercentage = 0,
      paymentModeId,
      bankId,
      remarks,
    } = body;

    // Validation
    if (!date) return sendError('date must be a valid ISO date', 400);
    if (!VALID_CATEGORIES.includes(category)) {
      return sendError(`category must be one of: ${VALID_CATEGORIES.join(', ')}`, 400);
    }
    if (amount === undefined || Number(amount) < 0) {
      return sendError('amount must be a non-negative number', 400);
    }

    const role = user.role;

    // Role-based category restriction
    if (role === 'supervisor' && !SUPERVISOR_ALLOWED_CATEGORIES.includes(category)) {
      return sendError(`Supervisors can only create payments of type: ${SUPERVISOR_ALLOWED_CATEGORIES.join(', ')}`, 403);
    }

    // Enforce site lock for supervisors
    const resolvedSiteId = enforceSiteLock(user, siteId ? Number(siteId) : null);

    // Role-based status
    let status: string;
    if (role === 'admin') {
      status = 'cleared';
    } else if (role === 'supervisor') {
      status = 'on_hold';
    } else {
      // office or other authenticated roles -> approval flow
      status = 'pending_approval';
    }

    // Supervisors cannot attach a bank account
    const resolvedBankId = role === 'supervisor' ? null : (bankId || null);

    // TDS calculation (only for relevant categories)
    let tdsAmount = 0;
    let netAmount = parseFloat(Number(amount).toFixed(2));
    if (TDS_CATEGORIES.includes(category)) {
      const tds = calculateTDS(Number(amount), Number(tdsPercentage));
      tdsAmount = tds.tdsAmount;
      netAmount = tds.netAmount;
    }

    // Generate display_id: PAY-<seq>
    const { count: payCount } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true });

    const displayId = generateDisplayId('PAY', (payCount || 0) + 1);

    // Insert payment record
    const { data: payment, error: insertError } = await supabase
      .from('payments')
      .insert({
        display_id: displayId,
        date,
        category,
        party_id: partyId || null,
        party_name: partyName || null,
        party_type: partyType || null,
        site_id: resolvedSiteId || siteId || user.siteId || null,
        amount: parseFloat(Number(amount).toFixed(2)),
        tds_percentage: parseFloat(Number(tdsPercentage).toFixed(2)),
        tds_amount: tdsAmount,
        net_amount: netAmount,
        payment_mode_id: paymentModeId || null,
        bank_id: resolvedBankId,
        remarks: remarks || null,
        status,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) return sendError(insertError.message, 500);

    // On employee payment with status 'cleared': create employee_ledger Debit entry
    if (category === 'employee' && status === 'cleared' && partyId) {
      const { error: ledgerError } = await supabase
        .from('employee_ledger')
        .insert({
          employee_id: partyId,
          payment_id: payment.id,
          type: 'debit',
          debit_amount: parseFloat(Number(amount).toFixed(2)),
          credit_amount: 0,
          description: `Payment: ${displayId}${remarks ? ' – ' + remarks : ''}`,
          transaction_date: date,
        });

      if (ledgerError) {
        return sendError(`Payment saved but ledger entry failed: ${ledgerError.message}`, 500);
      }
    }

    return sendSuccess(payment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
