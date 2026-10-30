const { createClient } = require('@supabase/supabase-js');

const isTest = process.env.NODE_ENV === 'test';

// In test mode we allow placeholder values so the module loads without a real
// Supabase instance. In all other environments the missing vars are a hard error
// so production never starts silently misconfigured.
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  (isTest ? 'http://localhost:54321' : undefined);
if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required');

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  (isTest
    ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.placeholder'
    : undefined);
if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  (isTest
    ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder'
    : undefined);
if (!ANON_KEY) throw new Error('SUPABASE_ANON_KEY is required');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);

module.exports = { supabase, supabaseAnon };
