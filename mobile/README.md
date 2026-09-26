# LIFTELY

LIFTELY is a multilingual fitness tracking app built with Expo / React Native and a Flask + SQLite backend.

## Mobile app

From the repository root:

```powershell
cd mobile
npm install
npx expo start --clear
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

Create `mobile/.env.local` when the backend is not using the default LAN address:

```
EXPO_PUBLIC_API_URL=http://192.168.100.200:5001
```

For a production build, use an HTTPS API URL instead.

## Repository structure

- `mobile/src/app/`: Expo Router routes
- `mobile/src/context/`: authentication and localization
- `mobile/src/components/`: reusable UI
- `backend/app.py`: Flask API and SQLite schema/catalog
- `init_db.py`: database initialization helper

## Development note

The current mobile app targets Expo SDK 57 and uses `expo-router/unstable-native-tabs`, which is the appropriate NativeTabs API for SDK 57.
