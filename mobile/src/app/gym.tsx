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
} from 'react-native';
import { router } from 'expo-router';

const API_URL = 'http://192.168.100.200:5001';

type Exercice = {
  id: number;
  nom?: string;
  name?: string;
  groupe_musculaire?: string;
};

export default function GymScreen() {
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

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
          Vérifie que le serveur Flask tourne (python app.py).
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.entete}>
        <Pressable style={styles.boutonRetour} onPress={() => router.back()}>
          <Text style={styles.retour}>‹</Text>
        </Pressable>

        <View>
          <Text style={styles.titre}>GYM</Text>
          <Text style={styles.sousTitre}>{exercices.length} exercices</Text>
        </View>
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
            <View style={styles.numero}>
              <Text style={styles.numeroTexte}>{item.id}</Text>
            </View>

            <View style={styles.infos}>
              <Text style={styles.nomExercice}>{item.nom ?? item.name}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.vide}>Aucun exercice pour l'instant.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  boutonRetour: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  retour: {
    fontSize: 34,
    lineHeight: 36,
    color: '#111',
    marginTop: -3,
  },
  titre: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
  },
  sousTitre: {
    fontSize: 13,
    color: '#8A8A8E',
    marginTop: 1,
  },
  liste: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  carte: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  numero: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  numeroTexte: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A8A8E',
  },
  infos: {
    flex: 1,
  },
  nomExercice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  vide: {
    fontSize: 14,
    color: '#8A8A8E',
    textAlign: 'center',
    marginTop: 30,
  },
  erreurTitre: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  erreurTexte: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 8,
  },
  erreurAide: {
    fontSize: 13,
    color: '#8A8A8E',
    textAlign: 'center',
  },
});
