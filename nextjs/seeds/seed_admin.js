const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_EMAIL = 'admin@atr.com';
const ADMIN_PASSWORD = 'Admin@123';

async function seedAdmin() {
  console.log('Checking for existing admin...');

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log('Admin already exists — skipping.');
    return;
  }

  console.log('Creating admin auth user...');
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'Admin', role: 'admin', display_id: 'ADM-001' },
  });

  if (authError) {
    console.error('Failed to create auth user:', authError.message);
    process.exit(1);
  }

  const authUid = authData.user.id;
  console.log('Auth user created:', authUid);

  const { error: profileError } = await supabase.from('profiles').insert({
    auth_uid: authUid,
    display_id: 'ADM-001',
    name: 'Admin',
    role: 'admin',
    assigned_site_id: null,
  });

  if (profileError) {
    console.error('Failed to insert profile:', profileError.message);
    await supabase.auth.admin.deleteUser(authUid);
    process.exit(1);
  }

  console.log(`✓ Admin seeded: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

seedAdmin().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
