import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  sendSuccess,
  sendError,
  authenticateRequest,
  isAuthError,
  requireRole,
  generateDisplayId,
  handleApiError,
} from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (isAuthError(user)) return user;

    const roleCheck = requireRole(user, 'admin');
    if (roleCheck) return roleCheck;

    const body = await request.json();
    const { employees } = body;

    if (!Array.isArray(employees) || !employees.length) {
      return sendError('employees array is required', 400);
    }

    const results = { created: 0, errors: [] as { name: string; error: string }[] };
    for (const emp of employees) {
      const { count } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true });
      const display_id = generateDisplayId('EMP', (count || 0) + 1);

      const { error } = await supabase.from('employees').insert({
        display_id,
        name: emp.name,
        phone: emp.phone || null,
        category_id: emp.category_id || null,
        site_id: emp.site_id || null,
        rate: emp.rate || 0,
        salary_basis: emp.salary_basis || 'Per Day',
        status: 'active',
      });

      if (error) {
        results.errors.push({ name: emp.name, error: error.message });
      } else {
        results.created++;
      }
    }

    return sendSuccess(results, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
