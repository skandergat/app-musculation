import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { API_URL } from '@/config/api';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';


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
    year: 'numeric',
  });

  return texte.charAt(0).toUpperCase() + texte.slice(1);
};

const formaterHeure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

const calculerDuree = (debut: string, fin: string, minuteLabel: string) => {
  const ms =
    new Date(fin).getTime() -
    new Date(debut).getTime();

  const minutes = Math.max(
    0,
    Math.round(ms / 60000)
  );

  if (minutes < 60) {
    return `${minutes} ${minuteLabel}`;
  }

  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;

  return `${heures}h${String(reste).padStart(2, '0')}`;
};

const grouperParExercice = (
  series: Serie[]
): ExerciceGroupe[] => {
  const groupes: ExerciceGroupe[] = [];

  series.forEach((serie) => {
    const groupe = groupes.find(
      (g) => g.nom === serie.exercice_nom
    );

    if (groupe) {
      groupe.series.push(serie);
    } else {
      groupes.push({
        nom: serie.exercice_nom,
        series: [serie],
      });
    }
  });

  return groupes;
};

export default function HistoriqueScreen() {
  const { token } = useAuth();
  const { t } = useI18n();
  const dark = useColorScheme() === 'dark';
  const [seances, setSeances] = useState<Seance[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichissement, setRafraichissement] =
    useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [seanceSelectionnee, setSeanceSelectionnee] =
    useState<Seance | null>(null);

  const chargerHistorique = useCallback(async () => {
    try {
      setErreur(null);

      const response = await fetch(
        `${API_URL}/historique`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Erreur ${response.status}`
        );
      }

      const data = await response.json();

      setSeances(data);
    } catch (error: any) {
      setErreur(
        error?.message ?? t('connectionImpossible')
      );
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  }, [token, t]);

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
        <ActivityIndicator
          size="large"
          color="#0A84FF"
        />
      </SafeAreaView>
    );
  }

  if (erreur) {
    return (
      <SafeAreaView style={styles.centre}>
        <Text style={styles.erreurTitre}>
          {t('connectionImpossible')}
        </Text>

        <Text style={styles.erreurTexte}>
          {erreur}
        </Text>

        <Text style={styles.erreurAide}>
          Vérifie que le serveur Flask tourne
          (python app.py) et que API_URL pointe
          vers l'IP locale de ton PC.
        </Text>
      </SafeAreaView>
    );
  }

  /*
   * ÉCRAN DÉTAIL
   */
  if (seanceSelectionnee) {
    const groupes = grouperParExercice(
      seanceSelectionnee.series
    );

    return (
      <SafeAreaView style={[styles.container, dark && styles.containerDark]}>
        <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

        <View style={styles.detailHeader}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              setSeanceSelectionnee(null)
            }
            style={styles.boutonRetour}
          >
            <Text style={styles.flecheRetour}>
              ‹
            </Text>

            <Text style={styles.retourTexte}>
              Historique
            </Text>
          </TouchableOpacity>

          <Text style={[styles.detailTitre, dark && styles.textDark]}>
            {t('sessionDetails')}
          </Text>
        </View>

        <FlatList
          data={groupes}
          keyExtractor={(item) => item.nom}
          contentContainerStyle={
            styles.detailListe
          }
          ListHeaderComponent={
            <View style={[styles.resumeCarte, dark && styles.cardDark]}>
              <Text style={[styles.dateDetail, dark && styles.textDark]}>
                {formaterDate(
                  seanceSelectionnee.date_debut
                )}
              </Text>

              <Text style={styles.infoDetail}>
                {formaterHeure(
                  seanceSelectionnee.date_debut
                )}

                {seanceSelectionnee.date_fin
                  ? `  ·  ${calculerDuree(
                      seanceSelectionnee.date_debut,
                      seanceSelectionnee.date_fin,
                      t('durationMinutes')
                    )}`
                  : ''}
              </Text>

              <View style={styles.statsLigne}>
                <View style={styles.stat}>
                  <Text style={[styles.statValeur, dark && styles.textDark]}>
                    {groupes.length}
                  </Text>

                  <Text style={[styles.statLabel, dark && styles.mutedDark]}>
                    {t('exercisesLabel')}
                  </Text>
                </View>

                <View style={styles.separateur} />

                <View style={styles.stat}>
                  <Text style={styles.statValeur}>
                    {seanceSelectionnee.series.length}
                  </Text>

                  <Text style={styles.statLabel}>
                    {t('setsLabel')}
                  </Text>
                </View>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.exerciceCarte, dark && styles.cardDark]}>
              <Text style={[styles.exerciceNom, dark && styles.textDark]}>
                {item.nom}
              </Text>

              {item.series.map(
                (serie, index) => (
                  <View
                    key={serie.id}
                    style={styles.serieLigne}
                  >
                    <View
                      style={
                        styles.numeroCercle
                      }
                    >
                      <Text
                        style={
                          styles.numeroTexte
                        }
                      >
                        {index + 1}
                      </Text>
                    </View>

                    <Text
                      style={styles.seriePoids}
                    >
                      {serie.poids} kg
                    </Text>

                    <Text
                      style={
                        styles.multiplication
                      }
                    >
                      ×
                    </Text>

                    <Text
                      style={styles.serieReps}
                    >
                      {serie.repetitions} {t('reps')}
                    </Text>
                  </View>
                )
              )}
            </View>
          )}
          ListFooterComponent={
            <View style={styles.finDetail}>
              <Text style={styles.finDetailTexte}>
                {t('endOfWorkout')}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  /*
   * ÉCRAN HISTORIQUE
   */
  return (
    <SafeAreaView style={[styles.container, dark && styles.containerDark]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      <Text style={[styles.titre, dark && styles.textDark]}>
        {t('history')}
      </Text>

      <FlatList
        data={seances}
        keyExtractor={(item) =>
          String(item.id)
        }
        contentContainerStyle={styles.liste}
        refreshControl={
          <RefreshControl
            refreshing={rafraichissement}
            onRefresh={onRefresh}
          />
        }
        ListEmptyComponent={
          <Text style={styles.videTexte}>
            {t('noCompletedWorkouts')}
          </Text>
        }
        renderItem={({ item }) => {
          const groupes =
            grouperParExercice(item.series);

          const totalSeries =
            item.series.length;

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setSeanceSelectionnee(item);
              }}
            >
              <View style={[styles.carte, dark && styles.cardDark]}>
                <View
                  style={styles.carteEntete}
                >
                  <Text style={[styles.date, dark && styles.mutedDark]}>
                    {formaterDate(
                      item.date_debut
                    )}
                  </Text>

                  {item.date_fin ? (
                    <Text style={styles.duree}>
                      {calculerDuree(
                        item.date_debut,
                        item.date_fin,
                        t('durationMinutes')
                      )}
                    </Text>
                  ) : null}
                </View>

                <Text
                  style={styles.sousTitre}
                >
                  {formaterHeure(
                    item.date_debut
                  )}
                  {'  ·  '}
                  {groupes.length} {t('exercisesLabel')}
                  {'  ·  '}
                  {totalSeries} {t('setsLabel')}
                </Text>

                {groupes
                  .slice(0, 3)
                  .map((groupe) => (
                    <View
                      key={groupe.nom}
                      style={
                        styles.exerciceLigne
                      }
                    >
                      <Text
                        style={[
                          styles.exerciceNom,
                          dark && styles.textDark,
                        ]}
                      >
                        {groupe.nom}
                      </Text>

                      <Text
                        style={[
                          styles.exerciceDetail,
                          dark && styles.mutedDark,
                        ]}
                      >
                        {groupe.series
                          .map(
                            (serie) =>
                              `${serie.poids}kg × ${serie.repetitions}`
                          )
                          .join('   ')}
                      </Text>
                    </View>
                  ))}

                {groupes.length > 3 && (
                  <Text
                    style={
                      styles.plusExercices
                    }
                  >
                    + {groupes.length - 3} {t('otherExercises')}
                  </Text>
                )}

                <View
                  style={styles.ouvrirLigne}
                >
                  <Text
                    style={styles.ouvrirTexte}
                  >
                    {t('seeDetails')}
                  </Text>

                  <Text
                    style={styles.fleche}
                  >
                    ›
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  containerDark: { backgroundColor: '#0B0B0D' },
  cardDark: { backgroundColor: '#1C1C1E' },
  textDark: { color: '#FFFFFF' },
  mutedDark: { color: '#A1A1A6' },

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

  liste: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

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
    flex: 1,
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

  plusExercices: {
    fontSize: 13,
    color: '#8A8A8E',
    marginTop: 2,
    marginBottom: 8,
  },

  ouvrirLigne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 12,
    marginTop: 4,
  },

  ouvrirTexte: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A84FF',
  },

  fleche: {
    fontSize: 24,
    color: '#0A84FF',
    lineHeight: 24,
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

  detailHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },

  boutonRetour: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },

  flecheRetour: {
    fontSize: 36,
    color: '#0A84FF',
    lineHeight: 36,
    marginRight: 4,
  },

  retourTexte: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A84FF',
  },

  detailTitre: {
    fontSize: 30,
    fontWeight: '700',
    color: '#000000',
  },

  detailListe: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  resumeCarte: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 22,
  },

  dateDetail: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },

  infoDetail: {
    fontSize: 14,
    color: '#8A8A8E',
    marginTop: 6,
  },

  statsLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
  },

  stat: {
    flex: 1,
    alignItems: 'center',
  },

  statValeur: {
    fontSize: 25,
    fontWeight: '700',
    color: '#000000',
  },

  statLabel: {
    fontSize: 13,
    color: '#8A8A8E',
    marginTop: 3,
  },

  separateur: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E5EA',
  },

  exerciceCarte: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },

  exerciceNom: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },

  serieLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F2',
  },

  numeroCercle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  numeroTexte: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },

  seriePoids: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },

  multiplication: {
    fontSize: 16,
    color: '#8A8A8E',
    marginHorizontal: 8,
  },

  serieReps: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },

  finDetail: {
    alignItems: 'center',
    paddingVertical: 24,
  },

  finDetailTexte: {
    fontSize: 13,
    color: '#8A8A8E',
  },
});