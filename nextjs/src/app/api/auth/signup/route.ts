import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  handleApiError,
} from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin');
    if (roleCheck) return roleCheck;

    const body = await request.json();
    const { email, password, name, role, displayId, siteId, aadhaar } = body;

    // Validation
    if (!email) return sendError('Valid email required', 400);
    if (!password || password.length < 8) return sendError('Password must be at least 8 characters', 400);
    if (!name) return sendError('Name is required', 400);
    if (!['admin', 'office', 'supervisor', 'employee'].includes(role)) return sendError('Invalid role', 400);
    if (!displayId) return sendError('displayId is required', 400);

    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, display_id: displayId },
    });

    if (authError) {
      return sendError(authError.message, 400);
    }

    const authUid = authData.user.id;

    // Build profiles row
    const profileRow: Record<string, unknown> = {
      auth_uid: authUid,
      display_id: displayId,
      name,
      role,
      assigned_site_id: siteId || null,
    };

    // Hash aadhaar if provided (employee signup)
    if (aadhaar) {
      if (String(aadhaar).length < 4) {
        // Clean up the auth user we just created
        await supabase.auth.admin.deleteUser(authUid);
        return sendError('Aadhaar must be at least 4 digits', 400);
      }
      const saltRounds = 12;
      profileRow.aadhaar_hash = await bcrypt.hash(String(aadhaar), saltRounds);
      profileRow.aadhaar_last4 = String(aadhaar).slice(-4);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert(profileRow)
      .select('id, display_id, name, role, assigned_site_id, created_at')
      .single();

    if (profileError) {
      // Attempt cleanup of the auth user
      await supabase.auth.admin.deleteUser(authUid);
      return sendError(profileError.message, 400);
    }

    return sendSuccess({ user: profile }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
