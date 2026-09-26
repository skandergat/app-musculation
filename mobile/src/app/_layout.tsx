import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Appearance, StatusBar, useColorScheme } from 'react-native';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { I18nProvider } from '@/context/I18nContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={loading || !!user}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={loading || !user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    AsyncStorage.getItem('@app_musculation_dark_mode')
      .then((value) => {
        Appearance.setColorScheme(value === 'true' ? 'dark' : 'light');
      })
      .catch(() => {});
  }, []);

  const colorScheme = useColorScheme();

  return (
    <I18nProvider>
      <AuthProvider>
        <ThemeProvider
          value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
        >
          <StatusBar
            barStyle={
              colorScheme === 'dark'
                ? 'light-content'
                : 'dark-content'
            }
          />
          <RootNavigator />
        </ThemeProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
