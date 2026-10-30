// Load env vars before anything else (use a .env.test if present, fallback to .env)
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.test') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Set test environment so the server does not bind a port
process.env.NODE_ENV = 'test';

const { createClient } = require('@supabase/supabase-js');

let testSupabaseClient = null;

/**
 * Returns a Supabase client configured for the test environment.
 * Uses the service role key so tests can read/write freely.
 */
function getTestSupabase() {
  if (!testSupabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      // Return a stub so tests that don't need a real connection still run
      return null;
    }

    testSupabaseClient = createClient(url, key);
  }
  return testSupabaseClient;
}

/**
 * Delete all rows from a table — useful for cleaning up integration test data.
 * @param {string} tableName
 */
async function clearTable(tableName) {
  const client = getTestSupabase();
  if (!client) return;
  const { error } = await client.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw new Error(`clearTable(${tableName}) failed: ${error.message}`);
}

module.exports = { getTestSupabase, clearTable };
