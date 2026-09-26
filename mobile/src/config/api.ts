const LOCAL_API_URL = 'http://192.168.100.200:5001';
const configuredApiUrl =
  process.env.EXPO_PUBLIC_API_URL?.trim() || '';

if (
  process.env.NODE_ENV === 'production' &&
  !configuredApiUrl
) {
  throw new Error(
    'EXPO_PUBLIC_API_URL must be configured for production builds.'
  );
}

if (
  process.env.NODE_ENV === 'production' &&
  !configuredApiUrl.startsWith('https://')
) {
  throw new Error(
    'Production API URL must use HTTPS.'
  );
}

export const API_URL =
  configuredApiUrl || LOCAL_API_URL;
