import { NextResponse } from 'next/server';
import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

// GET /api/equipment-categories
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { data, error } = await supabase
    .from('equipment_categories')
    .select('id, name, description, status, created_at, updated_at')
    .order('name');

  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}

// POST /api/equipment-categories
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const roleCheck = requireRole(auth, 'admin');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const { name, description } = body;

  if (!name) return sendError('name is required', 400);

  const { data, error } = await supabase
    .from('equipment_categories')
    .insert({
      name,
      description: description || null,
      status: 'active',
    })
    .select('id, name, description, status, created_at')
    .single();

  if (error) return sendError(error.message, 400);
  return sendSuccess(data, 201);
}
