import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  enforceSiteLock,
  generateDisplayId,
  getSearchParams,
  handleApiError,
} from '@/lib/api-utils';
import { createApprovalRequest } from '@/lib/services/approvalEngine';

// ---------------------------------------------------------------------------
// GET /api/employees
// Returns employee list (no aadhaar_hash). Supervisor: own site only.
// Query: site_id, status, category_id
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const params = getSearchParams(request);

    // enforceSiteLock: if supervisor, locks to their site
    const effectiveSiteId = enforceSiteLock(
      user,
      params.site_id ? params.site_id : null
    );

    let query = supabase
      .from('employees')
      .select(`
        id, display_id, name, phone, designation,
        working_positions, current_site_id, status,
        category_id, profile_id, created_at, updated_at,
        employee_categories(id, name, description, status)
      `);

    if (effectiveSiteId) query = query.eq('current_site_id', effectiveSiteId);
    if (params.status) query = query.eq('status', params.status);
    if (params.category_id) query = query.eq('category_id', params.category_id);

    query = query.order('name');

    const { data, error } = await query;

    if (error) {
      return sendError(error.message, 500);
    }

    return sendSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/employees
// Admin: inserts + creates auth user (email = displayId@atr.local, password = aadhaar).
// Office/Supervisor: creates approval request.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin', 'office', 'supervisor');
    if (roleCheck) return roleCheck;

    const body = await request.json();
    const {
      name,
      phone,
      designation,
      category_id,
      current_site_id,
      working_positions,
      aadhaar,
    } = body;

    // enforceSiteLock for supervisors
    enforceSiteLock(user, current_site_id || null);

    // Validation
    if (!name) return sendError('Name is required', 400);
    if (!aadhaar || String(aadhaar).length < 4) return sendError('Aadhaar must be at least 4 digits', 400);

    const role = user.role;

    // Compute display_id for employee
    const { count } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true });

    const seq = (count || 0) + 101; // starts at EMP-101
    const display_id = generateDisplayId('EMP', seq);

    const aadhaarStr = String(aadhaar);
    const aadhaar_hash = await bcrypt.hash(aadhaarStr, 12);
    const aadhaar_last4 = aadhaarStr.slice(-4);

    const employeeRow: Record<string, unknown> = {
      display_id,
      name,
      phone: phone || null,
      designation: designation || null,
      working_positions: working_positions || null,
      category_id: category_id || null,
      current_site_id: current_site_id || null,
      aadhaar_hash,
      aadhaar_last4,
      status: 'active',
    };

    if (role === 'admin') {
      // Insert employee directly
      const { data: emp, error: empError } = await supabase
        .from('employees')
        .insert(employeeRow)
        .select('id, display_id, name, phone, designation, working_positions, current_site_id, status, category_id, created_at')
        .single();

      if (empError) {
        return sendError(empError.message, 400);
      }

      // Create Supabase Auth user (email = displayId@atr.local, password = raw aadhaar)
      const email = `${display_id.toLowerCase().replace('-', '')}@atr.local`;
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: aadhaarStr,
        email_confirm: true,
        user_metadata: { name, role: 'employee', display_id },
      });

      if (authError) {
        // Log but don't fail employee creation — auth can be created separately
        console.warn(`Auth user creation failed for ${display_id}: ${authError.message}`);
      } else {
        // Create profiles row
        const profileRow = {
          auth_uid: authData.user.id,
          display_id,
          name,
          role: 'employee',
          assigned_site_id: current_site_id || null,
          aadhaar_hash,
          aadhaar_last4,
        };
        const { error: profileError } = await supabase.from('profiles').insert(profileRow);
        if (profileError) {
          console.warn(`Profile creation failed for ${display_id}: ${profileError.message}`);
        }
      }

      return sendSuccess(emp, 201);
    }

    // Office/Supervisor: create approval request
    const approval = await createApprovalRequest({
      source: role === 'office' ? 'office' : 'supervisor',
      requesterId: user.id,
      requesterName: user.name,
      siteId: employeeRow.current_site_id as string | null,
      module: 'Employee',
      actionType: 'new_entry',
      newData: employeeRow,
    });
    return sendSuccess({ approval, message: 'Approval request submitted' }, 202);
  } catch (error) {
    return handleApiError(error);
  }
}
