import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  handleApiError,
} from '@/lib/api-utils';

// ---------------------------------------------------------------------------
// GET /api/balance-received/:id - get single balance received record
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const { id } = await params;

    const { data, error } = await supabase
      .from('balance_received')
      .select('id, invoice_id, date, entry_type, amount, tds_amount, payment_method, reference_number, remarks, created_at')
      .eq('id', id)
      .single();

    if (error) return sendError(error.message, 500);
    if (!data) return sendError('Balance received record not found', 404);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/balance-received/:id - update balance received record (admin/office)
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin', 'office');
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const body = await request.json();

    const allowedFields = ['date', 'entry_type', 'amount', 'tds_amount', 'payment_method', 'reference_number', 'remarks'];
    const updates: Record<string, unknown> = {};
    allowedFields.forEach((f) => {
      if (body[f] !== undefined) updates[f] = body[f];
    });

    // Handle camelCase body fields
    if (body.entryType !== undefined) updates.entry_type = body.entryType;
    if (body.paymentMethod !== undefined) updates.payment_method = body.paymentMethod;
    if (body.referenceNumber !== undefined) updates.reference_number = body.referenceNumber;
    if (body.tdsAmount !== undefined) updates.tds_amount = body.tdsAmount != null ? parseFloat(Number(body.tdsAmount).toFixed(2)) : null;

    // Round amount if provided
    if (updates.amount !== undefined) {
      updates.amount = parseFloat(Number(updates.amount).toFixed(2));
    }

    if (Object.keys(updates).length === 0) {
      return sendError('No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('balance_received')
      .update(updates)
      .eq('id', id)
      .select('id, invoice_id, date, entry_type, amount, tds_amount, payment_method, reference_number, remarks, created_at')
      .single();

    if (error) return sendError(error.message, 400);
    if (!data) return sendError('Balance received record not found', 404);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/balance-received/:id - delete balance received record (admin/office)
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin', 'office');
    if (roleCheck) return roleCheck;

    const { id } = await params;

    // Fetch the record to get invoice_id before deleting
    const { data: record, error: fetchError } = await supabase
      .from('balance_received')
      .select('id, invoice_id')
      .eq('id', id)
      .single();

    if (fetchError) return sendError(fetchError.message, 500);
    if (!record) return sendError('Balance received record not found', 404);

    const { error: deleteError } = await supabase
      .from('balance_received')
      .delete()
      .eq('id', id);

    if (deleteError) return sendError(deleteError.message, 400);

    // Recalculate invoice status after deletion
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, gross_amount')
      .eq('id', record.invoice_id)
      .single();

    if (invoice) {
      const { data: sumData } = await supabase
        .from('balance_received')
        .select('amount')
        .eq('invoice_id', record.invoice_id);

      const totalReceived = parseFloat(
        (sumData || []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0).toFixed(2)
      );

      const grossAmount = parseFloat(Number(invoice.gross_amount).toFixed(2));

      let newStatus: string;
      if (totalReceived >= grossAmount) {
        newStatus = 'paid';
      } else if (totalReceived > 0) {
        newStatus = 'partial';
      } else {
        newStatus = 'unpaid';
      }

      await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', record.invoice_id);
    }

    return sendSuccess({ message: 'Balance received record deleted' });
  } catch (error) {
    return handleApiError(error);
  }
}
