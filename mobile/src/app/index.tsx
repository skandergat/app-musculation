import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

const API_URL = 'http://192.168.100.200:5001';

type Exercice = {
  id: number;
  nom?: string;
  name?: string;
};

export default function HomeScreen() {
  const [gymOuvert, setGymOuvert] = useState(false);
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const chargerExercices = async () => {
    try {
      setErreur(null);

      const response = await fetch(`${API_URL}/exercices`);

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      const data = await response.json();
      setExercices(data);
    } catch (err: any) {
      setErreur(err?.message ?? 'Erreur de connexion');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const ouvrirGym = () => {
    setGymOuvert(true);

    if (exercices.length === 0) {
      setLoading(true);
      chargerExercices();
    }
  };

  const fermerGym = () => {
    setGymOuvert(false);
  };

  const actualiser = () => {
    setRefreshing(true);
    chargerExercices();
  };

  if (gymOuvert) {
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
          <Pressable style={styles.boutonRetourErreur} onPress={fermerGym}>
            <Text style={styles.retour}>‹</Text>
          </Pressable>

          <Text style={styles.erreurTitre}>Connexion impossible</Text>
          <Text style={styles.erreurTexte}>{erreur}</Text>
          <Text style={styles.erreurAide}>
            Vérifie que le serveur Flask tourne avec python app.py.
          </Text>

          <Pressable style={styles.boutonReessayer} onPress={chargerExercices}>
            <Text style={styles.texteReessayer}>Réessayer</Text>
          </Pressable>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.entete}>
          <Pressable style={styles.boutonRetour} onPress={fermerGym}>
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
            <RefreshControl refreshing={refreshing} onRefresh={actualiser} />
          }
          contentContainerStyle={styles.liste}
          renderItem={({ item }) => (
            <View style={styles.carteExercice}>
              <View style={styles.numero}>
                <Text style={styles.numeroTexte}>{item.id}</Text>
              </View>

              <Text style={styles.nomExercice}>
                {item.nom ?? item.name ?? 'Exercice'}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.vide}>Aucun exercice pour l'instant.</Text>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.contenu}>
        <Text style={styles.titreHome}>Home</Text>
        <Text style={styles.sousTitreHome}>Choisis ton entraînement</Text>

        <Pressable
          style={({ pressed }) => [
            styles.carteGym,
            pressed && styles.presse,
          ]}
          onPress={ouvrirGym}
        >
          <View style={styles.icone}>
            <Text style={styles.iconeTexte}>GYM</Text>
          </View>

          <View style={styles.texteCarte}>
            <Text style={styles.titreCarte}>GYM</Text>
            <Text style={styles.descriptionCarte}>
              Tous les exercices de musculation
            </Text>
          </View>

          <Text style={styles.chevron}>›</Text>
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
  centered: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  contenu: {
    flex: 1,
    padding: 20,
  },
  titreHome: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111',
    marginTop: 8,
  },
  sousTitreHome: {
    fontSize: 16,
    color: '#8A8A8E',
    marginTop: 4,
    marginBottom: 24,
  },
  carteGym: {
    minHeight: 190,
    backgroundColor: '#111',
    borderRadius: 22,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  icone: {
    width: 76,
    height: 76,
    borderRadius: 18,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconeTexte: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  texteCarte: {
    flex: 1,
    marginLeft: 16,
  },
  titreCarte: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  descriptionCarte: {
    color: '#D1D1D6',
    fontSize: 14,
    marginTop: 4,
  },
  chevron: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '300',
    marginLeft: 12,
  },
  presse: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
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
  boutonRetourErreur: {
    position: 'absolute',
    top: 20,
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
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
  carteExercice: {
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
  nomExercice: {
    flex: 1,
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
    marginBottom: 18,
  },
  boutonReessayer: {
    backgroundColor: '#111',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  texteReessayer: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
