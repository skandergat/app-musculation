# LIFTELY staging — operational setup

## Isolation contract
- Supabase project: `liftely-staging` (`ybwvfprbpilijbzbujiw`), region `eu-west-2`.
- Never use the production database URL, password, service key, or user data in staging.
- Keep the staging backend separate from `liftely-api`; do not change the production Render service.
- The Expo Preview profile must point only to the staging API after that API is deployed and verified.
- Keep all staging credentials in Render environment variables / EAS secrets; never commit them.

## Database bootstrap
- Apply `supabase/migrations/20261114120000_staging_initial_schema_and_lockdown.sql` only to a newly created, empty staging project.
- The schema is backend-only: RLS is enabled and `anon`, `authenticated`, and `service_role` have no direct table or sequence privileges.
- The Flask API connects with its dedicated PostgreSQL connection string; do not add permissive RLS policies to bypass the API architecture.
- Import only the public exercise catalogue (349 rows); never copy users, sessions, tokens, rate-limit records, templates, or workout history from production.

## Render staging service
- Render service created: `liftely-api-staging` (`srv-dbs5nbmc6qcc7388b550`), Free, Frankfurt, branch `chore/staging-supabase-bootstrap`, auto-deploy disabled. URL: `https://liftely-api-staging.onrender.com`.
- Build command: `pip install -r backend/requirements.txt` from repository root; start command: `gunicorn --chdir backend --bind 0.0.0.0:$PORT app:app`.
- Build command: `pip install -r requirements.txt`.
- Start command: `gunicorn --bind 0.0.0.0:$PORT app:app`.
- `LIFTELY_DATABASE_URL` currently contains a deliberately invalid placeholder so the service cannot fall back to SQLite. Replace it with the staging PostgreSQL connection string in Render's secret environment-variable UI; never use the production DSN.
- Set `LIFTELY_DB_PATH` only if required by the adapter; staging must select PostgreSQL, not a local SQLite file.
- Set `LIFTELY_PUBLIC_BASE_URL` to the staging app's public URL only when the URL is known.
- Set Render health check path to `/health`; verify `database_backend` is `postgresql` before connecting Expo Preview.

## Release gates
1. Confirm staging project is healthy and schema migration is recorded.
2. Import and verify exactly 349 exercises with expected IDs 1–349 and no account data.
3. Verify Render `/health` returns 200 and `database_backend=postgresql`.
4. Verify Preview's API URL resolves only to the staging Render service.
5. Run auth, session isolation, workout CRUD, and negative cross-account access tests.
6. Keep production deploys, production schema changes, and app-store releases out of this staging setup.