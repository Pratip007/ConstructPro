import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
} from '@/lib/api-utils';

// ---------------------------------------------------------------------------
// GET /api/payment-modes - list all (any authenticated user)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const { data, error } = await supabase
    .from('payment_modes')
    .select('*')
    .order('name', { ascending: true });

  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}

// ---------------------------------------------------------------------------
// POST /api/payment-modes - create (admin only)
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  const body = await request.json();
  const { name, description } = body;

  // Validation
  if (!name) return sendError('name is required', 400);

  const { data, error } = await supabase
    .from('payment_modes')
    .insert({ name, description: description || null })
    .select()
    .single();

  if (error) return sendError(error.message, 500);
  return sendSuccess(data, 201);
}
