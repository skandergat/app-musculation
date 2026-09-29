import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View, useColorScheme, Linking,
} from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { API_URL } from '@/config/api';

export default function InscriptionScreen() {
  const { register } = useAuth();
  const { t } = useI18n();
  const dark = useColorScheme() === 'dark';

  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageSuccess, setMessageSuccess] = useState(false);
  const [creationReussie, setCreationReussie] = useState(false);

  const creerCompte = async () => {
    if (creationReussie) {
      router.replace('/connexion');
      return;
    }
    if (!nom.trim() || !email.trim() || !password || !confirmation) {
      setMessage(t('fillAllFields'));
      setMessageSuccess(false);
      return;
    }

    if (password.length < 8) {
      setMessage(t('passwordMin'));
      setMessageSuccess(false);
      return;
    }

    if (password !== confirmation) {
      setMessage(t('passwordsMismatch'));
      setMessageSuccess(false);
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      await register(nom, email, password);
      setMessage(t('verifyEmailSent'));
      setMessageSuccess(true);
      setCreationReussie(true);
    } catch (error: any) {
      setMessage(error.message || t('unexpectedError'));
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
        <Pressable
          style={styles.retour}
          onPress={() => router.back()}
        >
          <Text style={[styles.retourTexte, dark && styles.textDark]}>‹ {t("back")}</Text>
        </Pressable>

        <Text style={[styles.titre, dark && styles.textDark]}>{t("createAccount")}</Text>

        <Text style={[styles.sousTitre, dark && styles.mutedDark]}>
          {t("registerSubtitle")}
        </Text>

        <TextInput
          style={[styles.input, dark && styles.inputDark]}
          placeholder={t("name")}
          placeholderTextColor={dark ? '#8E8E93' : '#8A8A8E'}
          value={nom}
          onChangeText={(value) => { setNom(value); setMessage(''); }}
          autoCapitalize="words"
          editable={!creationReussie}
        />

        <TextInput
          style={[styles.input, dark && styles.inputDark]}
          placeholder={t("email")}
          placeholderTextColor={dark ? '#8E8E93' : '#8A8A8E'}
          value={email}
          onChangeText={(value) => { setEmail(value); setMessage(''); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!creationReussie}
        />

        <TextInput
          style={[styles.input, dark && styles.inputDark]}
          placeholder={t("password")}
          placeholderTextColor="#8A8A8E"
          value={password}
          onChangeText={(value) => { setPassword(value); setMessage(''); }}
          secureTextEntry
          autoCapitalize="none"
          editable={!creationReussie}
        />

        <TextInput
          style={[styles.input, dark && styles.inputDark]}
          placeholder={t("confirmPassword")}
          placeholderTextColor="#8A8A8E"
          value={confirmation}
          onChangeText={(value) => { setConfirmation(value); setMessage(''); }}
          secureTextEntry
          autoCapitalize="none"
          editable={!creationReussie}
        />

        <View style={styles.privacyNotice}>
          <Text style={[styles.question, dark && styles.mutedDark]}>
            {t('privacyNotice')}
          </Text>
          <Pressable onPress={() => {
            void Linking.openURL(API_URL + '/privacy').catch(() => {
              setMessage(t('connectionImpossible'));
              setMessageSuccess(false);
            });
          }}>
            <Text style={styles.lien}>{t('privacyPolicy')}</Text>
          </Pressable>
        </View>

        {message ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.message,
              dark && styles.messageDark,
              messageSuccess && styles.messageSuccess,
              dark && messageSuccess && styles.messageSuccessDark,
            ]}
          >
            {message}
          </Text>
        ) : null}

        <Pressable
          style={[
            styles.bouton,
            loading && styles.boutonDesactive,
          ]}
          onPress={creerCompte}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.boutonTexte}>
              {creationReussie ? t('loginButton') : t('createAccountButton')}
            </Text>
          )}
        </Pressable>

        <View style={styles.connexionContainer}>
          <Text style={[styles.question, dark && styles.mutedDark]}>
            {t("hasAccount")}
          </Text>

          <Pressable
            onPress={() => router.replace('/connexion')}
          >
            <Text style={styles.lien}>{t("loginButton")}</Text>
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
  retour: {
    marginBottom: 24,
  },
  retourTexte: {
    fontSize: 16,
    color: '#0A84FF',
    fontWeight: '600',
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
  privacyNotice: {
    alignItems: 'center',
    marginTop: 4,
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
  connexionContainer: {
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
  message: { color: '#C62828', fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 8 },
  messageSuccess: { color: '#237A3B' },
  messageDark: { color: '#FF8A80' },
  messageSuccessDark: { color: '#63D985' },
});
