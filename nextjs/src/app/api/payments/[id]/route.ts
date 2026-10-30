import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
} from '@/lib/api-utils';
import { calculateTDS } from '@/lib/services/tdsCalculation';

/** Categories that trigger TDS calculation */
const TDS_CATEGORIES = ['contractor', 'mobilization'];

// ---------------------------------------------------------------------------
// PUT /api/payments/:id - update payment (admin only)
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  const { id } = await params;
  const body = await request.json();

  // Build update object with explicit snake_case mapping
  const updateFields: Record<string, unknown> = {};
  if (body.date !== undefined) updateFields.date = body.date;
  if (body.category !== undefined) updateFields.category = body.category;
  if (body.partyId !== undefined) updateFields.party_id = body.partyId;
  if (body.partyName !== undefined) updateFields.party_name = body.partyName;
  if (body.partyType !== undefined) updateFields.party_type = body.partyType;
  if (body.siteId !== undefined) updateFields.site_id = body.siteId;
  if (body.paymentModeId !== undefined) updateFields.payment_mode_id = body.paymentModeId;
  if (body.bankId !== undefined) updateFields.bank_id = body.bankId;
  if (body.remarks !== undefined) updateFields.remarks = body.remarks;
  if (body.status !== undefined) updateFields.status = body.status;

  // Recalculate TDS when amount or tdsPercentage changes
  if (body.amount !== undefined || body.tdsPercentage !== undefined) {
    // Fetch current record to fill in whichever value was not supplied
    const { data: current, error: fetchError } = await supabase
      .from('payments')
      .select('amount, tds_percentage, category')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return sendError('Payment not found', 404);
    }

    const grossAmount = body.amount !== undefined
      ? parseFloat(Number(body.amount).toFixed(2))
      : Number(current.amount);

    const tdsPercentage = body.tdsPercentage !== undefined
      ? parseFloat(Number(body.tdsPercentage).toFixed(2))
      : Number(current.tds_percentage);

    updateFields.amount = grossAmount;
    updateFields.tds_percentage = tdsPercentage;

    if (TDS_CATEGORIES.includes(current.category)) {
      const tds = calculateTDS(grossAmount, tdsPercentage);
      updateFields.tds_amount = tds.tdsAmount;
      updateFields.net_amount = tds.netAmount;
    }
  }

  const { data, error } = await supabase
    .from('payments')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single();

  if (error) return sendError(error.message, 500);
  if (!data) return sendError('Payment not found', 404);

  return sendSuccess(data);
}

// ---------------------------------------------------------------------------
// DELETE /api/payments/:id - void payment (admin only, soft delete)
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  const { id } = await params;

  const { data, error } = await supabase
    .from('payments')
    .update({ status: 'voided' })
    .eq('id', id)
    .select()
    .single();

  if (error) return sendError(error.message, 500);
  if (!data) return sendError('Payment not found', 404);

  return sendSuccess(data);
}
