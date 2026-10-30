import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { invoice_id } = getSearchParams(request);

  let q = supabase
    .from('balance_received')
    .select('id, invoice_id, date, entry_type, amount, tds_amount, payment_method, reference_number, remarks, created_at')
    .order('created_at', { ascending: false });

  if (invoice_id) q = q.eq('invoice_id', invoice_id);

  const { data, error } = await q;
  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const { invoiceId, date, amount, tdsAmount, entryType, paymentMethod, referenceNumber, remarks } = body;

  if (!invoiceId) return sendError('invoiceId must be a valid UUID', 400);
  if (!date) return sendError('date is required', 400);
  if (amount === undefined || amount === null) return sendError('amount must be numeric', 400);
  if (!['PAYMENT', 'TDS'].includes(entryType)) return sendError("entryType must be 'PAYMENT' or 'TDS'", 400);

  const parsedAmount = parseFloat(Number(amount).toFixed(2));
  const parsedTdsAmount = tdsAmount != null ? parseFloat(Number(tdsAmount).toFixed(2)) : null;

  // Insert balance_received record
  const { data: record, error: insertError } = await supabase
    .from('balance_received')
    .insert({
      invoice_id: invoiceId,
      date,
      entry_type: entryType,
      amount: parsedAmount,
      tds_amount: parsedTdsAmount,
      payment_method: paymentMethod || null,
      reference_number: referenceNumber || null,
      remarks: remarks || null,
    })
    .select('id, invoice_id, date, entry_type, amount, tds_amount, payment_method, reference_number, remarks, created_at')
    .single();

  if (insertError) return sendError(insertError.message, 400);

  // Fetch the invoice's gross_amount
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, gross_amount')
    .eq('id', invoiceId)
    .single();

  if (invoiceError) return sendError(invoiceError.message, 500);
  if (!invoice) return sendError('Invoice not found', 404);

  // Sum all balance_received amounts for this invoice
  const { data: sumData, error: sumError } = await supabase
    .from('balance_received')
    .select('amount')
    .eq('invoice_id', invoiceId);

  if (sumError) return sendError(sumError.message, 500);

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

  // Update invoice status
  const { error: updateError } = await supabase
    .from('invoices')
    .update({ status: newStatus })
    .eq('id', invoiceId);

  if (updateError) return sendError(updateError.message, 500);

  return sendSuccess({ record, invoiceStatus: newStatus, totalReceived }, 201);
}
