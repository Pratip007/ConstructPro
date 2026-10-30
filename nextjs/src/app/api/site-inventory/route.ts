import { sendSuccess, sendError, authenticateRequest, isAuthError, enforceSiteLock, getSearchParams, handleApiError } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

// GET /api/site-inventory
export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const searchParams = getSearchParams(request);

    const effectiveSiteId = enforceSiteLock(auth, searchParams.site_id || null);

    let q = supabase
      .from('site_inventory')
      .select('id, product_id, site_id, quantity, last_updated, created_at, updated_at')
      .order('last_updated', { ascending: false });

    if (effectiveSiteId) q = q.eq('site_id', effectiveSiteId);
    if (searchParams.product_id) q = q.eq('product_id', searchParams.product_id);

    const { data, error } = await q;
    if (error) return sendError(error.message, 500);
    return sendSuccess(data);
  } catch (err) {
    return handleApiError(err);
  }
}
