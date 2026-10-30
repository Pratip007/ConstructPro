import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAnon } from '@/lib/supabase';
import { sendError, handleApiError } from '@/lib/api-utils';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email) return sendError('Valid email required', 400);
    if (!password) return sendError('Password is required', 400);

    const { data: sessionData, error: sessionError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError || !sessionData.session) {
      return sendError(sessionError ? sessionError.message : 'Login failed', 400);
    }

    const { access_token, refresh_token } = sessionData.session;
    const authUid = sessionData.user.id;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_id, name, role, assigned_site_id, created_at')
      .eq('auth_uid', authUid)
      .single();

    if (profileError || !profile) {
      return sendError('Profile not found', 400);
    }

    // Set token in httpOnly cookie — JS cannot read this
    const res = NextResponse.json({ success: true, data: { user: profile } });
    res.cookies.set('atr_token', access_token, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 7 });
    if (refresh_token) {
      res.cookies.set('atr_refresh', refresh_token, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 30 });
    }
    return res;
  } catch (error) {
    return handleApiError(error);
  }
}
