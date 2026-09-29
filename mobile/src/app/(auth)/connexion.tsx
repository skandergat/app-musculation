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
} from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { useAppColorScheme } from '@/context/ColorSchemeContext';

export default function ConnexionScreen() {
  const { login, resendVerificationEmail, authNotice, clearAuthNotice } = useAuth();
  const { t } = useI18n();
  const dark = useAppColorScheme() === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageSuccess, setMessageSuccess] = useState(false);
  const [resendPossible, setResendPossible] = useState(false);

  const messageAffiche = message || (authNotice ? t(authNotice) : '');
  const messageEstSucces = messageSuccess || Boolean(authNotice);

  const seConnecter = async () => {
    if (!email.trim() || !password) {
      setMessage(t('fillAllFields'));
      setMessageSuccess(false);
      setResendPossible(false);
      return;
    }

    try {
      setLoading(true);
      setMessage('');
      setResendPossible(false);

      await login(email, password);

      router.replace('/');
    } catch (error: any) {
      if (error.message === t('emailNotVerified')) {
        setMessage(t('emailNotVerified'));
        setMessageSuccess(false);
        setResendPossible(true);
      } else {
        setMessage(error.message || t('unexpectedError'));
        setMessageSuccess(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const renvoyerEmail = async () => {
    try {
      setLoading(true);
      await resendVerificationEmail(email);
      setMessage(t('verifyEmailSent'));
      setMessageSuccess(true);
      setResendPossible(false);
    } catch {
      setMessage(t('connectionImpossible'));
      setMessageSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, dark && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.contenu}>
        <Text style={[styles.logo, dark && styles.textDark]}>LIFTELY</Text>

        <Text style={[styles.titre, dark && styles.textDark]}>{t("login")}</Text>

        <Text style={[styles.sousTitre, dark && styles.mutedDark]}>
          {t("loginSubtitle")}
        </Text>

        <TextInput
          style={[styles.input, dark && styles.inputDark]}
          placeholder={t("email")}
          placeholderTextColor={dark ? '#8E8E93' : '#8A8A8E'}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setMessage('');
            clearAuthNotice();
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <TextInput
          style={[styles.input, dark && styles.inputDark]}
          placeholder={t("password")}
          placeholderTextColor={dark ? '#8E8E93' : '#8A8A8E'}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setMessage('');
            clearAuthNotice();
          }}
          secureTextEntry
          autoCapitalize="none"
        />

        <Pressable
          style={styles.lienMotDePasseOublie}
          onPress={() => router.push('/mot-de-passe-oublie')}
        >
          <Text style={styles.lien}>{t('forgotPassword')}</Text>
        </Pressable>

        {messageAffiche ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.message,
              dark && styles.messageDark,
              messageEstSucces && styles.messageSuccess,
              dark && messageEstSucces && styles.messageSuccessDark,
            ]}
          >
            {messageAffiche}
          </Text>
        ) : null}
        {resendPossible ? (
          <Pressable onPress={() => void renvoyerEmail()} disabled={loading}>
            <Text style={styles.lien}>{t('resendVerification')}</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={[
            styles.bouton,
            loading && styles.boutonDesactive,
          ]}
          onPress={seConnecter}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.boutonTexte}>{t("loginButton")}</Text>
          )}
        </Pressable>

        <View style={styles.inscriptionContainer}>
          <Text style={[styles.question, dark && styles.mutedDark]}>
            {t("noAccount")}
          </Text>

          <Pressable
            onPress={() => router.push('/inscription')}
          >
            <Text style={styles.lien}>{t("createAccount")}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  containerDark: { backgroundColor: '#0B0B0D' },
  textDark: { color: '#FFFFFF' },
  mutedDark: { color: '#A1A1A6' },
  inputDark: { backgroundColor: '#1C1C1E', color: '#FFFFFF' },
  contenu: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 32,
  },
  titre: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  sousTitre: {
    fontSize: 15,
    color: '#8A8A8E',
    lineHeight: 22,
    marginBottom: 24,
  },
  input: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111111',
    marginBottom: 12,
  },
  lienMotDePasseOublie: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    marginBottom: 8,
  },
  bouton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#0A84FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  boutonDesactive: {
    opacity: 0.7,
  },
  boutonTexte: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  inscriptionContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  question: {
    color: '#8A8A8E',
    fontSize: 14,
    marginBottom: 6,
  },
  lien: {
    color: '#0A84FF',
    fontSize: 15,
    fontWeight: '700',
  },
  message: { color: '#C62828', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  messageSuccess: { color: '#237A3B' },
  messageDark: { color: '#FF8A80' },
  messageSuccessDark: { color: '#63D985' },
});
