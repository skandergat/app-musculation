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
  View,
} from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/context/AuthContext';

export default function ConnexionScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const seConnecter = async () => {
    if (!email.trim() || !password) {
      Alert.alert(
        'Champs manquants',
        'Entre ton email et ton mot de passe.'
      );
      return;
    }

    try {
      setLoading(true);

      await login(email, password);

      router.replace('/');
    } catch (error: any) {
      Alert.alert(
        'Connexion impossible',
        error.message || 'Une erreur est survenue.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.contenu}>
        <Text style={styles.logo}>Musculation</Text>

        <Text style={styles.titre}>Connexion</Text>

        <Text style={styles.sousTitre}>
          Connecte-toi à ton compte pour retrouver tes séances.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#8A8A8E"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor="#8A8A8E"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

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
            <Text style={styles.boutonTexte}>Se connecter</Text>
          )}
        </Pressable>

        <View style={styles.inscriptionContainer}>
          <Text style={styles.question}>
            Pas encore de compte ?
          </Text>

          <Pressable
            onPress={() => router.push('/inscription')}
          >
            <Text style={styles.lien}>Créer un compte</Text>
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