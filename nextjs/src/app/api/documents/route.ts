import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole, getSearchParams, generateDisplayId } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const { folder_id, site_id } = getSearchParams(request);

  let q = supabase
    .from('documents')
    .select('id, display_id, name, folder_id, site_id, file_path, file_type, file_size, uploaded_by, description, status, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (folder_id) q = q.eq('folder_id', folder_id);
  if (site_id) q = q.eq('site_id', site_id);

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
  const { name, folderId, siteId, fileData, fileType, description } = body;

  if (!name) return sendError('name is required', 400);
  if (!fileData) return sendError('fileData (base64) is required', 400);
  if (!fileType) return sendError('fileType is required', 400);

  // Decode base64 to buffer
  let fileBuffer: Buffer;
  try {
    fileBuffer = Buffer.from(fileData, 'base64');
  } catch {
    return sendError('fileData must be a valid base64 string', 400);
  }

  const fileSize = fileBuffer.length;

  // Build storage path
  const ext = fileType.split('/')[1] || 'bin';
  const timestamp = Date.now();
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `uploads/${user.id}/${timestamp}_${safeName}.${ext}`;

  // Upload to Supabase Storage bucket 'documents'
  const { error: storageError } = await supabase.storage
    .from('documents')
    .upload(filePath, fileBuffer, { contentType: fileType, upsert: false });

  if (storageError) return sendError(`Storage upload failed: ${storageError.message}`, 500);

  // Count for display_id
  const { count, error: countError } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true });

  if (countError) {
    // Attempt to clean up uploaded file
    await supabase.storage.from('documents').remove([filePath]);
    return sendError(countError.message, 500);
  }
  const display_id = generateDisplayId('DOC', (count || 0) + 1);

  // Insert metadata into documents table
  const { data, error } = await supabase
    .from('documents')
    .insert({
      display_id,
      name,
      folder_id: folderId || null,
      site_id: siteId || null,
      file_path: filePath,
      file_type: fileType,
      file_size: fileSize,
      uploaded_by: user.id,
      description: description || null,
      status: 'active',
    })
    .select('id, display_id, name, folder_id, site_id, file_path, file_type, file_size, uploaded_by, description, status, created_at')
    .single();

  if (error) {
    // Attempt to clean up uploaded file
    await supabase.storage.from('documents').remove([filePath]);
    return sendError(error.message, 400);
  }

  return sendSuccess(data, 201);
}
