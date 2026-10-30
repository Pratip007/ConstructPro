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

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (isAuthError(user)) return user;

  const roleCheck = requireRole(user, 'admin');
  if (roleCheck) return roleCheck;

  const payload = await request.json();

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return sendError('Request body must be a JSON object', 400);
  }

  // Validate that any provided keys are known table names
  const unknownKeys = Object.keys(payload).filter(
    (k) => k !== '_meta' && !BACKUP_TABLES.includes(k)
  );
  if (unknownKeys.length > 0) {
    return sendError(`Unknown tables in payload: ${unknownKeys.join(', ')}`, 400);
  }

  // Validate each value is an array
  for (const table of BACKUP_TABLES) {
    if (payload[table] !== undefined && !Array.isArray(payload[table])) {
      return sendError(`Value for table '${table}' must be an array`, 400);
    }
  }

  const report: Record<string, unknown> = {};

  // Delete in reverse FK order (children before parents)
  const tablesToRestore = BACKUP_TABLES.filter((t) => payload[t]);
  for (const table of [...tablesToRestore].reverse()) {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      return sendError(`Import failed: could not clear table ${table}: ${deleteError.message}`, 500);
    }
  }

  // Insert in FK order (parents before children)
  for (const table of BACKUP_TABLES) {
    if (!payload[table]) {
      report[table] = { skipped: true };
      continue;
    }

    const rows = payload[table];

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from(table).insert(rows);

      if (insertError) {
        return sendError(`Import failed: could not insert into ${table}: ${insertError.message}`, 500);
      }
    }

    report[table] = { restored: rows.length };
  }

  return sendSuccess({
    message: 'Import completed',
    report,
    imported_at: new Date().toISOString(),
  });
}
