import { NextRequest } from 'next/server';
import { supabase, supabaseAnon } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  handleApiError,
} from '@/lib/api-utils';

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Validation
    if (!currentPassword) return sendError('Current password is required', 400);
    if (!newPassword || newPassword.length < 8) return sendError('New password must be at least 8 characters', 400);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.email) {
      return sendError('Could not verify identity', 400);
    }

    const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

    if (signInError) {
      return sendError('Current password is incorrect', 403);
    }

    const { error } = await supabase.auth.admin.updateUserById(user.authUid, {
      password: newPassword,
    });

    if (error) {
      return sendError(error.message, 400);
    }

    return sendSuccess({ message: 'Password updated successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
