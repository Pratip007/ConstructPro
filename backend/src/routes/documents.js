/**
 * Document routes
 *
 * Document Folders (/api/document-folders):
 * GET    /       — list, filter by site_id, parent_id. All roles.
 * POST   /       — create folder. Display_id prefix: FOLD.
 * DELETE /:id    — admin only, soft delete.
 *
 * Documents (/api/documents):
 * GET    /           — list, filter by folder_id, site_id. All roles.
 * POST   /           — upload document (base64 file). Display_id prefix: DOC.
 * GET    /:id/download — get signed URL from Supabase Storage.
 * DELETE /:id        — admin only. Delete from Storage + soft delete DB record.
 *
 * Note: File upload uses base64 JSON body (no multer). Accept:
 *   { name, folderId, siteId, fileData (base64), fileType, description }
 * Storage tests are wrapped in describe.skip (requires live Supabase Storage).
 */

const express = require('express');
const { body, param } = require('express-validator');

const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { generateDisplayId } = require('../utils/displayId');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

// ===========================================================================
// Document Folders Router
// ===========================================================================
const documentFoldersRouter = express.Router();
documentFoldersRouter.use(authenticateToken);

// GET /api/document-folders
documentFoldersRouter.get('/', async (req, res) => {
  const { site_id, parent_id } = req.query;

  let q = supabase
    .from('document_folders')
    .select('id, display_id, name, parent_id, site_id, created_by, status, created_at, updated_at')
    .order('name');

  if (site_id) q = q.eq('site_id', site_id);
  if (parent_id) q = q.eq('parent_id', parent_id);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// POST /api/document-folders
documentFoldersRouter.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('name').notEmpty().withMessage('name is required'),
    body('siteId').optional().isUUID().withMessage('siteId must be a valid UUID'),
    body('parentId').optional().isUUID().withMessage('parentId must be a valid UUID'),
  ]),
  async (req, res) => {
    const { name, siteId, parentId } = req.body;

    const { count, error: countError } = await supabase
      .from('document_folders')
      .select('id', { count: 'exact', head: true });

    if (countError) return sendError(res, countError.message, 500);
    const display_id = generateDisplayId('FOLD', (count || 0) + 1);

    const { data, error } = await supabase
      .from('document_folders')
      .insert({
        display_id,
        name,
        parent_id: parentId || null,
        site_id: siteId || null,
        created_by: req.user.id,
        status: 'active',
      })
      .select('id, display_id, name, parent_id, site_id, created_by, status, created_at')
      .single();

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, data, 201);
  }
);

// DELETE /api/document-folders/:id
documentFoldersRouter.delete(
  '/:id',
  requireRole('admin'),
  validate([param('id').isUUID().withMessage('Invalid folder ID')]),
  async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('document_folders')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select('id, display_id, name, status')
      .single();

    if (error) return sendError(res, error.message, 400);
    if (!data) return sendError(res, 'Document folder not found', 404);
    return sendSuccess(res, { message: 'Document folder deactivated', folder: data });
  }
);

// ===========================================================================
// Documents Router
// ===========================================================================
const documentsRouter = express.Router();
documentsRouter.use(authenticateToken);

// GET /api/documents
documentsRouter.get('/', async (req, res) => {
  const { folder_id, site_id } = req.query;

  let q = supabase
    .from('documents')
    .select('id, display_id, name, folder_id, site_id, file_path, file_type, file_size, uploaded_by, description, status, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (folder_id) q = q.eq('folder_id', folder_id);
  if (site_id) q = q.eq('site_id', site_id);

  const { data, error } = await q;
  if (error) return sendError(res, error.message, 500);
  return sendSuccess(res, data);
});

// POST /api/documents — upload document (base64 body)
documentsRouter.post(
  '/',
  requireRole('admin', 'office'),
  validate([
    body('name').notEmpty().withMessage('name is required'),
    body('fileData').notEmpty().withMessage('fileData (base64) is required'),
    body('fileType').notEmpty().withMessage('fileType is required'),
    body('folderId').optional().isUUID().withMessage('folderId must be a valid UUID'),
    body('siteId').optional().isUUID().withMessage('siteId must be a valid UUID'),
  ]),
  async (req, res) => {
    const { name, folderId, siteId, fileData, fileType, description } = req.body;

    // Decode base64 to buffer
    let fileBuffer;
    try {
      fileBuffer = Buffer.from(fileData, 'base64');
    } catch {
      return sendError(res, 'fileData must be a valid base64 string', 400);
    }

    const fileSize = fileBuffer.length;

    // Build storage path
    const ext = fileType.split('/')[1] || 'bin';
    const timestamp = Date.now();
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `uploads/${req.user.id}/${timestamp}_${safeName}.${ext}`;

    // Upload to Supabase Storage bucket 'documents'
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(filePath, fileBuffer, { contentType: fileType, upsert: false });

    if (storageError) return sendError(res, `Storage upload failed: ${storageError.message}`, 500);

    // Count for display_id
    const { count, error: countError } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      // Attempt to clean up uploaded file
      await supabase.storage.from('documents').remove([filePath]);
      return sendError(res, countError.message, 500);
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
        uploaded_by: req.user.id,
        description: description || null,
        status: 'active',
      })
      .select('id, display_id, name, folder_id, site_id, file_path, file_type, file_size, uploaded_by, description, status, created_at')
      .single();

    if (error) {
      // Attempt to clean up uploaded file
      await supabase.storage.from('documents').remove([filePath]);
      return sendError(res, error.message, 400);
    }

    return sendSuccess(res, data, 201);
  }
);

// GET /api/documents/:id/download — get signed URL
documentsRouter.get(
  '/:id/download',
  validate([param('id').isUUID().withMessage('Invalid document ID')]),
  async (req, res) => {
    const { id } = req.params;

    // Fetch document metadata
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, display_id, name, file_path, status')
      .eq('id', id)
      .single();

    if (docError) return sendError(res, docError.message, 500);
    if (!doc) return sendError(res, 'Document not found', 404);
    if (doc.status === 'inactive') return sendError(res, 'Document is inactive', 404);

    // Generate signed URL (valid for 1 hour)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 3600);

    if (signedError) return sendError(res, `Failed to generate signed URL: ${signedError.message}`, 500);

    return sendSuccess(res, { url: signedData.signedUrl, document: doc });
  }
);

// DELETE /api/documents/:id
documentsRouter.delete(
  '/:id',
  requireRole('admin'),
  validate([param('id').isUUID().withMessage('Invalid document ID')]),
  async (req, res) => {
    const { id } = req.params;

    // Fetch document to get file_path
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('id, display_id, file_path, status')
      .eq('id', id)
      .single();

    if (fetchError) return sendError(res, fetchError.message, 500);
    if (!doc) return sendError(res, 'Document not found', 404);

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

    if (error) return sendError(res, error.message, 400);
    return sendSuccess(res, { message: 'Document deleted', document: data });
  }
);

module.exports = { documentFoldersRouter, documentsRouter };
