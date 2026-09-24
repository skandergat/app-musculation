import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

const API_URL = 'http://192.168.100.200:5000';

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
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = '@app_musculation_token';
const USER_KEY = '@app_musculation_user';

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chargerSession();
  }, []);

  const chargerSession = async () => {
    try {
      const tokenSauvegarde = await AsyncStorage.getItem(TOKEN_KEY);
      const userSauvegarde = await AsyncStorage.getItem(USER_KEY);

      if (tokenSauvegarde && userSauvegarde) {
        const utilisateur = JSON.parse(userSauvegarde) as User;

        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${tokenSauvegarde}`,
          },
        });

        if (response.ok) {
          const data = await response.json();

          setToken(tokenSauvegarde);
          setUser(data.user);
        } else {
          await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
        }
      }
    } catch (error) {
      console.log('Erreur chargement session:', error);
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    } finally {
      setLoading(false);
    }
  };

  const sauvegarderSession = async (
    nouveauToken: string,
    nouvelUtilisateur: User
  ) => {
    await AsyncStorage.setItem(TOKEN_KEY, nouveauToken);
    await AsyncStorage.setItem(
      USER_KEY,
      JSON.stringify(nouvelUtilisateur)
    );

    setToken(nouveauToken);
    setUser(nouvelUtilisateur);
  };

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Connexion impossible');
    }

    await sauvegarderSession(data.token, data.user);
  };

  const register = async (
    nom: string,
    email: string,
    password: string
  ) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nom: nom.trim(),
        email: email.trim().toLowerCase(),
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Création du compte impossible');
    }

    await sauvegarderSession(data.token, data.user);
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.log('Erreur déconnexion:', error);
    } finally {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
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