import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  handleApiError,
} from '@/lib/api-utils';

// POST /api/supervisor-site-tagging — admin only: tag supervisor to a site
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (isAuthError(authResult)) return authResult;
    const user = authResult;

    const roleError = requireRole(user, 'admin');
    if (roleError) return roleError;

    const body = await request.json();
    const { supervisorId, siteId } = body;

    if (!supervisorId) return sendError('supervisorId must be a valid UUID', 400);
    if (!siteId) return sendError('siteId must be a valid UUID', 400);

    // Fetch current supervisor to record from_site
    const { data: supervisor, error: supervisorError } = await supabase
      .from('supervisors')
      .select('id, display_id, assigned_site_id, profile_id, status')
      .eq('id', supervisorId)
      .single();

    if (supervisorError || !supervisor) {
      return sendError('Supervisor not found', 404);
    }

    const fromSite = supervisor.assigned_site_id || null;

    // Insert tagging log
    const { data: tagging, error: taggingError } = await supabase
      .from('supervisor_site_tagging')
      .insert({
        supervisor_id: supervisorId,
        site_id: siteId,
        from_site: fromSite,
        to_site: siteId,
        tagged_date: new Date().toISOString().split('T')[0],
        tagged_by: user.id,
        status: 'active',
      })
      .select('id, supervisor_id, site_id, from_site, to_site, tagged_date, tagged_by, status, created_at')
      .single();

    if (taggingError) {
      return sendError(taggingError.message, 400);
    }

    // Update supervisor's assigned_site_id
    const { error: supUpdateError } = await supabase
      .from('supervisors')
      .update({ assigned_site_id: siteId })
      .eq('id', supervisorId);

    if (supUpdateError) {
      return sendError(`Tagging saved but supervisor update failed: ${supUpdateError.message}`, 500);
    }

    // Update linked profile's site_id if available
    if (supervisor.profile_id) {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ assigned_site_id: siteId })
        .eq('id', supervisor.profile_id);

      if (profileUpdateError) {
        return sendError(`Tagging saved but profile site sync failed: ${profileUpdateError.message}`, 500);
      }
    }

    return sendSuccess({ tagging, message: 'Supervisor tagged to site' }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
