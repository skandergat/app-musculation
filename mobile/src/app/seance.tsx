import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vibration } from 'react-native';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  useColorScheme,
} from 'react-native';

const API_URL = 'http://192.168.100.200:5001';

const SON_FIN_TIMER =
  'https://raw.githubusercontent.com/TaterTotterson/microWakeWords/main/wakeSounds/notification-ding.wav';

const TIMER_SERIE_KEY = '@app_musculation_timer_serie';
const TIMER_EXERCICE_KEY = '@app_musculation_timer_exercice';

type Serie = {
  id: number;
  poids: string;
  reps: string;
  terminee: boolean;
  sauvegardee?: boolean;
};

type PreviousSerie = {
  poids: number;
  repetitions: number;
};

type Exercice = {
  id: number;
  nom: string;
  muscle: string;
  backendId?: number;
  series: Serie[];
};

const exercicesInitiaux: Exercice[] = [
  {
    id: 1,
    backendId: 1,
    nom: 'Développé couché',
    muscle: 'Pectoraux',
    series: [
      { id: 1, poids: '40', reps: '12', terminee: false },
      { id: 2, poids: '40', reps: '12', terminee: false },
      { id: 3, poids: '40', reps: '10', terminee: false },
    ],
  },
  {
    id: 2,
    backendId: 2,
    nom: 'Développé incliné haltères',
    muscle: 'Pectoraux',
    series: [
      { id: 1, poids: '30', reps: '12', terminee: false },
      { id: 2, poids: '30', reps: '10', terminee: false },
      { id: 3, poids: '30', reps: '10', terminee: false },
    ],
  },
  {
    id: 3,
    backendId: 15,
    nom: 'Extensions triceps poulie',
    muscle: 'Triceps',
    series: [
      { id: 1, poids: '20', reps: '12', terminee: false },
      { id: 2, poids: '20', reps: '12', terminee: false },
      { id: 3, poids: '20', reps: '10', terminee: false },
    ],
  },
];

export default function SeanceScreen() {
  const { token, user } = useAuth();
  const { t } = useI18n();
  const dark = useColorScheme() === 'dark';

  const sonFinTimer = useAudioPlayer(SON_FIN_TIMER);

  const [exercices, setExercices] = useState<Exercice[]>(
    exercicesInitiaux.map((exercice) => ({
      ...exercice,
      series: exercice.series.map((serie) => ({
        ...serie,
      })),
    }))
  );

  const [menuExercices, setMenuExercices] = useState(false);
  const [seanceId, setSeanceId] = useState<number | null>(null);
  const [chargement, setChargement] = useState(true);
  const [terminee, setTerminee] = useState(false);
  const [terminaisonEnCours, setTerminaisonEnCours] = useState(false);

  const [previous, setPrevious] = useState<
    Record<string, PreviousSerie[]>
  >({});

  const [exercicesDisponibles, setExercicesDisponibles] = useState<
    { nom: string; muscle: string; backendId: number }[]
  >([]);

  const [tempsReposSerie, setTempsReposSerie] = useState(60);
  const [tempsReposExercice, setTempsReposExercice] = useState(120);
  const [timerActif, setTimerActif] = useState(false);
  const [tempsRestant, setTempsRestant] = useState(0);
  const [timerType, setTimerType] = useState<'serie' | 'exercice' | null>(null);
  const [timerExerciceId, setTimerExerciceId] = useState<number | null>(null);
  const [timerSerieId, setTimerSerieId] = useState<number | null>(null);
  const [minuteursTermines, setMinuteursTermines] = useState<Set<string>>(new Set());

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
    }).catch((error) => {
      console.error(t('error') + ' :', error);
    });
  }, []);

  useEffect(() => {
    const chargerPreferencesTimer = async () => {
      if (!user?.id) {
        return;
      }

      try {
        const [serieSauvegardee, exerciceSauvegarde] =
          await Promise.all([
            AsyncStorage.getItem(
              `${TIMER_SERIE_KEY}_${user.id}`
            ),
            AsyncStorage.getItem(
              `${TIMER_EXERCICE_KEY}_${user.id}`
            ),
          ]);

        if (serieSauvegardee) {
          const valeur = parseInt(serieSauvegardee, 10);

          if (Number.isFinite(valeur) && valeur > 0) {
            setTempsReposSerie(valeur);
          }
        }

        if (exerciceSauvegarde) {
          const valeur = parseInt(
            exerciceSauvegarde,
            10
          );

          if (Number.isFinite(valeur) && valeur > 0) {
            setTempsReposExercice(valeur);
          }
        }
      } catch (error) {
        console.error(
          'Erreur chargement préférences timer :',
          error
        );
      }
    };

    chargerPreferencesTimer();
  }, [user?.id]);

  useEffect(() => {
    if (!timerActif) {
      return;
    }

    const interval = setInterval(() => {
      setTempsRestant((ancien) => {
        if (ancien <= 1) {
          clearInterval(interval);

          setTimerActif(false);

          const timerTermineKey =
            timerType === 'serie'
              ? 'serie-' + timerExerciceId + '-' + timerSerieId
              : 'exercice-' + timerExerciceId;

          setMinuteursTermines((anciens) => {
            const nouveau = new Set(anciens);
            nouveau.add(timerTermineKey);
            return nouveau;
          });

          setTimerType(null);
          setTimerExerciceId(null);
          setTimerSerieId(null);

          Vibration.vibrate(500);

          try {
            sonFinTimer.seekTo(0);
            sonFinTimer.play();
          } catch (error) {
            console.error('Erreur lecture son timer :', error);
          }

          return 0;
        }

        return ancien - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActif, sonFinTimer]);

  const chargerExercicesDisponibles = async () => {
    try {
      const response = await fetch(`${API_URL}/exercices?categorie=all`);

      if (!response.ok) {
        throw new Error(t('connectionImpossible'));
      }

      const data = await response.json();

      setExercicesDisponibles(
        data.map((e: any) => ({
          nom: e.nom,
          muscle: e.groupe_musculaire ?? '',
          backendId: e.id,
        }))
      );
    } catch (error) {
      console.error(
        'Erreur chargement exercices disponibles :',
        error
      );
    }
  };

  const chargerPrevious = async (exercice: Exercice) => {
    try {
      if (!exercice.backendId) {
        return;
      }

      const response = await fetch(
        `${API_URL}/exercices/${exercice.backendId}/previous`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return;
      }

      const data: PreviousSerie[] = await response.json();

      setPrevious((ancien) => ({
        ...ancien,
        [exercice.nom]: data,
      }));
    } catch (error) {
      console.error('Erreur chargement Previous :', error);
    }
  };

  const demarrerSeance = async () => {
    try {
      const response = await fetch(`${API_URL}/seances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Impossible de démarrer la séance');
      }

      const data = await response.json();

      setSeanceId(data.seance_id);
      setChargement(false);

      console.log('Séance créée avec ID :', data.seance_id);
    } catch (error) {
      console.error('Erreur démarrage séance :', error);

      setChargement(false);

      Alert.alert(
        'Erreur',
        'Impossible de contacter le serveur Flask.'
      );
    }
  };

  useEffect(() => {
    demarrerSeance();
    chargerExercicesDisponibles();

    exercicesInitiaux.forEach((exercice) => {
      chargerPrevious(exercice);
    });
  }, []);

  const ajouterExercice = async (
    nom: string,
    muscle: string,
    backendId: number
  ) => {
    const nouvelExercice: Exercice = {
      id: Date.now(),
      backendId,
      nom,
      muscle,
      series: [
        {
          id: 1,
          poids: '0',
          reps: '10',
          terminee: false,
        },
        {
          id: 2,
          poids: '0',
          reps: '10',
          terminee: false,
        },
        {
          id: 3,
          poids: '0',
          reps: '10',
          terminee: false,
        },
      ],
    };

    setExercices((anciens) => [
      ...anciens,
      nouvelExercice,
    ]);

    setMenuExercices(false);

    await chargerPrevious(nouvelExercice);
  };

  const ajouterSerie = (exerciceId: number) => {
    setExercices((anciens) =>
      anciens.map((exercice) => {
        if (exercice.id !== exerciceId) {
          return exercice;
        }

        const derniereSerie =
          exercice.series[exercice.series.length - 1];

        const nouvelleSerie: Serie = {
          id: exercice.series.length + 1,
          poids: derniereSerie?.poids || '0',
          reps: derniereSerie?.reps || '10',
          terminee: false,
        };

        return {
          ...exercice,
          series: [
            ...exercice.series,
            nouvelleSerie,
          ],
        };
      })
    );
  };

  const supprimerSerie = (
    exerciceId: number,
    serieId: number
  ) => {
    setExercices((anciens) =>
      anciens.map((exercice) => {
        if (exercice.id !== exerciceId) {
          return exercice;
        }

        if (exercice.series.length <= 1) {
          Alert.alert(
            'Impossible',
            'Un exercice doit garder au moins une série.'
          );

          return exercice;
        }

        const nouvellesSeries = exercice.series
          .filter((serie) => serie.id !== serieId)
          .map((serie, index) => ({
            ...serie,
            id: index + 1,
          }));

        return {
          ...exercice,
          series: nouvellesSeries,
        };
      })
    );
  };

  const modifierPoids = (
    exerciceId: number,
    serieId: number,
    poids: string
  ) => {
    setExercices((anciens) =>
      anciens.map((exercice) => {
        if (exercice.id !== exerciceId) {
          return exercice;
        }

        return {
          ...exercice,
          series: exercice.series.map((serie) =>
            serie.id === serieId
              ? {
                  ...serie,
                  poids,
                  sauvegardee: false,
                }
              : serie
          ),
        };
      })
    );
  };

  const modifierReps = (
    exerciceId: number,
    serieId: number,
    reps: string
  ) => {
    setExercices((anciens) =>
      anciens.map((exercice) => {
        if (exercice.id !== exerciceId) {
          return exercice;
        }

        return {
          ...exercice,
          series: exercice.series.map((serie) =>
            serie.id === serieId
              ? {
                  ...serie,
                  reps,
                  sauvegardee: false,
                }
              : serie
          ),
        };
      })
    );
  };

  const sauvegarderSerie = async (
    exercice: Exercice,
    serie: Serie
  ) => {
    if (!seanceId) {
      Alert.alert(
        'Erreur',
        'La séance n’a pas encore été créée.'
      );

      return false;
    }

    try {
      const exercicesResponse = await fetch(
        `${API_URL}/exercices`
      );

      if (!exercicesResponse.ok) {
        throw new Error(
          t('connectionImpossible')
        );
      }

      const exercicesBackend =
        await exercicesResponse.json();

      const exerciceBackend =
        exercicesBackend.find(
          (item: any) =>
            item.nom === exercice.nom
        );

      if (!exerciceBackend) {
        Alert.alert(
          t('exerciseNotFound'),
          `${exercice.nom} n'existe pas encore dans la base Flask.`
        );

        return false;
      }

      const response = await fetch(
        `${API_URL}/seances/${seanceId}/series`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            exercice_id: exerciceBackend.id,
            poids: parseFloat(serie.poids) || 0,
            repetitions: parseInt(serie.reps, 10) || 0,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          'Impossible de sauvegarder la série'
        );
      }

      console.log(
        'Série sauvegardée :',
        exercice.nom,
        serie.poids,
        serie.reps
      );

      return true;
    } catch (error) {
      console.error(
        'Erreur sauvegarde série :',
        error
      );

      Alert.alert(
        'Erreur',
        'La série n’a pas pu être sauvegardée.'
      );

      return false;
    }
  };


  const modifierTempsReposSerie = (delta: number) => {
    const base =
      timerActif && timerType === 'serie'
        ? tempsRestant
        : tempsReposSerie;

    const nouveauTemps = Math.max(15, base + delta);

    setTempsRestant(nouveauTemps);
    setTempsReposSerie(nouveauTemps);

    if (user?.id) {
      AsyncStorage.setItem(
        `${TIMER_SERIE_KEY}_${user.id}`,
        String(nouveauTemps)
      ).catch((error) =>
        console.error(
          'Erreur sauvegarde timer série :',
          error
        )
      );
    }
  };

  const modifierTempsReposExercice = (delta: number) => {
    const base =
      timerActif && timerType === 'exercice'
        ? tempsRestant
        : tempsReposExercice;

    const nouveauTemps = Math.max(15, base + delta);

    setTempsRestant(nouveauTemps);
    setTempsReposExercice(nouveauTemps);

    if (user?.id) {
      AsyncStorage.setItem(
        `${TIMER_EXERCICE_KEY}_${user.id}`,
        String(nouveauTemps)
      ).catch((error) =>
        console.error(
          'Erreur sauvegarde timer exercice :',
          error
        )
      );
    }
  };

  const afficherTemps = (
    type: 'serie' | 'exercice',
    exerciceId: number,
    serieId?: number
  ) => {
    if (
      timerActif &&
      timerType === type &&
      timerExerciceId === exerciceId &&
      (type === 'exercice' || timerSerieId === serieId)
    ) {
      return tempsRestant;
    }

    const timerTermineKey =
      type === 'serie'
        ? 'serie-' + exerciceId + '-' + serieId
        : 'exercice-' + exerciceId;

    if (minuteursTermines.has(timerTermineKey)) {
      return 0;
    }

    return type === 'serie'
      ? tempsReposSerie
      : tempsReposExercice;
  };

  const terminerSerie = async (
    exerciceId: number,
    serieId: number
  ) => {
    const exercice = exercices.find(
      (item) => item.id === exerciceId
    );

    if (!exercice) {
      return;
    }

    const serie = exercice.series.find(
      (item) => item.id === serieId
    );

    if (!serie) {
      return;
    }

    if (serie.terminee) {
      setExercices((anciens) =>
        anciens.map((item) => {
          if (item.id !== exerciceId) {
            return item;
          }

          return {
            ...item,
            series: item.series.map((s) =>
              s.id === serieId
                ? {
                    ...s,
                    terminee: false,
                  }
                : s
            ),
          };
        })
      );

      return;
    }

    const sauvegardeReussie =
      await sauvegarderSerie(
        exercice,
        serie
      );

    if (!sauvegardeReussie) {
      return;
    }

    setExercices((anciens) =>
      anciens.map((item) => {
        if (item.id !== exerciceId) {
          return item;
        }

        return {
          ...item,
          series: item.series.map((s) =>
            s.id === serieId
              ? {
                  ...s,
                  terminee: true,
                  sauvegardee: true,
                }
              : s
          ),
        };
      })
    );

    const toutesLesSeriesTerminees =
      exercice.series.every((s) =>
        s.id === serieId ? true : s.terminee
      );

    const indexExercice = exercices.findIndex(
      (item) => item.id === exerciceId
    );

    const exerciceSuivantExiste =
      indexExercice >= 0 &&
      indexExercice < exercices.length - 1;

    if (
      toutesLesSeriesTerminees &&
      exerciceSuivantExiste
    ) {
      setMinuteursTermines((anciens) => {
        const nouveau = new Set(anciens);
        nouveau.delete('exercice-' + exerciceId);
        return nouveau;
      });

      setTempsRestant(tempsReposExercice);
      setTimerType('exercice');
      setTimerExerciceId(exerciceId);
      setTimerSerieId(null);
      setTimerActif(true);
    } else {
      setMinuteursTermines((anciens) => {
        const nouveau = new Set(anciens);
        nouveau.delete('serie-' + exerciceId + '-' + serieId);
        return nouveau;
      });

      setTempsRestant(tempsReposSerie);
      setTimerType('serie');
      setTimerExerciceId(exerciceId);
      setTimerSerieId(serieId);
      setTimerActif(true);
    }
  };

  const terminerSeance = async () => {
    if (terminaisonEnCours) {
      return;
    }

    if (!seanceId) {
      Alert.alert(
        'Erreur',
        t('noActiveWorkout')
      );

      return;
    }

    try {
      setTerminaisonEnCours(true);

      const ancienneSeanceId = seanceId;

      const response = await fetch(
        `${API_URL}/seances/${ancienneSeanceId}/terminer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          t('unableFinishWorkout')
        );
      }

      console.log(
        'Séance terminée :',
        ancienneSeanceId
      );

      setTimerActif(false);
      setTempsRestant(0);
      setTimerType(null);
      setTimerExerciceId(null);
      setTimerSerieId(null);
      setMinuteursTermines(new Set());

      const exercicesReset =
        exercicesInitiaux.map(
          (exercice) => ({
            ...exercice,
            series: exercice.series.map(
              (serie) => ({
                ...serie,
                terminee: false,
                sauvegardee: false,
              })
            ),
          })
        );

      setExercices(exercicesReset);
      setMenuExercices(false);
      setChargement(true);

      const nouvelleSeanceResponse =
        await fetch(`${API_URL}/seances`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

      if (!nouvelleSeanceResponse.ok) {
        throw new Error(
          t('unableStartNew')
        );
      }

      const nouvelleSeance =
        await nouvelleSeanceResponse.json();

      setSeanceId(
        nouvelleSeance.seance_id
      );

      await Promise.all(
        exercicesReset.map((exercice) =>
          chargerPrevious(exercice)
        )
      );

      setTerminee(false);
      setChargement(false);

      console.log(
        'Nouvelle séance créée avec ID :',
        nouvelleSeance.seance_id
      );

      Alert.alert(
        t('workoutFinished'),
        t('workoutSavedNewReady')
      );
    } catch (error) {
      console.error(
        t('error') + ' :',
        error
      );

      setChargement(false);

      Alert.alert(
        'Erreur',
        t('unableFinishWorkout')
      );
    } finally {
      setTerminaisonEnCours(false);
    }
  };

  if (chargement) {
    return (
      <SafeAreaView style={[styles.container, dark && styles.containerDark]}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.chargement}>
          <Text style={styles.chargementTexte}>
            {t('startup')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.contenu}
      >
        <Text style={[styles.titre, dark && styles.textDark]}>
          {t('workout')}
        </Text>

        <Text style={[styles.sousTitre, dark && styles.mutedDark]}>
          {t('todaysWorkout')}
        </Text>

        {exercices.map((exercice) => (
          <View
            key={exercice.id}
            style={styles.exerciceBloc}
          >
            <View
              style={styles.exerciceCarte}
            >
              <Text style={styles.exercice}>
                {exercice.nom}
              </Text>

              <Text style={styles.muscle}>
                {exercice.muscle}
              </Text>
            </View>

            <View style={styles.headerSeries}>
              <Text style={styles.headerTexte}>
                {t('set')}
              </Text>

              <Text
                style={
                  styles.headerPrevious
                }
              >
                {t('previous')}
              </Text>

              <Text style={styles.headerTexte}>
                {t('weight')}
              </Text>

              <Text style={styles.headerTexte}>
                {t('reps')}
              </Text>

              <Text style={styles.headerTexte}>
                ✓
              </Text>
            </View>

            {exercice.series.map((serie) => (
              <View key={serie.id}>
                <View
                  style={[
                    styles.serie,
                    serie.terminee &&
                      styles.serieTerminee,
                  ]}
                >
                  <Text style={styles.numero}>
                    {serie.id}
                  </Text>

                  <Text style={styles.previous}>
                    {previous[
                      exercice.nom
                    ]?.[serie.id - 1]
                      ? `${previous[exercice.nom][serie.id - 1].poids} kg × ${previous[exercice.nom][serie.id - 1].repetitions}`
                      : '—'}
                  </Text>

                  <TextInput
                    style={styles.input}
                    value={serie.poids}
                    keyboardType="numeric"
                    editable={!terminee}
                    onChangeText={(texte) =>
                      modifierPoids(
                        exercice.id,
                        serie.id,
                        texte
                      )
                    }
                  />

                  <TextInput
                    style={styles.input}
                    value={serie.reps}
                    keyboardType="numeric"
                    editable={!terminee}
                    onChangeText={(texte) =>
                      modifierReps(
                        exercice.id,
                        serie.id,
                        texte
                      )
                    }
                  />

                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      serie.terminee &&
                        styles.checkboxActive,
                    ]}
                    disabled={terminee}
                    onPress={() =>
                      terminerSerie(
                        exercice.id,
                        serie.id
                      )
                    }
                  >
                    {serie.terminee && (
                      <Text style={styles.check}>
                        ✓
                      </Text>
                    )}
                  </TouchableOpacity>

                  {!serie.terminee && (
                    <TouchableOpacity
                      style={styles.supprimerSerie}
                      disabled={terminee}
                      onPress={() =>
                        Alert.alert(
                          t('deleteSet'),
                          t('deleteSetQuestion'),
                          [
                            {
                              text: 'Annuler',
                              style: 'cancel',
                            },
                            {
                              text: t('delete'),
                              style: 'destructive',
                              onPress: () =>
                                supprimerSerie(
                                  exercice.id,
                                  serie.id
                                ),
                            },
                          ]
                        )
                      }
                    >
                      <Text style={styles.supprimerSerieTexte}>
                        ×
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.timerCompact}>
                  <TouchableOpacity
                    style={styles.timerBouton}
                    onPress={() => modifierTempsReposSerie(-15)}
                  >
                    <Text style={styles.timerBoutonTexte}>
                      −15s
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.timerValeurBloc}>
                    <Text style={styles.timerCompactTitre}>
                      {t('rest')}
                    </Text>
                    <Text style={styles.timerCompactValeur}>
                      {Math.floor(
                        afficherTemps('serie', exercice.id, serie.id) / 60
                      )
                        .toString()
                        .padStart(2, '0')}
                      :
                      {(afficherTemps('serie', exercice.id, serie.id) % 60)
                        .toString()
                        .padStart(2, '0')}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.timerBouton}
                    onPress={() => modifierTempsReposSerie(15)}
                  >
                    <Text style={styles.timerBoutonTexte}>
                      +15s
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={
                styles.boutonAjouterSerie
              }
              disabled={terminee}
              onPress={() =>
                ajouterSerie(
                  exercice.id
                )
              }
            >
              <Text
                style={
                  styles.boutonAjouterTexte
                }
              >
                + Ajouter une série
              </Text>
            </TouchableOpacity>


          

          </View>
        ))}



        <TouchableOpacity
          style={
            styles.boutonAjouterExercice
          }
          disabled={terminee}
          onPress={() =>
            setMenuExercices(
              !menuExercices
            )
          }
        >
          <Text
            style={
              styles.boutonAjouterExerciceTexte
            }
          >
            ＋ AJOUTER UN EXERCICE
          </Text>
        </TouchableOpacity>

        {menuExercices && !terminee && (
          <View style={styles.menu}>
            <Text style={styles.menuTitre}>
              {t('chooseExercise')}
            </Text>

            {exercicesDisponibles.map(
              (exercice) => (
                <TouchableOpacity
                  key={`${exercice.backendId}-${exercice.nom}`}
                  style={
                    styles.optionExercice
                  }
                  onPress={() =>
                    ajouterExercice(
                      exercice.nom,
                      exercice.muscle,
                      exercice.backendId
                    )
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.optionNom
                      }
                    >
                      {exercice.nom}
                    </Text>

                    <Text
                      style={
                        styles.optionMuscle
                      }
                    >
                      {exercice.muscle}
                    </Text>
                  </View>

                  <Text style={styles.plus}>
                    ＋
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.boutonTerminer,
            terminaisonEnCours &&
              styles.boutonTerminerDesactive,
          ]}
          disabled={terminaisonEnCours}
          onPress={terminerSeance}
        >
          <Text
            style={
              styles.boutonTerminerTexte
            }
          >
            {terminaisonEnCours
              ? t('saving').toUpperCase()
              : t('finishWorkout').toUpperCase()}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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

  contenu: {
    padding: 20,
    paddingBottom: 50,
  },

  chargement: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chargementTexte: {
    fontSize: 16,
    color: '#8A8A8E',
  },

  titre: {
    fontSize: 30,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },

  sousTitre: {
    fontSize: 15,
    color: '#8A8A8E',
    marginBottom: 24,
  },

  exerciceBloc: {
    marginBottom: 28,
  },

  exerciceCarte: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },

  exercice: {
    fontSize: 21,
    fontWeight: '700',
    color: '#000000',
  },

  muscle: {
    fontSize: 14,
    color: '#8A8A8E',
    marginTop: 5,
  },

  headerSeries: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 8,
  },

  headerTexte: {
    width: 50,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#8A8A8E',
  },

  headerPrevious: {
    width: 90,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#8A8A8E',
  },

  previous: {
    width: 90,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A8E',
  },

  serie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 8,
  },

  serieTerminee: {
    opacity: 0.6,
  },

  numero: {
    width: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },

  input: {
    width: 60,
    height: 42,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    padding: 0,
  },

  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxActive: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },

  check: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  supprimerSerie: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  supprimerSerieTexte: {
    color: '#FF3B30',
    fontSize: 25,
    fontWeight: '400',
    lineHeight: 27,
  },

  timerCompact: {
    width: '100%',
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    borderRadius: 9,
    paddingHorizontal: 4,
    marginTop: 2,
    marginBottom: 10,
  },

  timerBouton: {
    width: 72,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  timerBoutonTexte: {
    color: '#0A84FF',
    fontSize: 12,
    fontWeight: '700',
  },

  timerValeurBloc: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  timerCompactTitre: {
    color: '#AEAEB2',
    fontSize: 11,
    fontWeight: '600',
  },

  timerCompactValeur: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  boutonAjouterSerie: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },

  boutonAjouterTexte: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },

  boutonAjouterExercice: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#D1D1D6',
  },

  boutonAjouterExerciceTexte: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A84FF',
  },

  menu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 12,
    padding: 10,
  },

  menuTitre: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    padding: 12,
    marginBottom: 4,
  },

  optionExercice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },

  optionNom: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },

  optionMuscle: {
    fontSize: 13,
    color: '#8A8A8E',
    marginTop: 3,
  },

  plus: {
    fontSize: 24,
    color: '#0A84FF',
  },

  boutonTerminer: {
    backgroundColor: '#0A84FF',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 30,
  },

  boutonTerminerDesactive: {
    opacity: 0.6,
  },

  boutonTerminerTexte: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});