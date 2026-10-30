import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { id } = await params;

  const { data, error } = await supabase
    .from('invoices')
    .select('id, display_id, po_id, company_id, site_name, date, base_amount, gst_amount, gross_amount, is_gst, status, file_path, created_at')
    .eq('id', id)
    .single();

  if (error) return sendError(error.message, 500);
  if (!data) return sendError('Invoice not found', 404);
  return sendSuccess(data);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const { id } = await params;
  const body = await request.json();

  const allowedFields = ['po_id', 'company_id', 'site_name', 'date', 'base_amount', 'gst_amount', 'is_gst', 'status', 'file_path'];
  const updates: Record<string, unknown> = {};
  allowedFields.forEach((f) => {
    if (body[f] !== undefined) updates[f] = body[f];
  });

  // Recompute gross_amount if monetary fields are updated
  if (updates.base_amount !== undefined || updates.gst_amount !== undefined) {
    // Fetch current values to fill in the missing side
    const { data: current, error: fetchError } = await supabase
      .from('invoices')
      .select('base_amount, gst_amount')
      .eq('id', id)
      .single();

    if (fetchError) return sendError(fetchError.message, 500);
    if (!current) return sendError('Invoice not found', 404);

    const baseAmt = parseFloat(Number(updates.base_amount !== undefined ? updates.base_amount : current.base_amount).toFixed(2));
    const gstAmt = parseFloat(Number(updates.gst_amount !== undefined ? updates.gst_amount : current.gst_amount).toFixed(2));

    updates.base_amount = baseAmt;
    updates.gst_amount = gstAmt;
    updates.gross_amount = parseFloat(Number(baseAmt + gstAmt).toFixed(2));
  }

  if (Object.keys(updates).length === 0) {
    return sendError('No fields to update', 400);
  }

  const { data, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .select('id, display_id, po_id, company_id, site_name, date, base_amount, gst_amount, gross_amount, is_gst, status, file_path, created_at')
    .single();

  if (error) return sendError(error.message, 400);
  if (!data) return sendError('Invoice not found', 404);
  return sendSuccess(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const { id } = await params;

  const { data, error } = await supabase
    .from('invoices')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select('id, display_id, status')
    .single();

  if (error) return sendError(error.message, 400);
  if (!data) return sendError('Invoice not found', 404);
  return sendSuccess({ message: 'Invoice cancelled', invoice: data });
}
