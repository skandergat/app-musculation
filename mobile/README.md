# LIFTELY

LIFTELY is a multilingual fitness tracking app built with Expo / React Native and a Flask + SQLite backend.

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

Tunnel mode can be slower. If PowerShell blocks `npx.ps1`, use `npx.cmd` as shown above.

Type checking and Expo diagnostics:

```powershell
cd .\mobile
npx.cmd tsc --noEmit
npx.cmd expo-doctor
```

## Backend (Windows / PowerShell)

From the repository root, create the virtual environment once and install the backend dependencies:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
.\.venv\Scripts\python.exe .\backend\app.py
```

The local API listens on port 5001.

## API configuration

Create `mobile/.env.local` to choose the backend API URL. For a local backend, replace the example IP with the PC's current LAN IP address:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.100:5001
```

The phone and PC must be on the same local network when using the LAN address; do not use `localhost` from the phone.

The hosted API is `https://liftely-api.onrender.com`. Requests to it use the hosted database, not a local development database.

## Repository structure

- `mobile/src/app/`: Expo Router screens
- `mobile/src/context/`: authentication and localization
- `mobile/src/components/`: reusable UI
- `backend/app.py`: Flask API and SQLite schema/catalog
- `init_db.py`: database initialization helper

## Production readiness

- The backend's public privacy notice is available at `/privacy`; the account deletion information page is at `/account-deletion`.
- Configure `backend/.env.example` values in the hosting provider's environment; never commit real credentials.
- Complete the verified data-controller, contact, hosting-region, and retention details in the privacy notice before store submission. Use `docs/store-privacy-inventory.md` for the Apple App Privacy and Google Play Data safety forms.
- The backend uses SQLite. On Render, the database file must live on persistent storage to survive restarts and deploys. Confirm that `LIFTELY_DB_PATH` points to the mounted persistent path before storing real users' data; an ephemeral filesystem can lose accounts and workout history.
