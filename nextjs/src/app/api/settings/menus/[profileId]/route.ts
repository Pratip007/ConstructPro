import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const { profileId } = await params;

  const { data, error } = await supabase
    .from('menu_allotments')
    .select('id, profile_id, menu_item_id, menu_name, menu_url, granted, created_at')
    .eq('profile_id', profileId)
    .order('menu_name');

  if (error) return sendError(error.message, 500);
  return sendSuccess(data);
}

export async function PUT(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  const { profileId } = await params;
  const body = await request.json();
  const { menuItems } = body;

  if (!Array.isArray(menuItems)) {
    return sendError('menuItems must be an array', 400);
  }

  // Delete all existing allotments for this profile
  const { error: deleteError } = await supabase
    .from('menu_allotments')
    .delete()
    .eq('profile_id', profileId);

  if (deleteError) return sendError(deleteError.message, 500);

  // Bulk insert new allotments (skip if empty)
  if (!menuItems || menuItems.length === 0) {
    return sendSuccess({ message: 'Menu allotments cleared', items: [] });
  }

  const rows = menuItems.map((item: { menuItemId: string; menuName: string; menuUrl?: string; granted: boolean }) => ({
    profile_id: profileId,
    menu_item_id: item.menuItemId,
    menu_name: item.menuName,
    menu_url: item.menuUrl || null,
    granted: Boolean(item.granted),
  }));

  const { data, error } = await supabase
    .from('menu_allotments')
    .insert(rows)
    .select('id, profile_id, menu_item_id, menu_name, menu_url, granted, created_at');

  if (error) return sendError(error.message, 400);
  return sendSuccess({ message: 'Menu allotments updated', items: data });
}
