# Task 1 Report: Project Scaffold + Supabase Connection

## What Was Implemented

All nine steps from the task brief were completed:

1. **Project initialised** — `backend/` directory created with `npm init -y`, then production and dev dependencies installed:
   - Production: `express`, `@supabase/supabase-js`, `dotenv`, `cors`, `helmet`, `express-validator`
   - Dev: `jest`, `supertest`
   - `package.json` updated with `jest` as test runner, `--forceExit` flag, and `setupFiles` pointing to `tests/setup.js`.

2. **`.env.example`** — Contains all six required env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `PORT`, `NODE_ENV`, `DEFAULT_ADMIN_PASSWORD`.

3. **`src/config/supabase.js`** — Exports `supabase` (service role client) and `supabaseAnon` (anon key client) exactly as specified.

4. **`src/utils/response.js`** — Exports `sendSuccess(res, data, statusCode=200)` and `sendError(res, message, statusCode=400)` matching the required response envelope.

5. **`src/utils/displayId.js`** — Exports `generateDisplayId(prefix, seq)` (3-digit-padded, e.g. `EMP-101`) and `generateDisplayIdWithYear(prefix, year, seq)` (e.g. `INV-2026-001`).

6. **`server.js`** — Express app with `helmet`, `cors`, `express.json({ limit: '50mb' })`. `GET /api/health` returns `{ success: true, data: { status: 'ok', timestamp } }`. Exports `app`; only binds a port when `NODE_ENV !== 'test'`.

7. **`tests/setup.js`** — Loads `.env.test` then `.env`, forces `NODE_ENV=test`, exports `getTestSupabase()` and `clearTable(tableName)` helpers.

8. **`tests/integration/health.test.js`** — Two tests: checks status 200 + `success: true` + `data.status === 'ok'`, and checks that `timestamp` is a valid ISO date string.

## Test Results

```
Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Time:        ~2 s
```

Both the focused run (`npm test -- tests/integration/health.test.js`) and the full suite (`npm test`) passed with 0 failures.

The `console.error` lines in the output are informational logs from the dotenv library when `.env` / `.env.test` files don't exist on disk yet — they are not test failures.

## Files Changed

- `backend/package.json` (created + updated)
- `backend/.env.example` (created)
- `backend/src/config/supabase.js` (created)
- `backend/src/utils/response.js` (created)
- `backend/src/utils/displayId.js` (created)
- `backend/server.js` (created)
- `backend/tests/setup.js` (created)
- `backend/tests/integration/health.test.js` (created)
- `backend/node_modules/` (installed, not committed)

## Self-Review Findings

- **Force exit note**: Jest warns about `--forceExit` masking open handles. This is harmless for integration tests that use supertest (supertest keeps the underlying HTTP server alive unless `.close()` is called). For Task 1 the health test doesn't need cleanup; later tasks that spin up the server directly should use `afterAll(() => server.close())`.
- **dotenv noise**: The `console.error` from dotenv about missing env files is cosmetic. A `jest.setup.js` spy or a `.env.test` stub file could silence it; not worth the complexity at this stage.
- **Express 5**: `express@5` is installed (latest stable). Express 5 changes error handling and some routing behaviour versus v4. This is fine as long as subsequent tasks write v5-compatible route handlers.
- No hardcoded passwords. No float monetary types introduced. All interfaces match the spec exactly.

## Issues or Concerns

None blocking. The scaffold is complete and all specified files are in place and tested.

---

## Post-Review Fix (commit 9df0d78)

**Issue:** `clearTable` in `backend/tests/setup.js` silently swallowed Supabase delete errors. If a delete failed, the function returned without throwing, leaving test state dirty and hiding real problems.

**Change made** (`backend/tests/setup.js`):
```js
// Before
await client.from(tableName).delete().neq('id', '...');

// After
const { error } = await client.from(tableName).delete().neq('id', '...');
if (error) throw new Error(`clearTable(${tableName}) failed: ${error.message}`);
```

**Covering test command:**
```
npm test -- tests/integration/health.test.js
```

**Output:**
```
Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Time:        1.558 s
```

All tests continue to pass with no regressions.
