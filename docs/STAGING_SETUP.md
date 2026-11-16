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
- The Flask API connects with a dedicated PostgreSQL connection string; do not add permissive RLS policies to bypass the backend-only architecture.
- Import only the public exercise catalogue (349 rows); never copy users, sessions, tokens, rate-limit records, templates, or workout history from production.

## Render staging service
- Render service: `liftely-api-staging` (`srv-dbs5nbmc6qcc7388b550`), Free, Frankfurt, branch `chore/staging-supabase-bootstrap`, auto-deploy disabled.
- URL: `https://liftely-api-staging.onrender.com`.
- Root directory: repository root.
- Build command: `pip install -r backend/requirements.txt`.
- Start command: `gunicorn --chdir backend --bind 0.0.0.0:$PORT app:app`.
- Health check path must be `/health`. The current Render service configuration was observed with an empty health check path; set it in the Render Dashboard before considering this gate complete.
- The current Render logs show the database hostname resolving to an IPv6 address and failing with `Network is unreachable`. Supabase Free direct database endpoints are IPv6-only. Use the Supabase **Session pooler** (Supavisor), which is IPv4-compatible and supports persistent backends:
  - Supabase Dashboard → project `liftely-staging` → Connect → Session pooler.
  - Expected endpoint shape for region `eu-west-2`: host `aws-0-eu-west-2.pooler.supabase.com`, port `5432`, database `postgres`.
  - Username format: `postgres.ybwvfprbpilijbzbujiw` (or the exact username shown by Supabase).
  - Connection string shape: `postgresql://postgres.ybwvfprbpilijbzbujiw:[DATABASE-PASSWORD]@aws-0-eu-west-2.pooler.supabase.com:5432/postgres?sslmode=require`.
  - Copy the exact Session pooler string from the Supabase Dashboard and replace only its password placeholder. Do not use the direct host `db.ybwvfprbpilijbzbujiw.supabase.co` from Render's IPv4-only runtime.
- Set the exact Session pooler string as Render secret `LIFTELY_DATABASE_URL`. Never put the password in GitHub, this document, mobile configuration, or chat.
- Keep `LIFTELY_DB_PATH` unset in staging; PostgreSQL must be selected and there must be no SQLite fallback.
- `LIFTELY_PUBLIC_BASE_URL` should remain `https://liftely-api-staging.onrender.com`.

## Release gates
1. Confirm staging project is healthy and the schema migration is recorded.
2. Import and verify exactly 349 exercises with expected IDs 1–349 and no account data.
3. Verify Render `/health` returns 200 and `database_backend=postgresql`.
4. Verify Preview's API URL resolves only to the staging Render service.
5. Run auth, session isolation, workout CRUD, and negative cross-account access tests.
6. Keep production deploys, production schema changes, and app-store releases out of this staging setup.

## Transactional email staging (Brevo)
- Do not copy the production Brevo API key into staging. Create a separate staging API key in the owner's Brevo account.
- Configure `LIFTELY_BREVO_API_KEY` as a Render secret, `LIFTELY_EMAIL_FROM` with a verified sender, `LIFTELY_EMAIL_SENDER_NAME=LIFTELY`, and `LIFTELY_EMAIL_PROVIDER=Brevo Transactional API HTTPS` only if this is the actual provider; this value is displayed by the privacy page and must reflect reality.
- `LIFTELY_PUBLIC_BASE_URL` is the staging API URL; verify links generated in email templates before any delivery.
- After the staging PostgreSQL connection is working, test `POST /health/brevo-sandbox`. The endpoint sends a sandbox-only request with the `X-Sib-Sandbox: drop` header and a non-deliverable test recipient; it does not prove real inbox delivery.
- Do not run real registration/reset emails until a dedicated test inbox and sender are confirmed. Production email credentials and recipients must remain isolated.
