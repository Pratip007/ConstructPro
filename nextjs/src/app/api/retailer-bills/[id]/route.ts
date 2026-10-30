import { NextRequest } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

const BILL_SELECT = 'id, display_id, date, inv_type, inv_no, category, retailer_name, retailer_id, site_id, gst_applicable, gst_number, total_amount, paid_amount, due_amount, status, file_path, created_at';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { id } = await params;

  const { data: bill, error: billError } = await supabase
    .from('retailer_bills')
    .select(BILL_SELECT)
    .eq('id', id)
    .single();

  if (billError) return sendError(billError.message, 500);
  if (!bill) return sendError('Retailer bill not found', 404);

  const { data: items, error: itemsError } = await supabase
    .from('retailer_bill_items')
    .select('id, bill_id, item, qty, unit, price, gst_percent, line_total, line_gst, final_total, add_to_stock')
    .eq('bill_id', id);

  if (itemsError) return sendError(itemsError.message, 500);

  return sendSuccess({ ...bill, items: items || [] });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;
  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const { id } = await params;
  const body = await request.json();

  const allowedFields = [
    'date', 'inv_type', 'inv_no', 'category', 'retailer_name',
    'retailer_id', 'site_id', 'gst_applicable', 'gst_number',
    'paid_amount', 'status', 'file_path',
  ];
  const updates: Record<string, unknown> = {};
  allowedFields.forEach((f) => {
    if (body[f] !== undefined) updates[f] = body[f];
  });

  // Recompute due_amount if paid_amount changed
  if (updates.paid_amount !== undefined) {
    const { data: current, error: fetchError } = await supabase
      .from('retailer_bills')
      .select('total_amount')
      .eq('id', id)
      .single();

    if (fetchError) return sendError(fetchError.message, 500);
    if (!current) return sendError('Retailer bill not found', 404);

    const paidAmt = parseFloat(Number(updates.paid_amount).toFixed(2));
    const due = parseFloat(Number(current.total_amount - paidAmt).toFixed(2));
    updates.paid_amount = paidAmt;
    updates.due_amount = due;
    updates.status = due > 0 ? 'DUE' : 'PAID';
  }

  if (Object.keys(updates).length === 0) {
    return sendError('No fields to update', 400);
  }

  const { data, error } = await supabase
    .from('retailer_bills')
    .update(updates)
    .eq('id', id)
    .select(BILL_SELECT)
    .single();

  if (error) return sendError(error.message, 400);
  if (!data) return sendError('Retailer bill not found', 404);
  return sendSuccess(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;
  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const { id } = await params;

  const { data, error } = await supabase
    .from('retailer_bills')
    .update({ status: 'CANCELLED' })
    .eq('id', id)
    .select('id, display_id, status')
    .single();

  if (error) return sendError(error.message, 400);
  if (!data) return sendError('Retailer bill not found', 404);
  return sendSuccess({ message: 'Retailer bill cancelled', bill: data });
}
