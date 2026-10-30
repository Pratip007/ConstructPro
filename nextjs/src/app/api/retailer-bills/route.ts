import { NextRequest } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams, generateDisplayId } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

const BILL_SELECT = 'id, display_id, date, inv_type, inv_no, category, retailer_name, retailer_id, site_id, gst_applicable, gst_number, total_amount, paid_amount, due_amount, status, file_path, created_at';

function computeBillItemTotals(item: Record<string, unknown>) {
  const qty = parseFloat(Number(item.qty).toFixed(2));
  const price = parseFloat(Number(item.price).toFixed(2));
  const gst_percent = parseFloat(Number(item.gst_percent || 0).toFixed(2));
  const unit = (String(item.unit || '')).trim();

  const isPercentage = unit === '%' || unit.toLowerCase() === 'percentage';
  const line_total = isPercentage
    ? parseFloat(Number((price * qty) / 100).toFixed(2))
    : parseFloat(Number(price * qty).toFixed(2));

  const line_gst = parseFloat(Number(line_total * gst_percent / 100).toFixed(2));
  const final_total = parseFloat(Number(line_total + line_gst).toFixed(2));

  return { qty, price, gst_percent, line_total, line_gst, final_total };
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { site_id, retailer_id, status, gst_applicable } = getSearchParams(request);

  let q = supabase
    .from('retailer_bills')
    .select(BILL_SELECT)
    .order('created_at', { ascending: false });

  if (site_id) q = q.eq('site_id', site_id);
  if (retailer_id) q = q.eq('retailer_id', retailer_id);
  if (status) q = q.eq('status', status);
  if (gst_applicable !== undefined) q = q.eq('gst_applicable', gst_applicable === 'true');

  const { data, error } = await q;
  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;
  const roleCheck = requireRole(auth, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const {
    date, inv_type, inv_no, category, retailer_name,
    retailer_id, site_id, gst_applicable, gst_number,
    paid_amount, file_path, cart_items,
  } = body;

  if (!date) return sendError('date is required', 400);
  if (!Array.isArray(cart_items) || cart_items.length === 0) return sendError('cart_items must be a non-empty array', 400);

  const { count, error: countError } = await supabase
    .from('retailer_bills')
    .select('id', { count: 'exact', head: true });

  if (countError) return sendError(countError.message, 500);
  const display_id = generateDisplayId('BILL', (count || 0) + 1);

  const computedItems = cart_items.map(computeBillItemTotals);

  const total_amount = parseFloat(computedItems.reduce((s: number, i: { final_total: number }) => s + i.final_total, 0).toFixed(2));
  const paidAmt = parseFloat(Number(paid_amount || 0).toFixed(2));
  const due_amount = parseFloat(Number(total_amount - paidAmt).toFixed(2));
  const billStatus = due_amount > 0 ? 'DUE' : 'PAID';

  const { data: bill, error: billError } = await supabase
    .from('retailer_bills')
    .insert({
      display_id,
      date,
      inv_type: inv_type || null,
      inv_no: inv_no || null,
      category: category || null,
      retailer_name: retailer_name || null,
      retailer_id: retailer_id || null,
      site_id: site_id || null,
      gst_applicable: gst_applicable !== undefined ? Boolean(gst_applicable) : false,
      gst_number: gst_number || null,
      total_amount,
      paid_amount: paidAmt,
      due_amount,
      status: billStatus,
      file_path: file_path || null,
    })
    .select(BILL_SELECT)
    .single();

  if (billError) return sendError(billError.message, 400);

  const itemRows = cart_items.map((item: Record<string, unknown>, idx: number) => {
    const computed = computedItems[idx];
    return {
      bill_id: bill.id,
      item: item.item,
      qty: computed.qty,
      unit: item.unit || null,
      price: computed.price,
      gst_percent: computed.gst_percent,
      line_total: computed.line_total,
      line_gst: computed.line_gst,
      final_total: computed.final_total,
      add_to_stock: item.add_to_stock !== undefined ? Boolean(item.add_to_stock) : false,
    };
  });

  const { data: insertedItems, error: itemsError } = await supabase
    .from('retailer_bill_items')
    .insert(itemRows)
    .select('id, bill_id, item, qty, unit, price, gst_percent, line_total, line_gst, final_total, add_to_stock');

  if (itemsError) return sendError(itemsError.message, 400);

  return sendSuccess({ ...bill, items: insertedItems || [] }, 201);
}
