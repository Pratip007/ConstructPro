import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams, generateDisplayId } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const { site_id, parent_id } = getSearchParams(request);

  let q = supabase
    .from('document_folders')
    .select('id, display_id, name, parent_id, site_id, created_by, status, created_at, updated_at')
    .order('name');

  if (site_id) q = q.eq('site_id', site_id);
  if (parent_id) q = q.eq('parent_id', parent_id);

  const { data, error } = await q;
  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin', 'office');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const { name, siteId, parentId } = body;

  if (!name) return sendError('name is required', 400);

  const { count, error: countError } = await supabase
    .from('document_folders')
    .select('id', { count: 'exact', head: true });

  if (countError) return sendError(countError.message, 500);
  const display_id = generateDisplayId('FOLD', (count || 0) + 1);

  const { data, error } = await supabase
    .from('document_folders')
    .insert({
      display_id,
      name,
      parent_id: parentId || null,
      site_id: siteId || null,
      created_by: user.id,
      status: 'active',
    })
    .select('id, display_id, name, parent_id, site_id, created_by, status, created_at')
    .single();

  if (error) return sendError(error.message, 400);
  return sendSuccess(data, 201);
}
