/**
 * Seed the default admin user.
 *
 * Reads credentials from environment variables:
 *   ADMIN_EMAIL           — email for the admin account (required)
 *   DEFAULT_ADMIN_PASSWORD — password for the admin account (required)
 *
 * Idempotent: does nothing if an admin profile already exists.
 *
 * Usage:
 *   node seeds/seed_admin.js
 */

require('dotenv').config();

const { supabase } = require('../src/config/supabase');

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.DEFAULT_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('ERROR: ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD env vars are required.');
    process.exit(1);
  }

  // Check if an admin profile already exists
  const { data: existingAdmin, error: checkError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (checkError) {
    console.error('Failed to query profiles:', checkError.message);
    process.exit(1);
  }

  if (existingAdmin) {
    console.log('Admin profile already exists — skipping seed.');
    return;
  }

  // Create the Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'Admin', role: 'admin', display_id: 'ADM-001' },
  });

  if (authError) {
    console.error('Failed to create auth user:', authError.message);
    process.exit(1);
  }

  const authUid = authData.user.id;

  // Insert profiles row
  const { error: profileError } = await supabase.from('profiles').insert({
    auth_uid: authUid,
    display_id: 'ADM-001',
    name: 'Admin',
    role: 'admin',
    assigned_site_id: null,
  });

  if (profileError) {
    console.error('Failed to insert admin profile:', profileError.message);
    // Attempt to clean up auth user
    await supabase.auth.admin.deleteUser(authUid);
    process.exit(1);
  }

  console.log(`Admin user seeded successfully: ${email} (ADM-001)`);
}

seedAdmin().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
