import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';

export default function MotDePasseOublieScreen() {
  const { requestPasswordReset } = useAuth();
  const { t } = useI18n();
  const dark = useColorScheme() === 'dark';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const envoyerLien = async () => {
    if (sent) {
      router.replace('/connexion');
      return;
    }
    if (!email.trim()) {
      setMessage(t('fillAllFields'));
      return;
    }
    try {
      setLoading(true);
      setMessage('');
      await requestPasswordReset(email);
      setMessage(t('resetEmailSent'));
      setSent(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, dark && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.link}>‹ {t('back')}</Text>
        </Pressable>
        <Text style={[styles.title, dark && styles.textDark]}>
          {t('forgotPassword')}
        </Text>
        <Text style={[styles.subtitle, dark && styles.mutedDark]}>
          {t('resetEmailSent')}
        </Text>
        <TextInput
          style={[styles.input, dark && styles.inputDark]}
          placeholder={t('email')}
          placeholderTextColor={dark ? '#8E8E93' : '#8A8A8E'}
          value={email}
          onChangeText={(value) => { setEmail(value); setMessage(''); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          editable={!sent}
        />
        {message ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.message,
              dark && styles.messageDark,
              sent && styles.messageSuccess,
              dark && sent && styles.messageSuccessDark,
            ]}
          >
            {message}
          </Text>
        ) : null}
        <Pressable
          style={[styles.button, loading && styles.disabled]}
          onPress={envoyerLien}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {sent ? t('loginButton') : t('sendResetLink')}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  containerDark: { backgroundColor: '#0B0B0D' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  back: { marginBottom: 24 },
  link: { color: '#0A84FF', fontSize: 16, fontWeight: '600' },
  title: { color: '#111111', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#8A8A8E', fontSize: 15, lineHeight: 22, marginBottom: 24 },
  mutedDark: { color: '#A1A1A6' },
  textDark: { color: '#FFFFFF' },
  input: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111111',
    marginBottom: 12,
  },
  inputDark: { backgroundColor: '#1C1C1E', color: '#FFFFFF' },
  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#0A84FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  disabled: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  message: { color: '#C62828', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  messageSuccess: { color: '#237A3B' },
  messageDark: { color: '#FF8A80' },
  messageSuccessDark: { color: '#63D985' },
});
