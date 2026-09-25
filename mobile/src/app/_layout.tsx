import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Slot, Redirect } from 'expo-router';
import { useColorScheme, View, ActivityIndicator } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { I18nProvider } from '@/context/I18nContext';

SplashScreen.preventAutoHideAsync();

function Navigation() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#0A84FF" />
      </View>
    );
  }

  if (!user) {
    return (
      <>
        <Slot />
        <Redirect href="/connexion" />
      </>
    );
  }

  return <AppTabs />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <I18nProvider>
      <AuthProvider>
      <ThemeProvider
        value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
      >
        <AnimatedSplashOverlay />
        <Navigation />
      </ThemeProvider>
      </AuthProvider>
    </I18nProvider>
  );
}