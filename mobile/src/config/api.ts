const LOCAL_API_URL = 'http://192.168.100.200:5001';
const configuredApiUrl =
  (process.env.EXPO_PUBLIC_API_URL?.trim() || '').replace(/\/+$/, '');

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

const DEFAULT_TIMEOUT_MS = 8000;

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(
        'Connexion au serveur impossible après ' +
          timeoutMs / 1000 +
          's. Vérifiez que Flask est lancé et que l\'adresse API est correcte.'
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
