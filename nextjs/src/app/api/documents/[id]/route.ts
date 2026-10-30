import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  const { id } = await params;

  // Fetch document to get file_path
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('id, display_id, file_path, status')
    .eq('id', id)
    .single();

  if (fetchError) return sendError(fetchError.message, 500);
  if (!doc) return sendError('Document not found', 404);

  // Delete from Supabase Storage
  if (doc.file_path) {
    const { error: removeError } = await supabase.storage
      .from('documents')
      .remove([doc.file_path]);

    // Log but don't fail if storage removal fails
    if (removeError) {
      console.error(`Storage removal failed for ${doc.file_path}:`, removeError.message);
    }
  }

  // Soft-delete in DB
  const { data, error } = await supabase
    .from('documents')
    .update({ status: 'inactive' })
    .eq('id', id)
    .select('id, display_id, status')
    .single();

  if (error) return sendError(error.message, 400);
  return sendSuccess({ message: 'Document deleted', document: data });
}
