import Constants from 'expo-constants';

const configuredApiUrl =
  (process.env.EXPO_PUBLIC_API_URL?.trim() || '').replace(/\/+$/, '');

const expoHostUri = Constants.expoConfig?.hostUri?.trim() || '';
const expoHost = expoHostUri
  ? expoHostUri.replace(/^\[|\]$/g, '').replace(/:\d+$/, '')
  : '';

const localApiUrl = expoHost
  ? `http://${expoHost}:5001`
  : 'http://127.0.0.1:5001';

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
  configuredApiUrl || localApiUrl;

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
