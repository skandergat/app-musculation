# LIFTELY

LIFTELY is a multilingual fitness tracking app built with Expo / React Native and a Flask + SQLite backend.

## Mobile app

From the repository root:

```powershell
cd mobile
npm install
npx.cmd expo start --clear

If PowerShell blocks `npx.ps1`, use `npx.cmd` as shown above. Add `--tunnel` only if the phone cannot reach the PC over the local network; tunnel mode can be slower.
```

For type checking:

```powershell
cd mobile
npx tsc --noEmit
```

For Expo diagnostics:

```powershell
cd mobile
npx expo-doctor
```

## Backend

From the repository root:

```powershell
cd C:\Users\sonia\Desktop\app-musculation
.\.venv\Scripts\Activate.ps1
python backend\app.py
```

The local development API listens on port 5001.

## API configuration

Create `mobile/.env.local` when you need to override the API URL. The sample LAN address below is only an example: use the PC's current local IP address, and keep the phone and PC on the same network when using LAN mode:

```
EXPO_PUBLIC_API_URL=http://192.168.100.200:5001
```

For a production build, use an HTTPS API URL. The currently configured hosted API is `https://liftely-api.onrender.com`; requests made to it use the hosted database, not a local development database.

## Repository structure

- `mobile/src/app/`: Expo Router routes
- `mobile/src/context/`: authentication and localization
- `mobile/src/components/`: reusable UI
- `backend/app.py`: Flask API and SQLite schema/catalog
- `init_db.py`: database initialization helper

## Development note

The current mobile app targets Expo SDK 57 and uses `expo-router/unstable-native-tabs`, which is the appropriate NativeTabs API for SDK 57.


## Account security and privacy pages

The backend serves the public privacy notice at /privacy and the account deletion request page at /account-deletion. The app also offers authenticated account deletion in Settings.

For production, configure the backend environment using backend/.env.example as a checklist. Verification, password recovery, and email-based deletion require SMTP credentials and LIFTELY_PUBLIC_BASE_URL set to the HTTPS origin of the backend service. Do not commit actual SMTP credentials.

Before release, replace the privacy notice's required controller, contact, hosting-region, and email-provider values with verified details. Use docs/store-privacy-inventory.md to complete the Apple App Privacy and Google Play Data safety forms.
