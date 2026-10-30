import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  const { id } = await params;

  const { data, error } = await supabase
    .from('document_folders')
    .update({ status: 'inactive' })
    .eq('id', id)
    .select('id, display_id, name, status')
    .single();

  if (error) return sendError(error.message, 400);
  if (!data) return sendError('Document folder not found', 404);
  return sendSuccess({ message: 'Document folder deactivated', folder: data });
}
