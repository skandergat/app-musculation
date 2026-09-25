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

export default function InscriptionScreen() {
  const { register } = useAuth();
  const { t } = useI18n();
  const dark = useColorScheme() === 'dark';

  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);

  const creerCompte = async () => {
    if (!nom.trim() || !email.trim() || !password || !confirmation) {
      Alert.alert(
        t('missingFields'),
        t('fillAllFields')
      );
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        t('passwordTitle'),
        t('passwordMin')
      );
      return;
    }

    if (password !== confirmation) {
      Alert.alert(
        t('passwordTitle'),
        t('passwordsMismatch')
      );
      return;
    }

    try {
      setLoading(true);

      await register(nom, email, password);

      router.replace('/');
    } catch (error: any) {
      Alert.alert(
        t('creationImpossible'),
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
          onChangeText={setNom}
          autoCapitalize="words"
        />

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

        <TextInput
          style={styles.input}
          placeholder={t("password")}
          placeholderTextColor="#8A8A8E"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder={t("confirmPassword")}
          placeholderTextColor="#8A8A8E"
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry
          autoCapitalize="none"
        />

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
            <Text style={styles.boutonTexte}>{t("createAccountButton")}</Text>
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
});