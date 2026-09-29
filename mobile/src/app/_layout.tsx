import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'react-native';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import {
  ColorSchemeProvider,
  useColorSchemePreference,
} from '@/context/ColorSchemeContext';
import { I18nProvider } from '@/context/I18nContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { user, loading } = useAuth();
  const { colorScheme } = useColorSchemePreference();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!loading && !!user}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>

        <Stack.Protected guard={!loading && !user}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <ColorSchemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ColorSchemeProvider>
    </I18nProvider>
  );
}
