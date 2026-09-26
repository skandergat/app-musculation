const LOCAL_API_URL = 'http://192.168.100.200:5001';

// Set EXPO_PUBLIC_API_URL for production builds. The local URL is kept only
// as the development fallback so the current local setup keeps working.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || LOCAL_API_URL;
