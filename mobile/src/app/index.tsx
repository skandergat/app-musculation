import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Pressable,
  Alert,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';

// 👉 IP locale de ton PC (ipconfig → adresse IPv4).
const API_URL = 'http://192.168.100.200:5001';

type Exercice = {
  id: number;
  nom?: string;
  name?: string;
  groupe_musculaire?: string;
};

export default function ExercicesScreen() {
  const { user, logout } = useAuth();

  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  const chargerExercices = async () => {
    try {
      setErreur(null);
      const response = await fetch(`${API_URL}/exercices`);
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      const data = await response.json();
      setExercices(data);
    } catch (err: any) {
      setErreur(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    chargerExercices();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    chargerExercices();
  };

  const demanderDeconnexion = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
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

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#0A84FF" />
      </SafeAreaView>
    );
  }

  if (erreur) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.erreurTitre}>Connexion impossible</Text>
        <Text style={styles.erreurTexte}>{erreur}</Text>
        <Text style={styles.erreurAide}>
          Vérifie que le serveur Flask tourne (python app.py) et que API_URL
          pointe vers l'IP locale de ton PC, pas "localhost".
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.entete}>
        <View style={styles.enteteTexte}>
          <Text style={styles.titre}>Exercices</Text>
          {user ? (
            <Text style={styles.utilisateur}>
              Connecté en tant que {user.nom}
            </Text>
          ) : null}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.boutonDeconnexion,
            pressed && styles.boutonPresse,
          ]}
          onPress={demanderDeconnexion}
          disabled={deconnexionEnCours}
        >
          {deconnexionEnCours ? (
            <ActivityIndicator size="small" color="#FF3B30" />
          ) : (
            <Text style={styles.texteDeconnexion}>Déconnexion</Text>
          )}
        </Pressable>
      </View>

      <FlatList
        data={exercices}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.liste}
        renderItem={({ item }) => (
          <View style={styles.carte}>
            <Text style={styles.nomExercice}>{item.nom ?? item.name}</Text>
            {item.groupe_musculaire ? (
              <Text style={styles.sousTexte}>{item.groupe_musculaire}</Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.sousTexte}>Aucun exercice pour l'instant.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  entete: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  enteteTexte: {
    flex: 1,
  },
  titre: {
    fontSize: 28,
    fontWeight: '700',
  },
  utilisateur: {
    fontSize: 13,
    color: '#8A8A8E',
    marginTop: 3,
  },
  boutonDeconnexion: {
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 105,
    alignItems: 'center',
  },
  boutonPresse: {
    opacity: 0.6,
  },
  texteDeconnexion: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '600',
  },
  liste: { paddingHorizontal: 16, paddingBottom: 24 },
  carte: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  nomExercice: { fontSize: 16, fontWeight: '600', color: '#111' },
  sousTexte: { fontSize: 13, color: '#8A8A8E', marginTop: 2 },
  erreurTitre: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  erreurTexte: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 8,
  },
  erreurAide: { fontSize: 13, color: '#8A8A8E', textAlign: 'center' },
});
