import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View, useColorScheme,
} from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';

export default function ConnexionScreen() {
  const { login } = useAuth();
  const { t, language } = useI18n();
  const dark = useColorScheme() === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const visibilityLabel = passwordVisible
    ? { fr: 'Masquer le mot de passe', en: 'Hide password', ar: 'إخفاء كلمة المرور', de: 'Passwort verbergen' }[language]
    : { fr: 'Afficher le mot de passe', en: 'Show password', ar: 'إظهار كلمة المرور', de: 'Passwort anzeigen' }[language];

  const seConnecter = async () => {
    if (!email.trim() || !password) {
      Alert.alert(
        t('missingFields'),
        t('fillAllFields')
      );
      return;
    }

    try {
      setLoading(true);

      await login(email, password);

      router.replace('/');
    } catch (error: any) {
      Alert.alert(
        t('connectionImpossible'),
        error.message || t('unexpectedError')
      );
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
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <View style={styles.passwordField}>
          <TextInput
            style={[styles.input, styles.passwordInput, dark && styles.inputDark]}
            placeholder={t("password")}
            placeholderTextColor={dark ? '#8E8E93' : '#8A8A8E'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            autoCapitalize="none"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visibilityLabel}
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={styles.passwordToggle}
            hitSlop={8}
          >
            <Text style={styles.passwordToggleText}>{passwordVisible ? '🙈' : '👁️'}</Text>
          </Pressable>
        </View>

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
  passwordField: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 56,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 12,
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordToggleText: {
    fontSize: 18,
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
});
