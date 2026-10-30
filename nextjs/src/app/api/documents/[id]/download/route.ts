import { sendSuccess, sendError, authenticateRequest, isAuthError } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const { id } = await params;

  // Fetch document metadata
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, display_id, name, file_path, status')
    .eq('id', id)
    .single();

  if (docError) return sendError(docError.message, 500);
  if (!doc) return sendError('Document not found', 404);
  if (doc.status === 'inactive') return sendError('Document is inactive', 404);

  // Generate signed URL (valid for 1 hour)
  const { data: signedData, error: signedError } = await supabase.storage
    .from('documents')
    .createSignedUrl(doc.file_path, 3600);

  if (signedError) return sendError(`Failed to generate signed URL: ${signedError.message}`, 500);

  return sendSuccess({ url: signedData.signedUrl, document: doc });
}
