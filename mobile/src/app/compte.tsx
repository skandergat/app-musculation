import { StyleSheet, Text, View, SafeAreaView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';

import { useAuth } from '@/context/AuthContext';

export default function CompteScreen() {
  const { user, logout } = useAuth();
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  const demanderDeconnexion = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeconnexionEnCours(true);
              await logout();
            } finally {
              setDeconnexionEnCours(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contenu}>
        <Text style={styles.titre}>Mon compte</Text>

        <View style={styles.carte}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTexte}>
              {user?.nom?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>

          <Text style={styles.nom}>{user?.nom ?? 'Utilisateur'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.boutonDeconnexion,
            pressed && styles.presse,
          ]}
          onPress={demanderDeconnexion}
          disabled={deconnexionEnCours}
        >
          {deconnexionEnCours ? (
            <ActivityIndicator size="small" color="#FF3B30" />
          ) : (
            <Text style={styles.texteDeconnexion}>Se déconnecter</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  contenu: {
    flex: 1,
    padding: 20,
  },
  titre: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 20,
  },
  carte: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0A84FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarTexte: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
  },
  nom: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  email: {
    fontSize: 14,
    color: '#8A8A8E',
    marginTop: 5,
  },
  boutonDeconnexion: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  texteDeconnexion: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  presse: {
    opacity: 0.6,
  },
});
