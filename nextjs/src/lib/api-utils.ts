import { NextRequest, NextResponse } from 'next/server';
import { supabase } from './supabase';

export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

export function sendSuccess(data: unknown, statusCode: number = 200) {
  return NextResponse.json({ success: true, data }, { status: statusCode });
}

export function sendError(message: string, statusCode: number = 400) {
  return NextResponse.json({ success: false, error: message }, { status: statusCode });
}

export interface AuthenticatedUser {
  id: number;
  authUid: string;
  displayId: string;
  name: string;
  role: string;
  siteId: number | null;
}

export async function authenticateRequest(request: NextRequest | Request): Promise<AuthenticatedUser | NextResponse> {
  // Prefer httpOnly cookie; fall back to Authorization header for API clients / curl
  const token =
    (request as NextRequest).cookies?.get('atr_token')?.value ||
    request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return sendError('Not authenticated', 401);
  }

  // Verify the JWT signature via Supabase — rejects forged or tampered tokens.
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return sendError('Invalid or expired token', 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, auth_uid, display_id, name, role, assigned_site_id')
    .eq('auth_uid', user.id)
    .single();

  if (profileError || !profile) {
    return sendError('User profile not found', 401);
  }

  return {
    id: profile.id,
    authUid: profile.auth_uid,
    displayId: profile.display_id,
    name: profile.name,
    role: profile.role,
    siteId: profile.assigned_site_id,
  };
}

export function isAuthError(result: AuthenticatedUser | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

export function requireRole(user: AuthenticatedUser, ...allowedRoles: string[]): NextResponse | undefined {
  if (!allowedRoles.includes(user.role)) {
    return sendError(
      `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${user.role}`,
      403
    );
  }
  return undefined;
}

export function enforceSiteLock(user: AuthenticatedUser, requestedSiteId?: string | number | null | Record<string, string>): number | null {
  const parsed = typeof requestedSiteId === 'object' && requestedSiteId !== null
    ? (requestedSiteId as Record<string, string>).site_id
      ? Number((requestedSiteId as Record<string, string>).site_id)
      : null
    : requestedSiteId != null ? Number(requestedSiteId) : null;
  const numericId = parsed && !isNaN(parsed) ? parsed : null;
  if (user.role === 'supervisor' && user.siteId) {
    if (numericId && numericId !== user.siteId) {
      throw new ApiError('You can only access data for your assigned site', 403);
    }
    return user.siteId;
  }
  return numericId;
}

export function generateDisplayId(prefix: string, sequenceNum: number): string {
  return `${prefix}-${String(sequenceNum).padStart(3, '0')}`;
}

export function generateDisplayIdWithYear(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(3, '0')}`;
}

export function getSearchParams(request: NextRequest | Request): Record<string, string> {
  const url = new URL(request.url);
  const result: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return sendError(error.message, error.statusCode);
  }
  console.error('Unhandled API error:', error);
  return sendError('Internal server error', 500);
}
