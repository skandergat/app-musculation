import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Appearance,
  Platform,
  useColorScheme as useSystemColorScheme,
} from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

const DARK_MODE_KEY = '@app_musculation_dark_mode';

type ColorScheme = 'light' | 'dark';

type ColorSchemePreference = {
  colorScheme: ColorScheme;
  darkMode: boolean;
  setDarkMode: (enabled: boolean) => Promise<void>;
};

const ColorSchemeContext = createContext<ColorSchemePreference | null>(null);

export function ColorSchemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useSystemColorScheme();
  const [preference, setPreference] = useState<ColorScheme | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(DARK_MODE_KEY)
      .then((value) => {
        if (!active) return;
        if (value === null && Platform.OS === 'web') {
          setPreference(null);
        } else {
          setPreference(value === 'true' ? 'dark' : 'light');
        }
      })
      .catch(() => {
        if (active) setPreference(Platform.OS === 'web' ? null : 'light');
      });

    return () => {
      active = false;
    };
  }, []);

  const colorScheme =
    preference ?? (systemColorScheme === 'dark' ? 'dark' : 'light');

  const setDarkMode = useCallback(async (enabled: boolean) => {
    const nextScheme: ColorScheme = enabled ? 'dark' : 'light';
    setPreference(nextScheme);
    await AsyncStorage.setItem(DARK_MODE_KEY, String(enabled));

    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') {
        document.documentElement.style.colorScheme = nextScheme;
      }
    } else {
      Appearance.setColorScheme?.(nextScheme);
    }
  }, []);

  const value = useMemo(
    () => ({
      colorScheme,
      darkMode: colorScheme === 'dark',
      setDarkMode,
    }),
    [colorScheme, setDarkMode],
  );

  return (
    <ColorSchemeContext.Provider value={value}>
      {children}
    </ColorSchemeContext.Provider>
  );
}

export function useColorSchemePreference() {
  const value = useContext(ColorSchemeContext);
  if (!value) {
    throw new Error(
      'useColorSchemePreference must be used inside ColorSchemeProvider.',
    );
  }
  return value;
}

export function useAppColorScheme(): ColorScheme {
  return useColorSchemePreference().colorScheme;
}
