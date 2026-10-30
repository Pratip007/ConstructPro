import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const params = getSearchParams(request);
  const { module: moduleFilter, status } = params;

  let q = supabase
    .from('terms_conditions')
    .select('id, title, content, module, status, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (moduleFilter) q = q.eq('module', moduleFilter);
  if (status) q = q.eq('status', status);

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
  const { title, content, module: moduleVal } = body;

  if (!title) return sendError('title is required', 400);
  if (!content) return sendError('content is required', 400);

  if (user.role === 'admin') {
    const { data, error } = await supabase
      .from('terms_conditions')
      .insert({
        title,
        content,
        module: moduleVal || null,
        status: 'active',
      })
      .select('id, title, content, module, status, created_at')
      .single();

    if (error) return sendError(error.message, 400);
    return sendSuccess(data, 201);
  }

  // Office: approval request
  const { data: approval, error: approvalError } = await supabase
    .from('approval_requests')
    .insert({
      source: 'office',
      requester_id: user.id,
      requester_name: user.name,
      module: 'TermsConditions',
      action_type: 'new_entry',
      new_data: {
        title,
        content,
        module: moduleVal || null,
        status: 'active',
      },
      status: 'pending',
    })
    .select()
    .single();

  if (approvalError) return sendError(approvalError.message, 500);
  return sendSuccess({ approval, message: 'Approval request submitted' }, 202);
}
