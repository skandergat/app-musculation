import Constants from 'expo-constants';

const configuredApiUrl =
  (process.env.EXPO_PUBLIC_API_URL?.trim() || '').replace(/\/+$/, '');

const appEnvironment =
  process.env.EXPO_PUBLIC_APP_ENV?.trim() || 'development';

const expoHostUri = Constants.expoConfig?.hostUri?.trim() || '';
const expoHost = expoHostUri
  ? expoHostUri.replace(/^\[|\]$/g, '').replace(/:\d+$/, '')
  : '';

const localApiUrl = expoHost
  ? `http://${expoHost}:5001`
  : 'http://127.0.0.1:5001';

const isProductionBuild = process.env.NODE_ENV === 'production';
const isPreviewBuild = appEnvironment === 'preview';
const productionApiHost = 'liftely-api.onrender.com';

if (isProductionBuild && !configuredApiUrl) {
  throw new Error(
    'EXPO_PUBLIC_API_URL must be configured for production and preview builds.',
  );
}

if (
  isProductionBuild &&
  !configuredApiUrl.startsWith('https://')
) {
  throw new Error('Production and preview API URLs must use HTTPS.');
}

if (isPreviewBuild) {
  if (!configuredApiUrl) {
    throw new Error(
      'Preview builds require a dedicated staging EXPO_PUBLIC_API_URL.',
    );
  }

  let previewHost = '';
  try {
    previewHost = new URL(configuredApiUrl).hostname.toLowerCase();
  } catch {
    throw new Error('Preview EXPO_PUBLIC_API_URL must be a valid HTTPS URL.');
  }

  if (previewHost === productionApiHost) {
    throw new Error(
      'Preview builds cannot use the production LIFTELY API. Configure a dedicated staging backend.',
    );
  }
}

export const API_URL = configuredApiUrl || localApiUrl;

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
          "s. Vérifiez que Flask est lancé et que l'adresse API est correcte.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
