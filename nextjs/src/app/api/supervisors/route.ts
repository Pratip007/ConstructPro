import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  getSearchParams,
  generateDisplayId,
  handleApiError,
} from '@/lib/api-utils';

// GET /api/supervisors — all authenticated roles can view supervisors.
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;

    const { status } = getSearchParams(request);

    let q = supabase
      .from('supervisors')
      .select('id, display_id, name, contact, address, employee_id, profile_id, assigned_site_id, status, created_at')
      .order('name');

    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) return sendError(error.message, 500);
    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/supervisors — admin only. Creates auth user + profile + supervisor row.
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;
    const user = authResult;

    const roleError = requireRole(user, 'admin');
    if (roleError) return roleError;

    const body = await request.json();
    const { name, contact, address, siteId, employee_id, password } = body;

    if (!name) return sendError('name is required', 400);
    if (!password || password.length < 8) return sendError('password is required (min 8 characters)', 400);

    // Generate display_id
    const { count, error: countError } = await supabase
      .from('supervisors')
      .select('id', { count: 'exact', head: true });

    if (countError) return sendError(countError.message, 500);
    const display_id = generateDisplayId('SUP', (count || 0) + 1);

    // Step 1: Create Supabase Auth user
    const email = `${display_id.toLowerCase().replace('-', '')}@atr.local`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'supervisor', display_id },
    });

    if (authError) {
      return sendError(`Auth user creation failed: ${authError.message}`, 500);
    }

    // Step 2: Create profiles row
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        auth_uid: authData.user.id,
        display_id,
        name,
        role: 'supervisor',
        assigned_site_id: siteId || null,
      })
      .select('id, display_id, name, role, assigned_site_id')
      .single();

    if (profileError) {
      // Cleanup auth user on profile creation failure
      await supabase.auth.admin.deleteUser(authData.user.id);
      return sendError(`Profile creation failed: ${profileError.message}`, 500);
    }

    // Step 3: Create supervisors row
    const { data: supervisor, error: supervisorError } = await supabase
      .from('supervisors')
      .insert({
        display_id,
        name,
        contact: contact || null,
        address: address || null,
        employee_id: employee_id || null,
        profile_id: profileData.id,
        assigned_site_id: siteId || null,
        status: 'active',
      })
      .select('id, display_id, name, contact, address, employee_id, profile_id, assigned_site_id, status, created_at')
      .single();

    if (supervisorError) {
      // Cleanup on supervisor row failure
      await supabase.from('profiles').delete().eq('id', profileData.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return sendError(`Supervisor creation failed: ${supervisorError.message}`, 500);
    }

    return sendSuccess({ supervisor, profile: profileData, email }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
