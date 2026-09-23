import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const API_URL = 'http://192.168.100.200:5000';

type Serie = {
  id: number;
  exercice_id: number;
  exercice_nom: string;
  poids: number;
  repetitions: number;
};

type Seance = {
  id: number;
  date_debut: string;
  date_fin: string | null;
  series: Serie[];
};

type ExerciceGroupe = {
  nom: string;
  series: Serie[];
};

const formaterDate = (iso: string) => {
  const date = new Date(iso);
  const texte = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
};

const formaterHeure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

const calculerDuree = (debut: string, fin: string) => {
  const ms = new Date(fin).getTime() - new Date(debut).getTime();
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return `${heures}h${String(reste).padStart(2, '0')}`;
};

const grouperParExercice = (series: Serie[]): ExerciceGroupe[] => {
  const groupes: ExerciceGroupe[] = [];
  series.forEach((serie) => {
    const groupe = groupes.find(
      (g) => g.nom === serie.exercice_nom
    );
    if (groupe) {
      groupe.series.push(serie);
    } else {
      groupes.push({ nom: serie.exercice_nom, series: [serie] });
    }
  });
  return groupes;
};

export default function HistoriqueScreen() {
  const [seances, setSeances] = useState<Seance[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const chargerHistorique = useCallback(async () => {
    try {
      setErreur(null);
      const response = await fetch(`${API_URL}/historique`);
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }
      const data = await response.json();
      setSeances(data);
    } catch (error: any) {
      setErreur(
        error?.message ?? 'Connexion impossible'
      );
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  }, []);

  useEffect(() => {
    chargerHistorique();
  }, [chargerHistorique]);

  const onRefresh = () => {
    setRafraichissement(true);
    chargerHistorique();
  };

  if (chargement) {
    return (
      <SafeAreaView style={styles.centre}>
        <ActivityIndicator size="large" color="#0A84FF" />
      </SafeAreaView>
    );
  }

  if (erreur) {
    return (
      <SafeAreaView style={styles.centre}>
        <Text style={styles.erreurTitre}>
          Connexion impossible
        </Text>
        <Text style={styles.erreurTexte}>{erreur}</Text>
        <Text style={styles.erreurAide}>
          Vérifie que le serveur Flask tourne (python app.py) et
          que API_URL pointe vers l'IP locale de ton PC.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.titre}>Historique</Text>

      <FlatList
        data={seances}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.liste}
        refreshControl={
          <RefreshControl
            refreshing={rafraichissement}
            onRefresh={onRefresh}
          />
        }
        ListEmptyComponent={
          <Text style={styles.videTexte}>
            Aucune séance terminée pour l'instant.
          </Text>
        }
        renderItem={({ item }) => {
          const groupes = grouperParExercice(item.series);
          const totalSeries = item.series.length;

          return (
            <View style={styles.carte}>
              <View style={styles.carteEntete}>
                <Text style={styles.date}>
                  {formaterDate(item.date_debut)}
                </Text>
                {item.date_fin ? (
                  <Text style={styles.duree}>
                    {calculerDuree(
                      item.date_debut,
                      item.date_fin
                    )}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.sousTitre}>
                {formaterHeure(item.date_debut)}
                {'  ·  '}
                {groupes.length} exercice
                {groupes.length > 1 ? 's' : ''}
                {'  ·  '}
                {totalSeries} série
                {totalSeries > 1 ? 's' : ''}
              </Text>

              {groupes.map((groupe) => (
                <View
                  key={groupe.nom}
                  style={styles.exerciceLigne}
                >
                  <Text style={styles.exerciceNom}>
                    {groupe.nom}
                  </Text>
                  <Text style={styles.exerciceDetail}>
                    {groupe.series
                      .map(
                        (s) =>
                          `${s.poids}kg × ${s.repetitions}`
                      )
                      .join('   ')}
                  </Text>
                </View>
              ))}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },

  centre: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  titre: {
    fontSize: 30,
    fontWeight: '700',
    color: '#000000',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },

  liste: { paddingHorizontal: 16, paddingBottom: 24 },

  carte: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },

  carteEntete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  date: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },

  duree: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A84FF',
  },

  sousTitre: {
    fontSize: 13,
    color: '#8A8A8E',
    marginTop: 4,
    marginBottom: 14,
  },

  exerciceLigne: {
    marginBottom: 10,
  },

  exerciceNom: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },

  exerciceDetail: {
    fontSize: 13,
    color: '#8A8A8E',
    marginTop: 2,
  },

  videTexte: {
    fontSize: 14,
    color: '#8A8A8E',
    textAlign: 'center',
    marginTop: 40,
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
