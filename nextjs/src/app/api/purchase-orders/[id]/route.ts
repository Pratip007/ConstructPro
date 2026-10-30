import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { id } = await params;

  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .select('id, display_id, date, site_id, retailer_id, base_amount, gst_amount, net_amount, status, created_at, updated_at')
    .eq('id', id)
    .single();

  if (poError) return sendError(poError.message, 500);
  if (!po) return sendError('Purchase order not found', 404);

  const { data: items, error: itemsError } = await supabase
    .from('purchase_order_items')
    .select('id, order_id, product_id, name, hsn, unit, qty, price, gst_percent, gst_amount, line_total')
    .eq('order_id', id);

  if (itemsError) return sendError(itemsError.message, 500);

  return sendSuccess({ ...po, items: items || [] });
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
  const { items, ...bodyRest } = body;

  const allowedFields = ['date', 'site_id', 'retailer_id', 'status'];
  const updates: Record<string, unknown> = {};
  allowedFields.forEach((f) => {
    if (bodyRest[f] !== undefined) updates[f] = bodyRest[f];
  });

  // If items are provided, recompute totals
  if (Array.isArray(items) && items.length > 0) {
    const computedItems = items.map(computeItemTotals);
    updates.base_amount = parseFloat(computedItems.reduce((s: number, i: { base_total: number }) => s + i.base_total, 0).toFixed(2));
    updates.gst_amount = parseFloat(computedItems.reduce((s: number, i: { gst_amount: number }) => s + i.gst_amount, 0).toFixed(2));
    updates.net_amount = parseFloat(Number((updates.base_amount as number) + (updates.gst_amount as number)).toFixed(2));
  }

  if (Object.keys(updates).length === 0) {
    return sendError('No fields to update', 400);
  }

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .update(updates)
    .eq('id', id)
    .select('id, display_id, date, site_id, retailer_id, base_amount, gst_amount, net_amount, status, updated_at')
    .single();

  if (error) return sendError(error.message, 400);
  if (!po) return sendError('Purchase order not found', 404);

  // If items provided, replace them
  if (Array.isArray(items) && items.length > 0) {
    const { error: delError } = await supabase
      .from('purchase_order_items')
      .delete()
      .eq('order_id', id);

    if (delError) return sendError(delError.message, 500);

    const computedItems = items.map(computeItemTotals);
    const itemRows = items.map((item: Record<string, unknown>, idx: number) => {
      const computed = computedItems[idx];
      return {
        order_id: id,
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

    const { data: newItems, error: insertError } = await supabase
      .from('purchase_order_items')
      .insert(itemRows)
      .select('id, order_id, product_id, name, hsn, unit, qty, price, gst_percent, gst_amount, line_total');

    if (insertError) return sendError(insertError.message, 400);

    return sendSuccess({ ...po, items: newItems || [] });
  }

  return sendSuccess(po);
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
    .from('purchase_orders')
    .update({ status: 'inactive' })
    .eq('id', id)
    .select('id, display_id, status')
    .single();

  if (error) return sendError(error.message, 400);
  if (!data) return sendError('Purchase order not found', 404);
  return sendSuccess({ message: 'Purchase order deactivated', purchaseOrder: data });
}
