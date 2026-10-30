import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const { type, status } = getSearchParams(request);

  let q = supabase
    .from('head_allotments')
    .select('id, name, type, description, status, created_at, updated_at')
    .order('name');

  if (type) q = q.eq('type', type);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const { name, type, description } = body;

  if (!name) return sendError('name is required', 400);
  if (!type || !['Income', 'Expense'].includes(type)) {
    return sendError("type must be 'Income' or 'Expense'", 400);
  }

  const { data, error } = await supabase
    .from('head_allotments')
    .insert({
      name,
      type,
      description: description || null,
      status: 'active',
    })
    .select('id, name, type, description, status, created_at')
    .single();

  if (error) return sendError(error.message, 400);
  return sendSuccess(data, 201);
}
