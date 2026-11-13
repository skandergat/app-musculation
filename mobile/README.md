# LIFTELY

LIFTELY is a multilingual fitness tracking app built with Expo / React Native and a Flask API.

## Architecture

- **Mobile:** Expo Router / React Native, TypeScript.
- **API:** Flask + Gunicorn, hosted on Render as `liftely-api`.
- **Production database:** Supabase PostgreSQL 17.11, region `eu-west-2` (London).
- **Local development database:** SQLite by default. PostgreSQL is selected only when `LIFTELY_DATABASE_URL` is configured.
- **Transactional email:** Brevo API over HTTPS. Production action links use `LIFTELY_PUBLIC_BASE_URL`.

The production API is live at `https://liftely-api.onrender.com`. Requests to this URL use production accounts and workout data. Do not use it for destructive testing.

## Mobile app (Windows / PowerShell)

From the repository root:

```powershell
cd .\mobile
npm ci
npx.cmd expo start --clear
```

If the phone cannot reach the PC over the local network, start Expo with the tunnel option:

```powershell
npx.cmd expo start --clear --tunnel
```

Tunnel mode can be slower. If PowerShell blocks `npx.ps1`, use `npx.cmd`.

Type checking and diagnostics:

```powershell
npx.cmd tsc --noEmit
npx.cmd expo-doctor
```

## API configuration

Create `mobile/.env.local` to choose the backend API URL.

For local backend testing, replace the example IP with the PC's current LAN IP:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.100:5001
```

The phone and PC must be on the same local network when using the LAN address; do not use `localhost` from the phone.

For production, use:

```dotenv
EXPO_PUBLIC_API_URL=https://liftely-api.onrender.com
```

**Warning:** requests to the production API can create or modify real production accounts, sessions, templates and workout history. Use a separate test environment for destructive or integration tests.

## Backend (Windows / PowerShell)

From the repository root, create the virtual environment once and install dependencies:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
.\.venv\Scripts\python.exe .\backend\app.py
```

The local API listens on port 5001. If `LIFTELY_DATABASE_URL` is not set, the backend uses the local SQLite database at `backend/musculation.db`.

For PostgreSQL integration tests, use an isolated test database and a protected environment variable. Never point local test scripts at production Supabase.

## Repository structure

- `mobile/src/app/`: Expo Router screens
- `mobile/src/context/`: authentication and localization
- `mobile/src/components/`: reusable UI
- `backend/app.py`: Flask API
- `backend/db_compat.py`: SQLite/PostgreSQL adapter
- `backend/postgres_schema.sql`: PostgreSQL schema
- `backend/migrate_sqlite_to_postgres.py`: controlled SQLite-to-PostgreSQL importer
- `backend/migration_preflight.py`: read-only schema/content preflight
- `supabase/migrations/`: versioned production migrations

## Production readiness

- The production database is Supabase PostgreSQL, not an ephemeral Render SQLite file.
- Render service `liftely-api` runs in Oregon; Supabase is in London (`eu-west-2`). This cross-region placement may increase database latency. Consider a Europe-based Render service before scaling, after planning a safe cutover.
- Render's HTTP health-check path is not configured yet; the API exposes `/health`. Configure Render's health-check path as `/health` before launch hardening.
- Production account email links use `LIFTELY_PUBLIC_BASE_URL=https://liftely-api.onrender.com`. Do not send real test messages without an explicitly approved recipient.
- Complete the verified data-controller, contact, hosting-region, email-provider, log-retention and backup-retention details in the privacy notice before store submission. See `docs/store-privacy-inventory.md`.
- Configure all credentials only in protected Render/GitHub secret stores. Never commit a real PostgreSQL URI, Brevo API key, SMTP password or Supabase key.
