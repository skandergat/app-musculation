import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_URL, apiFetch } from '@/config/api';
import { useI18n } from '@/context/I18nContext';


type User = {
  id: number;
  nom: string;
  email: string;
  date_creation: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    nom: string,
    email: string,
    password: string
  ) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  authNotice: string | null;
  clearAuthNotice: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'liftely.auth.token';
const LEGACY_TOKEN_KEY = '@app_musculation_token';
const USER_KEY = '@app_musculation_user';

async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(TOKEN_KEY);
  }

  const secureToken = await SecureStore.getItemAsync(TOKEN_KEY);
  if (secureToken) {
    return secureToken;
  }

  // Migrate a token from the old AsyncStorage location once.
  const legacyToken = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacyToken) {
    await SecureStore.setItemAsync(TOKEN_KEY, legacyToken);
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
    return legacyToken;
  }

  return null;
}

async function setStoredToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return;
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function removeStoredToken(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY).catch(() => {});
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const { t } = useI18n();

  const chargerSession = useCallback(async () => {
    try {
      const tokenSauvegarde = await getStoredToken();
      const userSauvegarde = await AsyncStorage.getItem(USER_KEY);

      if (!tokenSauvegarde || !userSauvegarde) {
        return;
      }

      let utilisateurSauvegarde: User;
      try {
        utilisateurSauvegarde = JSON.parse(userSauvegarde) as User;
      } catch {
        await removeStoredToken();
        await AsyncStorage.removeItem(USER_KEY);
        return;
      }

      // Afficher immédiatement la session locale : l'écran de démarrage
      // ne doit jamais dépendre d'un serveur LAN potentiellement indisponible.
      setToken(tokenSauvegarde);
      setUser(utilisateurSauvegarde);

      // Validation distante en arrière-plan. Une panne réseau ne déconnecte
      // pas l'utilisateur ; seule une réponse 401 invalide réellement la session.
      try {
        const response = await apiFetch(
          API_URL + '/auth/me',
          {
            headers: {
              Authorization: 'Bearer ' + tokenSauvegarde,
            },
          },
          5000,
        );

        if (response.ok) {
          const data = await response.json();
          if (data?.user) {
            await AsyncStorage.setItem(
              USER_KEY,
              JSON.stringify(data.user)
            );
            setUser(data.user);
          }
        } else if (response.status === 401) {
          await removeStoredToken();
          await AsyncStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        console.log(
          'Serveur indisponible, session locale conservée:',
          error
        );
      }
    } catch (error) {
      console.log('Erreur chargement session:', error);
      await removeStoredToken();
      await AsyncStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The session bootstrap awaits storage and network before updating state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void chargerSession();
  }, [chargerSession]);

  const sauvegarderSession = async (
    nouveauToken: string,
    nouvelUtilisateur: User
  ) => {
    await setStoredToken(nouveauToken);
    await AsyncStorage.setItem(
      USER_KEY,
      JSON.stringify(nouvelUtilisateur)
    );

    setToken(nouveauToken);
    setUser(nouvelUtilisateur);
  };

  const login = async (email: string, password: string) => {
    const response = await apiFetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(t('invalidCredentials'));
      }
      if (response.status === 403 && data.code === 'email_not_verified') {
        throw new Error(t('emailNotVerified'));
      }
      throw new Error(data.error || t('connectionImpossible'));
    }

    setAuthNotice(null);
    await sauvegarderSession(data.token, data.user);
  };

  const register = async (
    nom: string,
    email: string,
    password: string
  ) => {
    const response = await apiFetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom: nom.trim(),
        email: email.trim().toLowerCase(),
        password,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 409) {
        throw new Error(t('emailAlreadyUsed'));
      }
      if (data.code === 'email_delivery_failed') {
        throw new Error(t('emailDeliveryFailed'));
      }
      if (data.code === 'email_rate_limited') {
        throw new Error(t('emailRateLimited'));
      }
      throw new Error(data.error || t('creationImpossible'));
    }
  };

  const demanderLienEmail = async (
    endpoint: string,
    email: string,
  ): Promise<void> => {
    const response = await apiFetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    if (!response.ok) throw new Error(t('connectionImpossible'));
  };

  const resendVerificationEmail = (email: string) =>
    demanderLienEmail('/auth/verify-email-request', email);

  const requestPasswordReset = (email: string) =>
    demanderLienEmail('/auth/password-reset-request', email);

  const deleteAccount = async (password: string) => {
    if (!token) throw new Error(t('connectionImpossible'));
    const response = await apiFetch(`${API_URL}/auth/account`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        response.status === 403
          ? t('invalidPassword')
          : data.error || t('connectionImpossible')
      );
    }

    await removeStoredToken();
    await AsyncStorage.removeItem(USER_KEY);
    setAuthNotice('accountDeleted');
    setToken(null);
    setUser(null);
  };

  const logout = async () => {
    try {
      if (token) {
        await apiFetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.log('Erreur déconnexion:', error);
    } finally {
      await removeStoredToken();
      await AsyncStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        resendVerificationEmail,
        requestPasswordReset,
        deleteAccount,
        authNotice,
        clearAuthNotice: () => setAuthNotice(null),
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth doit être utilisé à l’intérieur de AuthProvider'
    );
  }

  return context;
}
