import { NextRequest } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

const BILL_SELECT = 'id, display_id, date, inv_type, inv_no, category, retailer_name, retailer_id, site_id, gst_applicable, gst_number, total_amount, paid_amount, due_amount, status, file_path, created_at';

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { data, error } = await supabase
    .from('retailer_bills')
    .select(BILL_SELECT)
    .eq('gst_applicable', false)
    .order('created_at', { ascending: false });

  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}
