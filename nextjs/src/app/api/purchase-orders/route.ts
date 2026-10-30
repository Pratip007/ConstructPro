import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams, generateDisplayId } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

function computeItemTotals(item: Record<string, unknown>) {
  const qty = parseFloat(Number(item.qty).toFixed(2));
  const price = parseFloat(Number(item.price).toFixed(2));
  const gst_percent = parseFloat(Number(item.gst_percent || 0).toFixed(2));
  const unit = (String(item.unit || '')).trim();

  const isPercentage = unit === '%' || unit.toLowerCase() === 'percentage';
  const base_total = isPercentage
    ? parseFloat(Number((price * qty) / 100).toFixed(2))
    : parseFloat(Number(price * qty).toFixed(2));

  const gst_amount = parseFloat(Number(base_total * gst_percent / 100).toFixed(2));
  const line_total = parseFloat(Number(base_total + gst_amount).toFixed(2));

  return { qty, price, gst_percent, base_total, gst_amount, line_total };
}

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { site_id, status } = getSearchParams(request);

  let q = supabase
    .from('purchase_orders')
    .select('id, display_id, date, site_id, retailer_id, base_amount, gst_amount, net_amount, status, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (site_id) q = q.eq('site_id', site_id);
  if (status) q = q.eq('status', status);

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
  const { date, site_id, retailer_id, items, status } = body;

  if (!date) return sendError('date is required', 400);
  if (!Array.isArray(items) || items.length === 0) return sendError('items must be a non-empty array', 400);

  // Count existing POs for display_id generation
  const { count, error: countError } = await supabase
    .from('purchase_orders')
    .select('id', { count: 'exact', head: true });

  if (countError) return sendError(countError.message, 500);
  const display_id = generateDisplayId('PO', (count || 0) + 1);

  // Compute item totals
  const computedItems = items.map(computeItemTotals);

  // Compute PO totals
  const base_amount = parseFloat(computedItems.reduce((s: number, i: { base_total: number }) => s + i.base_total, 0).toFixed(2));
  const gst_amount = parseFloat(computedItems.reduce((s: number, i: { gst_amount: number }) => s + i.gst_amount, 0).toFixed(2));
  const net_amount = parseFloat(Number(base_amount + gst_amount).toFixed(2));

  // Insert PO
  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .insert({
      display_id,
      date,
      site_id: site_id || null,
      retailer_id: retailer_id || null,
      base_amount,
      gst_amount,
      net_amount,
      status: status || 'active',
    })
    .select('id, display_id, date, site_id, retailer_id, base_amount, gst_amount, net_amount, status, created_at')
    .single();

  if (poError) return sendError(poError.message, 400);

  // Insert items
  const itemRows = items.map((item: Record<string, unknown>, idx: number) => {
    const computed = computedItems[idx];
    return {
      order_id: po.id,
      product_id: item.product_id || null,
      name: item.name,
      hsn: item.hsn || null,
      unit: item.unit || null,
      qty: computed.qty,
      price: computed.price,
      gst_percent: computed.gst_percent,
      gst_amount: computed.gst_amount,
      line_total: computed.line_total,
    };
  });

  const { data: insertedItems, error: itemsError } = await supabase
    .from('purchase_order_items')
    .insert(itemRows)
    .select('id, order_id, product_id, name, hsn, unit, qty, price, gst_percent, gst_amount, line_total');

  if (itemsError) return sendError(itemsError.message, 400);

  return sendSuccess({ ...po, items: insertedItems || [] }, 201);
}
