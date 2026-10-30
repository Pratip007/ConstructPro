import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams, generateDisplayId } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { company_id, status, is_gst } = getSearchParams(request);

  let q = supabase
    .from('invoices')
    .select('id, display_id, po_id, company_id, site_name, date, base_amount, gst_amount, gross_amount, is_gst, status, file_path, created_at')
    .order('created_at', { ascending: false });

  if (company_id) q = q.eq('company_id', company_id);
  if (status) q = q.eq('status', status);
  if (is_gst !== undefined) q = q.eq('is_gst', is_gst === 'true');

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
  const { po_id, company_id, site_name, date, base_amount, gst_amount, is_gst, file_path } = body;

  if (!date) return sendError('date is required', 400);
  if (base_amount === undefined || base_amount === null) return sendError('base_amount must be numeric', 400);

  const { count, error: countError } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true });

  if (countError) return sendError(countError.message, 500);
  const display_id = generateDisplayId('INV', (count || 0) + 1);

  const baseAmt = parseFloat(Number(base_amount).toFixed(2));
  const gstAmt = parseFloat(Number(gst_amount || 0).toFixed(2));
  const gross_amount = parseFloat(Number(baseAmt + gstAmt).toFixed(2));

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      display_id,
      po_id: po_id || null,
      company_id: company_id || null,
      site_name: site_name || null,
      date,
      base_amount: baseAmt,
      gst_amount: gstAmt,
      gross_amount,
      is_gst: is_gst !== undefined ? Boolean(is_gst) : false,
      status: 'unpaid',
      file_path: file_path || null,
    })
    .select('id, display_id, po_id, company_id, site_name, date, base_amount, gst_amount, gross_amount, is_gst, status, file_path, created_at')
    .single();

  if (error) return sendError(error.message, 400);
  return sendSuccess(data, 201);
}
