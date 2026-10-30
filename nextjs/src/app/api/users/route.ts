import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  handleApiError,
} from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, display_id, role, status, created_at')
      .order('created_at', { ascending: false });

    if (error) return sendError(error.message, 500);
    return sendSuccess(data || []);
  } catch (error) {
    return handleApiError(error);
  }
}
