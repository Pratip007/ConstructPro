import { sendSuccess, sendError, authenticateRequest, isAuthError, requireRole } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';

const BACKUP_TABLES = [
  'companies',
  'banks',
  'equipment_categories',
  'head_allotments',
  'terms_conditions',
  'sites',
  'contractors',
  'retailers',
  'supervisors',
  'employees',
  'stock_products',
  'vehicles',
];

const EMPLOYEE_COLUMNS = 'id, display_id, name, father_name, dob, religion, village, post, ps, district, pin, aadhaar_last4, uan, phone, whatsapp, emergency_contact, bank_name, account_holder, account_number, ifsc_code, designation, category_id, working_positions, photo_url, current_site_id, status, profile_id, registered_by, created_at, updated_at';

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  const result: Record<string, unknown> = {};

  for (const table of BACKUP_TABLES) {
    const columns = table === 'employees' ? EMPLOYEE_COLUMNS : '*';
    const { data, error } = await supabase.from(table).select(columns).order('created_at');

    if (error) return sendError(`Export failed for table ${table}: ${error.message}`, 500);
    result[table] = data || [];
  }

  result._meta = {
    exported_at: new Date().toISOString(),
    tables: BACKUP_TABLES,
    version: 1,
  };

  return sendSuccess(result);
}
